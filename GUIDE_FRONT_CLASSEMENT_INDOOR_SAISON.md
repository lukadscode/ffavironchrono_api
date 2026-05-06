# Guide Frontend : Classement indoor par saison

## Vue d'ensemble

`GET /rankings/indoor/season/:season` retourne le **classement clubs indoor consolidé** pour une saison.

Total par club :

- **standard** (ou `indoor_ranking_scope` absent) : **maximum** des totaux obtenus sur les meetings "standard" de la saison
- **championnat_france_indoor** : **somme** des totaux sur ces événements
- **defi_capitaux** : pour chaque meeting, rang du club selon les totaux indoor puis bar?me `classement_defis_capitaux` ; sur la saison, **somme des N meilleurs** scores (N dans le template `defis_capitaux`, défaut **7**)

## Prérequis BDD

Exécuter `docs/migrations/012_add_event_season_indoor_ranking_scope.sql` puis renseigner sur chaque événement concerné :

- `season` (ex. `2025-2026`)
- `indoor_ranking_scope` : `standard` | `championnat_france_indoor` | `defi_capitaux` (null = `standard`)

Création / mise ? jour : champs acceptés par `POST/PUT /events` (validation Joi).

## R?gle de calcul des points (alignement classement club)

Pour chaque catégorie et chaque course indoor :

- **`position`** (ex. `GET /indoor-results/event/:id/bycategorie`) : rang **officiel** dans la catégorie (tous les temps valides).
- **`points`** : bar?me **classement club** : seules les lignes **éligibles** et avec **club** (`club_code` ou `club_name` non vide) sont classées par temps ; le **1er** de ce sous-groupe reçoit les points du **rang 1** du bar?me Points Indoor, le **2e** le **rang 2**, etc. L'**effectif** pour choisir la tranche (tables A ? D) est la **taille de ce sous-groupe**. Les concurrents **sans club** ne consomment ni une place ni une tranche.

M?me logique dans `rankingService` pour `getClubRankingsByEventType` et `getSeasonIndoorClubRanking`.

## Endpoint

```
GET /rankings/indoor/season/:season
Authorization: Bearer <token>
```

- **400** si `season` vide
- **500** si template Points Indoor introuvable

## Réponse (aperçu)

```json
{
  "status": "success",
  "data": {
    "season": "2025-2026",
    "defis_capitaux_template": {
      "id": "",
      "name": "",
      "nombre_defis_comptabilises": 7
    },
    "rules_summary": { "standard": "", "championnat_france_indoor": "", "defi_capitaux": "" },
    "rankings": [
      {
        "rank": 1,
        "club_code": "C130001",
        "club_name": "",
        "total_points": 0,
        "breakdown": {
          "max_standard_event_points": 0,
          "best_standard_event": { "id": "", "name": "" },
          "championnat_france_indoor_points": 0,
          "defis_capitaux_points": 0,
          "defis_capitaux_events_count": 0,
          "defis_capitaux_top_n_applied": 7
        }
      }
    ]
  }
}
```

## Références

- OpenAPI : `src/docs/ranking.yaml`, `src/docs/event.yaml`, `src/docs/indoorResults.yaml`
- Code : `src/services/rankingService.js`, `src/controllers/rankingController.js`
