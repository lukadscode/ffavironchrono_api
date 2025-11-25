# Guide Front : Ordre personnalisé des catégories

## Fonctionnalité
Vous pouvez maintenant définir l'ordre dans lequel les catégories seront traitées lors de la génération des courses.

## Endpoint

```
POST /races/generate
```

## Paramètres

### Paramètres existants
- `phase_id` (requis) : ID de la phase
- `lane_count` (requis) : Nombre de couloirs
- `start_time` (optionnel) : Heure de départ de la première course
- `interval_minutes` (optionnel) : Minutes entre chaque course

### Nouveau paramètre
- `category_order` (optionnel) : Tableau de codes de catégories dans l'ordre souhaité

## Exemple d'utilisation

### Sans ordre personnalisé (comportement par défaut)
```javascript
const response = await axios.post('/races/generate', {
  phase_id: 'abc-123-def',
  lane_count: 6,
  start_time: '2024-01-01T10:00:00Z',
  interval_minutes: 5
});
```

Les catégories seront triées par code (ordre alphabétique).

### Avec ordre personnalisé
```javascript
const response = await axios.post('/races/generate', {
  phase_id: 'abc-123-def',
  lane_count: 6,
  start_time: '2024-01-01T10:00:00Z',
  interval_minutes: 5,
  category_order: ['H4X', 'H2X', 'F4X', 'F2X', 'H1X', 'F1X']
});
```

Les catégories seront traitées dans cet ordre :
1. H4X (Hommes 4x)
2. H2X (Hommes 2x)
3. F4X (Femmes 4x)
4. F2X (Femmes 2x)
5. H1X (Hommes 1x)
6. F1X (Femmes 1x)
7. Toutes les autres catégories (triées par code)

## Comportement

### Catégories listées dans `category_order`
- Sont traitées dans l'ordre exact du tableau
- Les courses sont numérotées séquentiellement selon cet ordre

### Catégories non listées
- Sont ajoutées à la fin
- Sont triées par code (ordre alphabétique)
- Continuent la numérotation des courses

## Exemple complet React/TypeScript

```typescript
interface GenerateRacesParams {
  phase_id: string;
  lane_count: number;
  start_time?: string;
  interval_minutes?: number;
  category_order?: string[]; // Nouveau paramètre
}

const generateRaces = async (params: GenerateRacesParams) => {
  try {
    const response = await axios.post('/races/generate', {
      phase_id: params.phase_id,
      lane_count: params.lane_count,
      start_time: params.start_time,
      interval_minutes: params.interval_minutes || 5,
      category_order: params.category_order || [] // Tableau vide = ordre par défaut
    });
    
    console.log('Courses générées:', response.data);
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la génération des courses:', error);
    throw error;
  }
};

// Utilisation
await generateRaces({
  phase_id: 'abc-123-def',
  lane_count: 6,
  start_time: '2024-01-01T10:00:00Z',
  interval_minutes: 5,
  category_order: ['H4X', 'H2X', 'F4X', 'F2X', 'H1X', 'F1X']
});
```

## Interface utilisateur suggérée

Vous pourriez ajouter dans votre interface :

1. **Liste déplaçable** : Permettre à l'utilisateur de réorganiser les catégories par drag & drop
2. **Pré-configurations** : Proposer des ordres prédéfinis (ex: "Ordre standard indoor", "Ordre par type de bateau")
3. **Sauvegarde** : Optionnellement sauvegarder l'ordre préféré pour réutilisation

### Exemple avec React DnD ou react-beautiful-dnd

```typescript
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

const CategoryOrderSelector = ({ categories, onOrderChange }) => {
  const handleDragEnd = (result) => {
    if (!result.destination) return;
    
    const items = Array.from(categories);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    onOrderChange(items.map(cat => cat.code));
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="categories">
        {(provided) => (
          <div {...provided.droppableProps} ref={provided.innerRef}>
            {categories.map((category, index) => (
              <Draggable key={category.id} draggableId={category.id} index={index}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                  >
                    {category.code} - {category.label}
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
};
```

## Notes importantes

- Les codes de catégories doivent correspondre exactement aux codes dans la base de données
- Si un code n'existe pas dans les catégories de l'événement, il est ignoré
- L'ordre est respecté strictement : les courses sont numérotées selon cet ordre
- Si `category_order` est vide ou non fourni, le comportement par défaut (tri par code) est utilisé


