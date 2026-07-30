# TODO — API `ffavironchrono_api`

> Refonte sécurité + fonctionnalités de l'API de chronométrage FFAviron.
> Stack : Node 22 · Express 5 · Sequelize 6 · MariaDB · Socket.io · JWT · bcrypt · Joi · Resend/Nodemailer · Swagger.

## Comment utiliser ce fichier
- Coche les cases `- [ ]` → `- [x]` au fur et à mesure.
- Chaque tâche indique **Pourquoi**, les **Fichiers** concernés et un **Fait quand** (critère de fin).
- Priorités : **P0** critique (avant prod/mobile) · **P1** sécurité importante · **P2** qualité · **P3** fonctionnalités mobile.

## Avancement global
- [x] P0 — Sécurité critique (10/10)
- [ ] P1 — Sécurité renforcée (7/9)
- [ ] P0/P1 — Chronométrage : moteur & métier aviron (14/14)
- [ ] P2 — Architecture & qualité (7/9)
- [ ] P3 — Fonctionnalités mobile & temps réel (2/8)

> ✅ **RBAC par événement** : implémenté via `requireEventRole` sur les routes mutantes/sensibles.

---

## P0 — Sécurité critique

- [x] **Implémenter le RBAC par événement**
  - Pourquoi : `UserEvent` (rôles `viewer/editor/referee/timing/organiser`) existe mais aucun middleware ne vérifie l'appartenance à l'événement ni le rôle → **IDOR généralisé**, mass ownership.
  - Fichiers : nouveau `src/middlewares/requireEventRole.js`, à brancher sur toutes les routes mutantes (`eventRoutes`, `raceRoutes`, `crewRoutes`, `racePhaseRoutes`, `timingPointRoutes`, `notificationRoutes`, `userEventRoutes`, imports…).
  - Fait quand : une mutation sur un événement échoue (403) si l'utilisateur n'a pas le rôle requis sur CET événement (admin global excepté).

- [x] **Activer helmet**
  - Pourquoi : `helmet` installé mais **jamais monté** → pas de CSP, HSTS, X-Frame-Options…
  - Fichiers : `src/app.js`.
  - Fait quand : `app.use(helmet(...))` actif avec une CSP adaptée.

- [x] **Activer le rate limiting**
  - Pourquoi : `express-rate-limit` installé mais **jamais configuré** → brute force login, énumération reset, abus `resolve-token`.
  - Fichiers : `src/app.js`, `src/routes/authRoutes.js`, `src/routes/timingPointRoutes.js`.
  - Fait quand : limiteurs sur `/auth/login`, reset password, `/timing-points/resolve-token`, + limiteur global.

- [x] **Restreindre CORS**
  - Pourquoi : `cors({ origin: "*", credentials: true })` (HTTP) et Socket.io `origin: "*"` → configuration dangereuse/incohérente.
  - Fichiers : `src/app.js`, `src/server.js`.
  - Fait quand : liste blanche d'origines via env, cohérente HTTP + WebSocket.

- [x] **Authentifier les WebSockets + retirer `assignTiming` client**
  - Pourquoi : aucune auth socket (rejoindre `event:{id}` = voir tous les chronos live) ; `socket.on("assignTiming")` permet à un client de broadcaster à toute la room.
  - Fichiers : `src/server.js`, `src/socket.js`, `src/services/socketEvents.js`.
  - Fait quand : handshake JWT obligatoire, rooms autorisées selon le rôle, plus d'émission d'assignation côté client (serveur only).

- [x] **Éliminer le mass assignment**
  - Pourquoi : `event.update(req.body)`, `Timing.create({ id, ...req.body })`, idem race/category/timingPoint → injection de champs non prévus (`role`, `status`, `is_finished`…).
  - Fichiers : `src/controllers/eventController.js` (L47), `timingController.js` (L26-28), `raceController.js` (L11), `categoryController.js` (L9), `timingPointController.js` (L73)…
  - Fait quand : chaque endpoint mutant utilise une whitelist explicite de champs.

- [x] **Ne plus renvoyer `temporary_password` en clair**
  - Pourquoi : `createUser` et `addUserToEvent` retournent le mot de passe temporaire dans le JSON.
  - Fichiers : `src/controllers/userController.js` (L129), `src/controllers/userEventController.js` (L139).
  - Fait quand : le MDP temporaire n'est envoyé que par email, jamais dans la réponse HTTP.

- [x] **Secret JWT fort + gestion des secrets**
  - Pourquoi : `.env` local contient `JWT_SECRET=ultra-secret-key` (trivial).
  - Fichiers : `.env` (prod via vault/secret manager), `.env.example`, `src/services/tokenService.js`, `test/tokenServiceJwtSecret.test.mjs`.
  - Fait quand : secret aléatoire ≥ 256 bits, non commité, injecté en prod de façon sécurisée + refus en prod si secret faible/manquant.

- [x] **Sécuriser les tokens de timing point**
  - Pourquoi : format `123-456-789` (~1M combinaisons, faible entropie) ; le champ `token` est renvoyé par `GET /timing-points/event/:id` **sans auth**, et `resolve-token` est public sans rate limit.
  - Fichiers : `src/controllers/timingPointController.js`, `src/routes/timingPointRoutes.js`, `src/models/TimingPoint.js`.
  - Fait quand : token à haute entropie, masqué dans les réponses publiques, `resolve-token` rate-limité.

- [x] **Vérifier le compte actif au login**
  - Pourquoi : pas de contrôle `status === 'active'` au login ; `ensureActiveUser` n'est appliqué que sur `GET /auth/me`.
  - Fichiers : `src/controllers/authController.js`.
  - Fait quand : un compte inactif/non vérifié ne peut pas obtenir de token.

---

## P1 — Sécurité renforcée

- [x] **Rotation + révocation des refresh tokens**
  - Pourquoi : refresh actuel scanne **toutes** les sessions actives (O(n)) et compare via bcrypt ; pas de rotation.
  - Fichiers : `src/controllers/authController.js` (L267-277), `src/models/UserSession.js`.
  - Fait quand : lookup indexé par hash/selector, rotation à chaque refresh, révocation par device.

- [x] **Politique de mot de passe forte**
  - Pourquoi : minimum 6 caractères actuellement.
  - Fichiers : `src/schemas/authSchema.js`.
  - Fait quand : min 12 caractères + complexité (idéalement zxcvbn), MDP temporaires générés via `crypto` (pas `Math.random()` dans `userEventController`).

- [x] **Middleware d'erreur global**
  - Pourquoi : chaque controller gère ses try/catch, réponses hétérogènes, erreurs Sequelize parfois exposées au client.
  - Fichiers : nouveau `src/middlewares/errorHandler.js`, `src/app.js`.
  - Fait quand : format d'erreur unifié + masquage des détails en prod + request id.

- [x] **Logger structuré + audit log**
  - Pourquoi : pas de logging structuré ni de traçabilité des actions sensibles.
  - Sous-tâches :
    - [x] Logger structuré (Pino) + `request_id` sur HTTP + erreurs
    - [x] Remplacer les `console.*` critiques (server/socket/app/controllers clés)
    - [x] Audit log (BDD) des actions sensibles (login, changement de rôle, suppression d'event, imports, gun/false start)
  - Fichiers : `src/utils/logger.js`, `src/models/AuditLog.js`, `src/services/auditLogService.js`, `docs/migrations/014_create_audit_logs.sql`.
  - Fait quand : logs structurés ; audit des actions critiques stocké (migration SQL à appliquer en BDD).

- [x] **Validation des uploads**
  - Pourquoi : multer en mémoire (10 Mo) sans validation MIME/type.
  - Fichiers : `src/middlewares/validateUpload.js`, `src/routes/eventRoutes.js`.
  - Fait quand : vérification MIME + extension + taille, rejet des types non prévus.

- [x] **Désactiver Swagger/docs en prod**
  - Pourquoi : `/docs` et `/swagger.json` publics.
  - Fichiers : `src/app.js`.
  - Fait quand : docs désactivées en prod ou protégées par auth.

- [x] **Réduire l'expiration de l'access token**
  - Pourquoi : access token valable **5h**, sans rotation ni blacklist.
  - Fichiers : `src/services/tokenService.js`.
  - Fait quand : access token 15-30 min, s'appuyant sur le refresh.

- [x] **Retirer les logs de debug de tokens**
  - Pourquoi : `verifyEmail` loggue des tokens et infos debug verbeuses.
  - Fichiers : `src/controllers/authController.js` (L373-405).
  - Fait quand : plus aucun token en logs.

- [x] **Sanitizer les contenus diffusés**
  - Pourquoi : `Notification.message` stocké en TEXT et diffusé via WebSocket sans échappement (risque XSS côté clients).
  - Fichiers : `src/controllers/notificationController.js`, `src/models/Notification.js`.
  - Fait quand : sanitization/validation du message avant stockage et diffusion.

---

## Chronométrage — moteur & métier aviron

> Le calcul des temps relatifs est solide (`src/utils/relativeTimeCalculator.js`), mais il reste des bugs de fiabilité et des fonctionnalités métier à ajouter côté serveur.
> Fichiers : `src/controllers/timingController.js`, `timingPointController.js`, `timingAssignmentController.js`, `src/models/Timing.js`, `TimingAssignment.js`, `Race.js`, `RaceCrew.js`, `src/utils/relativeTimeCalculator.js`, `src/services/socketEvents.js`.

### P0 — Bugs & fiabilité

- [x] **Ne plus filtrer les impulsions non assignées**
  - Pourquoi : `getTimingsByRace` force `required: true` sur `TimingAssignment` → les timings `pending` (temps bruts) sont invisibles au rechargement, donc perdus pour l'affectation.
  - Fichiers : `src/controllers/timingController.js` (≈ L269-280).
  - Fait quand : `GET /timings/race/:id` renvoie aussi les timings non assignés (ou un endpoint dédié `?status=pending`).

- [x] **Renvoyer `relative_time_ms` à la création**
  - Pourquoi : `createTiming` ne renvoie pas le temps relatif enrichi, contrairement au payload WebSocket → incohérence client.
  - Fichiers : `src/controllers/timingController.js`.
  - Fait quand : la réponse `POST /timings` contient le temps relatif calculé.

- [x] **Fiabiliser `getStartTiming`**
  - Pourquoi : prend le départ le plus récent (`ORDER DESC`) sans filtrer par course → mauvais départ si un équipage a plusieurs départs sur l'événement.
  - Fichiers : `src/controllers/timingController.js`, `src/utils/relativeTimeCalculator.js`.
  - Fait quand : le départ retenu est bien celui de la course concernée.

- [x] **Verrou optimiste sur l'assignation**
  - Pourquoi : deux postes peuvent assigner le même timing/couloir simultanément.
  - Fichiers : `src/controllers/timingAssignmentController.js`.
  - Fait quand : une assignation en conflit renvoie `409` (transaction/contrainte unique), pas d'écrasement silencieux.

### P1 — Fonctionnalités métier

- [x] **Gun start / synchro `Race.start_time`**
  - Fichiers : `src/controllers/raceController.js`, `src/routes/raceRoutes.js` (`POST /races/:id/gun-start`).
  - Fait quand : un endpoint pose le départ commun à tous les couloirs, met à jour `Race.start_time` et le statut, en une opération atomique.

- [x] **Faux départ**
  - Fichiers : `src/controllers/raceController.js`, `src/routes/raceRoutes.js` (`POST /races/:id/false-start`).
  - Fait quand : un endpoint annule le départ (supprime/masque les timings de départ) et remet la course en `not_started`.

- [x] **Pénalités & bonifications**
  - Fichiers : `src/models/RaceCrew.js`, `src/controllers/raceCrewController.js`, `src/routes/raceCrewRoutes.js`, `docs/migrations/016_add_adjustment_to_race_crews.sql`.
  - Fait quand : champ d'ajustement (`adjustment_ms` + motif) sur RaceCrew, pris en compte dans `getRaceResults`.

- [x] **Ex-aequo (dead heat)**
  - Fichiers : `src/utils/rankingUtils.js`, `src/controllers/raceController.js`, `test/rankingUtils.test.mjs`.
  - Fait quand : le calcul de classement de course gère les places partagées pour des temps identiques.

- [x] **Vitesse & splits par segment**
  - Fichiers : `src/utils/segmentCalculator.js`, `src/utils/relativeTimeCalculator.js`, `test/segmentCalculator.test.mjs`.
  - Fait quand : temps par segment (entre 2 points) et vitesse (`distance / temps`) exposés dans les réponses.

- [x] **Verrouillage des temps après `official`**
  - Fichiers : `src/utils/raceLock.js`, `src/controllers/timingAssignmentController.js`.
  - Fait quand : les mutations sur assignations d'une course `official` sont rejetées (423).

- [x] **Signature de validation arbitre**
  - Fichiers : `src/controllers/raceController.js` (`POST /races/:id/validate`), `src/models/Race.js`, `docs/migrations/017_add_race_validation_fields.sql`.
  - Fait quand : `Race` stocke `validated_by` + horodatage à la validation officielle.

- [x] **Traçabilité des impulsions**
  - Pourquoi : `Timing.entered_by` existe mais n'est jamais renseigné ; `device_id` prévu mais absent de `POST /timings`.
  - Fichiers : `src/controllers/timingController.js`, `src/models/Timing.js`, `docs/migrations/015_add_device_id_to_timings.sql`.
  - Fait quand : chaque timing enregistre l'auteur (user) et/ou le device.

### P2 — Formats avancés

- [x] **Double chrono / réconciliation**
  - Fichiers : `src/utils/timingReconciliationUtils.js`, `timingController.js`, `test/timingReconciliationUtils.test.mjs`.
  - Endpoints : `GET /timings/point/:id/duplicates`, `POST /timings/reconcile`.
  - Fait quand : détection des groupes d'impulsions proches et masquage des doublons avec audit log.

- [x] **Import FinishLynx (photo-finish `.lif`)**
  - Fichiers : `src/utils/finishLynxParser.js`, `src/services/finishLynxImportService.js`, `src/controllers/finishLynxController.js`, `test/finishLynxParser.test.mjs`.
  - Endpoints : `POST /races/:id/finishlynx/preview`, `POST /races/:id/finishlynx/import`.
  - Fait quand : parser LIF, mapping couloir→RaceCrew, création Timing+Assignment au point d'arrivée, statuts DNS/DNF, audit log.

- [x] **Relais chronométrés & épreuves au temps**
  - Front : `RelayLegBadge`, `TimeBasedCountdownPanel`, segments via `segmentCalculator.js` (points intermédiaires).
  - Fait quand : relais affiché par leg au chrono ; épreuves au temps avec compte à rebours côté web.

---

## P2 — Architecture & qualité

- [ ] **Découper les gros controllers/services (> 500 lignes)**
  - [ ] `src/services/importManifestation.js` (~1421)
  - [ ] `src/services/rankingService.js` (~1093)
  - [ ] `src/controllers/indoorResultController.js` (~1012)
  - [ ] `src/services/importEnduranceMerResults.js` (~928)
  - [ ] `src/controllers/importController.js` (~924)
  - [ ] `src/controllers/authController.js` (~569) — extraire session/email
  - Fait quand : responsabilités séparées, fichiers < ~400 lignes.

- [ ] **Couche service auth + repositories**
  - Pourquoi : logique auth éparpillée ; controllers accèdent directement aux models.
  - Fait quand : service auth centralisé + accès données via repositories/services.

- [ ] **Migrations Sequelize automatisées**
  - Pourquoi : 13 migrations SQL manuelles dans `docs/migrations/` → risque de désync schéma/prod.
  - Fait quand : migrations versionnées via Sequelize CLI (ou umzug), reproductibles.

- [x] **Nettoyage des dépendances**
  - [x] Déclarer `uuid` dans `package.json` (utilisé partout, non déclaré).
  - [x] Retirer le package npm `crypto` (redondant avec le module natif).
  - [x] Retirer ou utiliser `zod` (installé, jamais importé).
  - Fait quand : `package.json` propre, aucune dépendance fantôme/inutile.

- [x] **Brancher ou supprimer le code mort**
  - Pourquoi : `requireCommission.js` et `timingPointAuthMiddleware.js` jamais importés.
  - Fait quand : `requireCommission` branché sur endurance-mer ; `timingPointAuthMiddleware` supprimé (remplacé par `flexibleAuthMiddleware`).

- [x] **Activer `compression`**
  - Pourquoi : installé mais jamais utilisé.
  - Fichiers : `src/app.js`.
  - Fait quand : middleware de compression actif.

- [ ] **Uniformiser les réponses & codes HTTP**
  - Pourquoi : mélange `{ status: "error", message }` et codes incohérents.
  - Sous-tâches :
    - [x] Helper `src/utils/apiResponse.js`
    - [x] Error handler Sequelize/Multer/CORS (`src/middlewares/errorHandler.js`)
    - [x] RBAC middleware migré vers apiResponse
    - [ ] Migration progressive des controllers restants
  - Fait quand : format de réponse standardisé (succès/erreur) + codes HTTP corrects partout.

- [x] **Tests automatisés**
  - Pourquoi : `"test": "echo Error..."` → 0 test.
  - Fichiers : `test/*.test.mjs`, Vitest + Supertest (14 tests).
  - Fait quand : `npm test` passe avec tests unitaires + HTTP.

- [x] **CI**
  - Fichiers : `.gitlab-ci.yml` (jobs `test:api` + `build:front`).
  - Fait quand : CI qui teste l'API et build le front TypeScript strict.

- [ ] **Nettoyer les `console.log`**
  - Fichiers : controllers/services restants (`importManifestation.js`, `clubController.js`, etc.).
  - Sous-tâches :
    - [x] `app.js`, `server.js`, `socket.js`, `eventController`, `importController`, `timingController`, `timingAssignmentController`, `raceController`, `userEventController`
    - [ ] Services lourds (`importManifestation.js`, `sendEmail.js`, `clubController.js`…)
  - Fait quand : logs de debug remplacés par le logger partout.

---

## P3 — Fonctionnalités mobile & temps réel

- [x] **Endpoint `POST /public/timing-points/resolve-token`**
  - Pourquoi : requis par l'app mobile (token timing point → JWT à portée limitée « chrono »).
  - Fichiers : `src/routes/publicTimingPointRoutes.js`, `src/controllers/timingPointController.js`.
  - Fait quand : le mobile peut résoudre un code et obtenir un JWT ne donnant accès qu'aux opérations de chrono de cet événement/point.

- [ ] **Modèle `Device` / `PushToken` + service push**
  - Pourquoi : aucun système de push mobile (FCM/APNS) aujourd'hui.
  - Fichiers : nouveau modèle `Device`, service push (Firebase Admin / Expo Push).
  - Fait quand : un device peut enregistrer son token et recevoir des push.

- [ ] **Endpoints `/devices/register` + préférences de notifications**
  - Fait quand : opt-in/opt-out par type de notification, par utilisateur/device.

- [ ] **Push à chaque résultat**
  - Fait quand : push déclenchés sur course terminée, résultat officiel, position d'un club/participant suivi.

- [ ] **Endpoints de suivi (follow)**
  - Pourquoi : suivre un participant / un club depuis l'app.
  - Fichiers : nouveaux modèles/relations `Follow`, routes dédiées.
  - Fait quand : follow/unfollow + flux d'activité disponibles via API.

- [ ] **Endpoints mobile optimisés**
  - Fait quand : pagination, delta-sync et payloads légers sur les listes lourdes (courses, résultats).

- [x] **`device_id` dans `POST /timings`**
  - Pourquoi : traçabilité des impulsions par appareil.
  - Fichiers : `src/controllers/timingController.js`, `src/models/Timing.js`.
  - Fait quand : le champ est accepté, validé et stocké.

- [ ] **Rooms Socket.io sécurisées & uniformisées**
  - Pourquoi : formats multiples (`race_` vs `race:`, `event_` vs `event:`) et broadcast global (`io.emit`).
  - Fichiers : `src/socket.js`, `src/services/socketEvents.js`.
  - Fait quand : nommage unifié, émissions ciblées par room autorisée.
