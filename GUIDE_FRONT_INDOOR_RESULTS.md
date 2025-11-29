# Guide Frontend : Résultats Indoor (ErgRace)

## Routes disponibles

### 1. Importer les résultats
**POST** `/indoor-results/import`

Importe les résultats d'une course depuis le format JSON ErgRace.

**Headers** :
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body** :
```json
{
  "results": {
    "race_id": "46916f84-f780-488c-813d-a5475142f86e",
    "c2_race_id": "abc-123-def-456",  // Optionnel : ID de la course dans la plateforme
    "ergrace_version": "03.01.01",
    "race_start_time": "2025-11-28 18:33:05",
    "race_end_time": "2025-11-28 18:33:44",
    "duration": 100,
    "time_cap": 0,
    "race_file_name": "Course_test_46916f84-f780-488c-813d-a5475142f86e.rac2",
    "participants": [
      {
        "id": "c45d85a1-8493-4e3e-9440-1a7ef4852406",  // UUID du crew_id ou "Lane X"
        "place": 1,
        "time": "0:24.1",
        "score": "0:24.1",
        "distance": 100,
        "avg_pace": "2:00.5",
        "spm": 32,
        "calories": 6,
        "serial_number": 431859705,
        "machine_type": "row",
        "logged_time": "28/11/2025 18:32:00",
        "splits": [...]  // Optionnel
      }
    ]
  }
}
```

**Réponse (201 Created)** :
```json
{
  "status": "success",
  "message": "Résultats importés avec succès",
  "data": {
    "indoor_race_result_id": "uuid-du-resultat",
    "race_id": "abc-123-def-456",
    "ergrace_race_id": "46916f84-f780-488c-813d-a5475142f86e",
    "participants_count": 8,
    "linked_crews_count": 6,
    "unlinked_participants_count": 2
  }
}
```

**Note** : Si les résultats existent déjà (même `ergrace_race_id`), ils seront mis à jour (200 OK).

### 2. Récupérer les résultats d'une course
**GET** `/indoor-results/race/:race_id`

Récupère les résultats d'une course avec tous les détails des participants.

**Headers** :
```
Authorization: Bearer <token>
```

**Réponse (200 OK)** :
```json
{
  "status": "success",
  "data": {
    "race_result": {
      "id": "uuid",
      "race_id": "abc-123-def-456",
      "ergrace_race_id": "46916f84-f780-488c-813d-a5475142f86e",
      "race_start_time": "2025-11-28T18:33:05.000Z",
      "race_end_time": "2025-11-28T18:33:44.000Z",
      "duration": 100
    },
    "participants": [
      {
        "id": "uuid",
        "place": 1,
        "time_display": "0:24.1",
        "time_ms": 2410,
        "score": "0:24.1",
        "distance": 100,
        "avg_pace": "2:00.5",
        "spm": 32,
        "calories": 6,
        "machine_type": "row",
        "logged_time": "2025-11-28T18:32:00.000Z",
        "crew": {
          "id": "c45d85a1-8493-4e3e-9440-1a7ef4852406",
          "club_name": "LE ROBERT ACR",
          "club_code": "C972007",
          "category": {
            "id": "uuid",
            "code": "SF_2000m",
            "label": "Senior Femme 2000m"
          }
        },
        "ergrace_participant_id": "c45d85a1-8493-4e3e-9440-1a7ef4852406",
        "splits_data": [...]  // Si présents
      }
    ]
  }
}
```

**Note** : Les participants sont triés par `place` (classement).

### 3. Récupérer tous les résultats d'un événement
**GET** `/indoor-results/event/:event_id`

Récupère tous les résultats des courses indoor d'un événement.

**Headers** :
```
Authorization: Bearer <token>
```

**Réponse (200 OK)** :
```json
{
  "status": "success",
  "data": [
    {
      "race": {
        "id": "abc-123-def-456",
        "name": "Série 1",
        "race_number": 1
      },
      "result": {
        "id": "uuid",
        "race_start_time": "2025-11-28T18:33:05.000Z",
        "race_end_time": "2025-11-28T18:33:44.000Z",
        "duration": 100
      },
      "participants": [
        {
          "place": 1,
          "time_display": "0:24.1",
          "crew": {
            "club_name": "LE ROBERT ACR",
            "category": "Senior Femme 2000m"
          }
        }
      ]
    }
  ]
}
```

## Liaison automatique des équipages

Le système tente automatiquement de lier les participants ErgRace avec les équipages de la plateforme :

- **Si `participant.id` est un UUID valide** → Vérifie si c'est un `crew_id` existant
- **Si `participant.id` = "Lane X"** → Participant non identifié, `crew_id` = NULL

**Exemple** :
```javascript
// Participant lié
{
  "id": "c45d85a1-8493-4e3e-9440-1a7ef4852406",  // UUID valide
  "crew": {
    "id": "c45d85a1-8493-4e3e-9440-1a7ef4852406",
    "club_name": "LE ROBERT ACR",
    "category": {...}
  }
}

// Participant non lié
{
  "id": "Lane 8",  // Pas un UUID
  "crew": null
}
```

## Gestion des erreurs

### 400 Bad Request
```json
{
  "status": "error",
  "message": "Le format JSON ErgRace est invalide (results.race_id manquant)"
}
```

### 404 Not Found
```json
{
  "status": "error",
  "message": "Course introuvable avec l'ID: abc-123-def-456"
}
```

ou

```json
{
  "status": "error",
  "message": "Aucun résultat trouvé pour cette course"
}
```

### 500 Internal Server Error
```json
{
  "status": "error",
  "message": "Erreur lors de l'import des résultats"
}
```

## Exemple d'utilisation (TypeScript/React)

```typescript
import axios from 'axios';

const API_URL = 'https://api-timing.ffaviron.fr';

// Importer les résultats
async function importIndoorResults(ergraceData: any, raceId?: string) {
  try {
    const response = await axios.post(
      `${API_URL}/indoor-results/import`,
      {
        results: {
          ...ergraceData,
          c2_race_id: raceId,  // Optionnel
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Résultats importés:', response.data);
    return response.data;
  } catch (error) {
    console.error('Erreur import:', error.response?.data);
    throw error;
  }
}

// Récupérer les résultats d'une course
async function getRaceResults(raceId: string) {
  try {
    const response = await axios.get(
      `${API_URL}/indoor-results/race/${raceId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    return response.data.data;
  } catch (error) {
    console.error('Erreur récupération:', error.response?.data);
    throw error;
  }
}

// Récupérer tous les résultats d'un événement
async function getEventResults(eventId: string) {
  try {
    const response = await axios.get(
      `${API_URL}/indoor-results/event/${eventId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    return response.data.data;
  } catch (error) {
    console.error('Erreur récupération:', error.response?.data);
    throw error;
  }
}
```

## Notes importantes

1. **Mise à jour automatique** : Si vous importez les mêmes résultats (même `ergrace_race_id`), ils seront mis à jour au lieu d'être dupliqués.

2. **Statut de la course** : Si `c2_race_id` est fourni et que la course existe, son statut sera automatiquement mis à `finished`.

3. **Splits optionnels** : Les splits peuvent être omis pour économiser l'espace. Ils sont stockés dans `splits_data` (JSON) uniquement si fournis.

4. **JSON complet conservé** : Le JSON complet ErgRace est conservé dans `raw_data` pour traçabilité/audit.

