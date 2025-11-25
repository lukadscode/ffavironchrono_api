# Guide du système de notifications

## Vue d'ensemble

Le système de notifications permet de créer et diffuser des messages pour les événements et les courses. Les notifications sont transmises en temps réel via WebSocket et peuvent avoir différents niveaux d'importance.

## Structure de la base de données

### Table `notifications`

- `id` : UUID de la notification
- `event_id` : ID de l'événement (nullable, requis si `race_id` est null)
- `race_id` : ID de la course (nullable, requis si `event_id` est null)
- `message` : Texte de la notification (max 1000 caractères)
- `importance` : Niveau d'importance (`info`, `warning`, `error`, `success`)
- `is_active` : Si la notification est active (boolean)
- `start_date` : Date de début d'affichage (nullable, null = immédiat)
- `end_date` : Date de fin d'affichage (nullable, null = pas d'expiration)
- `created_by` : ID de l'utilisateur créateur
- `created_at`, `updated_at` : Timestamps

## API Endpoints

### Créer une notification

```http
POST /notifications
Authorization: Bearer <token>
Content-Type: application/json

{
  "event_id": "abc-123-def",  // ou race_id
  "message": "La course est reportée de 30 minutes",
  "importance": "warning",
  "is_active": true,
  "start_date": "2024-01-01T10:00:00Z",  // optionnel
  "end_date": "2024-01-01T18:00:00Z"     // optionnel
}
```

### Récupérer les notifications d'un événement (public)

```http
GET /notifications/event/{event_id}
```

Retourne uniquement les notifications actives et valides (selon `start_date` et `end_date`).

### Récupérer les notifications d'une course (public)

```http
GET /notifications/race/{race_id}
```

Retourne les notifications spécifiques à la course ET les notifications de l'événement parent.

### Lister toutes les notifications (backoffice)

```http
GET /notifications?event_id=abc-123&is_active=true
Authorization: Bearer <token>
```

### Mettre à jour une notification

```http
PUT /notifications/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "message": "Nouveau message",
  "importance": "error",
  "is_active": false
}
```

### Supprimer une notification

```http
DELETE /notifications/{id}
Authorization: Bearer <token>
```

## WebSocket Events

### Écouter les notifications

Le client doit rejoindre les rooms appropriées :

```javascript
// Rejoindre la room de l'événement
socket.emit('joinPublicEvent', { event_id: 'abc-123' });

// Rejoindre la room de la course
socket.emit('joinRoom', { race_id: 'race-123' });
```

### Événements WebSocket

#### `notification:new`
Émis lorsqu'une nouvelle notification est créée ou activée.

```javascript
socket.on('notification:new', (data) => {
  console.log('Nouvelle notification:', data);
  // {
  //   id: "notification-id",
  //   event_id: "abc-123",
  //   race_id: null,
  //   message: "La course est reportée",
  //   importance: "warning",
  //   created_at: "2024-01-01T10:00:00Z"
  // }
});
```

#### `notification:updated`
Émis lorsqu'une notification est mise à jour.

```javascript
socket.on('notification:updated', (data) => {
  console.log('Notification mise à jour:', data);
});
```

#### `notification:removed`
Émis lorsqu'une notification est supprimée ou désactivée.

```javascript
socket.on('notification:removed', (data) => {
  console.log('Notification supprimée:', data);
  // {
  //   id: "notification-id",
  //   event_id: "abc-123",
  //   race_id: null
  // }
});
```

## Niveaux d'importance

- `info` : Information générale (bleu)
- `success` : Succès/confirmation (vert)
- `warning` : Avertissement (orange)
- `error` : Erreur/alerte (rouge)

## Exemples d'utilisation

### Notification pour tout un événement

```javascript
// Créer une notification pour l'événement
await axios.post('/notifications', {
  event_id: 'abc-123',
  message: 'Les résultats seront disponibles dans 30 minutes',
  importance: 'info',
  is_active: true
}, {
  headers: { Authorization: `Bearer ${token}` }
});
```

### Notification pour une course spécifique

```javascript
// Créer une notification pour une course
await axios.post('/notifications', {
  race_id: 'race-456',
  message: 'Départ retardé de 15 minutes',
  importance: 'warning',
  is_active: true
}, {
  headers: { Authorization: `Bearer ${token}` }
});
```

### Notification programmée

```javascript
// Notification qui s'affichera à partir d'une date
await axios.post('/notifications', {
  event_id: 'abc-123',
  message: 'Les inscriptions sont ouvertes !',
  importance: 'success',
  is_active: true,
  start_date: '2024-01-15T08:00:00Z',
  end_date: '2024-01-20T18:00:00Z'
}, {
  headers: { Authorization: `Bearer ${token}` }
});
```

## Intégration Frontend

### Exemple React avec Socket.io

```typescript
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

interface Notification {
  id: string;
  event_id: string | null;
  race_id: string | null;
  message: string;
  importance: 'info' | 'warning' | 'error' | 'success';
  created_at: string;
}

const NotificationDisplay = ({ eventId, raceId }: { eventId?: string; raceId?: string }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [socket, setSocket] = useState<any>(null);

  useEffect(() => {
    // Connexion WebSocket
    const newSocket = io('http://localhost:3010');
    setSocket(newSocket);

    // Rejoindre les rooms
    if (eventId) {
      newSocket.emit('joinPublicEvent', { event_id: eventId });
    }
    if (raceId) {
      newSocket.emit('joinRoom', { race_id: raceId });
    }

    // Écouter les nouvelles notifications
    newSocket.on('notification:new', (data: Notification) => {
      setNotifications(prev => [data, ...prev]);
    });

    // Écouter les mises à jour
    newSocket.on('notification:updated', (data: Notification) => {
      setNotifications(prev =>
        prev.map(n => n.id === data.id ? data : n)
      );
    });

    // Écouter les suppressions
    newSocket.on('notification:removed', (data: { id: string }) => {
      setNotifications(prev => prev.filter(n => n.id !== data.id));
    });

    // Charger les notifications existantes
    const fetchNotifications = async () => {
      try {
        const url = raceId 
          ? `/notifications/race/${raceId}`
          : eventId 
          ? `/notifications/event/${eventId}`
          : null;
        
        if (url) {
          const response = await axios.get(url);
          setNotifications(response.data.data);
        }
      } catch (error) {
        console.error('Erreur lors du chargement des notifications:', error);
      }
    };

    fetchNotifications();

    return () => {
      newSocket.disconnect();
    };
  }, [eventId, raceId]);

  const getNotificationColor = (importance: string) => {
    switch (importance) {
      case 'error': return 'red';
      case 'warning': return 'orange';
      case 'success': return 'green';
      default: return 'blue';
    }
  };

  return (
    <div className="notifications-container">
      {notifications.map(notification => (
        <div
          key={notification.id}
          className="notification"
          style={{ borderLeft: `4px solid ${getNotificationColor(notification.importance)}` }}
        >
          <p>{notification.message}</p>
        </div>
      ))}
    </div>
  );
};
```

## Comportement

### Filtrage automatique

Les endpoints publics (`/notifications/event/:event_id` et `/notifications/race/:race_id`) retournent uniquement :
- Les notifications avec `is_active = true`
- Les notifications dont `start_date` est null ou dans le passé
- Les notifications dont `end_date` est null ou dans le futur

### Hiérarchie des notifications

Pour une course :
1. Les notifications spécifiques à la course (`race_id` = course)
2. Les notifications de l'événement parent (`event_id` = événement, `race_id` = null)

### Diffusion WebSocket

Les notifications sont diffusées dans les rooms suivantes :
- `event:{event_id}` : Pour les notifications d'événement
- `race_{race_id}` : Pour les notifications de course
- `event_{event_id}` : Alternative pour compatibilité

## Migration

Exécuter la migration SQL :

```bash
mysql -u user -p database < migrations/create_notifications_table.sql
```

Ou via votre outil de gestion de base de données.

## Notes importantes

1. **Validation** : Au moins `event_id` ou `race_id` doit être fourni
2. **Dates** : Les dates sont optionnelles. Si `start_date` est null, la notification est immédiate
3. **Expiration** : Si `end_date` est null, la notification n'expire pas
4. **WebSocket** : Les notifications sont diffusées automatiquement lors de la création/mise à jour/suppression
5. **Permissions** : Seuls les utilisateurs authentifiés peuvent créer/modifier/supprimer des notifications

