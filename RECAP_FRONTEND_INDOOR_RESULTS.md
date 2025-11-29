# 📋 Récapitulatif : Système de Résultats Indoor (ErgRace)

## 🎯 Vue d'ensemble

Un système complet a été mis en place pour gérer l'import et l'affichage des résultats des courses indoor depuis le logiciel **ErgRace**. Le système permet d'importer les résultats au format JSON ErgRace et de les lier automatiquement aux équipages existants dans la plateforme.

---

## 🏗️ Architecture technique

### Tables créées

#### 1. `indoor_race_results`
Stocke les métadonnées de la course et le JSON complet pour traçabilité.

**Champs principaux** :
- `race_id` : ID de la course dans la plateforme (optionnel)
- `ergrace_race_id` : ID unique de la course dans ErgRace (UUID)
- `race_start_time`, `race_end_time` : Horaires de la course
- `duration` : Durée en millisecondes
- `raw_data` : JSON complet ErgRace (backup)

#### 2. `indoor_participant_results`
Stocke les résultats normalisés de chaque participant.

**Champs principaux** :
- `crew_id` : ID de l'équipage (si identifié)
- `ergrace_participant_id` : ID dans ErgRace (UUID du crew_id ou "Lane X")
- `place` : Classement
- `time_ms` : Temps en millisecondes (pour tri/calculs)
- `time_display` : Temps formaté "0:24.1"
- `distance`, `avg_pace`, `spm`, `calories` : Données de performance
- `splits_data` : Splits détaillés (JSON optionnel)

### Optimisations appliquées

✅ **Champs redondants supprimés** : Les infos déjà dans `races`, `crews`, `categories` sont récupérées via JOIN  
✅ **Liaison automatique** : `ergrace_participant_id` (UUID) = `crew_id` si l'équipage existe  
✅ **Splits optionnels** : Stockés uniquement si nécessaires (économie d'espace)  
✅ **JSON backup** : Le JSON complet ErgRace est conservé pour traçabilité

---

## 🔌 Routes API disponibles

### 1. Importer les résultats
**POST** `/indoor-results/import`

Importe les résultats d'une course depuis le format JSON ErgRace.

**Authentification** : ✅ Requise (Bearer Token)

**Body** :
```json
{
  "results": {
    "race_id": "46916f84-f780-488c-813d-a5475142f86e",  // UUID ErgRace (requis)
    "c2_race_id": "abc-123-def-456",  // ID course plateforme (optionnel)
    "ergrace_version": "03.01.01",
    "race_start_time": "2025-11-28 18:33:05",
    "race_end_time": "2025-11-28 18:33:44",
    "duration": 100,  // millisecondes
    "time_cap": 0,
    "race_file_name": "Course_test_46916f84-f780-488c-813d-a5475142f86e.rac2",
    "participants": [
      {
        "id": "c45d85a1-8493-4e3e-9440-1a7ef4852406",  // UUID crew_id ou "Lane X"
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
    "linked_crews_count": 6,  // Nombre d'équipages liés automatiquement
    "unlinked_participants_count": 2  // Participants non identifiés ("Lane X")
  }
}
```

**Réponse (200 OK)** : Si les résultats existent déjà (même `ergrace_race_id`), ils sont mis à jour.

**Codes d'erreur** :
- `400` : Format JSON invalide
- `404` : Course introuvable (si `c2_race_id` fourni)

---

### 2. Récupérer les résultats d'une course
**GET** `/indoor-results/race/:race_id`

Récupère les résultats d'une course avec tous les détails des participants, incluant les informations des équipages (club, catégorie) si liés.

**Authentification** : ✅ Requise (Bearer Token)

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
        "time_ms": 2410,  // Pour tri/calculs
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

**Codes d'erreur** :
- `404` : Aucun résultat trouvé pour cette course

---

### 3. Récupérer tous les résultats d'un événement
**GET** `/indoor-results/event/:event_id`

Récupère tous les résultats des courses indoor d'un événement.

**Authentification** : ✅ Requise (Bearer Token)

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

---

## 🔗 Liaison automatique des équipages

Le système tente automatiquement de lier les participants ErgRace avec les équipages de la plateforme :

### Règle de liaison

- **Si `participant.id` est un UUID valide** → Vérifie si c'est un `crew_id` existant
  - ✅ Si trouvé → `crew_id` = UUID, `crew` renseigné
  - ❌ Si non trouvé → `crew_id` = NULL, `crew` = NULL
- **Si `participant.id` = "Lane X"** → Participant non identifié, `crew_id` = NULL

### Exemple

```json
// Participant lié (UUID valide correspondant à un crew)
{
  "id": "c45d85a1-8493-4e3e-9440-1a7ef4852406",
  "crew": {
    "id": "c45d85a1-8493-4e3e-9440-1a7ef4852406",
    "club_name": "LE ROBERT ACR",
    "club_code": "C972007",
    "category": {
      "code": "SF_2000m",
      "label": "Senior Femme 2000m"
    }
  }
}

// Participant non lié ("Lane X" ou UUID non trouvé)
{
  "id": "Lane 8",
  "crew": null
}
```

---

## 💻 Exemple d'utilisation (TypeScript/React)

```typescript
import axios from 'axios';

const API_URL = 'https://api-timing.ffaviron.fr';

// Configuration axios avec token
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Ajouter le token aux requêtes
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 1. Importer les résultats ErgRace
export async function importIndoorResults(
  ergraceData: any,
  raceId?: string
): Promise<any> {
  try {
    const response = await apiClient.post('/indoor-results/import', {
      results: {
        ...ergraceData,
        c2_race_id: raceId,  // Optionnel : ID de la course dans la plateforme
      },
    });
    
    console.log('✅ Résultats importés:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('❌ Erreur import:', error.response?.data);
    throw error;
  }
}

// 2. Récupérer les résultats d'une course
export async function getRaceResults(raceId: string): Promise<any> {
  try {
    const response = await apiClient.get(`/indoor-results/race/${raceId}`);
    return response.data.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.log('Aucun résultat pour cette course');
      return null;
    }
    console.error('❌ Erreur récupération:', error.response?.data);
    throw error;
  }
}

// 3. Récupérer tous les résultats d'un événement
export async function getEventResults(eventId: string): Promise<any> {
  try {
    const response = await apiClient.get(`/indoor-results/event/${eventId}`);
    return response.data.data;
  } catch (error: any) {
    console.error('❌ Erreur récupération:', error.response?.data);
    throw error;
  }
}

// Exemple d'utilisation dans un composant React
function RaceResultsComponent({ raceId }: { raceId: string }) {
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchResults() {
      try {
        const data = await getRaceResults(raceId);
        setResults(data);
      } catch (error) {
        console.error('Erreur:', error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchResults();
  }, [raceId]);

  if (loading) return <div>Chargement...</div>;
  if (!results) return <div>Aucun résultat</div>;

  return (
    <div>
      <h2>Résultats de la course</h2>
      <table>
        <thead>
          <tr>
            <th>Place</th>
            <th>Équipage</th>
            <th>Temps</th>
            <th>Allure</th>
            <th>SPM</th>
          </tr>
        </thead>
        <tbody>
          {results.participants.map((p: any) => (
            <tr key={p.id}>
              <td>{p.place}</td>
              <td>
                {p.crew ? (
                  <>
                    {p.crew.club_name} - {p.crew.category?.label}
                  </>
                ) : (
                  <span style={{ color: 'gray' }}>
                    {p.ergrace_participant_id} (non identifié)
                  </span>
                )}
              </td>
              <td>{p.time_display}</td>
              <td>{p.avg_pace}</td>
              <td>{p.spm}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## ⚠️ Points importants à connaître

### 1. Mise à jour automatique
Si vous importez les mêmes résultats (même `ergrace_race_id`), ils seront **mis à jour** au lieu d'être dupliqués. L'ancien statut est `200 OK` au lieu de `201 Created`.

### 2. Statut de la course
Si `c2_race_id` est fourni et que la course existe, son statut sera automatiquement mis à `finished`.

### 3. Splits optionnels
Les splits peuvent être omis pour économiser l'espace. Ils sont stockés dans `splits_data` (JSON) uniquement si fournis dans le payload.

### 4. JSON complet conservé
Le JSON complet ErgRace est conservé dans `raw_data` pour traçabilité/audit. Vous pouvez le récupérer si besoin.

### 5. Format des temps
- **`time_display`** : Format lisible "0:24.1"
- **`time_ms`** : Temps en millisecondes (pour tri/calculs)
- Les temps sont automatiquement convertis depuis le format ErgRace

### 6. Participants non identifiés
Les participants avec `id = "Lane X"` ne sont pas liés à un équipage. Le champ `crew` sera `null`. Vous pouvez afficher un message comme "Participant non identifié" ou "Lane X".

---

## 📚 Documentation complémentaire

- **Guide détaillé** : `GUIDE_FRONT_INDOOR_RESULTS.md`
- **Architecture** : `ARCHITECTURE_INDOOR_RESULTS.md`
- **Optimisations** : `OPTIMISATIONS_INDOOR_RESULTS.md`
- **Swagger** : Disponible sur `/docs` (interface Swagger UI)

---

## 🚀 Prochaines étapes

1. ✅ **Migration SQL** : Exécuter `migrations/create_indoor_results_tables.sql`
2. ✅ **Tester l'import** : Utiliser `POST /indoor-results/import` avec un fichier ErgRace
3. ✅ **Afficher les résultats** : Utiliser `GET /indoor-results/race/:race_id`
4. ✅ **Gérer les participants non liés** : Afficher un message approprié si `crew` est `null`

---

## 📡 WebSocket - Notifications en temps réel

Le système émet des événements WebSocket pour mettre à jour les résultats en temps réel sur la page Live.

### Événements disponibles

1. **`indoorResultsImported`** : Émis après l'import des résultats
2. **`indoorParticipantUpdate`** : Émis quand un participant termine sa course (si ErgRace envoie des mises à jour en temps réel)
3. **`indoorRaceResultsComplete`** : Émis quand la course passe en statut "official"

### Documentation complète

📖 **Voir le guide détaillé** : `GUIDE_FRONT_WEBSOCKET_INDOOR_RESULTS.md`

**Exemple rapide** :
```typescript
socket.on("indoorResultsImported", async ({ race_id, participants_count }) => {
  // Recharger les résultats de la course
  const results = await getRaceResults(race_id);
  setRaceResults(results);
});
```

---

## 📞 Support

En cas de question ou problème :
- Consulter la documentation Swagger : `/docs`
- Guide WebSocket : `GUIDE_FRONT_WEBSOCKET_INDOOR_RESULTS.md`
- Vérifier les logs serveur pour les erreurs détaillées
- Les erreurs retournent toujours un format cohérent avec `status: "error"` et `message`

---

**Date de création** : 2024-01-XX  
**Version API** : 1.0.0  
**Statut** : ✅ Prêt pour production  
**WebSocket** : ✅ Implémenté et documenté

