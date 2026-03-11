## Migration : ajout de `crew_name` sur la table `crews`

Cette migration ajoute une colonne `crew_name` à la table `crews` pour stocker le nom complet d’un équipage
tel que fourni par l’intranet FFAVIRON dans le champ `nom_abrege_club_numero_equipage`.

Exemple de valeur : `NANTES CAN 5` (nom abrégé du club + numéro d’équipage).

---

### 1. Schéma cible

Modèle Sequelize (`src/models/Crew.js`) :

- nouveau champ :

```js
crew_name: {
  type: DataTypes.STRING,
  allowNull: true,
},
```

Table SQL (`crews`, `underscored: true`) :

- nouvelle colonne : `crew_name` (VARCHAR / TEXT selon le moteur).

---

### 2. SQL pour MySQL / MariaDB

À exécuter sur la base de données de production **une seule fois** :

```sql
ALTER TABLE `crews`
  ADD COLUMN `crew_name` VARCHAR(255) NULL AFTER `club_code`;
```

> Adapter le `AFTER` si la colonne `club_code` n’existe pas / a un autre ordre,
> l’important est simplement que la colonne `crew_name` soit ajoutée.

---

### 3. Effet sur l’import FFAVIRON

Après cette migration, les imports depuis l’intranet FFAVIRON rempliront automatiquement `crew_name` :

- Dans `src/services/importManifestation.js` :
  - `crew_name` reçoit **exactement** la valeur de `nom_abrege_club_numero_equipage`
    (ex : `"NANTES CAN 5"`).
  - `club_name` reste le nom du club **sans** le numéro (ex : `"NANTES CAN"`),
    extrait en supprimant la dernière partie si c’est un nombre.

- Dans `src/services/externalImportService.js` :
  - `crew_name` = `nom_abrege_club_numero_equipage`,
  - `club_name` est dérivé de la même manière (club sans numéro).

Aucune action supplémentaire n’est nécessaire côté front : le champ `crew_name` devient disponible
dans les réponses qui incluent le modèle `Crew` (par ex. `/crews/event/:eventId/with-participants`,
les endpoints d’export, etc.) dès que la migration et le déploiement sont effectués.

