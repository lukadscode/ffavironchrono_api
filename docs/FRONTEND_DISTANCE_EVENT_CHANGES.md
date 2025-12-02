# Documentation Frontend : Changements Distance/Event

## 📋 Résumé des changements

Une refactorisation a été effectuée pour éviter la duplication des distances dans la base de données. Les distances sont maintenant **globales** et partagées entre tous les événements, au lieu d'être créées une fois par événement.

### Problème résolu

**Avant** :
- Chaque événement créait ses propres distances (ex: "500m" pour Event A, "500m" pour Event B)
- Résultat : duplication inutile et gestion complexe

**Après** :
- Les distances sont **globales** et partagées entre tous les événements
- Une distance "500m" n'existe qu'**une seule fois** dans la base de données
- Une table intermédiaire `event_distances` lie les événements aux distances

## 🔄 Impact sur le Frontend

### ✅ **Aucun changement requis pour la plupart des endpoints**

Les endpoints existants continuent de fonctionner **exactement comme avant** :

#### Endpoints inchangés

- **`GET /categories/event/:event_id/with-crews`**
  - Retourne toujours `distance_id` dans chaque catégorie
  - Format de réponse identique
  - Aucun changement nécessaire

- **`PUT /categories/:id`**
  - Accepte toujours `distance_id` dans le body
  - Met à jour toujours `category.distance_id`
  - Aucun changement nécessaire

- **`GET /distances`**
  - Retourne toutes les distances globales
  - Format identique
  - Aucun changement nécessaire

- **`POST /distances`**
  - Crée une distance globale
  - **Changement mineur** : plus besoin d'envoyer `event_id` (optionnel, sera ignoré)

### 📊 Nouveau comportement

#### `GET /distances/event/:event_id`

Cet endpoint a été **légèrement modifié** mais reste compatible :

**Avant** : Retournait les distances liées à l'événement via `distances.event_id`

**Après** : Retourne les distances liées à l'événement via la table `event_distances`

**Impact Frontend** : **Aucun** - Le format de réponse est identique, seule la logique interne a changé.

## 🎯 Bonnes pratiques pour le Frontend

### 1. Création de distances

Lors de la création d'une distance, **ne plus envoyer `event_id`** :

```typescript
// ❌ Ancien (ne fonctionne plus)
POST /distances
{
  "event_id": "xxx",
  "meters": 500,
  "is_relay": false
}

// ✅ Nouveau (recommandé)
POST /distances
{
  "meters": 500,
  "is_relay": false
}
```

**Note** : Si vous envoyez `event_id`, il sera simplement ignoré (pas d'erreur).

### 2. Association distance ↔ catégorie

L'association se fait toujours via `category.distance_id` :

```typescript
// ✅ Toujours valide
PUT /categories/:categoryId
{
  "distance_id": "xxx" // ID de la distance globale
}
```

### 3. Récupération des distances d'un événement

Utilisez toujours le même endpoint :

```typescript
// ✅ Toujours valide
GET /distances/event/:eventId
// Retourne les distances utilisées dans cet événement
```

### 4. Gestion des catégories avec distances

Aucun changement dans la façon de récupérer les catégories avec leurs distances :

```typescript
// ✅ Toujours valide
GET /categories/event/:eventId/with-crews

// Réponse :
{
  "status": "success",
  "data": [
    {
      "id": "cat-123",
      "label": "U17F1I",
      "distance_id": "dist-456", // ✅ Toujours présent
      // ... autres champs
    }
  ]
}
```

## 📝 Exemples de code

### React/TypeScript - Récupération des catégories

```typescript
// Aucun changement nécessaire
const fetchCategories = async (eventId: string) => {
  const response = await fetch(`/categories/event/${eventId}/with-crews`);
  const data = await response.json();
  
  // distance_id est toujours présent
  data.data.forEach(category => {
    console.log(`Catégorie ${category.label} a la distance ${category.distance_id}`);
  });
};
```

### React/TypeScript - Mise à jour d'une distance de catégorie

```typescript
// Aucun changement nécessaire
const updateCategoryDistance = async (categoryId: string, distanceId: string) => {
  await fetch(`/categories/${categoryId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ distance_id: distanceId })
  });
};
```

### React/TypeScript - Création d'une distance

```typescript
// ⚠️ Changement mineur : ne plus envoyer event_id
const createDistance = async (meters: number) => {
  await fetch('/distances', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      meters: meters,
      is_relay: false,
      // event_id: eventId // ❌ Plus nécessaire (sera ignoré si envoyé)
    })
  });
};
```

## 🔍 Vérifications à faire

### Checklist de migration frontend

- [ ] Vérifier que `GET /categories/event/:eventId/with-crews` retourne toujours `distance_id`
- [ ] Vérifier que `PUT /categories/:id` avec `distance_id` fonctionne toujours
- [ ] Si vous créez des distances via `POST /distances`, retirer `event_id` du body (optionnel)
- [ ] Tester l'affichage des distances dans les catégories
- [ ] Tester la mise à jour d'une distance sur une catégorie

### Tests recommandés

```typescript
// Test 1 : Vérifier que distance_id est toujours présent
const categories = await fetchCategories(eventId);
categories.forEach(cat => {
  expect(cat).toHaveProperty('distance_id'); // Peut être null
});

// Test 2 : Vérifier la mise à jour
await updateCategoryDistance(categoryId, newDistanceId);
const updated = await fetchCategory(categoryId);
expect(updated.distance_id).toBe(newDistanceId);
```

## ⚠️ Points d'attention

### 1. Distance `null` ou non définie

Une catégorie peut avoir `distance_id: null`. Assurez-vous de gérer ce cas :

```typescript
const distanceLabel = category.distance_id 
  ? `Distance: ${category.distance_id}`
  : 'Aucune distance assignée';
```

### 2. Distances partagées

Les distances sont maintenant partagées entre événements. Si vous modifiez une distance, elle affectera **tous les événements** qui l'utilisent.

**Recommandation** : Ne modifiez pas directement les distances existantes. Créez plutôt une nouvelle distance si nécessaire.

### 3. Import automatique

Lors de l'import d'un événement depuis l'API FFAviron, les distances sont automatiquement :
- Créées si elles n'existent pas (globales)
- Réutilisées si elles existent déjà
- Liées à l'événement via `event_distances`

Aucune action frontend requise.

## 📊 Architecture technique (pour information)

### Structure de données

```
events
  └── event_distances (nouvelle table)
       └── distances (globales, partagées)
            └── categories.distance_id (lien direct)
```

### Flux de données

1. **Création d'une distance** : `POST /distances` → Distance globale créée
2. **Association à un événement** : Automatique lors de l'import, ou via `event_distances`
3. **Association à une catégorie** : `PUT /categories/:id` avec `distance_id`
4. **Récupération** : `GET /categories/event/:eventId/with-crews` → Retourne `distance_id`

## 🚀 Migration

### Étapes de migration frontend

1. **Aucune action urgente requise** - Les endpoints existants fonctionnent toujours
2. **Optionnel** : Retirer `event_id` des appels `POST /distances` (sera ignoré de toute façon)
3. **Tester** : Vérifier que tout fonctionne comme avant

### Rollback

Si nécessaire, le backend peut être rollbacké sans impact sur le frontend (les endpoints restent identiques).

## 📞 Support

En cas de problème :

1. Vérifier que `distance_id` est bien présent dans les réponses API
2. Vérifier les logs backend pour voir si les distances sont bien créées/réutilisées
3. Tester avec un événement existant et un nouveau événement

## 📅 Résumé

| Aspect | Avant | Après | Action Frontend |
|--------|-------|-------|-----------------|
| Création distance | Avec `event_id` | Sans `event_id` | Optionnel : retirer `event_id` |
| Récupération catégories | `distance_id` présent | `distance_id` présent | ✅ Aucun changement |
| Mise à jour catégorie | `distance_id` dans body | `distance_id` dans body | ✅ Aucun changement |
| Distances par événement | Via `distances.event_id` | Via `event_distances` | ✅ Aucun changement (format identique) |

**Conclusion** : **Aucun changement critique requis**. Les endpoints fonctionnent comme avant. Seule la création de distances peut être simplifiée (retirer `event_id`).

---

**Version** : 1.0  
**Date** : 2024  
**Auteur** : Équipe backend

