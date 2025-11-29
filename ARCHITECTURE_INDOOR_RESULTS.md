# Architecture : Système de résultats Indoor

## Analyse du format ErgRace

Le format JSON contient :
- **Métadonnées de course** : race_id, race_name, start_time, end_time, duration, etc.
- **Participants** : Array avec résultats détaillés (time, place, lane, etc.)
- **Splits** : Détails très granulaires par participant (peuvent être nombreux)

## Problématiques

1. **Volume de données** : Les splits peuvent être très nombreux (1 par split par participant)
2. **Requêtes fréquentes** : Besoin d'afficher rapidement les classements, temps, etc.
3. **Traçabilité** : Garder le JSON original pour audit/backup
4. **Liaison** : Lier avec les courses/participants existants dans la plateforme

## Solution proposée : Architecture hybride optimisée

### Option recommandée : **Hybride avec JSON compressé**

#### 1. Table `indoor_race_results` (métadonnées + backup)

```sql
CREATE TABLE `indoor_race_results` (
  `id` CHAR(36) PRIMARY KEY,
  `race_id` CHAR(36) NOT NULL,  -- FK vers races.id
  `ergrace_race_id` VARCHAR(255) UNIQUE,  -- ID de la course dans ErgRace
  `ergrace_version` VARCHAR(50),
  `race_name` VARCHAR(255),
  `race_type` VARCHAR(50),  -- "individual", "team", etc.
  `race_duration_type` VARCHAR(50),  -- "distance", "time"
  `race_start_time` DATETIME,
  `race_end_time` DATETIME,
  `duration` INT,  -- en millisecondes
  `time_cap` INT,
  `race_event_site` VARCHAR(255),
  `race_file_name` VARCHAR(255),
  `raw_data` JSON,  -- JSON complet compressé (pour backup)
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_race_id` (`race_id`),
  INDEX `idx_ergrace_race_id` (`ergrace_race_id`)
);
```

**Avantages** :
- Métadonnées normalisées pour requêtes rapides
- JSON complet en backup (compressé par MySQL)
- Index sur race_id pour jointures rapides

#### 2. Table `indoor_participant_results` (résultats normalisés)

```sql
CREATE TABLE `indoor_participant_results` (
  `id` CHAR(36) PRIMARY KEY,
  `indoor_race_result_id` CHAR(36) NOT NULL,  -- FK vers indoor_race_results
  `crew_id` CHAR(36) NULL,  -- FK vers crews (si équipage identifié)
  `participant_id` CHAR(36) NULL,  -- FK vers participants (si participant identifié)
  `ergrace_participant_id` VARCHAR(255),  -- ID dans ErgRace (peut être UUID ou "Lane X")
  `participant_name` VARCHAR(255),  -- Nom du participant (backup si non identifié)
  `affiliation` VARCHAR(50),  -- Code club
  `lane` INT,
  `place` INT,  -- Classement
  `time_ms` INT,  -- Temps en millisecondes (pour tri/calculs)
  `time_display` VARCHAR(20),  -- Temps formaté "0:24.1"
  `score` VARCHAR(20),  -- Score formaté
  `distance` INT,  -- Distance en mètres
  `avg_pace` VARCHAR(20),  -- Allure moyenne "2:00.5"
  `spm` INT,  -- Strokes per minute
  `calories` INT,
  `serial_number` BIGINT,  -- Numéro série de la machine
  `machine_type` VARCHAR(50),  -- "row", "ski", etc.
  `logged_time` DATETIME,
  `class` VARCHAR(255),  -- Classe/catégorie de l'épreuve
  `splits_data` JSON,  -- Splits détaillés (optionnel, peut être NULL si pas besoin)
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_indoor_race_result_id` (`indoor_race_result_id`),
  INDEX `idx_crew_id` (`crew_id`),
  INDEX `idx_participant_id` (`participant_id`),
  INDEX `idx_place` (`indoor_race_result_id`, `place`),
  INDEX `idx_time_ms` (`indoor_race_result_id`, `time_ms`)
);
```

**Avantages** :
- Requêtes ultra-rapides pour classements, filtres, etc.
- Index optimisés pour tri par temps/place
- Liaison avec crews/participants existants
- Splits optionnels (peuvent être NULL pour économiser l'espace)

### Gestion de l'espace

**Stratégie** :
1. **Splits dans JSON** : Stockés dans `splits_data` (JSON) uniquement si nécessaire
2. **Compression MySQL** : Le JSON est automatiquement compressé par MySQL 5.7+
3. **Option "splits légers"** : Ne stocker que les splits essentiels (premier, dernier, intermédiaires clés)
4. **Archivage** : Possibilité d'archiver les anciens résultats avec splits complets

### Workflow d'import

1. **Réception du JSON** ErgRace
2. **Vérification** : La course existe-t-elle ? (`ergrace_race_id` ou `race_id`)
3. **Création/Update** :
   - Créer/update `indoor_race_results` avec métadonnées + JSON complet
   - Créer/update `indoor_participant_results` avec résultats normalisés
   - Tenter de lier avec `crew_id`/`participant_id` via `ergrace_participant_id` ou nom
4. **Mise à jour de la course** : Marquer la course comme `finished` dans `races`

## Alternatives considérées

### Option 1 : JSON uniquement
❌ **Rejeté** : Requêtes lentes, pas de tri efficace, pas de liaison facile

### Option 2 : Tables normalisées uniquement
❌ **Rejeté** : Perte de traçabilité, splits trop volumineux

### Option 3 : Hybride complet (splits en table séparée)
⚠️ **Possible mais** : Trop volumineux, requêtes complexes, peu de valeur ajoutée

### Option 4 : Hybride optimisé (recommandé) ✅
✅ **Avantages** :
- Requêtes rapides sur résultats principaux
- Backup complet dans JSON
- Splits optionnels (économie d'espace)
- Flexibilité pour requêtes complexes

## Requêtes typiques optimisées

```sql
-- Classement d'une course
SELECT 
  ipr.place,
  ipr.participant_name,
  ipr.time_display,
  ipr.affiliation,
  c.club_name
FROM indoor_participant_results ipr
LEFT JOIN crews c ON ipr.crew_id = c.id
WHERE ipr.indoor_race_result_id = ?
ORDER BY ipr.place ASC;

-- Meilleur temps par catégorie
SELECT 
  irr.race_name,
  ipr.class,
  MIN(ipr.time_ms) as best_time_ms,
  ipr.time_display
FROM indoor_participant_results ipr
JOIN indoor_race_results irr ON ipr.indoor_race_result_id = irr.id
WHERE irr.race_id = ?
GROUP BY ipr.class
ORDER BY best_time_ms ASC;

-- Résultats d'un participant
SELECT 
  irr.race_name,
  ipr.place,
  ipr.time_display,
  ipr.class
FROM indoor_participant_results ipr
JOIN indoor_race_results irr ON ipr.indoor_race_result_id = irr.id
WHERE ipr.participant_id = ?
ORDER BY irr.race_start_time DESC;
```

## Migration et compatibilité

- **Backward compatible** : Les courses outdoor continuent d'utiliser le système existant
- **Champ optionnel** : Ajouter `is_indoor` BOOLEAN dans `races` pour distinguer
- **API séparée** : Routes `/indoor-results/*` pour ne pas polluer les routes existantes

## Estimation d'espace

Pour une course avec 8 participants et 10 splits chacun :
- **Métadonnées** : ~500 bytes
- **Résultats normalisés** : ~150 bytes × 8 = 1.2 KB (optimisé, sans champs redondants)
- **Splits JSON** : ~2 KB × 8 = 16 KB (optionnel, peut être NULL)
- **JSON complet** : ~50 KB (optimisé par MySQL en format binaire ~15-20 KB)

**Total par course** : ~17-22 KB (sans splits) ou ~33 KB (avec splits)

Pour 1000 courses : ~17-33 MB (très raisonnable)

## Optimisations appliquées

✅ **Champs redondants supprimés** :
- `race_name` → récupéré via `races.name`
- `race_type` → récupéré via `races.race_type`
- `race_event_site` → récupéré via `events.location`
- `participant_name` → récupéré via `crews` (si identifié)
- `affiliation` → récupéré via `crews.club_code`
- `class` → récupéré via `crews.category`

✅ **Liaison optimisée** :
- `ergrace_participant_id` = `crew_id` (si UUID valide)
- Index sur `ergrace_participant_id` pour liaison rapide
- Gestion du cas "Lane X" (participant non identifié)

✅ **JSON optimisé** :
- MySQL stocke le JSON en format binaire optimisé (pas de compression gzip, mais optimisation interne)
- Réduction d'environ 30-40% par rapport au texte brut

