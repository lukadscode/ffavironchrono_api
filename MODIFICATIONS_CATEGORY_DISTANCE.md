# Modifications : Lien direct entre Catégories et Distances

## Résumé
Ajout d'un lien direct entre la table `categories` et la table `distances` pour faciliter la gestion et la création des courses. Une catégorie peut maintenant être directement liée à une distance (ou null si aucune distance spécifique).

## Modifications de la base de données

### 1. Script de migration SQL
Exécutez le script `migrations/add_distance_id_to_categories.sql` pour ajouter la colonne suivante à la table `categories`:

- **`distance_id`** (CHAR(36), NULL) : ID de la distance associée (peut être null)
- Clé étrangère vers la table `distances` avec `ON DELETE SET NULL`
- Index pour améliorer les performances

### 2. Structure de la table après migration
```sql
ALTER TABLE `categories` 
ADD COLUMN `distance_id` CHAR(36) NULL DEFAULT NULL AFTER `has_coxswain`;

ALTER TABLE `categories` 
ADD CONSTRAINT `categories_ibfk_distance` 
FOREIGN KEY (`distance_id`) REFERENCES `distances` (`id`) 
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX `idx_distance_id` ON `categories` (`distance_id`);
```

## Modifications de l'API

### Fichiers modifiés

1. **`src/models/Category.js`**
   - Ajout du champ `distance_id` (nullable)

2. **`src/models/relations.js`**
   - Ajout de la relation `Category.belongsTo(Distance)`
   - Ajout de la relation `Distance.hasMany(Category)`

3. **`src/schemas/categorySchema.js`**
   - Ajout de la validation pour `distance_id` (string, nullable, optionnel)

4. **`src/services/importManifestation.js`**
   - Mise à jour pour assigner automatiquement `distance_id` lors de la création des catégories
   - La distance est trouvée depuis `distanceMap` et assignée directement

5. **`src/controllers/importController.js`**
   - Simplification de `generateInitialRaces()` pour utiliser directement `category.distance_id`
   - Plus besoin d'extraire la distance depuis le code de catégorie
   - Suppression de la fonction `extractDistanceFromCategoryCode()` devenue inutile

6. **`src/docs/category.yaml`**
   - Mise à jour de la documentation API pour inclure `distance_id` dans les schémas POST et PUT

## Utilisation

### Créer une catégorie avec une distance

```bash
POST /categories
Content-Type: application/json

{
  "label": "U17 Femmes 1x",
  "code": "U17F1I",
  "age_group": "U17",
  "gender": "Femme",
  "boat_seats": 1,
  "has_coxswain": false,
  "distance_id": "7c38e42f-198a-4bd6-9c59-9854094a1ea0"
}
```

### Mettre à jour la distance d'une catégorie

```bash
PUT /categories/{id}
Content-Type: application/json

{
  "distance_id": "7c38e42f-198a-4bd6-9c59-9854094a1ea0"
}
```

### Retirer la distance d'une catégorie

```bash
PUT /categories/{id}
Content-Type: application/json

{
  "distance_id": null
}
```

### Accéder à la distance depuis une catégorie

```javascript
const category = await Category.findByPk(categoryId, {
  include: [{ model: Distance, as: "distance" }]
});

if (category.distance) {
  console.log(category.distance.label); // "8x250m" ou "2000m"
}
```

## Avantages

1. **Simplicité** : Plus besoin d'extraire la distance depuis le code de catégorie
2. **Flexibilité** : Une catégorie peut avoir une distance ou null
3. **Cohérence** : Le lien direct garantit que la distance existe dans l'événement
4. **Performance** : Accès direct à la distance sans parsing de code
5. **Maintenance** : Plus facile de gérer les distances depuis l'interface

## Génération des courses

Lors de la génération des courses avec `generateInitialRaces`, le `distance_id` est maintenant automatiquement assigné depuis `category.distance_id` :

```javascript
const race = await Race.create({
  // ...
  distance_id: category.distance_id, // Assigné automatiquement
});
```

## Import d'événements

Lors de l'import d'un événement, les catégories sont automatiquement liées aux distances correspondantes :

- Si une épreuve contient "8x250m", la catégorie créée sera liée à la distance avec `is_relay: true, relay_count: 8, meters: 250`
- Si une épreuve contient "2000m", la catégorie créée sera liée à la distance avec `is_relay: false, meters: 2000`
- Si aucune distance n'est trouvée, `distance_id` sera `null`

## Migration depuis l'ancien système

Si vous avez déjà des catégories existantes sans `distance_id`, vous pouvez :

1. Les mettre à jour manuellement via l'API
2. Créer un script de migration pour extraire la distance depuis le code et assigner le `distance_id`

## Notes importantes

- Le champ `distance_id` est **nullable** : une catégorie peut exister sans distance
- La clé étrangère utilise `ON DELETE SET NULL` : si une distance est supprimée, les catégories liées auront `distance_id = null`
- La génération des courses utilise maintenant directement `category.distance_id` au lieu d'extraire depuis le code
- L'import assigne automatiquement `distance_id` lors de la création des catégories


