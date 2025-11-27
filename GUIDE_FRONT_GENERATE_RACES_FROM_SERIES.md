# Documentation : Génération des Courses depuis les Séries

## Endpoint

```
POST /races/generate-from-series
```

## Authentification

**Requise** : Bearer Token dans le header `Authorization`

```
Authorization: Bearer <token>
```

## Description

Cette route génère les courses en respectant la structure des séries fournie par le frontend. Chaque série devient une course avec les équipages assignés selon le nombre spécifié par catégorie. Les équipages sont sélectionnés **aléatoirement** parmi ceux disponibles pour chaque catégorie.

## Paramètres de la requête

### Body (JSON)

| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `phase_id` | string (UUID) | ✅ Oui | ID de la phase pour laquelle générer les courses |
| `lane_count` | integer (≥ 1) | ✅ Oui | Nombre de lignes d'eau disponibles |
| `start_time` | string (ISO 8601) | ❌ Non | Heure de départ de la première course (ex: `"2024-01-15T09:00:00.000Z"`) |
| `interval_minutes` | integer (≥ 0) | ❌ Non | Minutes entre chaque course (défaut: `5`) |
| `series` | array | ✅ Oui | Tableau des séries à générer (voir structure ci-dessous) |

### Structure d'une série

Chaque élément du tableau `series` doit avoir la structure suivante :

```typescript
{
  id: string;                    // Identifiant unique de la série (ex: "series-1234567890")
  categories: {                   // Objet avec codes de catégories comme clés
    [categoryCode: string]: number; // Nombre d'équipages à assigner pour cette catégorie
  }
}
```

## Exemple de requête

```javascript
const response = await axios.post('/races/generate-from-series', {
  phase_id: 'abc-123-def-456',
  lane_count: 6,
  start_time: '2024-01-15T09:00:00.000Z',
  interval_minutes: 5,
  series: [
    {
      id: 'series-1234567890',
      categories: {
        'SF': 5,  // 5 équipages "Senior Femme"
        'SH': 1   // 1 équipage "Senior Homme"
      }
    },
    {
      id: 'series-1234567891',
      categories: {
        'SF': 5,
        'SH': 1
      }
    },
    {
      id: 'series-1234567892',
      categories: {
        'JF': 6   // 6 équipages "Junior Femme"
      }
    }
  ]
}, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

## Réponse en cas de succès

### Status Code : `200 OK`

```json
{
  "status": "success",
  "message": "3 courses générées avec succès",
  "data": {
    "races_created": 3,
    "crews_assigned": 18,
    "races": [
      {
        "id": "race-uuid-1",
        "race_number": 1,
        "start_time": "2024-01-15T09:00:00.000Z",
        "distance_id": "distance-uuid-2000m",
        "crews_count": 6
      },
      {
        "id": "race-uuid-2",
        "race_number": 2,
        "start_time": "2024-01-15T09:05:00.000Z",
        "distance_id": "distance-uuid-2000m",
        "crews_count": 6
      },
      {
        "id": "race-uuid-3",
        "race_number": 3,
        "start_time": "2024-01-15T09:10:00.000Z",
        "distance_id": "distance-uuid-1000m",
        "crews_count": 6
      }
    ]
  }
}
```

### Champs de la réponse

| Champ | Type | Description |
|-------|------|-------------|
| `status` | string | Toujours `"success"` en cas de succès |
| `message` | string | Message de confirmation |
| `data.races_created` | integer | Nombre de courses créées |
| `data.crews_assigned` | integer | Nombre total d'équipages assignés |
| `data.races` | array | Tableau des courses créées |
| `data.races[].id` | string (UUID) | ID de la course |
| `data.races[].race_number` | integer | Numéro de la course dans la phase |
| `data.races[].start_time` | string (ISO 8601) | Heure de départ de la course |
| `data.races[].distance_id` | string (UUID) \| null | ID de la distance (null si aucune distance) |
| `data.races[].crews_count` | integer | Nombre d'équipages dans cette course |

## Réponse en cas d'erreur

### Status Code : `400 Bad Request` - Erreurs de validation

```json
{
  "status": "error",
  "message": "Erreurs de validation",
  "errors": [
    "Série 1: Le nombre total de participants (7) dépasse le nombre de lignes d'eau (6)",
    "Série 2: Les catégories ont des distances différentes. Toutes les catégories d'une série doivent avoir la même distance.",
    "Série 3: La catégorie \"SF\" n'a que 10 équipages disponibles (15 au total, 5 déjà assignés), mais 12 sont demandés au total"
  ]
}
```

### Status Code : `401 Unauthorized` - Token manquant ou invalide

```json
{
  "status": "error",
  "message": "No token provided"
}
```

ou

```json
{
  "status": "error",
  "message": "Invalid token"
}
```

### Status Code : `404 Not Found` - Phase introuvable

```json
{
  "status": "error",
  "message": "Phase introuvable"
}
```

### Status Code : `500 Internal Server Error` - Erreur serveur

```json
{
  "status": "error",
  "message": "Message d'erreur détaillé"
}
```

## Règles de validation

Le backend valide automatiquement les séries avant de générer les courses :

### 1. **Capacité des lignes d'eau**
- Le nombre total de participants dans une série ne peut pas dépasser `lane_count`
- Exemple : Si `lane_count = 6`, une série avec `{ "SF": 5, "SH": 2 }` (total = 7) sera rejetée

### 2. **Distance commune**
- Toutes les catégories dans une même série doivent avoir la même distance (ou aucune distance)
- Exemple : Une série avec `{ "SF": 5, "JF": 1 }` où SF = 2000m et JF = 1000m sera rejetée

### 3. **Disponibilité des équipages**
- Le nombre total d'équipages demandés pour une catégorie ne peut pas dépasser le nombre d'équipages disponibles
- Les équipages déjà assignés à d'autres courses de la phase sont exclus automatiquement
- Exemple : Si la catégorie "SF" a 15 équipages au total, mais 5 sont déjà assignés, seulement 10 sont disponibles pour les nouvelles séries

### 4. **Existence des catégories**
- Tous les codes de catégories doivent exister dans l'événement

## Comportement de génération

### Sélection des équipages
- Les équipages sont sélectionnés **aléatoirement** parmi ceux disponibles pour chaque catégorie
- Un équipage ne peut être assigné qu'**une seule fois** par phase
- Si un équipage est déjà assigné à une course existante, il sera automatiquement exclu

### Attribution des lanes
- Les lanes sont attribuées séquentiellement (1, 2, 3, ...) dans l'ordre des catégories de la série
- Exemple : Série avec `{ "SF": 3, "SH": 2 }` → SF aura les lanes 1, 2, 3 et SH aura les lanes 4, 5

### Calcul des heures de départ
- Si `start_time` est fourni, la première course commence à cette heure
- Les courses suivantes sont espacées de `interval_minutes` (défaut: 5 minutes)
- Exemple : `start_time = "09:00"`, `interval_minutes = 5` → Course 1 à 09:00, Course 2 à 09:05, Course 3 à 09:10, etc.

### Distance de la course
- La distance de la course est déterminée par la distance commune des catégories de la série
- Si toutes les catégories ont la même distance, cette distance est assignée à la course
- Si aucune catégorie n'a de distance, `distance_id` sera `null`

## Exemple TypeScript complet

```typescript
interface Series {
  id: string;
  categories: Record<string, number>; // { categoryCode: numberOfCrews }
}

interface GenerateRacesFromSeriesParams {
  phase_id: string;
  lane_count: number;
  start_time?: string; // ISO 8601
  interval_minutes?: number; // default: 5
  series: Series[];
}

interface Race {
  id: string;
  race_number: number;
  start_time: string | null;
  distance_id: string | null;
  crews_count: number;
}

interface GenerateRacesResponse {
  status: "success";
  message: string;
  data: {
    races_created: number;
    crews_assigned: number;
    races: Race[];
  };
}

interface GenerateRacesError {
  status: "error";
  message: string;
  errors?: string[]; // Présent uniquement en cas d'erreurs de validation
}

async function generateRacesFromSeries(
  params: GenerateRacesFromSeriesParams,
  token: string
): Promise<GenerateRacesResponse> {
  try {
    const response = await axios.post<GenerateRacesResponse>(
      '/races/generate-from-series',
      {
        phase_id: params.phase_id,
        lane_count: params.lane_count,
        start_time: params.start_time,
        interval_minutes: params.interval_minutes || 5,
        series: params.series,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const errorData = error.response.data as GenerateRacesError;
      throw new Error(
        errorData.errors
          ? `Erreurs de validation:\n${errorData.errors.join('\n')}`
          : errorData.message
      );
    }
    throw error;
  }
}

// Utilisation
try {
  const result = await generateRacesFromSeries(
    {
      phase_id: 'abc-123-def-456',
      lane_count: 6,
      start_time: '2024-01-15T09:00:00.000Z',
      interval_minutes: 5,
      series: [
        {
          id: 'series-1',
          categories: {
            SF: 5,
            SH: 1,
          },
        },
        {
          id: 'series-2',
          categories: {
            JF: 6,
          },
        },
      ],
    },
    userToken
  );

  console.log(`✅ ${result.data.races_created} courses créées`);
  console.log(`✅ ${result.data.crews_assigned} équipages assignés`);
} catch (error) {
  console.error('❌ Erreur:', error.message);
}
```

## Notes importantes

1. **Ordre des séries** : Les courses sont créées dans l'ordre des séries fournies (série 1 → course 1, série 2 → course 2, etc.)

2. **Équipages non assignés** : Si une catégorie a des équipages non assignés (total assigné < `crew_count`), ils restent disponibles pour une assignation manuelle ultérieure

3. **Idempotence** : Si des courses existent déjà pour cette phase, les équipages déjà assignés seront automatiquement exclus. La génération peut être relancée pour ajouter de nouvelles courses.

4. **Format de date** : `start_time` doit être au format ISO 8601 (ex: `"2024-01-15T09:00:00.000Z"`). Le backend accepte les dates avec ou sans millisecondes et avec ou sans timezone.

5. **Performance** : Pour de grandes quantités de séries/catégories, la génération peut prendre quelques secondes. Le frontend devrait afficher un indicateur de chargement.

## Différences avec `/races/generate`

| Aspect | `/races/generate` | `/races/generate-from-series` |
|--------|-------------------|-------------------------------|
| **Structure** | Génère automatiquement les séries | Utilise les séries fournies par le frontend |
| **Contrôle** | Automatique, basé sur `category_order` | Manuel, contrôle total du frontend |
| **Répartition** | Répartit automatiquement les équipages | Respecte le nombre exact par catégorie |
| **Flexibilité** | Limitée | Totale (mélange de catégories, nombre personnalisé) |

## Questions fréquentes

**Q : Que se passe-t-il si je génère plusieurs fois pour la même phase ?**  
R : Les équipages déjà assignés à des courses existantes seront automatiquement exclus. Vous pouvez générer de nouvelles courses pour les équipages restants.

**Q : Puis-je mélanger des catégories avec des distances différentes ?**  
R : Non, toutes les catégories dans une même série doivent avoir la même distance (ou aucune distance).

**Q : Que se passe-t-il si une catégorie n'a pas assez d'équipages ?**  
R : Le backend retournera une erreur de validation avec le détail du problème.

**Q : Les équipages sont-ils sélectionnés dans un ordre spécifique ?**  
R : Non, la sélection est aléatoire parmi les équipages disponibles pour chaque catégorie.

