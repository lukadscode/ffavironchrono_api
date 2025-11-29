# Guide Frontend : WebSocket pour Résultats Indoor

## 📡 Événements WebSocket disponibles

### 1. `indoorResultsImported`

Émis quand des résultats indoor sont importés pour une course.

**Quand** :
- Après un import réussi via `POST /indoor-results/import`
- Quand la course passe en statut "non_official" ou "finished" après l'import

**Données** :
```typescript
{
  race_id: string;
  event_id: string;
  participants_count: number;
  linked_crews_count: number;
  race_status: string; // "non_official", "finished", ou "official"
}
```

**Exemple d'utilisation** :
```typescript
socket.on("indoorResultsImported", async ({ race_id, event_id, participants_count }) => {
  console.log(`Résultats importés pour la course ${race_id}: ${participants_count} participants`);
  
  // Recharger les résultats de la course
  const results = await getRaceResults(race_id);
  setRaceResults(results);
  
  // Ou mettre à jour directement l'état
  setRaces((prev) =>
    prev.map((race) => {
      if (race.id !== race_id) return race;
      return { ...race, hasIndoorResults: true };
    })
  );
});
```

---

### 2. `indoorParticipantUpdate`

Émis quand un participant indoor termine sa course (si ErgRace envoie des mises à jour en temps réel).

**Quand** :
- Quand un nouveau participant termine sa course
- Quand les résultats d'un participant sont mis à jour

**Données** :
```typescript
{
  race_id: string;
  event_id: string;
  participant: {
    id: string;
    place: number;
    time_display: string;
    time_ms: number;
    distance: number;
    avg_pace: string;
    spm: number;
    calories: number;
    crew_id?: string | null;
    crew?: {
      id: string;
      club_name: string;
      club_code: string;
      category?: {
        id: string;
        code: string;
        label: string;
      };
    } | null;
  };
}
```

**Exemple d'utilisation** :
```typescript
socket.on("indoorParticipantUpdate", ({ race_id, participant }) => {
  console.log(`Mise à jour participant: ${participant.crew?.club_name || participant.id}`);
  
  // Mettre à jour les résultats de la course en temps réel
  setRaces((prev) =>
    prev.map((race) => {
      if (race.id !== race_id) return race;
      
      // Mettre à jour ou ajouter le participant
      const existingIndex = race.indoorResults?.participants?.findIndex(
        (p) => p.id === participant.id
      );
      
      if (existingIndex !== undefined && existingIndex >= 0) {
        // Mettre à jour le participant existant
        const updatedParticipants = [...race.indoorResults.participants];
        updatedParticipants[existingIndex] = participant;
        return {
          ...race,
          indoorResults: {
            ...race.indoorResults,
            participants: updatedParticipants.sort((a, b) => a.place - b.place),
          },
        };
      } else {
        // Ajouter le nouveau participant
        const newParticipants = [
          ...(race.indoorResults?.participants || []),
          participant,
        ].sort((a, b) => a.place - b.place);
        
        return {
          ...race,
          indoorResults: {
            ...race.indoorResults,
            participants: newParticipants,
          },
        };
      }
    })
  );
});
```

---

### 3. `indoorRaceResultsComplete`

Émis quand tous les résultats d'une course indoor sont disponibles et que la course passe en statut "official".

**Quand** :
- Quand la course passe en statut "official" (validée par les arbitres)
- Tous les participants ont terminé

**Données** :
```typescript
{
  race_id: string;
  event_id: string;
  total_participants: number;
  race_status: string; // "official"
}
```

**Exemple d'utilisation** :
```typescript
socket.on("indoorRaceResultsComplete", ({ race_id, total_participants }) => {
  console.log(`Course ${race_id} terminée avec ${total_participants} participants`);
  
  // Mettre à jour le statut de la course
  setRaces((prev) =>
    prev.map((race) => {
      if (race.id !== race_id) return race;
      return { ...race, status: "official", isComplete: true };
    })
  );
  
  // Afficher une notification
  showNotification({
    type: "success",
    message: "Les résultats de la course sont maintenant officiels",
  });
});
```

---

## 🏠 Rooms WebSocket

Les événements sont émis dans les rooms suivantes :

### Rooms d'événement
- `event:${event_id}` - Événement public (format standard)
- `publicEvent:${event_id}` - Alias pour compatibilité

### Rooms de course
- `race_${race_id}` - Course (format standard)
- `race:${race_id}` - Alias pour compatibilité

**Note** : Les deux formats sont utilisés pour assurer la compatibilité avec le code existant.

---

## 🔌 Connexion et abonnement

### Exemple complet (React/TypeScript)

```typescript
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = 'https://api-timing.ffaviron.fr';

function useIndoorResultsWebSocket(eventId: string, raceId?: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [indoorResults, setIndoorResults] = useState<any>(null);

  useEffect(() => {
    // Connexion WebSocket
    const newSocket = io(API_URL, {
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      console.log('✅ WebSocket connecté');

      // Rejoindre les rooms
      if (eventId) {
        newSocket.emit('joinPublicEvent', { event_id: eventId });
      }
      if (raceId) {
        newSocket.emit('joinRoom', { race_id: raceId, event_id: eventId });
      }
    });

    // Écouter les résultats importés
    newSocket.on('indoorResultsImported', async ({ race_id, participants_count }) => {
      console.log(`📥 Résultats importés: ${participants_count} participants`);
      
      if (race_id === raceId) {
        // Recharger les résultats
        const results = await fetchRaceResults(race_id);
        setIndoorResults(results);
      }
    });

    // Écouter les mises à jour de participants
    newSocket.on('indoorParticipantUpdate', ({ race_id, participant }) => {
      if (race_id === raceId) {
        setIndoorResults((prev: any) => {
          if (!prev) return prev;
          
          const participants = prev.participants || [];
          const index = participants.findIndex((p: any) => p.id === participant.id);
          
          if (index >= 0) {
            // Mettre à jour
            const updated = [...participants];
            updated[index] = participant;
            return {
              ...prev,
              participants: updated.sort((a: any, b: any) => a.place - b.place),
            };
          } else {
            // Ajouter
            return {
              ...prev,
              participants: [...participants, participant].sort(
                (a: any, b: any) => a.place - b.place
              ),
            };
          }
        });
      }
    });

    // Écouter la complétion de la course
    newSocket.on('indoorRaceResultsComplete', ({ race_id, total_participants }) => {
      if (race_id === raceId) {
        console.log(`✅ Course terminée: ${total_participants} participants`);
        setIndoorResults((prev: any) => ({
          ...prev,
          race_status: 'official',
        }));
      }
    });

    setSocket(newSocket);

    // Nettoyage à la déconnexion
    return () => {
      if (eventId) {
        newSocket.emit('leavePublicEvent', { event_id: eventId });
      }
      if (raceId) {
        newSocket.emit('leaveRoom', { race_id: raceId, event_id: eventId });
      }
      newSocket.disconnect();
    };
  }, [eventId, raceId]);

  return { socket, indoorResults };
}

// Utilisation dans un composant
function LiveIndoorRace({ eventId, raceId }: { eventId: string; raceId: string }) {
  const { indoorResults } = useIndoorResultsWebSocket(eventId, raceId);

  if (!indoorResults) {
    return <div>Chargement des résultats...</div>;
  }

  return (
    <div>
      <h2>Résultats en temps réel</h2>
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
          {indoorResults.participants.map((p: any) => (
            <tr key={p.id}>
              <td>{p.place}</td>
              <td>
                {p.crew ? (
                  `${p.crew.club_name} - ${p.crew.category?.label}`
                ) : (
                  <span style={{ color: 'gray' }}>Non identifié</span>
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

## ⚠️ Notes importantes

### 1. Compatibilité
Les événements WebSocket pour les résultats indoor sont **indépendants** des événements existants (`raceIntermediateUpdate`, `raceFinalUpdate`) qui sont utilisés pour les courses normales (outdoor). Aucun conflit n'est possible.

### 2. Format des rooms
Le système émet dans **plusieurs formats de rooms** pour assurer la compatibilité :
- `event:${event_id}` et `publicEvent:${event_id}` pour les événements
- `race_${race_id}` et `race:${race_id}` pour les courses

### 3. Performance
Pour les événements avec beaucoup de participants, seules les **mises à jour incrémentielles** sont envoyées via `indoorParticipantUpdate`. L'événement `indoorResultsImported` est émis une seule fois après l'import complet.

### 4. Gestion des erreurs
```typescript
socket.on('connect_error', (error) => {
  console.error('Erreur de connexion WebSocket:', error);
  // Implémenter une logique de reconnexion si nécessaire
});

socket.on('disconnect', (reason) => {
  console.log('Déconnexion WebSocket:', reason);
  // Implémenter une logique de reconnexion si nécessaire
});
```

---

## 📋 Checklist d'intégration

- [ ] Installer `socket.io-client` : `npm install socket.io-client`
- [ ] Créer un hook `useIndoorResultsWebSocket` ou similaire
- [ ] Écouter `indoorResultsImported` pour recharger les résultats
- [ ] Écouter `indoorParticipantUpdate` pour les mises à jour en temps réel
- [ ] Écouter `indoorRaceResultsComplete` pour notifier la fin de course
- [ ] Gérer les déconnexions et reconnexions
- [ ] Tester avec plusieurs clients connectés simultanément

---

**Date de création** : 2024-01-XX  
**Version API** : 1.0.0

