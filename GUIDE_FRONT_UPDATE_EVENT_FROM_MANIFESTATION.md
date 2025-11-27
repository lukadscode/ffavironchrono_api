# Documentation : Mise à jour incrémentale d'un événement depuis FFAviron

## Endpoint

```
POST /import/manifestation/{manifestation_id}/update
```

## Authentification

**Requise** : Bearer Token dans le header `Authorization`

```
Authorization: Bearer <token>
```

## Description

Cette route permet de mettre à jour un événement existant en ajoutant uniquement les **nouveaux éléments** depuis l'API FFAviron, sans toucher à l'existant. C'est une mise à jour **incrémentale** qui :

- ✅ Ajoute les nouvelles catégories
- ✅ Ajoute les nouveaux équipages
- ✅ Ajoute les nouveaux participants
- ✅ Ajoute les nouvelles distances
- ❌ **Ne supprime rien**
- ❌ **Ne duplique pas** les données existantes
- ❌ **Ne modifie pas** les courses, phases, ou autres données déjà créées

Cette route est idéale pour synchroniser un événement existant avec les dernières données de l'API FFAviron après qu'il ait été partiellement configuré (courses créées, phases organisées, etc.).

## Paramètres de la requête

### Path Parameters

| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `manifestation_id` | string | ✅ Oui | ID de la manifestation dans l'API FFAviron (dans l'URL) |

### Body (JSON)

| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `event_id` | string (UUID) | ✅ Oui | ID de l'événement à mettre à jour dans votre base de données |

## Exemple de requête

```javascript
const response = await axios.post(
  '/import/manifestation/12345/update',
  {
    event_id: 'abc-123-def-456'
  },
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);
```

### Exemple avec fetch

```javascript
const response = await fetch('/import/manifestation/12345/update', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    event_id: 'abc-123-def-456'
  })
});

const data = await response.json();
```

## Réponse en cas de succès

### Status Code : `200 OK`

```json
{
  "status": "success",
  "message": "Événement mis à jour avec succès",
  "data": {
    "event_id": "abc-123-def-456",
    "name": "Championnat de France 2024",
    "new_categories_count": 2,
    "new_crews_count": 15,
    "new_participants_count": 8,
    "total_participants_count": 120,
    "new_distances_count": 1,
    "new_categories": [
      {
        "id": "category-uuid-1",
        "code": "SF_2000m",
        "label": "Senior Femme 2000m",
        "age_group": "S",
        "gender": "Femme",
        "boat_seats": 4,
        "has_coxswain": false,
        "distance_id": "distance-uuid-1"
      },
      {
        "id": "category-uuid-2",
        "code": "SH_2000m",
        "label": "Senior Homme 2000m",
        "age_group": "S",
        "gender": "Homme",
        "boat_seats": 4,
        "has_coxswain": false,
        "distance_id": "distance-uuid-1"
      }
    ],
    "new_distances": [
      {
        "id": "distance-uuid-1",
        "meters": 2000,
        "is_relay": false,
        "relay_count": null,
        "label": "2000m"
      }
    ],
    "new_crews": [
      {
        "id": "crew-uuid-1",
        "category_id": "category-uuid-1",
        "category_code": "SF_2000m",
        "category_label": "Senior Femme 2000m",
        "club_name": "LE ROBERT ACR",
        "club_code": "C972007",
        "status": 8
      },
      {
        "id": "crew-uuid-2",
        "category_id": "category-uuid-1",
        "category_code": "SF_2000m",
        "category_label": "Senior Femme 2000m",
        "club_name": "FORT DE FRANCE",
        "club_code": "C972008",
        "status": 8
      }
    ],
    "new_participants": [
      {
        "id": "participant-uuid-1",
        "first_name": "Marie",
        "last_name": "Dupont",
        "license_number": "123456",
        "gender": "Femme",
        "club_name": "LE ROBERT ACR",
        "crew_id": "crew-uuid-1",
        "crew_club": "LE ROBERT ACR",
        "is_coxswain": false,
        "seat_position": 1
      },
      {
        "id": "participant-uuid-2",
        "first_name": "Jean",
        "last_name": "Martin",
        "license_number": "789012",
        "gender": "Homme",
        "club_name": "FORT DE FRANCE",
        "crew_id": "crew-uuid-2",
        "crew_club": "FORT DE FRANCE",
        "is_coxswain": false,
        "seat_position": 2
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
| `data.event_id` | string (UUID) | ID de l'événement mis à jour |
| `data.name` | string | Nom de l'événement |
| `data.new_categories_count` | integer | Nombre de nouvelles catégories créées |
| `data.new_crews_count` | integer | Nombre de nouveaux équipages créés |
| `data.new_participants_count` | integer | Nombre de nouveaux participants créés (participants qui n'existaient pas du tout) |
| `data.total_participants_count` | integer | Nombre total de participants liés aux nouveaux équipages (inclut les participants réutilisés) |
| `data.new_distances_count` | integer | Nombre de nouvelles distances créées |
| `data.new_categories` | array | Détails complets des nouvelles catégories créées (voir structure ci-dessous) |
| `data.new_distances` | array | Détails complets des nouvelles distances créées (voir structure ci-dessous) |
| `data.new_crews` | array | Détails complets des nouveaux équipages créés (voir structure ci-dessous) |
| `data.new_participants` | array | Détails complets des nouveaux participants créés (voir structure ci-dessous) |

### Structure des nouvelles catégories

Chaque élément de `data.new_categories` contient :

| Champ | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | ID de la catégorie |
| `code` | string | Code unique de la catégorie (ex: "SF_2000m") |
| `label` | string | Libellé de la catégorie |
| `age_group` | string \| null | Groupe d'âge (ex: "S", "U17") |
| `gender` | string | Genre ("Homme", "Femme", "Mixte") |
| `boat_seats` | integer \| null | Nombre de places dans le bateau |
| `has_coxswain` | boolean | Indique si le bateau a un barreur |
| `distance_id` | string (UUID) \| null | ID de la distance associée |

### Structure des nouvelles distances

Chaque élément de `data.new_distances` contient :

| Champ | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | ID de la distance |
| `meters` | integer | Distance en mètres |
| `is_relay` | boolean | Indique si c'est un relais |
| `relay_count` | integer \| null | Nombre de relais (si `is_relay` = true) |
| `label` | string | Libellé formaté (ex: "2000m" ou "8x250m") |

### Structure des nouveaux équipages

Chaque élément de `data.new_crews` contient :

| Champ | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | ID de l'équipage |
| `category_id` | string (UUID) | ID de la catégorie |
| `category_code` | string | Code de la catégorie |
| `category_label` | string | Libellé de la catégorie |
| `club_name` | string | Nom du club |
| `club_code` | string | Code du club |
| `status` | integer | Statut de l'équipage (défaut: 8) |

### Structure des nouveaux participants

Chaque élément de `data.new_participants` contient :

| Champ | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | ID du participant |
| `first_name` | string | Prénom |
| `last_name` | string | Nom |
| `license_number` | string \| null | Numéro de licence |
| `gender` | string | Genre ("Homme", "Femme") |
| `club_name` | string | Nom du club |
| `crew_id` | string (UUID) | ID de l'équipage auquel il appartient |
| `crew_club` | string | Nom du club de l'équipage |
| `is_coxswain` | boolean | Indique si c'est un barreur |
| `seat_position` | integer \| null | Position dans le bateau (1-8, null pour barreur) |

## Réponse en cas d'erreur

### Status Code : `400 Bad Request` - Paramètres manquants

```json
{
  "status": "error",
  "message": "event_id est requis dans le body de la requête"
}
```

### Status Code : `404 Not Found` - Événement introuvable

```json
{
  "status": "error",
  "message": "Événement abc-123-def-456 introuvable",
  "details": {
    "message": "Événement abc-123-def-456 introuvable",
    "duration": "2.34s",
    "event_id": "abc-123-def-456"
  }
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

### Status Code : `500 Internal Server Error` - Erreur serveur

```json
{
  "status": "error",
  "message": "Message d'erreur détaillé",
  "details": {
    "message": "Erreur API: 404 - ...",
    "duration": "5.67s",
    "event_id": "abc-123-def-456"
  }
}
```

## Comportement de la mise à jour

### Détection des doublons

Le backend détecte automatiquement les éléments existants pour éviter les doublons :

1. **Catégories** : Vérifie si une catégorie avec le même code existe déjà
2. **Distances** : Vérifie si une distance avec les mêmes caractéristiques (mètres, type relais) existe déjà pour l'événement
3. **Équipages** : Vérifie si un équipage avec la même catégorie, `club_name` et `club_code` existe déjà
4. **Participants** : Utilise une logique de `findOrCreate` basée sur :
   - Le numéro de licence (si disponible)
   - Le nom + prénom (si pas de licence)

### Ce qui est préservé

La mise à jour **ne touche jamais** à :
- ✅ Les courses existantes
- ✅ Les phases existantes
- ✅ Les assignations d'équipages aux courses (`race_crews`)
- ✅ Les données de chronométrage
- ✅ Les classements
- ✅ Les notifications
- ✅ Toute autre donnée déjà créée

### Ce qui est ajouté

La mise à jour ajoute uniquement :
- ✅ Les nouvelles catégories qui n'existent pas encore
- ✅ Les nouveaux équipages qui n'existent pas encore
- ✅ Les nouveaux participants qui n'existent pas encore
- ✅ Les nouvelles distances qui n'existent pas encore
- ✅ Les liens entre catégories et événement (`event_categories`)

## Exemple TypeScript complet

```typescript
interface UpdateEventFromManifestationParams {
  manifestation_id: string; // ID de la manifestation dans l'API FFAviron
  event_id: string;         // ID de l'événement dans votre base de données
}

interface UpdateEventResponse {
  status: "success";
  message: string;
  data: {
    event_id: string;
    name: string;
    new_categories_count: number;
    new_crews_count: number;
    new_participants_count: number;
    total_participants_count: number;
    new_distances_count: number;
  };
}

interface UpdateEventError {
  status: "error";
  message: string;
  details?: {
    message: string;
    duration?: string;
    event_id?: string;
    stack?: string;
  };
}

async function updateEventFromManifestation(
  params: UpdateEventFromManifestationParams,
  token: string
): Promise<UpdateEventResponse> {
  try {
    const response = await axios.post<UpdateEventResponse>(
      `/import/manifestation/${params.manifestation_id}/update`,
      {
        event_id: params.event_id,
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
      const errorData = error.response.data as UpdateEventError;
      throw new Error(
        errorData.details?.message || errorData.message || "Erreur inconnue"
      );
    }
    throw error;
  }
}

// Utilisation
try {
  const result = await updateEventFromManifestation(
    {
      manifestation_id: "12345",
      event_id: "abc-123-def-456",
    },
    userToken
  );

  console.log(`✅ Événement mis à jour: ${result.data.name}`);
  console.log(`📊 ${result.data.new_categories_count} nouvelles catégories`);
  console.log(`📊 ${result.data.new_crews_count} nouveaux équipages`);
  console.log(`📊 ${result.data.new_participants_count} nouveaux participants`);
  console.log(`📊 ${result.data.new_distances_count} nouvelles distances`);
} catch (error) {
  console.error("❌ Erreur:", error.message);
}
```

## Exemple React/TypeScript avec hook

```typescript
import { useState } from 'react';
import axios from 'axios';

interface UpdateResult {
  new_categories_count: number;
  new_crews_count: number;
  new_participants_count: number;
  new_distances_count: number;
}

export function useUpdateEventFromManifestation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UpdateResult | null>(null);

  const updateEvent = async (
    manifestationId: string,
    eventId: string,
    token: string
  ) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await axios.post(
        `/import/manifestation/${manifestationId}/update`,
        { event_id: eventId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setResult(response.data.data);
      return response.data;
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message || err.message || "Erreur inconnue";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return { updateEvent, loading, error, result };
}

// Utilisation dans un composant
function EventUpdateButton({ eventId, manifestationId }: Props) {
  const { updateEvent, loading, error, result } = useUpdateEventFromManifestation();
  const token = useAuthToken(); // Votre hook d'authentification

  const handleUpdate = async () => {
    try {
      await updateEvent(manifestationId, eventId, token);
      // Afficher un message de succès
      alert("Événement mis à jour avec succès !");
    } catch (err) {
      // L'erreur est déjà gérée par le hook
      console.error(err);
    }
  };

  return (
    <div>
      <button onClick={handleUpdate} disabled={loading}>
        {loading ? "Mise à jour..." : "Mettre à jour depuis FFAviron"}
      </button>
      
      {error && <div className="error">{error}</div>}
      
      {result && (
        <div className="success">
          <p>✅ Mise à jour réussie !</p>
          <ul>
            <li>{result.new_categories_count} nouvelles catégories</li>
            <li>{result.new_crews_count} nouveaux équipages</li>
            <li>{result.new_participants_count} nouveaux participants</li>
            <li>{result.new_distances_count} nouvelles distances</li>
          </ul>
        </div>
      )}
    </div>
  );
}
```

## Cas d'usage

### Cas 1 : Synchronisation après ajout d'inscriptions

Un organisateur a ajouté de nouvelles inscriptions sur le site FFAviron après l'import initial. Vous pouvez utiliser cette route pour ajouter uniquement les nouveaux équipages sans perdre les courses déjà créées.

```typescript
// Après que l'utilisateur ait créé des courses et organisé des phases
// Il peut synchroniser pour récupérer les nouvelles inscriptions
await updateEventFromManifestation(
  {
    manifestation_id: "12345",
    event_id: existingEventId,
  },
  token
);
```

### Cas 2 : Ajout de nouvelles catégories

De nouvelles catégories ont été ajoutées à la manifestation. Cette route les ajoutera automatiquement sans affecter les catégories existantes.

### Cas 3 : Correction d'erreurs d'import

Si certains équipages n'ont pas été importés lors de l'import initial (problème réseau, timeout, etc.), cette route permet de compléter l'import sans tout recréer.

## Différences avec `/import/manifestation/:id`

| Aspect | `/import/manifestation/:id` | `/import/manifestation/:id/update` |
|--------|----------------------------|-------------------------------------|
| **Action** | Crée un nouvel événement | Met à jour un événement existant |
| **Événement** | Crée un nouvel événement | Nécessite `event_id` existant |
| **Catégories** | Crée toutes les catégories | Ajoute uniquement les nouvelles |
| **Équipages** | Crée tous les équipages | Ajoute uniquement les nouveaux |
| **Phases** | Crée une phase par défaut | Ne touche pas aux phases existantes |
| **Courses** | N'en crée pas | Ne touche pas aux courses existantes |
| **Idempotence** | Non (crée toujours un nouvel événement) | Oui (peut être appelée plusieurs fois) |

## Notes importantes

1. **Idempotence** : Cette route peut être appelée plusieurs fois sans problème. Elle n'ajoutera que les éléments qui n'existent pas encore.

2. **Performance** : Pour de grandes quantités de données, la mise à jour peut prendre quelques secondes. Le frontend devrait afficher un indicateur de chargement.

3. **Sécurité** : L'événement doit exister et l'utilisateur doit être authentifié. Le backend vérifie que l'événement existe avant de procéder.

4. **Gestion des erreurs** : En cas d'erreur API (ex: manifestation introuvable sur FFAviron), une erreur détaillée est retournée avec le code de statut HTTP de l'API externe.

5. **Logs** : Le backend log des informations de progression (tous les 50 équipages traités) pour suivre l'avancement.

## Questions fréquentes

**Q : Que se passe-t-il si je mets à jour un événement qui a déjà des courses créées ?**  
R : Les courses existantes ne sont **pas affectées**. Seuls les nouveaux équipages sont ajoutés et restent disponibles pour être assignés manuellement ou via la génération de courses.

**Q : Puis-je utiliser cette route pour remplacer complètement les données ?**  
R : Non, cette route est conçue pour une mise à jour **incrémentale**. Si vous voulez remplacer complètement les données, vous devrez supprimer l'événement et le réimporter avec `/import/manifestation/:id`.

**Q : Les équipages déjà assignés à des courses sont-ils modifiés ?**  
R : Non, les équipages existants (même ceux déjà assignés à des courses) ne sont **pas modifiés**. Seuls les nouveaux équipages sont ajoutés.

**Q : Que faire si la manifestation n'existe plus sur FFAviron ?**  
R : Le backend retournera une erreur 500 avec les détails de l'erreur API (probablement un 404 de l'API FFAviron).

**Q : Combien de temps prend la mise à jour ?**  
R : Cela dépend du nombre de nouvelles inscriptions. Pour 100 nouveaux équipages, comptez environ 5-10 secondes. Le backend log la progression tous les 50 équipages.

**Q : Puis-je mettre à jour plusieurs fois le même événement ?**  
R : Oui, c'est même recommandé si de nouvelles inscriptions arrivent régulièrement. Chaque appel n'ajoutera que les éléments qui n'existent pas encore.

