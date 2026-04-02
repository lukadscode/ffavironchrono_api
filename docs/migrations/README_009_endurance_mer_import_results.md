# Migration 009 – Table `endurance_mer_import_results`

Cette migration crée la table des **résultats importés** pour l’Endurance Mer (ENDURO / BRS), utilisée par l’import Excel (un fichier par événement) et le classement par club calculé à la volée.

## Comment exécuter la migration

### Option 1 : Ligne de commande MySQL / MariaDB

Depuis le répertoire du projet :

```bash
mysql -h VOTRE_HOST -u VOTRE_USER -p VOTRE_BASE < docs/migrations/009_create_endurance_mer_import_results.sql
```

Ou en ouvrant une session MySQL puis :

```sql
source docs/migrations/009_create_endurance_mer_import_results.sql
```

(En Windows avec `mysql` dans le PATH, vous pouvez utiliser le chemin complet du fichier.)

### Option 2 : Script Node (utilise le .env du projet)

À la racine du projet :

```bash
node scripts/run-migration-009.js
```

Le script lit les variables `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` du fichier `.env` et exécute le SQL de la migration.

### Option 3 : Copier-coller le SQL

Ouvrez `009_create_endurance_mer_import_results.sql` dans un client SQL (MySQL Workbench, DBeaver, phpMyAdmin, TablePlus, etc.), connectez-vous à votre base, puis exécutez le contenu du fichier.

## Vérification

Après exécution, la table `endurance_mer_import_results` doit exister :

```sql
SHOW TABLES LIKE 'endurance_mer_import_results';
DESCRIBE endurance_mer_import_results;
```

## Rollback (annuler la migration)

Si vous devez supprimer la table :

```sql
DROP TABLE IF EXISTS endurance_mer_import_results;
```

Attention : toutes les données importées seront perdues.
