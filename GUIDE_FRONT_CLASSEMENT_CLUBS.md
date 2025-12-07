# Guide Frontend : Classement des Clubs par Type d'Événement

## 📋 Vue d'ensemble

Cette route permet de récupérer les classements des clubs pour tous les événements d'un type donné (indoor, mer, rivière). Les résultats sont groupés par événement, avec les classements des clubs pour chaque événement.

Cette route est idéale pour afficher :
- Un classement général des clubs par type d'événement
- Une vue d'ensemble de tous les événements d'un type et leurs classements
- Des statistiques comparatives entre événements
- Un tableau de classement multi-événements

## 📡 Endpoint API

### GET `/rankings/clubs/by-type/:event_type`

Récupère tous les événements d'un type donné et leurs classements de clubs.

**Paramètres** :
- `event_type` (dans l'URL) : Type d'événement (ex: "indoor", "mer", "rivière")
- `ranking_type` (query, optionnel) : Type de classement (`indoor_points`, `defis_capitaux`, `custom`). Par défaut : `indoor_points`

**Authentification** : Requise (Bearer token)

**Exemple de requête** :

```typescript
const eventType = "indoor";
const rankingType = "indoor_points"; // optionnel
const response = await fetch(`/rankings/clubs/by-type/${eventType}?ranking_type=${rankingType}`, {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
const data = await response.json();
```

## 📦 Format de réponse

### Structure de la réponse

```typescript
interface ClubRankingsByEventTypeResponse {
  status: "success" | "error";
  data: EventRankings[];
}

interface EventRankings {
  event: {
    id: string;
    name: string;
    location: string;
    start_date: string;        // ISO date string
    end_date: string;          // ISO date string
    race_type: string;         // Type d'événement (indoor, mer, rivière)
  };
  rankings: ClubRanking[];
}

interface ClubRanking {
  id: string;
  club_name: string;
  club_code: string | null;
  total_points: number;        // Total des points du club pour cet événement
  rank: number | null;          // Rang dans le classement (1 = premier)
  points_count: number;        // Nombre de points détaillés attribués
}
```

### Exemple de réponse (200 OK)

```json
{
  "status": "success",
  "data": [
    {
      "event": {
        "id": "7c38e42f-198a-4bd6-9c59-9854094a1ea0",
        "name": "Championnat Indoor 2025",
        "location": "Paris",
        "start_date": "2025-01-15T00:00:00.000Z",
        "end_date": "2025-01-16T00:00:00.000Z",
        "race_type": "indoor"
      },
      "rankings": [
        {
          "id": "ranking-uuid-1",
          "club_name": "Club Aviron Paris",
          "club_code": "PAR",
          "total_points": 150.5,
          "rank": 1,
          "points_count": 12
        },
        {
          "id": "ranking-uuid-2",
          "club_name": "Club Aviron Lyon",
          "club_code": "LYO",
          "total_points": 120.0,
          "rank": 2,
          "points_count": 10
        },
        {
          "id": "ranking-uuid-3",
          "club_name": "Club Aviron Bordeaux",
          "club_code": "BOR",
          "total_points": 95.5,
          "rank": 3,
          "points_count": 8
        }
      ]
    },
    {
      "event": {
        "id": "8d49f53g-209b-5ce7-b88f-0965105b1fb1",
        "name": "Compétition Indoor Régionale",
        "location": "Lyon",
        "start_date": "2025-02-10T00:00:00.000Z",
        "end_date": "2025-02-11T00:00:00.000Z",
        "race_type": "indoor"
      },
      "rankings": [
        {
          "id": "ranking-uuid-4",
          "club_name": "Club Aviron Lyon",
          "club_code": "LYO",
          "total_points": 180.0,
          "rank": 1,
          "points_count": 15
        },
        {
          "id": "ranking-uuid-5",
          "club_name": "Club Aviron Paris",
          "club_code": "PAR",
          "total_points": 165.5,
          "rank": 2,
          "points_count": 14
        }
      ]
    }
  ]
}
```

## 💻 Exemples d'utilisation

### Exemple 1 : Afficher tous les classements indoor

```typescript
async function fetchIndoorRankings() {
  try {
    const response = await fetch("/rankings/clubs/by-type/indoor", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    const { status, data } = await response.json();
    
    if (status === "success") {
      data.forEach((eventRankings) => {
        console.log(`Événement: ${eventRankings.event.name}`);
        console.log(`Date: ${new Date(eventRankings.event.start_date).toLocaleDateString()}`);
        console.log("Classement:");
        eventRankings.rankings.forEach((ranking) => {
          console.log(
            `${ranking.rank}. ${ranking.club_name} - ${ranking.total_points} points`
          );
        });
      });
    }
  } catch (error) {
    console.error("Erreur lors de la récupération des classements:", error);
  }
}
```

### Exemple 2 : Créer un tableau de classement

```typescript
function RankingsTable({ eventType }: { eventType: string }) {
  const [data, setData] = useState<EventRankings[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/rankings/clubs/by-type/${eventType}`)
      .then((res) => res.json())
      .then((result) => {
        if (result.status === "success") {
          setData(result.data);
        }
        setLoading(false);
      });
  }, [eventType]);

  if (loading) return <div>Chargement...</div>;

  return (
    <div>
      {data.map((eventRankings) => (
        <div key={eventRankings.event.id} className="event-section">
          <h2>{eventRankings.event.name}</h2>
          <p>
            {new Date(eventRankings.event.start_date).toLocaleDateString()} -{" "}
            {eventRankings.event.location}
          </p>
          <table>
            <thead>
              <tr>
                <th>Rang</th>
                <th>Club</th>
                <th>Code</th>
                <th>Points</th>
                <th>Nombre de points</th>
              </tr>
            </thead>
            <tbody>
              {eventRankings.rankings.map((ranking) => (
                <tr key={ranking.id}>
                  <td>{ranking.rank || "-"}</td>
                  <td>{ranking.club_name}</td>
                  <td>{ranking.club_code || "-"}</td>
                  <td>{ranking.total_points.toFixed(2)}</td>
                  <td>{ranking.points_count}</td>
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

### Exemple 3 : Calculer un classement global (tous événements confondus)

```typescript
function calculateGlobalRanking(eventRankings: EventRankings[]) {
  // Agréger les points par club sur tous les événements
  const clubTotals: Record<string, { club_name: string; club_code: string | null; total: number }> = {};
  
  eventRankings.forEach((eventRankings) => {
    eventRankings.rankings.forEach((ranking) => {
      const key = ranking.club_name;
      if (!clubTotals[key]) {
        clubTotals[key] = {
          club_name: ranking.club_name,
          club_code: ranking.club_code,
          total: 0,
        };
      }
      clubTotals[key].total += ranking.total_points;
    });
  });
  
  // Trier par total décroissant
  const globalRanking = Object.values(clubTotals)
    .sort((a, b) => b.total - a.total)
    .map((club, index) => ({
      ...club,
      global_rank: index + 1,
    }));
  
  return globalRanking;
}

// Utilisation
const globalRanking = calculateGlobalRanking(data);
console.log("Classement global:", globalRanking);
```

### Exemple 4 : Filtrer par date

```typescript
function getRankingsByDateRange(
  eventRankings: EventRankings[],
  startDate: Date,
  endDate: Date
) {
  return eventRankings.filter((eventRankings) => {
    const eventStart = new Date(eventRankings.event.start_date);
    return eventStart >= startDate && eventStart <= endDate;
  });
}

// Utilisation
const startDate = new Date("2025-01-01");
const endDate = new Date("2025-12-31");
const filteredRankings = getRankingsByDateRange(data, startDate, endDate);
```

## 🎨 Exemple de composant React complet

```typescript
import React, { useState, useEffect } from "react";

interface ClubRanking {
  id: string;
  club_name: string;
  club_code: string | null;
  total_points: number;
  rank: number | null;
  points_count: number;
}

interface EventRankings {
  event: {
    id: string;
    name: string;
    location: string;
    start_date: string;
    end_date: string;
    race_type: string;
  };
  rankings: ClubRanking[];
}

interface RankingsByTypeProps {
  eventType: "indoor" | "mer" | "rivière";
  rankingType?: "indoor_points" | "defis_capitaux" | "custom";
}

export const RankingsByType: React.FC<RankingsByTypeProps> = ({
  eventType,
  rankingType = "indoor_points",
}) => {
  const [data, setData] = useState<EventRankings[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRankings = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        const response = await fetch(
          `/rankings/clubs/by-type/${eventType}?ranking_type=${rankingType}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const result = await response.json();

        if (result.status === "success") {
          setData(result.data);
        } else {
          setError(result.message || "Erreur lors de la récupération des classements");
        }
      } catch (err) {
        setError("Erreur réseau");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchRankings();
  }, [eventType, rankingType]);

  if (loading) {
    return <div className="loading">Chargement des classements...</div>;
  }

  if (error) {
    return <div className="error">Erreur : {error}</div>;
  }

  if (data.length === 0) {
    return <div className="no-data">Aucun classement trouvé pour ce type d'événement</div>;
  }

  return (
    <div className="rankings-by-type">
      <h1>Classements - {eventType.toUpperCase()}</h1>
      {data.map((eventRankings) => (
        <div key={eventRankings.event.id} className="event-rankings">
          <div className="event-header">
            <h2>{eventRankings.event.name}</h2>
            <div className="event-info">
              <span>
                📅 {new Date(eventRankings.event.start_date).toLocaleDateString()}
              </span>
              <span>📍 {eventRankings.event.location}</span>
            </div>
          </div>
          <table className="rankings-table">
            <thead>
              <tr>
                <th>Rang</th>
                <th>Club</th>
                <th>Code</th>
                <th>Points</th>
                <th>Nb points</th>
              </tr>
            </thead>
            <tbody>
              {eventRankings.rankings.map((ranking) => (
                <tr
                  key={ranking.id}
                  className={ranking.rank === 1 ? "first-place" : ""}
                >
                  <td className="rank">
                    {ranking.rank ? (
                      <span className="rank-badge">{ranking.rank}</span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="club-name">{ranking.club_name}</td>
                  <td className="club-code">{ranking.club_code || "-"}</td>
                  <td className="points">{ranking.total_points.toFixed(2)}</td>
                  <td className="points-count">{ranking.points_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
};
```

## 🎨 Exemple de styles CSS

```css
.rankings-by-type {
  padding: 2rem;
}

.event-rankings {
  margin-bottom: 3rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
  background: #fff;
}

.event-header {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #007bff;
}

.event-header h2 {
  margin: 0 0 0.5rem 0;
  color: #333;
}

.event-info {
  display: flex;
  gap: 1.5rem;
  color: #666;
  font-size: 0.9rem;
}

.rankings-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}

.rankings-table thead {
  background-color: #f8f9fa;
}

.rankings-table th {
  padding: 0.75rem;
  text-align: left;
  font-weight: 600;
  color: #333;
  border-bottom: 2px solid #dee2e6;
}

.rankings-table td {
  padding: 0.75rem;
  border-bottom: 1px solid #e9ecef;
}

.rankings-table tbody tr:hover {
  background-color: #f8f9fa;
}

.rankings-table tbody tr.first-place {
  background-color: #fff3cd;
  font-weight: 600;
}

.rank-badge {
  display: inline-block;
  width: 2rem;
  height: 2rem;
  line-height: 2rem;
  text-align: center;
  background-color: #007bff;
  color: white;
  border-radius: 50%;
  font-weight: bold;
}

.rank-badge:first-child {
  background-color: #ffd700; /* Or pour le 1er */
}

.rank-badge:nth-child(2) {
  background-color: #c0c0c0; /* Argent pour le 2ème */
}

.rank-badge:nth-child(3) {
  background-color: #cd7f32; /* Bronze pour le 3ème */
}

.club-name {
  font-weight: 500;
}

.points {
  font-weight: 600;
  color: #007bff;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.error {
  text-align: center;
  padding: 2rem;
  color: #dc3545;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
}

.no-data {
  text-align: center;
  padding: 2rem;
  color: #666;
}
```

## ⚠️ Points d'attention

1. **Type d'événement** : Le paramètre `event_type` doit correspondre exactement à la valeur du champ `race_type` dans la base de données. Les valeurs courantes sont : "indoor", "mer", "rivière", mais peuvent varier selon les données importées.

2. **Événements sans classements** : Seuls les événements ayant au moins un classement de club sont retournés. Si un événement n'a pas encore de points calculés, il n'apparaîtra pas dans la réponse.

3. **Tri des événements** : Les événements sont triés par date de début (du plus récent au plus ancien).

4. **Tri des classements** : Les classements sont triés par rang (1er, 2ème, 3ème, etc.), puis par points décroissants en cas d'égalité.

5. **Points totaux** : Le champ `total_points` représente la somme de tous les points attribués au club pour cet événement. C'est un nombre décimal (peut avoir des décimales).

6. **Rang** : Le champ `rank` peut être `null` si le rang n'a pas encore été calculé. Utilisez `points_count` pour vérifier si des points ont été attribués.

7. **Points détaillés** : Le champ `points_count` indique le nombre d'entrées de points détaillés. Pour obtenir les détails, utilisez la route `/rankings/event/{event_id}/club/{club_name}/points`.

8. **Authentification** : Cette route nécessite une authentification (Bearer token). Assurez-vous de gérer les erreurs 401 (non authentifié) et 403 (non autorisé).

9. **Performance** : Cette route peut être lourde si beaucoup d'événements sont retournés. Pensez à mettre en cache les résultats côté frontend, surtout si les données ne changent pas fréquemment.

10. **Type de classement** : Le paramètre `ranking_type` permet de spécifier le type de classement à utiliser. Par défaut, `indoor_points` est utilisé. Assurez-vous d'utiliser le bon type selon le contexte.

## 🐛 Gestion des erreurs

### Erreur 401 - Non authentifié

```json
{
  "status": "error",
  "message": "Token d'authentification manquant ou invalide"
}
```

**Solution** : Vérifiez que le token est présent et valide dans les headers.

### Erreur 500 - Erreur serveur

```json
{
  "status": "error",
  "message": "Erreur lors de la récupération des classements"
}
```

**Solution** : Vérifiez les logs serveur et réessayez plus tard.

### Cas sans résultats

Si aucun événement du type spécifié n'a de classements, la réponse sera :

```json
{
  "status": "success",
  "data": []
}
```

## 📊 Cas d'usage recommandés

1. **Page de classements par type** : Afficher tous les classements pour un type d'événement donné
2. **Tableau de bord** : Créer un tableau de bord avec les classements de différents types d'événements
3. **Statistiques comparatives** : Comparer les performances des clubs entre différents événements
4. **Classement global** : Calculer un classement global en agrégeant les points de tous les événements d'un type
5. **Historique** : Afficher l'historique des classements pour suivre l'évolution des clubs

## 🔗 Routes complémentaires

Pour obtenir plus de détails sur les points d'un club pour un événement spécifique :

```
GET /rankings/event/{event_id}/club/{club_name}/points
```

Pour obtenir le classement d'un seul événement :

```
GET /rankings/event/{event_id}/ranking
```

## 📝 Notes importantes

- Les points sont calculés selon le template de points configuré (par défaut "Points Indoor")
- Les classements sont recalculés automatiquement lorsque de nouveaux points sont attribués
- Le rang peut être `null` si le classement n'a pas encore été recalculé après l'ajout de points
- Les événements sont filtrés pour ne retourner que ceux ayant des classements

