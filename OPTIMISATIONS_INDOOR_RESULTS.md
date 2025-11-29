# Optimisations appliquées aux résultats Indoor

## Réponse : Qu'est-ce qu'un JSON "compressé" ?

**JSON compressé dans MySQL** = **Optimisation binaire interne** (pas de compression gzip)

MySQL 5.7+ stocke les colonnes JSON en format **binaire optimisé** :
- ✅ **30-40% d'économie d'espace** par rapport au texte brut
- ✅ **Parsing plus rapide** (format binaire structuré)
- ✅ **Index partiels** possibles sur les champs JSON
- ❌ **Pas de compression gzip** (ce serait trop lent)

**Exemple** :
- JSON texte brut : 50 KB
- JSON MySQL optimisé : ~30-35 KB (économie automatique)

## Optimisations appliquées

### ✅ Champs redondants supprimés

Les informations déjà présentes dans les tables existantes ont été retirées :

| Champ supprimé | Récupéré via |
|----------------|--------------|
| `race_name` | `races.name` (JOIN) |
| `race_type` | `races.race_type` (JOIN) |
| `race_event_site` | `events.location` (JOIN via races → phases → events) |
| `participant_name` | `crews` → `crew_participants` → `participants` (JOIN) |
| `affiliation` | `crews.club_code` (JOIN) |
| `class` | `crews.category_id` → `categories.label` (JOIN) |
| `lane` | `race_crews.lane` (JOIN) - **Note** : peut être gardé pour vérification |

### ✅ Liaison optimisée `ergrace_participant_id` = `crew_id`

**Logique** :
- Si `ergrace_participant_id` est un UUID valide → c'est le `crew_id`
- Si `ergrace_participant_id` = "Lane X" → participant non identifié, `crew_id` = NULL

**Index créé** :
```sql
INDEX `idx_ergrace_participant_id` (`ergrace_participant_id`)
```

Permet une liaison rapide lors de l'import :
```javascript
// Pseudo-code d'import
if (isValidUUID(ergrace_participant_id)) {
  crew_id = ergrace_participant_id; // Direct mapping
} else {
  crew_id = null; // Participant non identifié ("Lane X")
}
```

### ✅ Structure finale optimisée

**Table `indoor_race_results`** :
- Métadonnées spécifiques à ErgRace uniquement
- JSON complet en backup (`raw_data`)
- Liaison avec `races.id`

**Table `indoor_participant_results`** :
- Données de performance uniquement (temps, classement, etc.)
- Splits optionnels (NULL si pas besoin)
- Liaison avec `crew_id` via `ergrace_participant_id`

## Requêtes optimisées

### Classement d'une course avec infos complètes

```sql
SELECT 
  ipr.place,
  ipr.time_display,
  ipr.avg_pace,
  ipr.spm,
  c.club_name,
  cat.label as category_label,
  r.name as race_name
FROM indoor_participant_results ipr
LEFT JOIN crews c ON ipr.crew_id = c.id
LEFT JOIN categories cat ON c.category_id = cat.id
JOIN indoor_race_results irr ON ipr.indoor_race_result_id = irr.id
JOIN races r ON irr.race_id = r.id
WHERE irr.race_id = ?
ORDER BY ipr.place ASC;
```

### Statistiques par catégorie

```sql
SELECT 
  cat.label as category,
  COUNT(*) as participants_count,
  MIN(ipr.time_ms) as best_time_ms,
  AVG(ipr.time_ms) as avg_time_ms
FROM indoor_participant_results ipr
JOIN crews c ON ipr.crew_id = c.id
JOIN categories cat ON c.category_id = cat.id
JOIN indoor_race_results irr ON ipr.indoor_race_result_id = irr.id
WHERE irr.race_id = ?
GROUP BY cat.id, cat.label
ORDER BY best_time_ms ASC;
```

## Gain d'espace estimé

**Avant optimisation** (avec champs redondants) :
- Métadonnées : ~800 bytes
- Résultats : ~300 bytes × 8 = 2.4 KB
- **Total** : ~3.2 KB par course

**Après optimisation** :
- Métadonnées : ~500 bytes
- Résultats : ~150 bytes × 8 = 1.2 KB
- **Total** : ~1.7 KB par course

**Économie** : ~47% d'espace en moins ! 🎉

Pour 1000 courses : **~1.7 MB** au lieu de ~3.2 MB

## Prochaines étapes

1. ✅ Migration SQL créée
2. ✅ Modèles Sequelize créés
3. ✅ Relations définies
4. ⏳ Routes d'import à créer
5. ⏳ Routes de récupération à créer
6. ⏳ Logique de liaison `ergrace_participant_id` → `crew_id`

