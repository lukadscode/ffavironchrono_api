# Guide Frontend : Statistiques d'Événement

## 📋 Vue d'ensemble

Cette route permet de récupérer les statistiques d'un événement, incluant le nombre de participants (total, hommes, femmes), le nombre d'équipages et le nombre de clubs présents.

Cette route est idéale pour afficher :
- Un tableau de bord avec les statistiques de l'événement
- Des indicateurs clés de performance (KPI)
- Des graphiques et visualisations de données
- Des résumés statistiques pour les rapports

## 📡 Endpoint API

### GET `/events/:id/statistics`

Récupère les statistiques d'un événement.

**Paramètres** :
- `id` (dans l'URL) : ID de l'événement

**Authentification** : Requise (Bearer token)

**Exemple de requête** :

```typescript
const eventId = "7c38e42f-198a-4bd6-9c59-9854094a1ea0";
const response = await fetch(`/events/${eventId}/statistics`, {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
const data = await response.json();
```

## 📦 Format de réponse

### Structure de la réponse

```typescript
interface EventStatisticsResponse {
  status: "success" | "error";
  data: EventStatistics;
}

interface EventStatistics {
  event_id: string;
  total_participants: number;        // Nombre total de participants uniques
  participants_homme: number;        // Nombre de participants hommes
  participants_femme: number;        // Nombre de participants femmes
  total_crews: number;               // Nombre total d'équipages
  total_clubs: number;               // Nombre de clubs distincts (par club_code)
}
```

### Exemple de réponse (200 OK)

```json
{
  "status": "success",
  "data": {
    "event_id": "7c38e42f-198a-4bd6-9c59-9854094a1ea0",
    "total_participants": 245,
    "participants_homme": 135,
    "participants_femme": 110,
    "total_crews": 48,
    "total_clubs": 12
  }
}
```

## 💻 Exemples d'utilisation

### Exemple 1 : Afficher les statistiques de base

```typescript
async function fetchEventStatistics(eventId: string) {
  try {
    const response = await fetch(`/events/${eventId}/statistics`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    const { status, data } = await response.json();
    
    if (status === "success") {
      console.log(`Participants totaux: ${data.total_participants}`);
      console.log(`Hommes: ${data.participants_homme}`);
      console.log(`Femmes: ${data.participants_femme}`);
      console.log(`Équipages: ${data.total_crews}`);
      console.log(`Clubs: ${data.total_clubs}`);
    }
  } catch (error) {
    console.error("Erreur lors de la récupération des statistiques:", error);
  }
}
```

### Exemple 2 : Créer un composant de statistiques

```typescript
function EventStatistics({ eventId }: { eventId: string }) {
  const [statistics, setStatistics] = useState<EventStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatistics = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        const response = await fetch(`/events/${eventId}/statistics`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const result = await response.json();

        if (result.status === "success") {
          setStatistics(result.data);
        } else {
          setError(result.message || "Erreur lors de la récupération des statistiques");
        }
      } catch (err) {
        setError("Erreur réseau");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchStatistics();
  }, [eventId]);

  if (loading) {
    return <div className="loading">Chargement des statistiques...</div>;
  }

  if (error) {
    return <div className="error">Erreur : {error}</div>;
  }

  if (!statistics) {
    return <div className="no-data">Aucune statistique disponible</div>;
  }

  return (
    <div className="event-statistics">
      <h2>Statistiques de l'événement</h2>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{statistics.total_participants}</div>
          <div className="stat-label">Participants totaux</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{statistics.participants_homme}</div>
          <div className="stat-label">Participants hommes</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{statistics.participants_femme}</div>
          <div className="stat-label">Participants femmes</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{statistics.total_crews}</div>
          <div className="stat-label">Équipages</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{statistics.total_clubs}</div>
          <div className="stat-label">Clubs</div>
        </div>
      </div>
    </div>
  );
}
```

### Exemple 3 : Calculer des pourcentages

```typescript
function calculatePercentages(statistics: EventStatistics) {
  const total = statistics.total_participants;
  
  return {
    hommes: total > 0 ? ((statistics.participants_homme / total) * 100).toFixed(1) : "0",
    femmes: total > 0 ? ((statistics.participants_femme / total) * 100).toFixed(1) : "0",
    participantsPerCrew: statistics.total_crews > 0 
      ? (statistics.total_participants / statistics.total_crews).toFixed(1) 
      : "0",
    crewsPerClub: statistics.total_clubs > 0 
      ? (statistics.total_crews / statistics.total_clubs).toFixed(1) 
      : "0",
  };
}

// Utilisation
const percentages = calculatePercentages(statistics);
console.log(`Hommes: ${percentages.hommes}%`);
console.log(`Femmes: ${percentages.femmes}%`);
console.log(`Participants par équipage: ${percentages.participantsPerCrew}`);
console.log(`Équipages par club: ${percentages.crewsPerClub}`);
```

### Exemple 4 : Créer un graphique de répartition par genre

```typescript
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

function GenderDistributionChart({ statistics }: { statistics: EventStatistics }) {
  const data = [
    { name: "Hommes", value: statistics.participants_homme, color: "#0088FE" },
    { name: "Femmes", value: statistics.participants_femme, color: "#FF8042" },
  ];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
```

## 🎨 Exemple de composant React complet

```typescript
import React, { useState, useEffect } from "react";

interface EventStatistics {
  event_id: string;
  total_participants: number;
  participants_homme: number;
  participants_femme: number;
  total_crews: number;
  total_clubs: number;
}

interface EventStatisticsProps {
  eventId: string;
}

export const EventStatistics: React.FC<EventStatisticsProps> = ({ eventId }) => {
  const [statistics, setStatistics] = useState<EventStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatistics = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        const response = await fetch(`/events/${eventId}/statistics`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const result = await response.json();

        if (result.status === "success") {
          setStatistics(result.data);
        } else {
          setError(result.message || "Erreur lors de la récupération des statistiques");
        }
      } catch (err) {
        setError("Erreur réseau");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchStatistics();
  }, [eventId]);

  if (loading) {
    return (
      <div className="statistics-loading">
        <div className="spinner"></div>
        <p>Chargement des statistiques...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="statistics-error">
        <p>❌ Erreur : {error}</p>
      </div>
    );
  }

  if (!statistics) {
    return (
      <div className="statistics-no-data">
        <p>Aucune statistique disponible pour cet événement</p>
      </div>
    );
  }

  const hommesPercentage = statistics.total_participants > 0
    ? ((statistics.participants_homme / statistics.total_participants) * 100).toFixed(1)
    : "0";
  
  const femmesPercentage = statistics.total_participants > 0
    ? ((statistics.participants_femme / statistics.total_participants) * 100).toFixed(1)
    : "0";

  const participantsPerCrew = statistics.total_crews > 0
    ? (statistics.total_participants / statistics.total_crews).toFixed(1)
    : "0";

  const crewsPerClub = statistics.total_clubs > 0
    ? (statistics.total_crews / statistics.total_clubs).toFixed(1)
    : "0";

  return (
    <div className="event-statistics">
      <h2>📊 Statistiques de l'événement</h2>
      
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-icon">👥</div>
          <div className="stat-value">{statistics.total_participants}</div>
          <div className="stat-label">Participants totaux</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">👨</div>
          <div className="stat-value">{statistics.participants_homme}</div>
          <div className="stat-label">Participants hommes</div>
          <div className="stat-percentage">{hommesPercentage}%</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">👩</div>
          <div className="stat-value">{statistics.participants_femme}</div>
          <div className="stat-label">Participants femmes</div>
          <div className="stat-percentage">{femmesPercentage}%</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🚣</div>
          <div className="stat-value">{statistics.total_crews}</div>
          <div className="stat-label">Équipages</div>
          <div className="stat-detail">
            {participantsPerCrew} participants/équipage
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🏛️</div>
          <div className="stat-value">{statistics.total_clubs}</div>
          <div className="stat-label">Clubs</div>
          <div className="stat-detail">
            {crewsPerClub} équipages/club
          </div>
        </div>
      </div>

      {/* Graphique de répartition par genre */}
      <div className="gender-chart">
        <h3>Répartition par genre</h3>
        <div className="chart-container">
          <div className="chart-bar">
            <div 
              className="chart-bar-fill hommes" 
              style={{ width: `${hommesPercentage}%` }}
            >
              <span>{statistics.participants_homme} hommes ({hommesPercentage}%)</span>
            </div>
            <div 
              className="chart-bar-fill femmes" 
              style={{ width: `${femmesPercentage}%` }}
            >
              <span>{statistics.participants_femme} femmes ({femmesPercentage}%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
```

## 🎨 Exemple de styles CSS

```css
.event-statistics {
  padding: 2rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.event-statistics h2 {
  margin-bottom: 2rem;
  color: #333;
  font-size: 1.5rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  text-align: center;
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.stat-card.primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.stat-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.stat-value {
  font-size: 2.5rem;
  font-weight: bold;
  color: #333;
  margin: 0.5rem 0;
}

.stat-card.primary .stat-value {
  color: white;
}

.stat-label {
  font-size: 0.9rem;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-card.primary .stat-label {
  color: rgba(255, 255, 255, 0.9);
}

.stat-percentage {
  font-size: 0.85rem;
  color: #007bff;
  margin-top: 0.5rem;
  font-weight: 600;
}

.stat-detail {
  font-size: 0.8rem;
  color: #999;
  margin-top: 0.5rem;
  font-style: italic;
}

.gender-chart {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-top: 2rem;
}

.gender-chart h3 {
  margin-bottom: 1rem;
  color: #333;
}

.chart-container {
  margin-top: 1rem;
}

.chart-bar {
  display: flex;
  height: 40px;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
}

.chart-bar-fill {
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 0.9rem;
  transition: width 0.5s ease;
}

.chart-bar-fill.hommes {
  background: linear-gradient(90deg, #0088FE 0%, #00C49F 100%);
}

.chart-bar-fill.femmes {
  background: linear-gradient(90deg, #FF8042 0%, #FF6B9D 100%);
}

.statistics-loading {
  text-align: center;
  padding: 3rem;
  color: #666;
}

.spinner {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #007bff;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.statistics-error {
  text-align: center;
  padding: 2rem;
  color: #dc3545;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
}

.statistics-no-data {
  text-align: center;
  padding: 2rem;
  color: #666;
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
}

/* Responsive */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .stat-value {
    font-size: 2rem;
  }
}
```

## ⚠️ Points d'attention

1. **Participants uniques** : Le champ `total_participants` compte les participants de manière unique. Si un participant est dans plusieurs équipages, il ne compte qu'une fois.

2. **Répartition par genre** : Les participants sont classés en "Homme" ou "Femme" selon leur champ `gender`. Les valeurs acceptées sont :
   - Pour hommes : "Homme", "H", "M"
   - Pour femmes : "Femme", "F"
   - Les participants avec un genre non reconnu ne sont pas comptés dans `participants_homme` ni `participants_femme`, mais sont inclus dans `total_participants`

3. **Clubs distincts** : Le champ `total_clubs` compte les clubs par `club_code`. Si un club a plusieurs noms mais le même code, il ne compte qu'une fois.

4. **Équipages** : Le champ `total_crews` compte tous les équipages de l'événement, qu'ils aient des participants ou non.

5. **Calculs de pourcentages** : Faites attention aux divisions par zéro lors du calcul des pourcentages. Vérifiez toujours que le dénominateur n'est pas zéro.

6. **Authentification** : Cette route nécessite une authentification (Bearer token). Assurez-vous de gérer les erreurs 401 (non authentifié) et 403 (non autorisé).

7. **Performance** : Cette route peut être lourde si l'événement contient beaucoup d'équipages et de participants. Pensez à mettre en cache les résultats côté frontend, surtout si les données ne changent pas fréquemment.

8. **Mise à jour en temps réel** : Les statistiques sont calculées à la volée à chaque requête. Si vous avez besoin de statistiques en temps réel, vous devrez peut-être rafraîchir périodiquement les données.

## 🐛 Gestion des erreurs

### Erreur 401 - Non authentifié

```json
{
  "status": "error",
  "message": "Token d'authentification manquant ou invalide"
}
```

**Solution** : Vérifiez que le token est présent et valide dans les headers.

### Erreur 404 - Événement non trouvé

```json
{
  "status": "error",
  "message": "Événement non trouvé"
}
```

**Solution** : Vérifiez que l'ID de l'événement est correct.

### Erreur 500 - Erreur serveur

```json
{
  "status": "error",
  "message": "Erreur lors de la récupération des statistiques"
}
```

**Solution** : Vérifiez les logs serveur et réessayez plus tard.

### Cas sans données

Si l'événement n'a pas d'équipages ou de participants, la réponse sera :

```json
{
  "status": "success",
  "data": {
    "event_id": "event-uuid",
    "total_participants": 0,
    "participants_homme": 0,
    "participants_femme": 0,
    "total_crews": 0,
    "total_clubs": 0
  }
}
```

## 📊 Cas d'usage recommandés

1. **Tableau de bord** : Afficher les statistiques principales de l'événement
2. **Page d'accueil de l'événement** : Présenter un résumé statistique
3. **Rapports** : Générer des rapports avec des statistiques
4. **Graphiques** : Créer des visualisations de données (graphiques en barres, camemberts, etc.)
5. **Comparaisons** : Comparer les statistiques entre différents événements
6. **Indicateurs de performance** : Suivre l'évolution des statistiques au fil du temps

## 🔗 Routes complémentaires

Pour obtenir plus de détails sur les participants d'un événement :

```
GET /participants/event/:event_id
```

Pour obtenir les équipages d'un événement :

```
GET /crews?event_id={event_id}
```

Pour obtenir les résultats d'un événement :

```
GET /indoor-results/event/:event_id
```

## 📝 Notes importantes

- Les statistiques sont calculées à la volée à chaque requête
- Les participants sont comptés de manière unique (par ID)
- Les clubs sont comptés par `club_code` (pas par nom)
- Le genre est détecté de manière flexible pour gérer différentes variantes
- Les équipages sans participants sont inclus dans `total_crews` mais n'affectent pas `total_participants`

