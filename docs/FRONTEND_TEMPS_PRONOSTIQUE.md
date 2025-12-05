# Guide Frontend : Temps Pronostique des Équipages

## 📋 Vue d'ensemble

Un nouveau champ `temps_pronostique` a été ajouté au modèle `Crew` (équipage). Ce champ permet de stocker le temps pronostique de l'équipage en secondes, calculé automatiquement lors de l'import depuis l'API FFAviron.

**Impact principal** : Ce temps est maintenant utilisé pour trier automatiquement les équipages lors de la génération des courses, du plus rapide au plus lent.

---

## 🗂️ Structure des données

### Modèle Crew - Nouveau champ

Le modèle `Crew` inclut maintenant le champ suivant :

```typescript
interface Crew {
  id: string;
  event_id: string;
  category_id: string;
  status: string;
  club_name: string | null;
  club_code: string | null;
  coach_name: string | null;
  temps_pronostique: number | null; // ← NOUVEAU : Temps en secondes
}
```

### Format du champ

- **Type** : `number | null`
- **Unité** : Secondes (INTEGER en base de données)
- **Valeur** :
  - `null` si aucun temps pronostique n'est disponible
  - Nombre entier représentant le temps total en secondes

### Exemple de données

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "event_id": "uuid",
  "category_id": "uuid",
  "status": "registered",
  "club_name": "LE ROBERT ACR",
  "club_code": "C972007",
  "coach_name": null,
  "temps_pronostique": 1920 // 32 minutes (4 x 8:00.0)
}
```

---

## 📥 Calcul automatique lors de l'import

### Source des données

Le temps pronostique est extrait depuis l'API FFAviron lors de l'import d'une manifestation. Il peut provenir de plusieurs sources :

1. **Temps des rameurs individuels** : Dans `infos_complementaires_rameur_X` (rameurs 1 à 8)

   - Format : `"Temps pronostique: 8:00.0"`
   - Format : `"Temps pronostique: 1:08:00.0"`

2. **Temps du barreur** : Dans `infos_complementaires_barreur`

   - Même format que les rameurs

3. **Temps au niveau de l'inscription** : Dans `temps_pronostique`
   - Format : `"8:00.0"` ou `"1:08:00.0"`

### Calcul

**Le temps pronostique de l'équipage est la SOMME de tous les temps pronostiques trouvés** :

```javascript
temps_pronostique_equipage =
  temps_rameur_1 +
  temps_rameur_2 +
  ... +
  temps_rameur_8 +
  temps_barreur +
  temps_inscription
```

### Exemple de calcul

Si un équipage de 4 rameurs a les temps suivants :

- Rameur 1 : `"Temps pronostique: 8:00.0"` → 480 secondes
- Rameur 2 : `"Temps pronostique: 8:00.0"` → 480 secondes
- Rameur 3 : `"Temps pronostique: 8:00.0"` → 480 secondes
- Rameur 4 : `"Temps pronostique: 8:00.0"` → 480 secondes
- Rameurs 5-8 : pas de temps
- Barreur : pas de temps
- Inscription : pas de temps

**Résultat** : `temps_pronostique = 480 + 480 + 480 + 480 = 1920 secondes (32 minutes)`

### Formats de temps supportés

Le parser accepte les formats suivants :

| Format d'entrée                 | Exemple                        | Résultat (secondes) |
| ------------------------------- | ------------------------------ | ------------------- |
| `MM:SS.S`                       | `8:00.0`                       | 480                 |
| `HH:MM:SS.S`                    | `1:08:00.0`                    | 4080                |
| `Temps pronostique: MM:SS.S`    | `Temps pronostique: 8:00.0`    | 480                 |
| `Temps pronostique: HH:MM:SS.S` | `Temps pronostique: 1:08:00.0` | 4080                |

---

## 🔄 Routes API affectées

### Routes qui retournent des crews

Toutes les routes qui retournent des équipages incluent maintenant automatiquement le champ `temps_pronostique` :

#### 1. GET `/crews` - Liste des équipages

```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "event_id": "uuid",
      "category_id": "uuid",
      "status": "registered",
      "club_name": "LE ROBERT ACR",
      "club_code": "C972007",
      "temps_pronostique": 1920,
      ...
    }
  ]
}
```

#### 2. GET `/crews/:id` - Détails d'un équipage

Même format que ci-dessus.

#### 3. GET `/crews/event/:event_id` - Équipages par événement

Même format que ci-dessus.

#### 4. GET `/race-crews/:race_id` - Équipages d'une course

Les équipages retournés via `RaceCrew` incluent aussi `temps_pronostique` :

```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "race_id": "uuid",
      "crew_id": "uuid",
      "lane": 1,
      "crew": {
        "id": "uuid",
        "club_name": "LE ROBERT ACR",
        "temps_pronostique": 1920,
        ...
      }
    }
  ]
}
```

#### 5. Toutes les autres routes incluant des crews

Le champ est automatiquement inclus dans toutes les réponses.

---

## 🎯 Impact sur la génération des courses

### Comportement modifié

Lors de la génération des courses (dispatch des équipages), **les équipages sont maintenant triés automatiquement par temps pronostique** du plus rapide au plus lent.

### Routes affectées

#### 1. POST `/import/generate-initial-races`

**Avant** : Les équipages étaient répartis aléatoirement dans les séries.

**Maintenant** : Les équipages sont triés par temps pronostique avant d'être répartis :

- Les équipages les plus rapides (temps le plus bas) sont assignés en premier
- Les équipages les plus lents (temps le plus élevé) sont assignés ensuite
- Les équipages sans temps pronostique sont placés à la fin

**Exemple** :

```
Équipages avant tri :
- Équipage A : 600s (10:00)
- Équipage B : 480s (8:00)
- Équipage C : 540s (9:00)
- Équipage D : pas de temps
- Équipage E : 500s (8:20)

Ordre après tri (pour dispatch) :
1. Équipage B (480s - le plus rapide)
2. Équipage E (500s)
3. Équipage C (540s)
4. Équipage A (600s - le plus lent)
5. Équipage D (pas de temps - à la fin)
```

#### 2. POST `/import/generate-races-from-series`

**Même comportement** : Les équipages sont triés par temps pronostique avant d'être assignés aux séries.

**Body de la requête** (inchangé) :

```json
{
  "phase_id": "uuid",
  "lane_count": 6,
  "start_time": "2024-01-15T10:00:00Z",
  "interval_minutes": 5,
  "series": [
    {
      "id": "serie-1",
      "categories": {
        "SFR4": 3,
        "SFR2": 2
      }
    }
  ]
}
```

**Comportement** :

- Pour chaque catégorie dans chaque série, les équipages disponibles sont triés par temps pronostique
- Les équipages les plus rapides sont sélectionnés en premier
- Cela permet de créer des séries équilibrées avec les meilleurs équipages répartis

---

## 💡 Utilisation côté frontend

### Afficher le temps pronostique

#### Conversion secondes → format lisible

```javascript
function formatTempsPronostique(seconds) {
  if (!seconds || seconds === null) {
    return "N/A";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }
}

// Exemple d'utilisation
const crew = {
  temps_pronostique: 1920,
};

console.log(formatTempsPronostique(crew.temps_pronostique)); // "32:00"
console.log(formatTempsPronostique(4080)); // "1:08:00"
console.log(formatTempsPronostique(null)); // "N/A"
```

#### Composant React d'exemple

```jsx
import React from "react";

const CrewCard = ({ crew }) => {
  const formatTime = (seconds) => {
    if (!seconds) return "N/A";
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="crew-card">
      <h3>{crew.club_name}</h3>
      <p>Code: {crew.club_code}</p>
      <p>
        Temps pronostique:
        <strong>{formatTime(crew.temps_pronostique)}</strong>
      </p>
    </div>
  );
};

export default CrewCard;
```

### Trier les équipages côté frontend

Si vous voulez trier les équipages par temps pronostique côté frontend :

```javascript
const sortCrewsByTempsPronostique = (crews) => {
  return [...crews].sort((a, b) => {
    const timeA = a.temps_pronostique;
    const timeB = b.temps_pronostique;

    // Équipages avec temps : du plus rapide au plus lent
    if (
      timeA !== null &&
      timeA !== undefined &&
      timeB !== null &&
      timeB !== undefined
    ) {
      return timeA - timeB;
    }

    // Équipages avec temps avant ceux sans temps
    if (timeA !== null && timeA !== undefined) return -1;
    if (timeB !== null && timeB !== undefined) return 1;

    // Si aucun n'a de temps, conserver l'ordre
    return 0;
  });
};

// Utilisation
const sortedCrews = sortCrewsByTempsPronostique(crews);
```

### Filtrer les équipages avec/sans temps pronostique

```javascript
// Équipages avec temps pronostique
const crewsWithTime = crews.filter(
  (c) => c.temps_pronostique !== null && c.temps_pronostique !== undefined
);

// Équipages sans temps pronostique
const crewsWithoutTime = crews.filter(
  (c) => c.temps_pronostique === null || c.temps_pronostique === undefined
);
```

### Statistiques

```javascript
const getTempsPronostiqueStats = (crews) => {
  const crewsWithTime = crews.filter((c) => c.temps_pronostique !== null);

  if (crewsWithTime.length === 0) {
    return {
      total: crews.length,
      withTime: 0,
      withoutTime: crews.length,
      average: null,
      fastest: null,
      slowest: null,
    };
  }

  const times = crewsWithTime.map((c) => c.temps_pronostique);
  const average = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  const fastest = Math.min(...times);
  const slowest = Math.max(...times);

  return {
    total: crews.length,
    withTime: crewsWithTime.length,
    withoutTime: crews.length - crewsWithTime.length,
    average,
    fastest,
    slowest,
  };
};
```

---

## 🎨 Exemples d'affichage UI

### Tableau des équipages avec temps pronostique

```jsx
const CrewsTable = ({ crews }) => {
  const formatTime = (seconds) => {
    if (!seconds) return "-";
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <table>
      <thead>
        <tr>
          <th>Club</th>
          <th>Code</th>
          <th>Temps pronostique</th>
          <th>Statut</th>
        </tr>
      </thead>
      <tbody>
        {crews.map((crew) => (
          <tr key={crew.id}>
            <td>{crew.club_name}</td>
            <td>{crew.club_code}</td>
            <td>
              {crew.temps_pronostique ? (
                <span className="time">
                  {formatTime(crew.temps_pronostique)}
                </span>
              ) : (
                <span className="no-time">Non renseigné</span>
              )}
            </td>
            <td>{crew.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
```

### Badge de temps pronostique

```jsx
const TempsPronostiqueBadge = ({ seconds }) => {
  if (!seconds) {
    return <span className="badge badge-secondary">N/A</span>;
  }

  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const timeStr = `${minutes}:${secs.toString().padStart(2, "0")}`;

  return <span className="badge badge-primary">{timeStr}</span>;
};
```

### Indicateur visuel (rapide/lent)

```jsx
const TempsPronostiqueIndicator = ({ seconds, averageTime }) => {
  if (!seconds || !averageTime) {
    return <span className="indicator neutral">-</span>;
  }

  const diff = seconds - averageTime;
  const percentDiff = (diff / averageTime) * 100;

  if (percentDiff < -5) {
    // Plus rapide que la moyenne de 5% ou plus
    return <span className="indicator fast">⚡ Rapide</span>;
  } else if (percentDiff > 5) {
    // Plus lent que la moyenne de 5% ou plus
    return <span className="indicator slow">🐢 Lent</span>;
  } else {
    // Proche de la moyenne
    return <span className="indicator average">➖ Moyen</span>;
  }
};
```

---

## ⚠️ Points importants

### 1. Valeur null

Le champ `temps_pronostique` peut être `null` si :

- Aucun temps pronostique n'a été fourni dans l'API FFAviron
- L'équipage a été créé manuellement sans temps
- L'import n'a pas trouvé de temps pronostique dans les données

**Toujours vérifier** la présence du temps avant de l'utiliser :

```javascript
if (crew.temps_pronostique !== null && crew.temps_pronostique !== undefined) {
  // Utiliser le temps
} else {
  // Gérer le cas sans temps
}
```

### 2. Unité de temps

**Important** : Le temps est stocké en **secondes** (nombre entier), pas en minutes ou format string.

```javascript
// ❌ Incorrect
const timeInMinutes = crew.temps_pronostique; // C'est en secondes !

// ✅ Correct
const timeInMinutes = crew.temps_pronostique / 60;
const timeInSeconds = crew.temps_pronostique;
```

### 3. Tri automatique lors de la génération

**Le tri par temps pronostique est automatique** lors de la génération des courses. Vous n'avez pas besoin de trier manuellement les équipages avant d'appeler les routes de génération.

### 4. Mise à jour

Le temps pronostique est calculé et mis à jour uniquement lors de :

- L'import initial d'une manifestation (`POST /import/manifestation/:id`)
- La mise à jour d'un événement (`POST /import/manifestation/:id/update`)

Si vous modifiez manuellement un équipage, le temps pronostique ne sera pas recalculé automatiquement.

---

## 🔍 Migration de la base de données

### Pour les développeurs backend

Une migration SQL a été créée : `docs/migrations/006_add_temps_pronostique_to_crews.sql`

Cette migration :

- Ajoute la colonne `temps_pronostique` (INT, nullable)
- Ajoute un index pour la recherche/tri

**À exécuter avant** d'utiliser cette fonctionnalité en production.

---

## 📊 Exemple complet : Affichage d'une liste d'équipages

```jsx
import React, { useState, useEffect } from "react";

const CrewsList = ({ eventId }) => {
  const [crews, setCrews] = useState([]);
  const [sortBy, setSortBy] = useState("club"); // 'club', 'time'

  useEffect(() => {
    fetch(`/crews/event/${eventId}`)
      .then((res) => res.json())
      .then((data) => setCrews(data.data || []));
  }, [eventId]);

  const formatTime = (seconds) => {
    if (!seconds) return "N/A";
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const sortedCrews = [...crews].sort((a, b) => {
    if (sortBy === "time") {
      const timeA = a.temps_pronostique;
      const timeB = b.temps_pronostique;

      if (timeA && timeB) return timeA - timeB;
      if (timeA) return -1;
      if (timeB) return 1;
      return 0;
    } else {
      return (a.club_name || "").localeCompare(b.club_name || "");
    }
  });

  return (
    <div>
      <div className="controls">
        <label>
          Trier par :
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="club">Club</option>
            <option value="time">Temps pronostique</option>
          </select>
        </label>
      </div>

      <div className="stats">
        <p>
          Équipages avec temps :{" "}
          {crews.filter((c) => c.temps_pronostique).length} / {crews.length}
        </p>
      </div>

      <table>
        <thead>
          <tr>
            <th>Club</th>
            <th>Temps pronostique</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          {sortedCrews.map((crew) => (
            <tr key={crew.id}>
              <td>{crew.club_name}</td>
              <td>
                {crew.temps_pronostique ? (
                  <span className="time-badge">
                    {formatTime(crew.temps_pronostique)}
                  </span>
                ) : (
                  <span className="no-time">Non renseigné</span>
                )}
              </td>
              <td>{crew.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CrewsList;
```

---

## ✅ Checklist d'implémentation frontend

- [ ] Vérifier que le champ `temps_pronostique` est bien présent dans les réponses API
- [ ] Créer une fonction de formatage secondes → format lisible (MM:SS ou HH:MM:SS)
- [ ] Afficher le temps pronostique dans les listes d'équipages
- [ ] Gérer le cas `null` (afficher "N/A" ou "Non renseigné")
- [ ] Optionnel : Ajouter un tri par temps pronostique dans les interfaces
- [ ] Optionnel : Afficher des statistiques (moyenne, plus rapide, plus lent)
- [ ] Optionnel : Ajouter des indicateurs visuels (rapide/lent par rapport à la moyenne)

---

## 🔗 Routes API concernées

- `GET /crews` - Liste des équipages
- `GET /crews/:id` - Détails d'un équipage
- `GET /crews/event/:event_id` - Équipages par événement
- `GET /race-crews/:race_id` - Équipages d'une course
- `POST /import/generate-initial-races` - Génération initiale (tri automatique)
- `POST /import/generate-races-from-series` - Génération depuis séries (tri automatique)

---

**Dernière mise à jour** : 2024
