# 📱 Documentation API Mobile - Authentification Timing Point

## Vue d'ensemble

Cette documentation décrit l'intégration de l'application mobile avec le backend pour l'authentification et les opérations de timing point. L'application mobile permet aux appareils de se connecter via un **token de timing point** et de recevoir des mises à jour en temps réel via WebSocket.

---

## 🔐 1. Authentification via Token

### Endpoint : Résolution de Token

**Route :** `POST /public/timing-points/resolve-token`

**Description :** Endpoint public permettant à un appareil mobile d'authentifier un timing point via son token unique. Cet endpoint retourne toutes les informations nécessaires pour l'application mobile.

**Authentification :** Aucune (endpoint public)

#### Requête

```json
{
  "token": "TP-XYZ-001",
  "device_id": "device-1234567890-abc123"
}
```

**Paramètres :**
- `token` (string, requis) : Le token du timing point (ex: "123-456-789")
- `device_id` (string, requis) : Identifiant unique de l'appareil mobile (UUID)

#### Réponse Succès (200 OK)

```json
{
  "status": "success",
  "data": {
    "timing_point_id": "tp-uuid-123",
    "timing_point_label": "Arrivée 2000m",
    "event_id": "event-uuid-456",
    "event_name": "Championnat de France 2024",
    "event_location": "Lac d'Aiguebelette",
    "event_start_date": "2024-06-15T08:00:00.000Z",
    "event_end_date": "2024-06-17T18:00:00.000Z",
    "order_index": 3,
    "distance_m": 2000,
    "token": "TP-XYZ-001"
  }
}
```

**Données retournées :**
- `timing_point_id` : ID unique du timing point
- `timing_point_label` : Nom/libellé du timing point (ex: "Arrivée", "Départ", "500m")
- `event_id` : ID de l'événement associé
- `event_name` : Nom de l'événement
- `event_location` : Lieu de l'événement
- `event_start_date` : Date de début de l'événement (ISO 8601)
- `event_end_date` : Date de fin de l'événement (ISO 8601)
- `order_index` : Ordre du timing point dans la course
- `distance_m` : Distance en mètres depuis le départ
- `token` : Token du timing point (confirmé)

#### Réponses d'Erreur

**404 Not Found - Token invalide**
```json
{
  "status": "error",
  "message": "Token de timing point invalide ou introuvable"
}
```

**400 Bad Request - Paramètres manquants**
```json
{
  "status": "error",
  "message": "\"token\" is required"
}
```

#### Exemple d'utilisation (JavaScript/TypeScript)

```typescript
const resolveTimingPointToken = async (token: string, deviceId: string) => {
  const response = await fetch(`${API_BASE_URL}/public/timing-points/resolve-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token,
      device_id: deviceId,
    }),
  });

  if (!response.ok) {
    throw new Error('Token invalide');
  }

  const result = await response.json();
  return result.data;
};

// Stocker les données en AsyncStorage (React Native)
await AsyncStorage.setItem('timingPoint', JSON.stringify(result.data));
```

---

## 🔌 2. WebSocket - Mises à jour en temps réel

### Connexion WebSocket

**URL :** `ws://your-api-url/socket.io/` (ou `wss://` en HTTPS)

**Bibliothèque recommandée :** `socket.io-client`

#### Installation

```bash
npm install socket.io-client
# ou
yarn add socket.io-client
```

#### Connexion initiale

```typescript
import { io } from 'socket.io-client';

const socket = io(API_BASE_URL, {
  transports: ['websocket'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
});

socket.on('connect', () => {
  console.log('✅ Connecté au serveur WebSocket');
});

socket.on('disconnect', () => {
  console.log('❌ Déconnecté du serveur WebSocket');
});
```

---

### 📡 Événements WebSocket disponibles

#### 1. Rejoindre une room d'événement

Pour recevoir les mises à jour d'un événement spécifique :

```typescript
socket.emit('joinPublicEvent', {
  event_id: 'event-uuid-456'
});
```

**Événement émis :** `joinPublicEvent`
**Paramètres :**
- `event_id` (string, requis) : ID de l'événement

**Note :** Cet événement permet de recevoir toutes les mises à jour de l'événement (courses, timings, notifications).

---

#### 2. Rejoindre une room de timing point

Pour recevoir les timings créés sur un timing point spécifique :

```typescript
socket.emit('watchTimingPoint', {
  timing_point_id: 'tp-uuid-123'
});
```

**Événement émis :** `watchTimingPoint`
**Paramètres :**
- `timing_point_id` (string, requis) : ID du timing point

**Réponse reçue :** `timingPointViewerCount`
```json
{
  "timing_point_id": "tp-uuid-123",
  "count": 3
}
```
Le `count` indique le nombre de clients qui surveillent ce timing point.

---

#### 3. Quitter une room

```typescript
// Quitter l'événement
socket.emit('leavePublicEvent', {
  event_id: 'event-uuid-456'
});

// Quitter le timing point
socket.emit('unwatchTimingPoint', {
  timing_point_id: 'tp-uuid-123'
});
```

---

### 📥 Événements reçus (écouter)

#### 1. Nouveau timing créé (`timingImpulse`)

Émis lorsqu'un nouveau timing est créé sur le timing point surveillé.

```typescript
socket.on('timingImpulse', (data) => {
  console.log('Nouveau timing reçu:', data);
  // Traiter le timing (afficher, stocker, etc.)
});
```

**Format des données :**
```json
{
  "id": "timing-uuid",
  "timing_point_id": "tp-uuid-123",
  "timestamp": "2024-06-15T10:30:45.123Z",
  "manual_entry": false,
  "status": "pending",
  "TimingPoint": {
    "id": "tp-uuid-123",
    "label": "Arrivée 2000m",
    "distance_m": 2000,
    "order_index": 3,
    "Event": {
      "id": "event-uuid-456",
      "name": "Championnat de France 2024"
    }
  }
}
```

---

#### 2. Mise à jour intermédiaire de course (`raceIntermediateUpdate`)

Émis lorsqu'un équipage passe un timing point intermédiaire.

```typescript
socket.on('raceIntermediateUpdate', (data) => {
  console.log('Mise à jour intermédiaire:', data);
  // Afficher le temps intermédiaire
});
```

**Format des données :**
```json
{
  "race_id": "race-uuid",
  "crew_id": "crew-uuid",
  "timing_point_id": "tp-uuid-123",
  "timing_point_label": "Arrivée 2000m",
  "distance_m": 2000,
  "time_ms": "420000",
  "relative_time_ms": 420000,
  "order_index": 3
}
```

**Champs :**
- `race_id` : ID de la course
- `crew_id` : ID de l'équipage
- `timing_point_id` : ID du timing point
- `timing_point_label` : Libellé du timing point
- `distance_m` : Distance en mètres
- `time_ms` : Temps en millisecondes (string)
- `relative_time_ms` : Temps relatif en millisecondes (nombre) - **Temps depuis le départ réel**
- `order_index` : Ordre du timing point

---

#### 3. Mise à jour finale de course (`raceFinalUpdate`)

Émis lorsqu'un équipage termine la course.

```typescript
socket.on('raceFinalUpdate', (data) => {
  console.log('Temps final:', data);
  // Afficher le temps final
});
```

**Format des données :**
```json
{
  "race_id": "race-uuid",
  "crew_id": "crew-uuid",
  "final_time": "420000",
  "relative_time_ms": 420000
}
```

**Champs :**
- `race_id` : ID de la course
- `crew_id` : ID de l'équipage
- `final_time` : Temps final en millisecondes (string)
- `relative_time_ms` : Temps relatif en millisecondes (nombre) - **Temps depuis le départ réel**

---

#### 4. Notification événement (`notification:new`)

Émis lorsqu'une nouvelle notification est créée pour l'événement.

```typescript
socket.on('notification:new', (data) => {
  console.log('Nouvelle notification:', data);
  // Afficher la notification à l'utilisateur
});
```

**Format des données :**
```json
{
  "id": "notification-uuid",
  "event_id": "event-uuid-456",
  "race_id": "race-uuid" | null,
  "message": "La course suivante commence dans 5 minutes",
  "importance": "info",
  "created_at": "2024-06-15T10:25:00.000Z"
}
```

**Types d'importance :** `info`, `warning`, `error`, `success`

---

#### 5. Mise à jour du statut de course (`raceStatusUpdate`)

Émis lorsque le statut d'une course change.

```typescript
socket.on('raceStatusUpdate', (data) => {
  console.log('Statut course:', data);
});
```

**Format des données :**
```json
{
  "race_id": "race-uuid",
  "status": "official"
}
```

**Statuts possibles :** `pending`, `official`, `non_official`, etc.

---

## 🔄 3. Flux d'intégration complet

### Étape 1 : Résolution du token

Lorsque l'utilisateur saisit le token dans l'application :

```typescript
// 1. Récupérer le device_id (générer ou récupérer depuis AsyncStorage)
const deviceId = await getOrCreateDeviceId();

// 2. Résoudre le token
const timingPointData = await resolveTimingPointToken(token, deviceId);

// 3. Stocker les données
await AsyncStorage.setItem('timingPoint', JSON.stringify(timingPointData));
await AsyncStorage.setItem('eventId', timingPointData.event_id);
await AsyncStorage.setItem('timingPointId', timingPointData.timing_point_id);
```

### Étape 2 : Connexion WebSocket

Après la résolution du token :

```typescript
// 1. Se connecter au WebSocket
const socket = io(API_BASE_URL);

socket.on('connect', async () => {
  // 2. Récupérer l'event_id depuis AsyncStorage
  const eventId = await AsyncStorage.getItem('eventId');
  const timingPointId = await AsyncStorage.getItem('timingPointId');

  // 3. Rejoindre les rooms
  socket.emit('joinPublicEvent', { event_id: eventId });
  socket.emit('watchTimingPoint', { timing_point_id: timingPointId });

  // 4. Écouter les événements
  setupSocketListeners(socket);
});
```

### Étape 3 : Écouter les événements

```typescript
const setupSocketListeners = (socket) => {
  // Nouveau timing créé sur ce timing point
  socket.on('timingImpulse', (timing) => {
    // Afficher le timing dans l'interface
    displayNewTiming(timing);
  });

  // Mise à jour intermédiaire
  socket.on('raceIntermediateUpdate', (data) => {
    updateRaceDisplay(data);
  });

  // Mise à jour finale
  socket.on('raceFinalUpdate', (data) => {
    updateFinalTime(data);
  });

  // Notifications
  socket.on('notification:new', (notification) => {
    showNotification(notification);
  });
};
```

### Étape 4 : Créer un timing

Lorsque l'appareil mobile crée un nouveau timing :

```typescript
const createTiming = async (timingPointId: string) => {
  const response = await fetch(`${API_BASE_URL}/timings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timing_point_id: timingPointId,
      timestamp: new Date().toISOString(),
      manual_entry: false,
    }),
  });

  const result = await response.json();
  return result.data;
};
```

**Note :** Ce timing sera automatiquement diffusé via WebSocket à tous les clients qui écoutent le timing point.

---

## 📋 4. Résumé des endpoints REST utilisés

| Endpoint | Méthode | Auth | Description |
|----------|---------|------|-------------|
| `/public/timing-points/resolve-token` | POST | ❌ | Résoudre un token de timing point |
| `/timings` | POST | ❌ | Créer un nouveau timing |
| `/timings/event/:eventId` | GET | ❌ | Récupérer les timings d'un événement |
| `/races/event/:eventId` | GET | ❌ | Récupérer les courses d'un événement |
| `/timing-points/event/:eventId` | GET | ❌ | Récupérer les timing points d'un événement |

**Note :** Tous ces endpoints sont publics (pas d'authentification JWT requise). L'authentification se fait via le token du timing point.

---

## 🔒 5. Sécurité

### Points importants

1. **Token unique** : Chaque timing point a un token unique qui sert d'authentification
2. **Pas de session utilisateur** : L'appareil n'a pas de session utilisateur classique
3. **Accès limité** : Après résolution du token, l'appareil peut uniquement :
   - Créer des timings pour ce timing point
   - Lire les données de l'événement associé
   - Recevoir les mises à jour en temps réel via WebSocket
   - **Ne peut PAS** accéder aux endpoints d'administration

### Recommandations

- Stocker le token de façon sécurisée (AsyncStorage chiffré)
- Valider le token avant chaque opération importante
- Gérer la reconnexion WebSocket automatiquement
- Vérifier périodiquement que le token est toujours valide

---

## 🛠️ 6. Gestion des erreurs

### Reconnexion WebSocket

```typescript
socket.on('connect_error', (error) => {
  console.error('Erreur de connexion:', error);
  // Le client se reconnectera automatiquement
});

socket.on('reconnect', (attemptNumber) => {
  console.log(`Reconnecté après ${attemptNumber} tentatives`);
  // Rejoindre à nouveau les rooms
  const eventId = await AsyncStorage.getItem('eventId');
  socket.emit('joinPublicEvent', { event_id: eventId });
});
```

### Gestion des erreurs HTTP

```typescript
try {
  const data = await resolveTimingPointToken(token, deviceId);
} catch (error) {
  if (error.response?.status === 404) {
    // Token invalide
    showError('Token invalide. Vérifiez le code et réessayez.');
  } else if (error.response?.status === 400) {
    // Paramètres manquants
    showError('Erreur de validation. Vérifiez les paramètres.');
  } else {
    // Erreur serveur
    showError('Erreur serveur. Réessayez plus tard.');
  }
}
```

---

## 📝 7. Exemple complet d'intégration (React Native)

```typescript
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

class TimingPointService {
  private socket: Socket | null = null;
  private eventId: string | null = null;
  private timingPointId: string | null = null;

  async initialize(token: string) {
    try {
      // 1. Résoudre le token
      const deviceId = await this.getOrCreateDeviceId();
      const data = await this.resolveToken(token, deviceId);

      // 2. Stocker les données
      this.eventId = data.event_id;
      this.timingPointId = data.timing_point_id;
      await AsyncStorage.setItem('timingPoint', JSON.stringify(data));

      // 3. Se connecter au WebSocket
      await this.connectWebSocket();

      return data;
    } catch (error) {
      console.error('Erreur d\'initialisation:', error);
      throw error;
    }
  }

  private async resolveToken(token: string, deviceId: string) {
    const response = await fetch(`${API_BASE_URL}/public/timing-points/resolve-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, device_id: deviceId }),
    });

    if (!response.ok) {
      throw new Error('Token invalide');
    }

    const result = await response.json();
    return result.data;
  }

  private async connectWebSocket() {
    this.socket = io(API_BASE_URL, {
      transports: ['websocket'],
      reconnection: true,
    });

    this.socket.on('connect', () => {
      console.log('✅ Connecté au WebSocket');
      this.joinRooms();
    });

    this.socket.on('timingImpulse', (timing) => {
      // Émettre un événement React Native
      EventEmitter.emit('timing:new', timing);
    });

    this.socket.on('raceIntermediateUpdate', (data) => {
      EventEmitter.emit('race:intermediate', data);
    });

    this.socket.on('raceFinalUpdate', (data) => {
      EventEmitter.emit('race:final', data);
    });
  }

  private joinRooms() {
    if (this.socket && this.eventId && this.timingPointId) {
      this.socket.emit('joinPublicEvent', { event_id: this.eventId });
      this.socket.emit('watchTimingPoint', { timing_point_id: this.timingPointId });
    }
  }

  async createTiming() {
    if (!this.timingPointId) throw new Error('Timing point non initialisé');

    const response = await fetch(`${API_BASE_URL}/timings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timing_point_id: this.timingPointId,
        timestamp: new Date().toISOString(),
        manual_entry: false,
      }),
    });

    return response.json();
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private async getOrCreateDeviceId(): Promise<string> {
    let deviceId = await AsyncStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = generateUUID(); // Implémenter votre fonction UUID
      await AsyncStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }
}

export default new TimingPointService();
```

---

## 🎯 8. Checklist d'intégration

- [ ] Implémenter la résolution de token
- [ ] Stocker les données du timing point (AsyncStorage)
- [ ] Configurer la connexion WebSocket
- [ ] Rejoindre les rooms (`joinPublicEvent`, `watchTimingPoint`)
- [ ] Écouter les événements WebSocket
- [ ] Implémenter la création de timings
- [ ] Gérer les erreurs et les reconnexions
- [ ] Tester avec des tokens valides et invalides
- [ ] Tester la reconnexion WebSocket
- [ ] Gérer le cycle de vie de l'application (foreground/background)

---

## 📞 Support

Pour toute question ou problème, contacter l'équipe backend.

