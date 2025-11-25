# Système de Classement des Clubs

## Résumé
Système complet de gestion des classements des clubs pour les compétitions. Permet de calculer automatiquement les points selon différents barèmes (indoor, défis des capitales, etc.) et de générer les classements.

## Structure de la base de données

### Tables créées

1. **`scoring_templates`** : Templates de répartition des points
   - `id` : Identifiant unique
   - `name` : Nom du template
   - `type` : Type (indoor_points, defis_capitaux, custom)
   - `config` : Configuration JSON des points
   - `is_default` : Indique si c'est le template par défaut

2. **`club_rankings`** : Classements des clubs par événement
   - `id` : Identifiant unique
   - `event_id` : ID de l'événement
   - `club_name` : Nom du club
   - `club_code` : Code du club
   - `total_points` : Total des points du club
   - `rank` : Rang dans le classement (1 = premier)
   - `ranking_type` : Type de classement

3. **`ranking_points`** : Points détaillés attribués
   - `id` : Identifiant unique
   - `event_id` : ID de l'événement
   - `club_ranking_id` : ID du classement du club
   - `race_id` : ID de la course (nullable)
   - `crew_id` : ID de l'équipage (nullable)
   - `place` : Place dans la course (1 = premier)
   - `points` : Points attribués
   - `points_type` : Type (individuel ou relais)
   - `participant_count` : Nombre de participants dans la course

## Migration SQL

Exécutez le script `migrations/create_ranking_system.sql` pour créer les tables et insérer les templates par défaut.

## Barèmes de points

### Points Indoor

Les points varient selon :
- Le nombre de participants (1-3, 4-6, 7-12, 13+)
- Le type de course (individuel ou relais)
- La place obtenue

**Exemples :**
- 1-3 participants, 1ère place : 9 points (individuel) ou 13.5 points (relais)
- 7-12 participants, 1ère place : 24 points (individuel) ou 36 points (relais)
- 13+ participants, 1ère place : 30 points (individuel) ou 45 points (relais)

### Classement Défis des Capitales

Points selon le rang final dans le classement général :
- 1er : 300 points
- 2ème : 280 points
- 3ème : 260 points
- ...
- 75ème : 2 points

## Utilisation de l'API

### 1. Calculer les points pour une course

```bash
POST /rankings/race/{race_id}/calculate-points?ranking_type=indoor_points
```

Cette route :
- Récupère les résultats de la course avec les positions
- Détermine le barème selon le nombre de participants
- Calcule les points pour chaque équipage
- Enregistre les points dans la base de données
- Met à jour le total des points de chaque club
- Recalcule les rangs

### 2. Récupérer le classement des clubs

```bash
GET /rankings/event/{event_id}/ranking?ranking_type=indoor_points
```

Retourne le classement complet avec :
- Le rang de chaque club
- Le total des points
- Les points détaillés par course

### 3. Récupérer les points détaillés d'un club

```bash
GET /rankings/event/{event_id}/club/{club_name}/points?ranking_type=indoor_points
```

Retourne tous les points attribués au club avec les détails de chaque course.

### 4. Recalculer les rangs

```bash
POST /rankings/event/{event_id}/recalculate
Content-Type: application/json

{
  "ranking_type": "indoor_points"
}
```

Recalcule les rangs de tous les clubs selon leurs points totaux.

### 5. Gérer les templates

```bash
# Lister les templates
GET /rankings/templates?type=indoor_points

# Créer un template personnalisé
POST /rankings/templates
Content-Type: application/json

{
  "name": "Mon Template",
  "type": "custom",
  "config": { ... },
  "is_default": false
}
```

## Workflow recommandé

1. **Après chaque course terminée** :
   ```bash
   POST /rankings/race/{race_id}/calculate-points
   ```
   Les points sont automatiquement calculés et enregistrés.

2. **Pour afficher le classement** :
   ```bash
   GET /rankings/event/{event_id}/ranking
   ```

3. **Si besoin de recalculer** (après modification de résultats) :
   ```bash
   POST /rankings/event/{event_id}/recalculate
   ```

## Calcul automatique des points

Le système détermine automatiquement :
- **Le nombre de participants** : Compte les équipages avec un timing valide
- **Le type de course** : Vérifie si la distance est un relais (`is_relay`)
- **Le barème à utiliser** : Selon le nombre de participants (1-3, 4-6, 7-12, 13+)
- **Les points à attribuer** : Selon la place et le type (individuel/relais)

## Exemple de réponse

### Classement des clubs

```json
{
  "status": "success",
  "data": [
    {
      "id": "...",
      "event_id": "...",
      "club_name": "Club A",
      "club_code": "CLUB_A",
      "total_points": 125.5,
      "rank": 1,
      "ranking_type": "indoor_points",
      "ranking_points": [
        {
          "id": "...",
          "race_id": "...",
          "crew_id": "...",
          "place": 1,
          "points": 30,
          "points_type": "individuel",
          "participant_count": 15
        }
      ]
    }
  ]
}
```

## Notes importantes

- Les points sont calculés uniquement pour les équipages ayant un timing valide
- Les anciens points d'une course sont supprimés avant le recalcul
- Les rangs sont recalculés automatiquement après chaque attribution de points
- Le système supporte plusieurs types de classements simultanés (indoor_points, defis_capitaux, custom)
- Les templates peuvent être personnalisés pour créer de nouveaux barèmes



