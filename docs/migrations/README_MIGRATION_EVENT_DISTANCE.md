# Migration : Création de la table EventDistance

## 📋 Description

Cette migration crée une table intermédiaire `EventDistance` pour lier les événements aux distances, tout en gardant la relation directe `Category.distance_id`.

### Architecture

**Structure** :
- **`distances`** : Distances globales (sans `event_id`) - partagées entre tous les événements
- **`categories`** : Garde `distance_id` (comme avant) - une catégorie a une distance
- **`event_distances`** : Table intermédiaire Event ↔ Distance - permet de savoir quelles distances sont utilisées dans un événement

### Avantages

- ✅ **Simplicité** : Les catégories gardent leur `distance_id` direct (pas de changement côté frontend)
- ✅ **Pas de duplication** : Les distances sont globales et partagées
- ✅ **Flexibilité** : La table `event_distances` permet de gérer les distances au niveau événement
- ✅ **Rétrocompatibilité** : L'ancien code continue de fonctionner

## 🚀 Exécution de la migration

### ⚠️ IMPORTANT : Avant de commencer

1. **Sauvegarder la base de données**

```bash
mysqldump -u [user] -p [database_name] > backup_before_migration_event_distance.sql
```

2. **Vérifier les données existantes**

```sql
-- Vérifier combien de distances existent
SELECT COUNT(*) as total_distances FROM distances;

-- Vérifier les distances avec event_id
SELECT COUNT(*) as distances_with_event_id 
FROM distances 
WHERE event_id IS NOT NULL;

-- Vérifier les distances dupliquées (même caractéristiques, event_id différent)
SELECT 
  meters, is_relay, relay_count, is_time_based, duration_seconds,
  COUNT(*) as count,
  GROUP_CONCAT(id) as distance_ids
FROM distances
GROUP BY meters, is_relay, relay_count, is_time_based, duration_seconds
HAVING COUNT(*) > 1;
```

### Exécution

```bash
mysql -u [user] -p [database_name] < docs/migrations/003_migrate_to_event_distance.sql
```

## 📝 Étapes de la migration

### 1. Création de la table `event_distances`

La table est créée avec :
- Contrainte unique sur `(event_id, distance_id)` pour éviter les doublons
- Clés étrangères avec `ON DELETE CASCADE`

### 2. Migration des données existantes

Pour chaque distance qui a un `event_id`, la migration crée une entrée dans `event_distances`.

### 3. Fusion des distances dupliquées

La migration identifie et fusionne les distances identiques qui ont été créées pour différents événements :
- Garde une seule distance (ex: "500m")
- Met à jour toutes les références (races, categories, event_distances)
- Supprime les distances dupliquées

### 4. Retrait de `event_id` de `distances`

Une fois les distances fusionnées, la colonne `event_id` est retirée de la table `distances`.

## ✅ Vérification post-migration

### 1. Vérifier que la table existe

```sql
SELECT COUNT(*) as event_distances_count 
FROM event_distances;
```

### 2. Vérifier qu'il n'y a plus de `event_id` dans `distances`

```sql
SELECT COUNT(*) as distances_with_event_id 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'distances' 
  AND COLUMN_NAME = 'event_id';
-- Résultat attendu : 0
```

### 3. Vérifier les associations créées

```sql
SELECT 
  e.name as event_name,
  d.meters,
  d.is_relay,
  d.is_time_based
FROM event_distances ed
LEFT JOIN events e ON e.id = ed.event_id
LEFT JOIN distances d ON d.id = ed.distance_id
LIMIT 10;
```

### 4. Vérifier qu'il n'y a plus de distances dupliquées

```sql
SELECT 
  meters, is_relay, relay_count, is_time_based, duration_seconds,
  COUNT(*) as count
FROM distances
GROUP BY meters, is_relay, relay_count, is_time_based, duration_seconds
HAVING COUNT(*) > 1;
-- Résultat attendu : 0 lignes
```

## 🔄 Impact sur l'API

### Endpoints inchangés

- `GET /categories/event/:event_id/with-crews` - Retourne toujours `category.distance_id` (comme avant)
- `PUT /categories/:id` - Met à jour toujours `category.distance_id` (comme avant)
- `GET /distances` - Retourne toutes les distances globales

### Endpoints modifiés

- `GET /distances/event/:event_id` - Utilise maintenant `EventDistance` pour récupérer les distances d'un événement

### Comportement de l'import

Lors de l'import d'un événement :
1. Les distances sont créées globalement (sans `event_id`)
2. Les catégories sont créées avec leur `distance_id` (comme avant)
3. Les associations `EventDistance` sont créées automatiquement

## 🧪 Test en environnement de développement

**IMPORTANT** : Testez d'abord en environnement de développement !

1. Restaurez une copie de production en dev
2. Exécutez la migration
3. Vérifiez que tout fonctionne
4. Testez l'API avec les endpoints existants
5. Testez l'import d'un événement
6. Si tout est OK, exécutez en production

## 🔄 Rollback (en cas de problème)

Si vous devez annuler la migration :

1. **Restaurer `event_id` dans `distances`** (si supprimé)
```sql
ALTER TABLE distances ADD COLUMN event_id CHAR(36) NULL;
```

2. **Migrer les données depuis `event_distances` vers `distances`**
```sql
UPDATE distances d
INNER JOIN event_distances ed ON ed.distance_id = d.id
SET d.event_id = ed.event_id
WHERE d.event_id IS NULL;
```

3. **Supprimer la table `event_distances`**
```sql
DROP TABLE IF EXISTS event_distances;
```

**OU** restaurez la sauvegarde complète :

```bash
mysql -u [user] -p [database_name] < backup_before_migration_event_distance.sql
```

## 📊 Impact

- **Temps d'exécution** : Quelques minutes selon le nombre de distances
- **Downtime** : Aucun si exécuté pendant une période de faible activité
- **Risque** : Faible (migration simple, réversible)

## 📅 Checklist de migration

- [ ] Sauvegarde de la base de données effectuée
- [ ] Vérification des données existantes (distances)
- [ ] Test en environnement de développement
- [ ] Migration exécutée en production
- [ ] Vérifications post-migration effectuées
- [ ] API testée avec les endpoints existants
- [ ] Import d'un événement testé

---

**Version** : 1.0  
**Date** : 2024  
**Auteur** : Équipe backend

