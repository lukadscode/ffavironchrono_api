# Migration : Changement du statut des équipages (Crew Status)

## 📋 Description

Cette migration change le type de la colonne `status` dans la table `crews` :
- **Avant** : `INTEGER` avec valeur par défaut `8`
- **Après** : `ENUM` avec valeurs sémantiques et valeur par défaut `'registered'`

## ⚠️ IMPORTANT : Avant de commencer

### 1. Sauvegarder la base de données

```bash
# Exemple avec mysqldump
mysqldump -u [user] -p [database_name] > backup_before_migration.sql
```

### 2. Vérifier les données existantes

Exécutez cette requête pour voir quelles valeurs de `status` existent actuellement :

```sql
SELECT status, COUNT(*) as count 
FROM crews 
GROUP BY status 
ORDER BY status;
```

Cela vous permettra de savoir s'il y a d'autres valeurs que `8` à convertir.

## 🚀 Exécution de la migration

### Option 1 : Migration complète (recommandée)

Exécutez le script complet `001_migrate_crew_status_to_enum.sql` :

```bash
mysql -u [user] -p [database_name] < docs/migrations/001_migrate_crew_status_to_enum.sql
```

### Option 2 : Migration étape par étape

Si vous préférez exécuter étape par étape, suivez les instructions dans le fichier SQL.

## 📝 Valeurs de conversion

Par défaut, toutes les valeurs existantes sont converties en `'registered'`. 

Si vous avez d'autres valeurs numériques à convertir, modifiez le script SQL avant l'exécution :

```sql
-- Exemple : si status = 1 signifie DNS
UPDATE crews SET status_new = 'dns' WHERE status = 1;

-- Exemple : si status = 2 signifie DNF
UPDATE crews SET status_new = 'dnf' WHERE status = 2;
```

## ✅ Vérification post-migration

Après la migration, vérifiez que :

1. **Le type de colonne est correct** :
```sql
SHOW COLUMNS FROM crews WHERE Field = 'status';
```
   - Type attendu : `enum('registered','dns','dnf','disqualified','changed','withdrawn','scratch')`
   - Default : `'registered'`

2. **Toutes les valeurs ont été converties** :
```sql
SELECT DISTINCT status, COUNT(*) as count 
FROM crews 
GROUP BY status;
```
   - Toutes les valeurs doivent être dans la liste des ENUM

3. **Pas de valeurs NULL** :
```sql
SELECT COUNT(*) as null_count 
FROM crews 
WHERE status IS NULL;
```
   - Résultat attendu : `0`

4. **Le nombre total d'équipages est identique** :
```sql
SELECT COUNT(*) FROM crews;
```
   - Doit correspondre au nombre avant migration

## 🔄 Rollback (en cas de problème)

Si vous devez annuler la migration, utilisez le script de rollback dans le fichier SQL :

```sql
-- Restaurer l'ancienne structure
ALTER TABLE crews DROP COLUMN status;
ALTER TABLE crews ADD COLUMN status INT DEFAULT 8;
UPDATE crews SET status = 8 WHERE status_new = 'registered';
ALTER TABLE crews DROP COLUMN status_new;
```

**OU** restaurez la sauvegarde complète :

```bash
mysql -u [user] -p [database_name] < backup_before_migration.sql
```

## 📊 Impact

- **Temps d'exécution** : Quelques secondes à quelques minutes selon le nombre d'équipages
- **Downtime** : Aucun si exécuté pendant une période de faible activité
- **Risque** : Faible (migration réversible)

## 🧪 Test en environnement de développement

**IMPORTANT** : Testez d'abord en environnement de développement !

1. Restaurez une copie de production en dev
2. Exécutez la migration
3. Vérifiez que tout fonctionne
4. Testez l'API avec les nouveaux statuts
5. Si tout est OK, exécutez en production

## 📞 Support

En cas de problème :
1. Vérifiez les logs MySQL/MariaDB
2. Vérifiez que la version de MariaDB supporte ENUM (toutes les versions récentes)
3. Vérifiez les contraintes de clés étrangères si elles existent

## 📅 Checklist de migration

- [ ] Sauvegarde de la base de données effectuée
- [ ] Vérification des valeurs existantes de `status`
- [ ] Script de migration adapté si nécessaire (autres valeurs que 8)
- [ ] Test en environnement de développement
- [ ] Migration exécutée en production
- [ ] Vérifications post-migration effectuées
- [ ] API testée avec les nouveaux statuts
- [ ] Frontend mis à jour (voir `FRONTEND_CREW_STATUS_CHANGES.md`)

---

**Version** : 1.0  
**Date** : 2024  
**Auteur** : Équipe backend

