# Guide Front - Gestion des Utilisateurs

## 📋 Table des matières
1. [Routes pour la liste des utilisateurs](#routes-pour-la-liste-des-utilisateurs)
2. [Modification du rôle principal d'un utilisateur](#modification-du-rôle-principal-dun-utilisateur)
3. [Événements associés à un utilisateur](#événements-associés-à-un-utilisateur)
4. [Création d'un utilisateur](#création-dun-utilisateur)
5. [Inscription (register) avec utilisateur existant inactif](#inscription-register-avec-utilisateur-existant-inactif)

---

## Routes pour la liste des utilisateurs

### ✅ Routes implémentées

Toutes les routes `/users/*` sont maintenant **implémentées et disponibles**. Elles sont réservées aux **administrateurs** (rôle `admin` ou `superadmin`).

#### GET `/users` - Liste des utilisateurs
- **Méthode** : `GET`
- **URL** : `/users`
- **Authentification** : Requise (Bearer Token)
- **Permissions** : Admin ou Superadmin uniquement
- **Paramètres de requête (query)** :
  - `search` (string, optionnel) : Recherche par nom/email
  - `role` (string, optionnel) : Filtrer par rôle (`user`, `admin`, `superadmin`)
  - `page` (integer, optionnel) : Numéro de page pour la pagination
  - `limit` (integer, optionnel) : Nombre d'éléments par page

**Exemple de requête** :
```javascript
GET /users?search=john&role=admin&page=1&limit=10
Authorization: Bearer <token>
```

**Réponse attendue** :
```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "num_license": "12345",
      "avatar": "url",
      "status": "active",
      "role": "admin",
      "slug": "abc123"
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10
  }
}
```

#### GET `/users/{identifier}` - Détail d'un utilisateur
- **Méthode** : `GET`
- **URL** : `/users/{identifier}`
- **Authentification** : Requise (Bearer Token)
- **Permissions** : Admin ou Superadmin uniquement
- **Paramètres** :
  - `identifier` (path) : **ID (UUID)**, email ou numéro de licence de l'utilisateur

**Exemples de requête** :
```javascript
// Par ID (UUID)
GET /users/123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer <token>

// Par email
GET /users/john@example.com
Authorization: Bearer <token>

// Par numéro de licence
GET /users/12345
Authorization: Bearer <token>
```

**Réponse attendue** :
```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "num_license": "12345",
    "avatar": "url",
    "status": "active",
    "role": "admin",
    "slug": "abc123",
    "clubs": [],
    "groups": []
  }
}
```

---

## Routes supplémentaires pour la gestion des utilisateurs

### POST `/users` - Créer un utilisateur (Admin uniquement)
- **Méthode** : `POST`
- **URL** : `/users`
- **Authentification** : Requise (Bearer Token)
- **Permissions** : Admin ou Superadmin uniquement

**Body de la requête** :
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "num_license": "12345",
  "role": "user"
}
```

**Champs requis** :
- `name` (string, min 2, max 100) : Nom de l'utilisateur
- `email` (string, format email) : Adresse email
- `num_license` (string, optionnel) : Numéro de licence
- `role` (enum, optionnel) : `user`, `admin`, `superadmin` (défaut: `user`)

**Réponse (201)** :
```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "email": "john@example.com",
    "name": "John Doe",
    "temporary_password": "motdepasse123"
  }
}
```

**Note** : Un mot de passe temporaire est généré automatiquement et envoyé par email à l'utilisateur.

### DELETE `/users/{id}` - Désactiver un utilisateur (Admin uniquement)
- **Méthode** : `DELETE`
- **URL** : `/users/{id}`
- **Authentification** : Requise (Bearer Token)
- **Permissions** : Admin ou Superadmin uniquement

**Réponse (200)** :
```json
{
  "status": "success",
  "message": "Utilisateur désactivé"
}
```

**Note** : L'utilisateur n'est pas supprimé, son statut est simplement mis à `inactive`.

### GET `/users/{id}/session-summary` - Résumé des sessions (Admin uniquement)
- **Méthode** : `GET`
- **URL** : `/users/{id}/session-summary`
- **Authentification** : Requise (Bearer Token)
- **Permissions** : Admin ou Superadmin uniquement

**Réponse (200)** :
```json
{
  "status": "success",
  "data": {
    "totalSessions": 0,
    "noShowSessions": 0,
    "points": 0
  }
}
```

### GET `/users/{userId}/sessions` - Liste des sessions (Admin uniquement)
- **Méthode** : `GET`
- **URL** : `/users/{userId}/sessions`
- **Authentification** : Requise (Bearer Token)
- **Permissions** : Admin ou Superadmin uniquement

**Réponse (200)** :
```json
{
  "status": "success",
  "data": [
    {
      "id": "session-uuid",
      "user_agent": "Mozilla/5.0...",
      "ip_address": "192.168.1.1",
      "is_active": true,
      "expires_at": "2024-12-31T23:59:59.000Z",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### GET `/users/me/session-summary` - Résumé des sessions pour l'utilisateur connecté
- **Méthode** : `GET`
- **URL** : `/users/me/session-summary`
- **Authentification** : Requise (Bearer Token)
- **Permissions** : Tous les utilisateurs authentifiés

**Réponse (200)** :
```json
{
  "status": "success",
  "data": {
    "totalSessions": 0,
    "noShowSessions": 0,
    "points": 0
  }
}
```

### POST `/users/assign-club` - Associer un utilisateur à un club (Admin uniquement)
- **Méthode** : `POST`
- **URL** : `/users/assign-club`
- **Authentification** : Requise (Bearer Token)
- **Permissions** : Admin ou Superadmin uniquement

**Body de la requête** :
```json
{
  "user_id": "user-uuid",
  "club_id": "club-uuid",
  "role": "member"
}
```

**Champs requis** :
- `user_id` (string) : ID de l'utilisateur
- `club_id` (string) : ID du club
- `role` (enum, optionnel) : `member`, `coach`, `admin` (défaut: `member`)

**Réponse (200)** :
```json
{
  "status": "success",
  "message": "Utilisateur associé au club",
  "data": {
    "user_id": "user-uuid",
    "club_id": "club-uuid",
    "role": "member"
  }
}
```

**Note** : Cette fonctionnalité nécessite l'implémentation du modèle Club. Actuellement, elle retourne une réponse de succès mais n'effectue pas l'association réelle.

---

## Modification du rôle principal d'un utilisateur

### PATCH `/users/{id}` - Modifier un utilisateur
- **Méthode** : `PATCH`
- **URL** : `/users/{id}`
- **Authentification** : Requise (Bearer Token)
- **Permissions** : Admin ou Superadmin uniquement
- **Paramètres** :
  - `id` (path) : ID de l'utilisateur (UUID)

**Body de la requête** :
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "num_license": "12345",
  "avatar": "url",
  "status": "active",
  "role": "admin"
}
```

**Champs modifiables** :
- `name` (string) : Nom de l'utilisateur
- `email` (string) : Adresse email
- `num_license` (string) : Numéro de licence
- `avatar` (string) : URL de l'avatar
- `status` (enum) : `"active"` ou `"inactive"`
- `role` (enum) : `"user"`, `"admin"` ou `"superadmin"` ⭐ **Rôle principal**

**Exemple de requête pour modifier le rôle** :
```javascript
PATCH /users/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "role": "admin"
}
```

**Réponse attendue** :
```json
{
  "status": "success",
  "message": "Utilisateur mis à jour"
}
```

---

## Événements associés à un utilisateur

### GET `/auth/me` - Profil utilisateur avec événements
- **Méthode** : `GET`
- **URL** : `/auth/me`
- **Authentification** : Requise (Bearer Token)
- **Description** : Retourne le profil de l'utilisateur connecté avec tous les événements auxquels il est associé

**Exemple de requête** :
```javascript
GET /auth/me
Authorization: Bearer <token>
```

**Réponse attendue** :
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "avatar": "url",
      "slug": "abc123",
      "num_license": "12345",
      "role": "admin"
    },
    "events": [
      {
        "id": "event-uuid",
        "name": "Championnat de France",
        "start_date": "2024-06-01",
        "end_date": "2024-06-03",
        "location": "Paris",
        "role": "organiser"
      },
      {
        "id": "event-uuid-2",
        "name": "Coupe de France",
        "start_date": "2024-07-01",
        "end_date": "2024-07-02",
        "location": "Lyon",
        "role": "referee"
      }
    ]
  }
}
```

**Note** : Le champ `role` dans chaque événement correspond au **rôle dans l'événement** (pas le rôle principal) :
- `viewer` : Visualiseur
- `editor` : Éditeur
- `referee` : Arbitre
- `organiser` : Organisateur

### GET `/user-events/event/{event_id}` - Liste des utilisateurs d'un événement
- **Méthode** : `GET`
- **URL** : `/user-events/event/{event_id}`
- **Authentification** : Requise (Bearer Token)
- **Description** : Liste tous les utilisateurs associés à un événement spécifique

**Exemple de requête** :
```javascript
GET /user-events/event/{event_id}
Authorization: Bearer <token>
```

**Réponse attendue** :
```json
{
  "status": "success",
  "data": [
    {
      "id": "user-event-uuid",
      "user_id": "user-uuid",
      "event_id": "event-uuid",
      "role": "organiser",
      "User": {
        "id": "user-uuid",
        "name": "John Doe",
        "email": "john@example.com"
      }
    }
  ]
}
```

---

## Création d'un utilisateur

### POST `/auth/register` - Inscription d'un nouvel utilisateur
- **Méthode** : `POST`
- **URL** : `/auth/register`
- **Authentification** : Non requise
- **Description** : Crée un nouveau compte utilisateur

**Body de la requête** :
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "motdepasse123",
  "num_license": "12345"
}
```

**Champs requis** :
- `name` (string, min 2, max 100) : Nom de l'utilisateur
- `email` (string, format email) : Adresse email
- `password` (string, min 6 caractères) : Mot de passe
- `num_license` (string, optionnel) : Numéro de licence

**Exemple de requête** :
```javascript
POST /auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "motdepasse123",
  "num_license": "12345"
}
```

**Réponse en cas de succès (201)** :
```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "email": "john@example.com"
  }
}
```

**Réponse en cas d'erreur (400)** :
```json
{
  "status": "error",
  "message": "Email ou numéro déjà utilisé"
}
```

**Processus de création** :
1. Vérification que l'email ou le numéro de licence n'existe pas déjà
2. Hashage du mot de passe
3. Génération d'un token de vérification d'email
4. Création de l'utilisateur avec le statut `inactive` par défaut
5. Envoi d'un email de vérification avec le lien : `https://aviron-app.com/verify-email?token={token}`
6. L'utilisateur doit cliquer sur le lien pour activer son compte (statut passe à `active`)

### POST `/user-events` - Ajouter un utilisateur à un événement (création automatique)
- **Méthode** : `POST`
- **URL** : `/user-events`
- **Authentification** : Requise (Bearer Token)
- **Description** : Ajoute un utilisateur à un événement. Si l'utilisateur n'existe pas, il est créé automatiquement avec un mot de passe provisoire.

**Body de la requête** :
```json
{
  "email": "john@example.com",
  "event_id": "event-uuid",
  "role": "organiser",
  "name": "John Doe"
}
```

**Champs requis** :
- `email` (string, format email) : Adresse email de l'utilisateur
- `event_id` (string) : ID de l'événement
- `role` (enum) : Rôle dans l'événement (`viewer`, `editor`, `referee`, `organiser`)
- `name` (string, optionnel) : Nom de l'utilisateur (extrait de l'email si non fourni)

**Exemple de requête** :
```javascript
POST /user-events
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "john@example.com",
  "event_id": "event-uuid",
  "role": "organiser",
  "name": "John Doe"
}
```

**Réponse en cas de succès** :
```json
{
  "status": "success",
  "data": {
    "user_event": {
      "id": "user-event-uuid",
      "user_id": "user-uuid",
      "event_id": "event-uuid",
      "role": "organiser"
    },
    "user": {
      "id": "user-uuid",
      "email": "john@example.com",
      "name": "John Doe"
    },
    "user_created": true,
    "temporary_password": "TempPass123!"
  }
}
```

**Processus si l'utilisateur n'existe pas** :
1. Génération d'un mot de passe provisoire aléatoire (12 caractères)
2. Hashage du mot de passe
3. Génération d'un token de vérification d'email
4. Création de l'utilisateur avec le statut `inactive`
5. Envoi d'un email avec :
   - Le mot de passe provisoire
   - Le lien de vérification d'email : `https://aviron-app.com/verify-email?token={token}`
6. Création du lien UserEvent entre l'utilisateur et l'événement

**Processus si l'utilisateur existe déjà** :
1. Récupération de l'utilisateur existant
2. Mise à jour ou création du lien UserEvent avec le nouveau rôle

---

## Inscription (register) avec utilisateur existant inactif

### ✅ Solution implémentée et améliorée

**Situation** : Un utilisateur a été ajouté à un événement via `/user-events`, ce qui a créé un compte avec le statut `inactive` et un mot de passe provisoire. L'utilisateur peut maintenant finaliser son inscription via `/auth/register`.

**Comportement actuel (amélioré)** :
Le code dans `src/controllers/authController.js` a été modifié et amélioré pour gérer tous les cas de figure :

1. **Si l'utilisateur existe par email et est inactif** :
   - Le compte est mis à jour avec le nouveau mot de passe choisi
   - Le nom et le numéro de licence sont mis à jour si fournis
   - Vérification que le numéro de licence n'est pas déjà utilisé par un autre utilisateur actif
   - Un nouveau token de vérification d'email est généré
   - Un nouvel email de vérification est envoyé
   - Retourne un statut `200` avec le message "Compte mis à jour, veuillez vérifier votre email"

2. **Si l'utilisateur existe par numéro de licence et est inactif (email différent)** :
   - Le compte est mis à jour avec le nouvel email fourni
   - Le mot de passe, le nom et le token de vérification sont mis à jour
   - Vérification que le nouvel email n'est pas déjà utilisé par un utilisateur actif
   - Un nouvel email de vérification est envoyé

3. **Si l'utilisateur existe et est actif** :
   - Retourne une erreur `400` avec un message précis :
     - "Cet email est déjà utilisé" si l'email existe
     - "Ce numéro de licence est déjà utilisé" si le numéro de licence existe

4. **Si l'utilisateur n'existe pas** :
   - Crée un nouveau compte (comportement normal)
   - Gestion des erreurs de contrainte unique avec messages d'erreur précis

**Améliorations apportées** :
- ✅ Vérification séparée de l'email et du numéro de licence
- ✅ Messages d'erreur précis et différenciés
- ✅ Gestion des contraintes uniques de la base de données
- ✅ Gestion du cas où un utilisateur inactif est trouvé par numéro de licence avec un email différent
- ✅ Protection contre les conflits de données (email/num_license déjà utilisés)
- ✅ Gestion d'erreurs robuste avec try/catch appropriés

### 📝 Exemple d'utilisation

**Requête pour un utilisateur inactif existant** :
```javascript
POST /auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "nouveaumotdepasse123",
  "num_license": "12345"
}
```

**Réponse (200) - Compte inactif mis à jour** :
```json
{
  "status": "success",
  "data": {
    "id": "uuid-existant",
    "email": "john@example.com"
  },
  "message": "Compte mis à jour, veuillez vérifier votre email"
}
```

**Réponse (201) - Nouveau compte créé** :
```json
{
  "status": "success",
  "data": {
    "id": "nouveau-uuid",
    "email": "john@example.com"
  }
}
```

### ⚠️ Messages d'erreur possibles

| Code | Message | Description |
|------|---------|-------------|
| 400 | `"Cet email est déjà utilisé"` | L'email est déjà utilisé par un utilisateur actif |
| 400 | `"Ce numéro de licence est déjà utilisé"` | Le numéro de licence est déjà utilisé par un utilisateur actif |
| 400 | `"Ce numéro de licence est déjà utilisé par un autre compte"` | Tentative de mettre à jour un compte inactif avec un numéro de licence déjà utilisé |
| 400 | `"Cet email est déjà utilisé par un autre compte"` | Tentative de mettre à jour un compte inactif (trouvé par num_license) avec un email déjà utilisé |
| 500 | `"Une erreur est survenue lors de l'inscription"` | Erreur serveur générique |

### 🔄 Workflow pour les utilisateurs inactifs

Un utilisateur ajouté à un événement peut maintenant :

1. **Option 1 : Finaliser via `/auth/register`** ✅ (NOUVEAU)
   - Créer son propre mot de passe
   - Mettre à jour ses informations
   - Recevoir un nouvel email de vérification
   - Activer son compte via le lien de vérification

2. **Option 2 : Utiliser le mot de passe provisoire**
   - Se connecter avec le mot de passe provisoire via `/auth/login`
   - Changer son mot de passe via `/auth/change-password` (après connexion)
   - Vérifier son email via `/auth/verify-email?token={token}` pour activer son compte

---

## Résumé des routes disponibles

| Route | Méthode | Auth | Description | Statut |
|-------|---------|------|-------------|--------|
| `/users` | GET | ✅ Admin | Liste des utilisateurs (pagination, recherche, filtre) | ✅ Implémenté |
| `/users` | POST | ✅ Admin | Créer un utilisateur | ✅ Implémenté |
| `/users/{identifier}` | GET | ✅ Admin | Détail d'un utilisateur (email ou num_license) | ✅ Implémenté |
| `/users/{id}` | PATCH | ✅ Admin | Modifier un utilisateur (rôle, etc.) | ✅ Implémenté |
| `/users/{id}` | DELETE | ✅ Admin | Désactiver un utilisateur | ✅ Implémenté |
| `/users/{id}/session-summary` | GET | ✅ Admin | Résumé des sessions d'un utilisateur | ✅ Implémenté |
| `/users/{userId}/sessions` | GET | ✅ Admin | Liste des sessions d'un utilisateur | ✅ Implémenté |
| `/users/me/session-summary` | GET | ✅ | Résumé des sessions pour l'utilisateur connecté | ✅ Implémenté |
| `/users/assign-club` | POST | ✅ Admin | Associer un utilisateur à un club | ✅ Implémenté |
| `/auth/me` | GET | ✅ | Profil utilisateur avec événements | ✅ Implémenté |
| `/user-events/event/{event_id}` | GET | ✅ | Liste des utilisateurs d'un événement | ✅ Implémenté |
| `/auth/register` | POST | ❌ | Créer un compte | ✅ Implémenté |
| `/user-events` | POST | ✅ | Ajouter un utilisateur à un événement | ✅ Implémenté |
| `/auth/verify-email` | GET | ❌ | Vérifier l'email et activer le compte | ✅ Implémenté |
| `/auth/login` | POST | ❌ | Se connecter | ✅ Implémenté |
| `/auth/change-password` | POST | ✅ | Changer le mot de passe | ✅ Implémenté |

---

## Notes importantes

1. **Rôle principal vs Rôle dans l'événement** :
   - Le **rôle principal** (`role` dans la table `users`) : `user`, `admin`, `superadmin` - définit les permissions globales
   - Le **rôle dans l'événement** (`role` dans la table `user_events`) : `viewer`, `editor`, `referee`, `organiser` - définit les permissions pour un événement spécifique

2. **Statut utilisateur** :
   - `inactive` : Compte créé mais email non vérifié
   - `active` : Compte activé après vérification de l'email

3. **Authentification** :
   - Toutes les routes nécessitant une authentification utilisent un **Bearer Token** dans le header `Authorization`
   - Le token est obtenu via `/auth/login`

4. **Routes utilisateurs** :
   - ✅ Toutes les routes `/users/*` sont maintenant implémentées et disponibles
   - ⚠️ **Accès réservé aux administrateurs** : Toutes les routes (sauf `/users/me/session-summary`) nécessitent le rôle `admin` ou `superadmin`
   - Les routes sont montées dans `app.js` et protégées par le middleware `requireAdmin`

