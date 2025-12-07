# Guide Frontend : Résultats d'Événement par Catégorie

## 📋 Vue d'ensemble

Cette route permet de récupérer tous les résultats d'un événement, **groupés par catégorie**. Les résultats sont automatiquement triés par temps (du plus rapide au plus lent) et les positions sont calculées pour chaque catégorie.

Cette route est idéale pour afficher :
- Un classement général par catégorie
- Les podiums par catégorie
- Les statistiques par catégorie
- Un tableau de résultats complet organisé par catégorie

## 📡 Endpoint API

### GET `/events/:id/results-by-category`

Récupère tous les résultats d'un événement, groupés et triés par catégorie.

**Paramètres** :
- `id` (dans l'URL) : ID de l'événement

**Exemple de requête** :

```typescript
const eventId = "7c38e42f-198a-4bd6-9c59-9854094a1ea0";
const response = await fetch(`/events/${eventId}/results-by-category`);
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
  phase_id: string;
  phase_name: string;
  crew_id: string;
  lane: number;
  club_name: string | null;
  club_code: string | null;
  position: number | null;        // Position dans la catégorie (1, 2, 3, ...)
  finish_time: string | null;     // Timestamp ISO de l'arrivée
  final_time: string | null;      // Temps en millisecondes (string)
  time_seconds: string | null;    // Temps en secondes avec décimales (string, ex: "420.000")
  time_formatted: string | null;  // Temps formaté lisible (ex: "7:00.000" ou "45.500")
  has_timing: boolean;            // Indique si l'équipage a un temps enregistré
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
          "phase_id": "phase-uuid-1",
          "phase_name": "Série A",
          "crew_id": "crew-uuid-1",
          "lane": 1,
          "club_name": "Club Aviron Paris",
          "club_code": "PAR",
          "position": 1,
          "finish_time": "2025-01-15T10:30:45.000Z",
          "final_time": "420000",
          "time_seconds": "420.000",
          "time_formatted": "7:00.000",
          "has_timing": true
        },
        {
          "race_id": "race-uuid-2",
          "race_number": 2,
          "phase_id": "phase-uuid-1",
          "phase_name": "Série A",
          "crew_id": "crew-uuid-2",
          "lane": 2,
          "club_name": "Club Aviron Lyon",
          "club_code": "LYO",
          "position": 2,
          "finish_time": "2025-01-15T10:31:12.000Z",
          "final_time": "447000",
          "time_seconds": "447.000",
          "time_formatted": "7:27.000",
          "has_timing": true
        },
        {
          "race_id": "race-uuid-3",
          "race_number": 3,
          "phase_id": "phase-uuid-1",
          "phase_name": "Série A",
          "crew_id": "crew-uuid-3",
          "lane": 3,
          "club_name": "Club Aviron Marseille",
          "club_code": "MAR",
          "position": 3,
          "finish_time": "2025-01-15T10:31:45.000Z",
          "final_time": "480000",
          "time_seconds": "480.000",
          "time_formatted": "8:00.000",
          "has_timing": true
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
          "phase_id": "phase-uuid-1",
          "phase_name": "Série A",
          "crew_id": "crew-uuid-4",
          "lane": 1,
          "club_name": "Club Aviron Bordeaux",
          "club_code": "BOR",
          "position": 1,
          "finish_time": "2025-01-15T10:35:20.000Z",
          "final_time": "455000",
          "time_seconds": "455.000",
          "time_formatted": "7:35.000",
          "has_timing": true
        },
        {
          "race_id": "race-uuid-5",
          "race_number": 5,
          "phase_id": "phase-uuid-1",
          "phase_name": "Série A",
          "crew_id": "crew-uuid-5",
          "lane": 2,
          "club_name": "Club Aviron Nice",
          "club_code": "NIC",
          "position": null,
          "finish_time": null,
          "final_time": null,
          "time_seconds": null,
          "time_formatted": null,
          "has_timing": false
        }
      ]
    }
  ]
}
```

## 🔍 Comportement de la route

### Tri et positions

1. **Tri automatique** : Les résultats sont triés par temps (du plus rapide au plus lent) **dans chaque catégorie**
2. **Calcul des positions** : Les positions (1, 2, 3, ...) sont calculées automatiquement pour chaque catégorie
3. **Équipages sans timing** : Les équipages sans temps enregistré (`has_timing = false`) apparaissent à la fin avec `position: null`

### Groupement par catégorie

- Tous les résultats d'un même événement sont regroupés par catégorie
- Chaque catégorie contient tous les équipages de cette catégorie, peu importe la phase ou la course
- Les catégories sans résultats n'apparaissent pas dans la réponse

### Informations incluses

Pour chaque résultat, vous avez accès à :
- **Informations de course** : `race_id`, `race_number`, `phase_id`, `phase_name`
- **Informations d'équipage** : `crew_id`, `lane`, `club_name`, `club_code`
- **Informations de catégorie** : Toutes les infos de la catégorie dans l'objet `category`
- **Temps** : `finish_time` (timestamp), `final_time` (millisecondes en string)
- **Position** : Position dans la catégorie (1 = premier, 2 = deuxième, etc.)

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
  eventId: string
): Promise<CategoryResult[]> {
  const response = await fetch(`/events/${eventId}/results-by-category`);
  
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

Le backend fournit déjà le temps formaté dans `time_formatted`, mais vous pouvez utiliser cette fonction si vous avez besoin de formater manuellement :

```typescript
/**
 * Convertit un temps en millisecondes (string) en format lisible
 * @param finalTime Temps en millisecondes (string) ou null
 * @returns Format "MM:SS.mmm" ou "SS.mmm" ou null
 */
function formatTime(finalTime: string | null): string | null {
  if (!finalTime) return null;
  
  const ms = parseInt(finalTime, 10);
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;
  
  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;
  }
  
  return `${seconds}.${milliseconds.toString().padStart(3, "0")}`;
}

// Note : Le backend fournit déjà time_formatted, donc vous pouvez utiliser directement :
// result.time_formatted au lieu de formatTime(result.final_time)
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
                    {result.club_name}
                    {result.club_code && ` (${result.club_code})`}
                  </td>
                  <td>
                    {result.phase_name} - Course {result.race_number}
                  </td>
                  <td>
                    {result.has_timing && result.time_formatted ? (
                      result.time_formatted
                    ) : (
                      <span className="no-time">DNS/DNF</span>
                    )}
                  </td>
                  <td>{result.lane}</td>
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
          .filter((r) => r.has_timing)
          .slice(0, 3);

        if (topThree.length === 0) return null;

        return (
          <div key={categoryResult.category.id} className="podium-category">
            <h3>{categoryResult.category.label}</h3>
            <div className="podium">
              {topThree[1] && (
                <div className="podium-second">
                  <div className="medal">🥈</div>
                  <div className="club">{topThree[1].club_name}</div>
                  <div className="time">{topThree[1].time_formatted || "N/A"}</div>
                </div>
              )}
              {topThree[0] && (
                <div className="podium-first">
                  <div className="medal">🥇</div>
                  <div className="club">{topThree[0].club_name}</div>
                  <div className="time">{topThree[0].time_formatted || "N/A"}</div>
                </div>
              )}
              {topThree[2] && (
                <div className="podium-third">
                  <div className="medal">🥉</div>
                  <div className="club">{topThree[2].club_name}</div>
                  <div className="time">{topThree[2].time_formatted || "N/A"}</div>
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
        const withTiming = categoryResult.results.filter((r) => r.has_timing);
        const withoutTiming = categoryResult.results.filter((r) => !r.has_timing);
        
        // Calculer le temps moyen (en secondes)
        const averageTime = withTiming.length > 0
          ? withTiming.reduce((sum, r) => {
              const seconds = parseFloat(r.time_seconds || "0");
              return sum + seconds;
            }, 0) / withTiming.length
          : null;

        // Formater le temps moyen
        const formatAverageTime = (seconds: number): string => {
          const minutes = Math.floor(seconds / 60);
          const secs = Math.floor(seconds % 60);
          const ms = Math.floor((seconds % 1) * 1000);
          if (minutes > 0) {
            return `${minutes}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
          }
          return `${secs}.${ms.toString().padStart(3, "0")}`;
        };

        // Temps le plus rapide
        const fastest = withTiming[0] || null;

        return (
          <div key={categoryResult.category.id} className="category-stats">
            <h3>{categoryResult.category.label}</h3>
            <ul>
              <li>Total équipages : {categoryResult.results.length}</li>
              <li>Avec temps : {withTiming.length}</li>
              <li>Sans temps : {withoutTiming.length}</li>
              {fastest && (
                <li>
                  Temps le plus rapide : {fastest.time_formatted || "N/A"} 
                  ({fastest.club_name})
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

1. **Temps formaté** : Le backend fournit maintenant `time_formatted` qui est déjà formaté et prêt à être affiché. Utilisez ce champ plutôt que de formater manuellement.

2. **Temps en millisecondes** : Le champ `final_time` est une **string** représentant des millisecondes. Utilisez `time_seconds` (string avec décimales) pour les calculs mathématiques.

2. **Équipages sans timing** : Les équipages sans temps (`has_timing = false`) ont `position: null` et `final_time: null`. Pensez à les gérer dans votre UI.

3. **Tri déjà effectué** : Les résultats sont déjà triés par temps dans chaque catégorie. Vous n'avez pas besoin de les re-trier.

4. **Positions** : Les positions sont calculées uniquement pour les équipages avec timing. Les équipages sans timing ont `position: null`.

5. **Catégories vides** : Les catégories sans résultats n'apparaissent pas dans la réponse.

6. **Performance** : Cette route peut être lourde si l'événement contient beaucoup de courses. Pensez à mettre en cache les résultats côté frontend.

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

| Route | Usage | Groupement |
|-------|-------|------------|
| `GET /races/:race_id/results` | Résultats d'une course spécifique | Non groupé |
| `GET /events/:id/results-by-category` | Tous les résultats d'un événement | Par catégorie |

La route `results-by-category` est idéale pour un **aperçu global** de tous les résultats d'un événement, tandis que la route par course est utile pour les **détails d'une course spécifique**.

## 📚 Ressources

- **Endpoint** : `GET /events/:id/results-by-category`
- **Route associée** : `GET /races/:race_id/results` (résultats d'une course spécifique)
- **Modèle Category** : Voir la documentation des modèles pour plus de détails sur les catégories

---

**Date de création** : 2025-01-XX  
**Version API** : Compatible avec toutes les versions existantes

