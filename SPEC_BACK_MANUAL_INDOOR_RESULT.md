# Spécification backend – Nouvelle route d’ajout de résultat indoor manuel

## 1. Contexte

Front actuel : `IndoorRaceDetailPage` permet d’ajouter un résultat manuel pour une course indoor (cas où on n’a pas de fichier ErgRace).

Aujourd’hui, le front utilise l’endpoint existant :

`POST /indoor-results/import`

avec un payload “déguisé” en ErgRace, ce qui provoque des erreurs internes (500, `Cannot read properties of undefined (reading 'split')`) car la route s’attend à un JSON ErgRace complet (splits, structure exacte, etc.).

**Objectif :**

Ajouter une route simple, explicite, et robuste pour créer/modifier un résultat indoor manuel pour un équipage donné, sans passer par la logique d’import ErgRace.

## 2. Nouvelle route proposée

### 2.1 Endpoint

**Méthode** : `POST`

**URL** (à adapter selon vos conventions) :

#### Option A (préférée) – explicite par course + équipage

`POST /indoor-results/race/:raceId/manual`

**Body :**

```json
{
  "crew_id": "UUID-équipage-obligatoire",
  "lane": 1,
  "time_display": "7:21.1",
  "time_ms": 441100,
  "distance": 1000,
  "avg_pace": "3:40.5",
  "spm": 0,
  "calories": 0,
  "machine_type": "Rameur",
  "logged_time": "2025-12-17T09:11:48.721Z",
  "splits_data": []   // optionnel
}
```

#### Option B – tout dans le body

`POST /indoor-results/manual`

**Body identique mais avec `race_id` en plus :**

```json
{
  "race_id": "UUID-course-obligatoire",
  "crew_id": "UUID-équipage-obligatoire",
  "...": "..."
}
```

### 2.2 Authentification & droits

Même auth que les autres routes admin/timing (Bearer token déjà en place dans l’API).

Accès réservé aux rôles déjà autorisés à gérer les résultats indoor sur l’événement (organiser, timing, referee selon votre politique).

## 3. Détails du body

### Champs obligatoires

- `crew_id` (string, UUID)  
  Équipage FFA auquel associer le résultat.

- `race_id` (string, UUID)  
  Si non passé dans l’URL (option B).

- `time_display` (string)  
  Temps au format humain (ex : `"7:21.1"`).

- `time_ms` (number)  
  Temps en millisecondes (ex : `441100` pour `7:21.1`).

- `distance` (number)  
  Distance parcourue (ex : `1000`).

### Champs optionnels (avec valeurs par défaut si absents)

- `lane` (number)  
  Numéro de couloir (pour affichage / cohérence).

- `avg_pace` (string)  
  Ex `"3:40.5"` ; si absent, peut être calculé côté backend à partir de `time_ms` et `distance`.

- `spm` (number)  
  Strokes/min (0 si absent).

- `calories` (number)  
  `0` si absent.

- `machine_type` (string)  
  Ex `"Rameur"`, valeur par défaut possible.

- `logged_time` (string, ISO datetime)  
  Si absent, utiliser `now()`.

- `splits_data` (Array ou `null`)  
  Optionnel, peut être omis totalement.

Pour `splits_data`, réutiliser le même format que `MODIFICATION_API_PUBLIC_INDOOR_RESULTS_SPLITS.md` si un jour on souhaite ajouter des splits manuels, mais **ne jamais supposer** que ce champ est présent :

```json
"splits_data": [
  {
    "split_distance": 250,
    "split_time": "625",
    "split_avg_pace": "2:05.0",
    "split_stroke_rate": 26
  }
]
```

## 4. Comportement backend attendu

### 4.1 Validation

- Vérifier que `race_id` (ou `:raceId` dans l’URL) et `crew_id` existent et sont cohérents :
  - l’équipage appartient bien à l’événement et à la course.
- Vérifier que `time_ms > 0` et `distance > 0`.

### 4.2 Création / mise à jour

- Si un résultat indoor existe déjà pour (`race_id`, `crew_id`) :
  - soit on le remplace,
  - soit on ajoute une entrée supplémentaire en conservant la plus récente (à définir, mais le plus simple est de **mettre à jour**).

- Créer / mettre à jour l’enregistrement dans la table des résultats indoor (`indoor_results_participants` ou équivalent).

### 4.3 Calculs automatiques

- `place` (classement) recalculé automatiquement pour la course (en fonction de `time_ms` et du sens de classement).
- Si `avg_pace` est absent ou vide :
  - le calculer à partir de `time_ms` et `distance`.

### 4.4 Réponse

`200` / `201` avec la structure indoor actuelle utilisée par le front :

```json
{
  "status": "success",
  "data": {
    "race_result": {
      "id": "uuid-du-resultat-global",
      "race_id": "uuid-course",
      "race_start_time": "...",
      "race_end_time": "...",
      "duration": 441100,
      "raw_data": null
    },
    "participants": [
      {
        "id": "uuid-participant-indoor",
        "place": 1,
        "time_display": "7:21.1",
        "time_ms": 441100,
        "distance": 1000,
        "avg_pace": "3:40.5",
        "spm": 0,
        "calories": 0,
        "crew_id": "uuid-équipage",
        "crew": {
          "id": "uuid-équipage",
          "club_name": "MEYZIEU AM",
          "club_code": "C069011",
          "category": {
            "id": "uuid-catégorie",
            "code": "TAF1I_1000m",
            "label": "TAF1I 1000m"
          }
        },
        "splits_data": []   // ou null si non fourni
      }
      // ... autres participants
    ]
  }
}
```

## 5. Erreurs & codes

### 5.1 `400 Bad Request`

Champs manquants ou invalides :

- `race_id` / `crew_id` absent,
- `time_ms <= 0`,
- `distance <= 0`,
- format incorrect.

### 5.2 `404 Not Found`

Course ou équipage introuvable / incohérent (l’équipage ne fait pas partie de la course).

### 5.3 `500 Internal Server Error`

Pour les cas non prévus, mais **sans utiliser `.split` sur des valeurs potentiellement `undefined`** : toutes les opérations sur des strings/splits doivent être protégées par des checks.

## 6. Pourquoi cette route est nécessaire (résumé pour l’équipe)

La route actuelle `POST /indoor-results/import` :

- est conçue pour des fichiers ErgRace complets (JSON),
- suppose la présence de certains champs (parfois avec des `.split()` sur des strings),
- n’est pas adaptée à un simple résultat manuel issu de l’UI.

Résultat : même avec un payload propre, on obtient un `500` serveur avec  
`Cannot read properties of undefined (reading 'split')`.

La nouvelle route :

- simplifie le contrat : **“créer ou mettre à jour un résultat pour un équipage dans une course indoor”** ;
- évite de surcharger la logique d’import ErgRace ;
- permet au front d’ajouter/manipuler un résultat manuel sans se battre avec le format ErgRace ni les splits.

---

> Si besoin, une version “courte” de cette spec (quelques lignes) peut être utilisée pour un message Slack à l’équipe backend, ce fichier `.md` servant de référence détaillée.


