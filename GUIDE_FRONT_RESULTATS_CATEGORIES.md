# Guide Frontend : Résultats d'Événement Indoor par Catégorie

## 📋 Vue d'ensemble

Cette route permet de récupérer tous les résultats **indoor** d'un événement, **groupés par catégorie**. Les résultats sont automatiquement triés par place (1, 2, 3, ...) dans chaque catégorie.

Cette route est idéale pour afficher :
- Un classement général par catégorie pour les courses indoor
- Les podiums par catégorie
- Les statistiques par catégorie
- Un tableau de résultats complet organisé par catégorie avec les informations détaillées des équipages (code club, participants)

## 📡 Endpoint API

### GET `/indoor-results/event/:event_id/bycategorie`

Récupère tous les résultats indoor d'un événement, groupés et triés par catégorie.

**Paramètres** :
- `event_id` (dans l'URL) : ID de l'événement

**Authentification** : Requise (Bearer token)

**Exemple de requête** :

```typescript
const eventId = "7c38e42f-198a-4bd6-9c59-9854094a1ea0";
const response = await fetch(`/indoor-results/event/${eventId}/bycategorie`, {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
const data = await response.json();
```

## 📦 Format de réponse

### Structure de la réponse

```typescript
interface EventResultsByCategoryResponse {
  status: "success" | "error";
  data: CategoryResult[];
}

interface CategoryResult {
  category: {
    id: string;
    code: string | null;
    label: string | null;
    age_group: string | null;
    gender: "Homme" | "Femme" | "Mixte" | null;
  };
  results: Result[];
}

interface Result {
  race_id: string;
  race_number: number;
  race_name: string | null;
  place_in_race: number | null;   // Place dans la course/série (conservée pour référence)
  position: number | null;         // Position dans le classement de la catégorie (1, 2, 3, ...)
  points: number | null;           // Points attribués selon le classement (basé sur le template "Points Indoor")
  is_eligible_for_points: boolean; // Indique si le résultat est éligible pour les points
  time_display: string | null;     // Temps formaté lisible (ex: "7:00.0")
  time_ms: number | null;          // Temps en millisecondes
  score: number | null;
  distance: number | null;         // Distance en mètres
  distance_info: {
    id: string;
    meters: number | null;
    is_relay: boolean;
    relay_count: number | null;
    label: string;                  // Label formaté (ex: "2000m", "8x250m")
  } | null;
  avg_pace: string | null;         // Allure moyenne
  spm: number | null;              // Coups par minute
  calories: number | null;
  machine_type: string | null;
  logged_time: string | null;     // Timestamp ISO
  crew_id: string | null;
  crew: {
    id: string;
    club_name: string | null;
    club_code: string | null;     // Code du club
    category: {
      id: string;
      code: string | null;
      label: string | null;
      age_group: string | null;
      gender: "Homme" | "Femme" | "Mixte" | null;
    } | null;
    participants: Participant[];   // Liste des participants de l'équipage
  } | null;
}

interface Participant {
  id: string | null;
  first_name: string | null;
  last_name: string | null;
  license_number: string | null;
  seat_position: number | null;  // Position dans le bateau (1-8)
  is_coxswain: boolean;            // Indique si c'est le barreur
}
```

### Exemple de réponse (200 OK)

```json
{
  "status": "success",
  "data": [
    {
      "category": {
        "id": "cat-uuid-1",
        "code": "M23",
        "label": "Hommes 23 ans",
        "age_group": "23",
        "gender": "Homme"
      },
      "results": [
        {
          "race_id": "race-uuid-1",
          "race_number": 1,
          "race_name": "Course 1",
          "place_in_race": 1,
          "position": 1,
          "points": 30,
          "is_eligible_for_points": true,
          "time_display": "7:00.0",
          "time_ms": 420000,
          "score": 1000,
          "distance": 2000,
          "distance_info": {
            "id": "distance-uuid-1",
            "meters": 2000,
            "is_relay": false,
            "relay_count": null,
            "label": "2000m"
          },
          "avg_pace": "1:45.0",
          "spm": 32,
          "calories": 250,
          "machine_type": "Concept2",
          "logged_time": "2025-01-15T10:30:45.000Z",
          "crew_id": "crew-uuid-1",
          "crew": {
            "id": "crew-uuid-1",
            "club_name": "Club Aviron Paris",
            "club_code": "PAR",
            "category": {
              "id": "cat-uuid-1",
              "code": "M23",
              "label": "Hommes 23 ans",
              "age_group": "23",
              "gender": "Homme"
            },
            "participants": [
              {
                "id": "participant-uuid-1",
                "first_name": "Jean",
                "last_name": "Dupont",
                "license_number": "12345",
                "seat_position": 1,
                "is_coxswain": false
              },
              {
                "id": "participant-uuid-2",
                "first_name": "Pierre",
                "last_name": "Martin",
                "license_number": "12346",
                "seat_position": 2,
                "is_coxswain": false
              }
            ]
          }
        },
        {
          "race_id": "race-uuid-2",
          "race_number": 2,
          "race_name": "Course 2",
          "place_in_race": 1,
          "position": 2,
          "points": 25.5,
          "is_eligible_for_points": true,
          "time_display": "7:27.0",
          "time_ms": 447000,
          "score": 950,
          "distance": 2000,
          "distance_info": {
            "id": "distance-uuid-1",
            "meters": 2000,
            "is_relay": false,
            "relay_count": null,
            "label": "2000m"
          },
          "avg_pace": "1:51.8",
          "spm": 30,
          "calories": 240,
          "machine_type": "Concept2",
          "logged_time": "2025-01-15T10:31:12.000Z",
          "crew_id": "crew-uuid-2",
          "crew": {
            "id": "crew-uuid-2",
            "club_name": "Club Aviron Lyon",
            "club_code": "LYO",
            "category": {
              "id": "cat-uuid-1",
              "code": "M23",
              "label": "Hommes 23 ans",
              "age_group": "23",
              "gender": "Homme"
            },
            "participants": [
              {
                "id": "participant-uuid-3",
                "first_name": "Paul",
                "last_name": "Bernard",
                "license_number": "12347",
                "seat_position": 1,
                "is_coxswain": false
              }
            ]
          }
        }
      ]
    },
    {
      "category": {
        "id": "cat-uuid-2",
        "code": "F23",
        "label": "Femmes 23 ans",
        "age_group": "23",
        "gender": "Femme"
      },
      "results": [
        {
          "race_id": "race-uuid-4",
          "race_number": 4,
          "race_name": "Course 4",
          "place_in_race": 1,
          "position": 1,
          "points": 30,
          "is_eligible_for_points": true,
          "time_display": "7:35.0",
          "time_ms": 455000,
          "score": 980,
          "distance": 2000,
          "distance_info": {
            "id": "distance-uuid-1",
            "meters": 2000,
            "is_relay": false,
            "relay_count": null,
            "label": "2000m"
          },
          "avg_pace": "1:53.8",
          "spm": 31,
          "calories": 230,
          "machine_type": "Concept2",
          "logged_time": "2025-01-15T10:35:20.000Z",
          "crew_id": "crew-uuid-4",
          "crew": {
            "id": "crew-uuid-4",
            "club_name": "Club Aviron Bordeaux",
            "club_code": "BOR",
            "category": {
              "id": "cat-uuid-2",
              "code": "F23",
              "label": "Femmes 23 ans",
              "age_group": "23",
              "gender": "Femme"
            },
            "participants": []
          }
        }
      ]
    }
  ]
}
```

## 🔍 Comportement de la route

### Tri et positions

1. **Tri automatique** : Les résultats sont triés par temps (du plus rapide au plus lent) **dans chaque catégorie**
2. **Position dans la catégorie** : La `position` (1, 2, 3, ...) est calculée automatiquement après le tri par temps dans chaque catégorie
3. **Place dans la course** : La `place_in_race` est conservée pour référence (place dans la course/série d'origine)
4. **Groupement** : Tous les résultats de toutes les courses sont regroupés par catégorie, puis triés et classés

### Groupement par catégorie

- Tous les résultats indoor d'un même événement sont regroupés par catégorie
- Chaque catégorie contient tous les équipages de cette catégorie, peu importe la course
- Les catégories sans résultats n'apparaissent pas dans la réponse

### Informations incluses

Pour chaque résultat, vous avez accès à :
- **Informations de course** : `race_id`, `race_number`, `race_name`
- **Informations de résultat** : 
  - `place_in_race` : Place dans la course/série d'origine
  - `position` : Position dans le classement de la catégorie (calculée après tri par temps)
  - `time_display`, `time_ms`, `score`, `distance`, `avg_pace`, `spm`, `calories`, `machine_type`
- **Informations d'équipage** : `crew_id`, `club_name`, `club_code`
- **Informations de catégorie** : Disponible à deux niveaux :
  - Au niveau du groupement : `category` (id, code, label, age_group, gender)
  - Dans l'équipage : `crew.category` (mêmes informations)
- **Participants** : Liste complète des participants avec leurs informations (nom, prénom, licence, position dans le bateau)

## 💻 Exemples d'utilisation côté frontend

### TypeScript Interfaces

```typescript
interface Category {
  id: string;
  code: string | null;
  label: string | null;
  age_group: string | null;
  gender: "Homme" | "Femme" | "Mixte" | null;
}

interface Result {
  race_id: string;
  race_number: number;
  phase_id: string;
  phase_name: string;
  crew_id: string;
  lane: number;
  club_name: string | null;
  club_code: string | null;
  position: number | null;
  finish_time: string | null;
  final_time: string | null;
  time_seconds: string | null;
  time_formatted: string | null;
  has_timing: boolean;
}

interface CategoryResult {
  category: Category;
  results: Result[];
}

interface EventResultsByCategoryResponse {
  status: "success" | "error";
  data: CategoryResult[];
}
```

### Fonction de récupération

```typescript
async function getEventResultsByCategory(
  eventId: string,
  token: string
): Promise<CategoryResult[]> {
  const response = await fetch(`/indoor-results/event/${eventId}/bycategorie`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Erreur ${response.status}: ${response.statusText}`);
  }
  
  const data: EventResultsByCategoryResponse = await response.json();
  
  if (data.status === "error") {
    throw new Error("Erreur lors de la récupération des résultats");
  }
  
  return data.data;
}
```

### Helper pour formater le temps (optionnel)

Le backend fournit déjà le temps formaté dans `time_display`, mais vous pouvez utiliser cette fonction si vous avez besoin de formater manuellement :

```typescript
/**
 * Convertit un temps en millisecondes en format lisible
 * @param timeMs Temps en millisecondes (number) ou null
 * @returns Format "M:SS.m" ou "SS.m" ou null
 */
function formatTime(timeMs: number | null): string | null {
  if (!timeMs) return null;
  
  const totalSeconds = Math.floor(timeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = Math.floor((timeMs % 1000) / 100);
  
  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${milliseconds}`;
  }
  
  return `${seconds}.${milliseconds}`;
}

// Note : Le backend fournit déjà time_display, donc vous pouvez utiliser directement :
// result.time_display au lieu de formatTime(result.time_ms)
```

### Affichage d'un tableau de résultats par catégorie

```tsx
import React, { useEffect, useState } from "react";

function EventResultsByCategory({ eventId }: { eventId: string }) {
  const [results, setResults] = useState<CategoryResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchResults() {
      try {
        setLoading(true);
        const data = await getEventResultsByCategory(eventId);
        setResults(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    }

    fetchResults();
  }, [eventId]);

  if (loading) return <div>Chargement...</div>;
  if (error) return <div>Erreur : {error}</div>;
  if (results.length === 0) return <div>Aucun résultat disponible</div>;

  return (
    <div className="results-by-category">
      {results.map((categoryResult) => (
        <div key={categoryResult.category.id} className="category-section">
          <h2>{categoryResult.category.label || categoryResult.category.code}</h2>
          
          <table>
            <thead>
              <tr>
                <th>Position</th>
                <th>Club</th>
                <th>Course</th>
                <th>Temps</th>
                <th>Voie</th>
              </tr>
            </thead>
            <tbody>
              {categoryResult.results.map((result) => (
                <tr key={result.crew_id}>
                  <td>
                    {result.position !== null ? (
                      <span className="position">{result.position}</span>
                    ) : (
                      <span className="no-position">-</span>
                    )}
                  </td>
                  <td>
                    {result.crew?.club_name || "-"}
                    {result.crew?.club_code && ` (${result.crew.club_code})`}
                  </td>
                  <td>
                    {result.race_name || `Course ${result.race_number}`}
                  </td>
                  <td>
                    {result.time_display ? (
                      result.time_display
                    ) : (
                      <span className="no-time">-</span>
                    )}
                  </td>
                  <td>
                    {result.crew?.participants?.length || 0} participant(s)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
```

### Affichage des podiums par catégorie

```tsx
function CategoryPodiums({ eventId }: { eventId: string }) {
  const [results, setResults] = useState<CategoryResult[]>([]);

  useEffect(() => {
    getEventResultsByCategory(eventId).then(setResults);
  }, [eventId]);

  return (
    <div className="podiums">
      {results.map((categoryResult) => {
        const topThree = categoryResult.results
          .filter((r) => r.position !== null)
          .slice(0, 3);

        if (topThree.length === 0) return null;

        return (
          <div key={categoryResult.category.id} className="podium-category">
            <h3>{categoryResult.category.label}</h3>
            <div className="podium">
              {topThree[1] && (
                <div className="podium-second">
                  <div className="medal">🥈</div>
                  <div className="club">{topThree[1].crew?.club_name || "-"}</div>
                  <div className="time">{topThree[1].time_display || "N/A"}</div>
                </div>
              )}
              {topThree[0] && (
                <div className="podium-first">
                  <div className="medal">🥇</div>
                  <div className="club">{topThree[0].crew?.club_name || "-"}</div>
                  <div className="time">{topThree[0].time_display || "N/A"}</div>
                </div>
              )}
              {topThree[2] && (
                <div className="podium-third">
                  <div className="medal">🥉</div>
                  <div className="club">{topThree[2].crew?.club_name || "-"}</div>
                  <div className="time">{topThree[2].time_display || "N/A"}</div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

### Statistiques par catégorie

```tsx
function CategoryStatistics({ eventId }: { eventId: string }) {
  const [results, setResults] = useState<CategoryResult[]>([]);

  useEffect(() => {
    getEventResultsByCategory(eventId).then(setResults);
  }, [eventId]);

  return (
    <div className="statistics">
      {results.map((categoryResult) => {
        const withResults = categoryResult.results.filter((r) => r.time_ms !== null);
        
        // Calculer le temps moyen (en millisecondes)
        const averageTime = withResults.length > 0
          ? withResults.reduce((sum, r) => sum + (r.time_ms || 0), 0) / withResults.length
          : null;

        // Formater le temps moyen
        const formatAverageTime = (ms: number): string => {
          const totalSeconds = Math.floor(ms / 1000);
          const minutes = Math.floor(totalSeconds / 60);
          const seconds = totalSeconds % 60;
          const milliseconds = Math.floor((ms % 1000) / 100);
          if (minutes > 0) {
            return `${minutes}:${seconds.toString().padStart(2, "0")}.${milliseconds}`;
          }
          return `${seconds}.${milliseconds}`;
        };

        // Temps le plus rapide (première position dans la catégorie)
        const fastest = categoryResult.results.find((r) => r.position === 1) || null;

        return (
          <div key={categoryResult.category.id} className="category-stats">
            <h3>{categoryResult.category.label}</h3>
            <ul>
              <li>Total équipages : {categoryResult.results.length}</li>
              <li>Avec résultats : {withResults.length}</li>
              {fastest && (
                <li>
                  Meilleur temps : {fastest.time_display || "N/A"} 
                  ({fastest.crew?.club_name || "-"})
                </li>
              )}
              {averageTime && (
                <li>Temps moyen : {formatAverageTime(averageTime)}</li>
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
```

### Filtrage et recherche

```typescript
// Filtrer par catégorie spécifique
function getCategoryResults(
  results: CategoryResult[],
  categoryId: string
): CategoryResult | undefined {
  return results.find((r) => r.category.id === categoryId);
}

// Rechercher un équipage dans toutes les catégories
function findCrewInResults(
  results: CategoryResult[],
  crewId: string
): { category: Category; result: Result } | null {
  for (const categoryResult of results) {
    const result = categoryResult.results.find((r) => r.crew_id === crewId);
    if (result) {
      return { category: categoryResult.category, result };
    }
  }
  return null;
}

// Obtenir le top N d'une catégorie
function getTopN(
  categoryResult: CategoryResult,
  n: number
): Result[] {
  return categoryResult.results
    .filter((r) => r.has_timing)
    .slice(0, n);
}
```

## 🎨 Exemples de styles CSS

```css
.results-by-category {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.category-section {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 1.5rem;
}

.category-section h2 {
  margin-top: 0;
  color: #333;
  border-bottom: 2px solid #007bff;
  padding-bottom: 0.5rem;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}

table th {
  background-color: #f8f9fa;
  padding: 0.75rem;
  text-align: left;
  font-weight: 600;
}

table td {
  padding: 0.75rem;
  border-bottom: 1px solid #eee;
}

.position {
  font-weight: bold;
  color: #007bff;
  font-size: 1.2em;
}

.no-position {
  color: #999;
}

.no-time {
  color: #dc3545;
  font-style: italic;
}

.podium {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 1rem;
  margin-top: 1rem;
}

.podium-first {
  order: 2;
  text-align: center;
}

.podium-second {
  order: 1;
  text-align: center;
}

.podium-third {
  order: 3;
  text-align: center;
}

.medal {
  font-size: 3rem;
}
```

## ⚠️ Points d'attention

1. **Temps formaté** : Le backend fournit `time_display` qui est déjà formaté et prêt à être affiché (ex: "7:00.0"). Utilisez ce champ plutôt que de formater manuellement.

2. **Temps en millisecondes** : Le champ `time_ms` est un **number** représentant des millisecondes. Utilisez-le pour les calculs mathématiques.

3. **Position vs Place** : 
   - `position` : Position dans le classement de la catégorie (calculée après tri par temps de toutes les courses)
   - `place_in_race` : Place dans la course/série d'origine (conservée pour référence)
   - La `position` peut être `null` si l'équipage n'a pas de temps (`time_ms === null`)

4. **Tri déjà effectué** : Les résultats sont déjà triés par temps (du plus rapide au plus lent) dans chaque catégorie, et les positions sont calculées. Vous n'avez pas besoin de les re-trier.

5. **Points** : 
   - Les points sont calculés automatiquement selon le template "Points Indoor" en fonction de la position dans la catégorie et du nombre de participants
   - Les points ne sont attribués que pour les distances éligibles : **2000m**, **500m** ou **relais 8x250m**
   - Les points ne sont pas attribués si `time_ms` est `null` ou `0`
   - Le champ `is_eligible_for_points` indique si le résultat est éligible pour les points
   - Le champ `points` est `null` si le résultat n'est pas éligible ou si aucun template n'est trouvé
   - Les points diffèrent selon que c'est un relais (`distance_info.is_relay === true`) ou une course individuelle
   - Le nombre de points dépend du nombre total de participants dans la catégorie (1-3, 4-6, 7-12, 13+)

6. **Distance** : 
   - Le champ `distance_info` contient les informations détaillées sur la distance de la course
   - `distance_info.label` fournit un label formaté (ex: "2000m", "8x250m") pour l'affichage
   - `distance_info.is_relay` indique si c'est une course en relais
   - `distance_info.relay_count` indique le nombre de relais (ex: 8 pour 8x250m)

7. **Participants** : Les participants sont triés par `seat_position` (position dans le bateau). Le barreur a `is_coxswain: true` et peut ne pas avoir de `seat_position`.

8. **Catégories vides** : Les catégories sans résultats n'apparaissent pas dans la réponse.

9. **Authentification** : Cette route nécessite une authentification (Bearer token).

10. **Performance** : Cette route peut être lourde si l'événement contient beaucoup de courses. Pensez à mettre en cache les résultats côté frontend.

## 🐛 Gestion des erreurs

### Erreur 404 - Événement non trouvé

```json
{
  "status": "error",
  "message": "Événement non trouvé"
}
```

### Erreur 500 - Erreur serveur

```json
{
  "status": "error",
  "message": "Erreur lors de la récupération des résultats"
}
```

### Cas sans résultats

Si l'événement n'a pas de points de timing ou de courses, la réponse sera :

```json
{
  "status": "success",
  "data": []
}
```

## 📊 Cas d'usage recommandés

1. **Page de résultats complète** : Afficher tous les résultats d'un événement organisés par catégorie
2. **Podiums** : Créer une page dédiée aux podiums par catégorie
3. **Statistiques** : Afficher des statistiques (temps moyen, meilleur temps, etc.) par catégorie
4. **Export PDF** : Générer un PDF avec tous les résultats groupés par catégorie
5. **Classement général** : Créer un classement général avec toutes les catégories

## 🔄 Comparaison avec d'autres routes

| Route | Usage | Groupement | Type |
|-------|-------|------------|------|
| `GET /indoor-results/race/:race_id` | Résultats d'une course indoor spécifique | Non groupé | Indoor |
| `GET /indoor-results/event/:event_id` | Tous les résultats indoor d'un événement | Par course | Indoor |
| `GET /indoor-results/event/:event_id/bycategorie` | Tous les résultats indoor d'un événement | Par catégorie | Indoor |

La route `bycategorie` est idéale pour un **aperçu global** de tous les résultats indoor d'un événement groupés par catégorie, avec les informations détaillées des équipages (code club, participants).

## 📚 Ressources

- **Endpoint** : `GET /indoor-results/event/:event_id/bycategorie`
- **Routes associées** : 
  - `GET /indoor-results/race/:race_id` (résultats d'une course indoor spécifique)
  - `GET /indoor-results/event/:event_id` (tous les résultats indoor d'un événement par course)
- **Modèle Category** : Voir la documentation des modèles pour plus de détails sur les catégories
- **Swagger** : Disponible sur `/docs` → Section `indoor-results`

---

**Date de création** : 2025-01-XX  
**Version API** : Compatible avec toutes les versions existantes  
**Type** : Résultats Indoor uniquement

