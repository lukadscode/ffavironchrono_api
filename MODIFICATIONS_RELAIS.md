# Modifications pour le support des courses en relais

## Résumé
Ajout du support des courses en relais (ex: 8x250m, 4x500m) dans la base de données et l'API, particulièrement pour les événements indoor.

## Modifications de la base de données

### 1. Script de migration SQL
Exécutez le script `migrations/add_relay_support_to_distances.sql` pour ajouter les colonnes suivantes à la table `distances`:

- **`is_relay`** (TINYINT(1), NOT NULL, DEFAULT 0) : Indique si c'est une course en relais
- **`relay_count`** (INT(11), NULL) : Nombre de relais (ex: 8 pour 8x250m, 4 pour 4x500m)

### 2. Structure de la table après migration
```sql
CREATE TABLE `distances` (
  `id` char(36) NOT NULL,
  `event_id` char(36) DEFAULT NULL,
  `meters` int(11) DEFAULT NULL,
  `is_relay` TINYINT(1) NOT NULL DEFAULT 0,
  `relay_count` INT(11) NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `event_id` (`event_id`),
  KEY `idx_is_relay` (`is_relay`),
  CONSTRAINT `distances_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
```

### 3. Exemples d'utilisation

**Course normale (2000m):**
```json
{
  "event_id": "7c38e42f-198a-4bd6-9c59-9854094a1ea0",
  "meters": 2000,
  "is_relay": false,
  "relay_count": null
}
```

**Relais 8x250m:**
```json
{
  "event_id": "7c38e42f-198a-4bd6-9c59-9854094a1ea0",
  "meters": 250,
  "is_relay": true,
  "relay_count": 8
}
```

**Relais 4x500m:**
```json
{
  "event_id": "7c38e42f-198a-4bd6-9c59-9854094a1ea0",
  "meters": 500,
  "is_relay": true,
  "relay_count": 4
}
```

## Modifications de l'API

### Fichiers modifiés

1. **`src/models/Distance.js`**
   - Ajout des champs `is_relay` et `relay_count`
   - Ajout d'une méthode `getFormattedLabel()` qui retourne "8x250m" pour les relais ou "2000m" pour les courses normales
   - Ajout d'un getter virtuel `label` pour accéder au label formaté

2. **`src/schemas/distanceSchema.js`**
   - Ajout de la validation pour `is_relay` (boolean, default: false)
   - Ajout de la validation pour `relay_count` (integer, 2-20, requis si `is_relay` = true)

3. **`src/docs/distance.yaml`**
   - Mise à jour de la documentation API pour inclure les nouveaux champs

4. **`src/services/importManifestation.js`**
   - Mise à jour de la fonction `extractDistance()` pour détecter les relais dans les libellés d'épreuves
   - Détection automatique des formats: "8x250m", "4x500 m", "8 x 250 m", etc.
   - Création automatique des distances avec les champs `is_relay` et `relay_count` lors de l'import
   - Mise à jour de la création des codes de catégories pour inclure les informations de relais

### Endpoints API

L'endpoint `POST /distances` accepte maintenant les champs optionnels:
- `is_relay` (boolean, default: false)
- `relay_count` (integer, requis si `is_relay` = true)

L'endpoint `GET /distances` et `GET /distances/event/{event_id}` retournent maintenant ces champs dans la réponse.

## Utilisation

### Créer un relais via l'API

```bash
POST /distances
Content-Type: application/json

{
  "event_id": "7c38e42f-198a-4bd6-9c59-9854094a1ea0",
  "meters": 250,
  "is_relay": true,
  "relay_count": 8
}
```

### Accéder au label formaté

```javascript
const distance = await Distance.findByPk(distanceId);
console.log(distance.label); // "8x250m" ou "2000m"
console.log(distance.getFormattedLabel()); // Même résultat
```

## Import d'événements

L'import d'événements depuis l'API externe détecte automatiquement les relais dans les libellés d'épreuves.

### Formats détectés

La fonction `extractDistance()` reconnaît les formats suivants :
- **Relais** : "8x250m", "4x500 m", "8 x 250 m", "4 x 500m" (insensible à la casse)
- **Courses normales** : "500 m", "2000m", "2000 m"

### Exemple d'import

Si un événement contient une épreuve avec le libellé "Relais 8x250m", l'import créera automatiquement :
- Une distance avec `meters: 250`, `is_relay: true`, `relay_count: 8`
- Une catégorie avec le code formaté incluant le relais (ex: "U17F1I_8x250m")

Les logs d'import indiquent clairement quand un relais est détecté :
```
✅ Relais créé: 8x250m
✅ Distance créée: 2000m
```

## Notes importantes

- Pour un relais, le champ `meters` représente la distance d'un seul relais (ex: 250m pour 8x250m)
- Le champ `relay_count` est requis uniquement si `is_relay` est `true`
- Les courses normales continuent de fonctionner comme avant (is_relay = false, relay_count = null)
- Le label formaté est automatiquement généré pour l'affichage
- L'import détecte automatiquement les relais dans les libellés d'épreuves de l'API externe

