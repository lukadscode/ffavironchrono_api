# Guide Frontend : Support des Courses Basées sur le Temps

## 📋 Vue d'ensemble

Le système de distances a été étendu pour supporter les courses basées sur le **temps** (en secondes) en plus des courses basées sur la **distance** (en mètres).

Vous pouvez maintenant créer des distances pour des courses comme :
- **2 minutes** (120 secondes)
- **5 minutes** (300 secondes)
- **1 minute 30 secondes** (90 secondes)
- Etc.

## 🆕 Nouveaux champs dans l'API

### Modèle `Distance`

Les distances ont maintenant les champs suivants :

```typescript
interface Distance {
  id: string;
  event_id: string;
  meters: number | null;              // Distance en mètres (null si course basée sur le temps)
  is_relay: boolean;                  // Indique si c'est un relais
  relay_count: number | null;         // Nombre de relais (si is_relay = true)
  is_time_based: boolean;            // ✨ NOUVEAU : Indique si la course est basée sur le temps
  duration_seconds: number | null;    // ✨ NOUVEAU : Durée en secondes (null si course basée sur la distance)
  label: string;                      // Label formaté automatiquement (ex: "2000m", "2min", "2min 30s")
}
```

### Règles de validation

- Si `is_time_based = false` → `meters` est **requis**, `duration_seconds` doit être `null`
- Si `is_time_based = true` → `duration_seconds` est **requis**, `meters` doit être `null`
- Au moins un des deux (`meters` ou `duration_seconds`) doit être présent

## 📡 Endpoints API

### 1. Créer une distance basée sur le temps

**POST** `/distances`

**Exemple : Course de 2 minutes**

```json
{
  "event_id": "7c38e42f-198a-4bd6-9c59-9854094a1ea0",
  "duration_seconds": 120,
  "is_time_based": true,
  "is_relay": false
}
```

**Exemple : Course de 5 minutes 30 secondes**

```json
{
  "event_id": "7c38e42f-198a-4bd6-9c59-9854094a1ea0",
  "duration_seconds": 330,
  "is_time_based": true,
  "is_relay": false
}
```

**Exemple : Course de 2000m (existant, toujours fonctionnel)**

```json
{
  "event_id": "7c38e42f-198a-4bd6-9c59-9854094a1ea0",
  "meters": 2000,
  "is_time_based": false,
  "is_relay": false
}
```

### 2. Récupérer les distances

**GET** `/distances`

**GET** `/distances/event/:event_id`

Les distances sont triées automatiquement :
1. D'abord les distances basées sur les mètres (triées par `meters` croissant)
2. Ensuite les distances basées sur le temps (triées par `duration_seconds` croissant)

**Réponse (200 OK)** :

```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid-1",
      "event_id": "event-uuid",
      "meters": 500,
      "is_time_based": false,
      "duration_seconds": null,
      "is_relay": false,
      "relay_count": null,
      "label": "500m"
    },
    {
      "id": "uuid-2",
      "event_id": "event-uuid",
      "meters": 2000,
      "is_time_based": false,
      "duration_seconds": null,
      "is_relay": false,
      "relay_count": null,
      "label": "2000m"
    },
    {
      "id": "uuid-3",
      "event_id": "event-uuid",
      "meters": null,
      "is_time_based": true,
      "duration_seconds": 120,
      "is_relay": false,
      "relay_count": null,
      "label": "2min"
    },
    {
      "id": "uuid-4",
      "event_id": "event-uuid",
      "meters": null,
      "is_time_based": true,
      "duration_seconds": 300,
      "is_relay": false,
      "relay_count": null,
      "label": "5min"
    },
    {
      "id": "uuid-5",
      "event_id": "event-uuid",
      "meters": null,
      "is_time_based": true,
      "duration_seconds": 150,
      "is_relay": false,
      "relay_count": null,
      "label": "2min 30s"
    }
  ]
}
```

## 🎨 Format d'affichage automatique

Le champ `label` est généré automatiquement par le backend selon le type de distance :

### Distances basées sur les mètres
- `500m` → `"500m"`
- `2000m` → `"2000m"`
- `8x250m` (relais) → `"8x250m"`

### Distances basées sur le temps
- `60s` → `"1min"`
- `120s` → `"2min"`
- `150s` → `"2min 30s"`
- `300s` → `"5min"`
- `45s` → `"45s"`

**Règle de formatage** :
- Si ≥ 60 secondes : affiche en minutes (`"2min"`)
- Si minutes + secondes : affiche les deux (`"2min 30s"`)
- Si < 60 secondes : affiche uniquement les secondes (`"45s"`)

## 💻 Exemples d'utilisation côté frontend

### TypeScript Interface

```typescript
interface Distance {
  id: string;
  event_id: string;
  meters: number | null;
  is_relay: boolean;
  relay_count: number | null;
  is_time_based: boolean;
  duration_seconds: number | null;
  label: string; // Formaté automatiquement par le backend
}

// Helper pour formater manuellement si besoin
function formatDistanceLabel(distance: Distance): string {
  if (distance.is_time_based && distance.duration_seconds) {
    const minutes = Math.floor(distance.duration_seconds / 60);
    const seconds = distance.duration_seconds % 60;
    
    if (minutes > 0 && seconds > 0) {
      return `${minutes}min ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}min`;
    } else {
      return `${distance.duration_seconds}s`;
    }
  } else if (distance.is_relay && distance.relay_count && distance.meters) {
    return `${distance.relay_count}x${distance.meters}m`;
  } else if (distance.meters) {
    return `${distance.meters}m`;
  }
  return "Distance inconnue";
}
```

### Créer une distance basée sur le temps

```typescript
async function createTimeBasedDistance(
  eventId: string,
  durationSeconds: number
) {
  const response = await fetch("/distances", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      event_id: eventId,
      duration_seconds: durationSeconds,
      is_time_based: true,
      is_relay: false,
    }),
  });

  const data = await response.json();
  return data.data;
}

// Exemple : Créer une course de 2 minutes
const distance = await createTimeBasedDistance(eventId, 120);
console.log(distance.label); // "2min"
```

### Filtrer les distances par type

```typescript
function getDistancesByType(distances: Distance[], isTimeBased: boolean) {
  return distances.filter((d) => d.is_time_based === isTimeBased);
}

// Récupérer uniquement les distances basées sur le temps
const timeBasedDistances = getDistancesByType(allDistances, true);

// Récupérer uniquement les distances basées sur les mètres
const meterBasedDistances = getDistancesByType(allDistances, false);
```

### Afficher dans un sélecteur

```tsx
function DistanceSelector({ distances, onSelect }: Props) {
  return (
    <select onChange={(e) => onSelect(e.target.value)}>
      <optgroup label="Distances (mètres)">
        {distances
          .filter((d) => !d.is_time_based)
          .map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
      </optgroup>
      <optgroup label="Durées (temps)">
        {distances
          .filter((d) => d.is_time_based)
          .map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
      </optgroup>
    </select>
  );
}
```

### Formulaire de création

```tsx
function CreateDistanceForm({ eventId }: { eventId: string }) {
  const [type, setType] = useState<"meters" | "time">("meters");
  const [meters, setMeters] = useState<number | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      event_id: eventId,
      is_time_based: type === "time",
      is_relay: false,
      ...(type === "time"
        ? { duration_seconds: durationSeconds, meters: null }
        : { meters, duration_seconds: null }),
    };

    await fetch("/distances", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Type de distance :
        <select value={type} onChange={(e) => setType(e.target.value as "meters" | "time")}>
          <option value="meters">Distance (mètres)</option>
          <option value="time">Durée (temps)</option>
        </select>
      </label>

      {type === "meters" ? (
        <label>
          Distance (mètres) :
          <input
            type="number"
            min="100"
            value={meters || ""}
            onChange={(e) => setMeters(parseInt(e.target.value))}
            required
          />
        </label>
      ) : (
        <div>
          <label>
            Minutes :
            <input
              type="number"
              min="0"
              value={durationSeconds ? Math.floor(durationSeconds / 60) : ""}
              onChange={(e) => {
                const mins = parseInt(e.target.value) || 0;
                const secs = durationSeconds ? durationSeconds % 60 : 0;
                setDurationSeconds(mins * 60 + secs);
              }}
            />
          </label>
          <label>
            Secondes :
            <input
              type="number"
              min="0"
              max="59"
              value={durationSeconds ? durationSeconds % 60 : ""}
              onChange={(e) => {
                const secs = parseInt(e.target.value) || 0;
                const mins = durationSeconds ? Math.floor(durationSeconds / 60) : 0;
                setDurationSeconds(mins * 60 + secs);
              }}
            />
          </label>
        </div>
      )}

      <button type="submit">Créer</button>
    </form>
  );
}
```

## 🔄 Rétrocompatibilité

✅ **Toutes les distances existantes continuent de fonctionner** :
- Les distances créées avant cette modification ont `is_time_based = false` et `duration_seconds = null`
- Le champ `label` est toujours disponible et formaté automatiquement
- Aucune migration de données n'est nécessaire côté frontend

## ⚠️ Points d'attention

1. **Validation** : Vérifiez toujours que `is_time_based` correspond aux champs renseignés :
   - Si `is_time_based = true` → `duration_seconds` doit être présent, `meters` doit être `null`
   - Si `is_time_based = false` → `meters` doit être présent, `duration_seconds` doit être `null`

2. **Affichage** : Utilisez le champ `label` fourni par le backend plutôt que de formater manuellement (sauf cas spécifique)

3. **Tri** : Les distances sont déjà triées par le backend, mais vous pouvez les re-trier côté frontend si besoin

4. **Import automatique** : Lors de l'import depuis l'API externe, les formats suivants sont automatiquement détectés :
   - `"2 min"`, `"5 minutes"` → convertis en secondes
   - `"120s"`, `"300 secondes"` → utilisés directement

## 📝 Exemples de cas d'usage

### Course indoor de 2 minutes
```json
{
  "event_id": "...",
  "duration_seconds": 120,
  "is_time_based": true
}
```

### Course de 1 minute 30 secondes
```json
{
  "event_id": "...",
  "duration_seconds": 90,
  "is_time_based": true
}
```

### Course de 5 minutes
```json
{
  "event_id": "...",
  "duration_seconds": 300,
  "is_time_based": true
}
```

## 🐛 Gestion des erreurs

**Erreur 400 - Validation** :
```json
{
  "status": "error",
  "message": "Au moins un des champs meters ou duration_seconds doit être renseigné"
}
```

**Erreur 400 - Champs incompatibles** :
```json
{
  "status": "error",
  "message": "Si is_time_based est true, duration_seconds est requis et meters doit être null"
}
```

## 📚 Ressources

- **Swagger** : `/api-docs` → Section `distances`
- **Endpoint** : `POST /distances`, `GET /distances`, `GET /distances/event/:event_id`

---

**Date de mise à jour** : 2025-01-XX  
**Version API** : Compatible avec toutes les versions existantes

