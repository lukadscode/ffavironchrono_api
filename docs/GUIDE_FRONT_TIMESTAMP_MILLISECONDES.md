# Guide Frontend : Support des millisecondes pour les timestamps

## 📋 Résumé des modifications backend

Le backend a été mis à jour pour supporter les **millisecondes** dans les timestamps de chronométrage :
- Le champ `timestamp` dans la table `timings` utilise maintenant `DATETIME(3)` au lieu de `DATETIME`
- Cela permet une précision de **millisecondes** (hh:mm:ss.mmm) au lieu de secondes seulement

## ✅ Ce qui fonctionne déjà (pas de modification nécessaire)

### 1. Envoi de timestamps

Le format ISO 8601 avec millisecondes est **déjà supporté** et fonctionne automatiquement :

```javascript
// ✅ Fonctionne déjà - JavaScript envoie automatiquement les millisecondes
const timestamp = new Date().toISOString();
// Résultat : "2024-01-15T10:30:45.123Z" (avec millisecondes)

// Exemple d'envoi au backend
const response = await fetch('/timings', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    timing_point_id: 'uuid',
    timestamp: new Date().toISOString(), // ✅ Inclut automatiquement les millisecondes
    manual_entry: false
  })
});
```

### 2. Réception de timestamps

Le backend retourne les timestamps au format ISO 8601 avec millisecondes :

```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "timestamp": "2024-01-15T10:30:45.123Z",
    "timing_point_id": "uuid"
  }
}
```

JavaScript parse automatiquement ce format avec `new Date()` :

```javascript
const timing = await response.json();
const date = new Date(timing.data.timestamp);
// date.getTime() retourne déjà les millisecondes depuis l'époque Unix
```

### 3. Calculs de temps relatifs

Les calculs utilisent déjà `getTime()` qui retourne les millisecondes :

```javascript
// ✅ Fonctionne déjà - getTime() retourne les millisecondes
const start = new Date(startTiming.timestamp).getTime();
const finish = new Date(finishTiming.timestamp).getTime();
const duration_ms = finish - start; // Différence en millisecondes
```

## 🔧 Modifications recommandées côté frontend

### 1. Affichage des timestamps avec millisecondes

Pour un logiciel de chronométrage professionnel, vous devriez **afficher les millisecondes** dans l'interface utilisateur.

#### Fonction de formatage recommandée

```javascript
/**
 * Formate un timestamp avec millisecondes pour l'affichage
 * @param {string|Date} timestamp - Timestamp ISO 8601 ou objet Date
 * @param {boolean} showMilliseconds - Afficher les millisecondes (défaut: true)
 * @returns {string} Timestamp formaté "HH:mm:ss.mmm"
 */
function formatTimestamp(timestamp, showMilliseconds = true) {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  
  if (showMilliseconds) {
    const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${milliseconds}`;
  } else {
    return `${hours}:${minutes}:${seconds}`;
  }
}

// Exemples d'utilisation
formatTimestamp('2024-01-15T10:30:45.123Z'); 
// Résultat : "11:30:45.123" (en heure locale)

formatTimestamp(new Date(), false); 
// Résultat : "11:30:45" (sans millisecondes)
```

#### Formatage pour les temps de course (durée)

```javascript
/**
 * Formate une durée en millisecondes au format chronométrage
 * @param {number} milliseconds - Durée en millisecondes
 * @returns {string} Format "mm:ss.mmm" ou "hh:mm:ss.mmm"
 */
function formatDuration(milliseconds) {
  if (milliseconds === null || milliseconds === undefined) return '--:--.---';
  
  const totalSeconds = Math.floor(milliseconds / 1000);
  const ms = milliseconds % 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  const msStr = ms.toString().padStart(3, '0');
  const secStr = seconds.toString().padStart(2, '0');
  const minStr = minutes.toString().padStart(2, '0');
  
  if (hours > 0) {
    const hourStr = hours.toString().padStart(2, '0');
    return `${hourStr}:${minStr}:${secStr}.${msStr}`;
  } else {
    return `${minStr}:${secStr}.${msStr}`;
  }
}

// Exemples
formatDuration(420123); // "07:00.123" (7 minutes et 123ms)
formatDuration(3665123); // "01:01:05.123" (1h 1min 5s 123ms)
formatDuration(123); // "00:00.123" (123ms)
```

### 2. Composant React d'exemple

```jsx
import React from 'react';

const TimingDisplay = ({ timing }) => {
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '--:--:--.---';
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${milliseconds}`;
  };

  const formatDuration = (ms) => {
    if (ms === null || ms === undefined) return '--:--.---';
    const totalSeconds = Math.floor(ms / 1000);
    const msPart = ms % 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${msPart.toString().padStart(3, '0')}`;
  };

  return (
    <div className="timing-display">
      <div className="timestamp">
        <label>Timestamp:</label>
        <span>{formatTimestamp(timing.timestamp)}</span>
      </div>
      {timing.relative_time_ms !== null && (
        <div className="duration">
          <label>Temps de course:</label>
          <span className="duration-value">
            {formatDuration(timing.relative_time_ms)}
          </span>
        </div>
      )}
    </div>
  );
};

export default TimingDisplay;
```

### 3. Mise à jour des tableaux de résultats

Si vous affichez des listes de timings, assurez-vous d'afficher les millisecondes :

```jsx
const TimingsTable = ({ timings }) => {
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3 // ⚠️ Support limité selon les navigateurs
    });
  };

  // Alternative plus fiable :
  const formatTimeManual = (timestamp) => {
    const date = new Date(timestamp);
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    const s = date.getSeconds().toString().padStart(2, '0');
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    return `${h}:${m}:${s}.${ms}`;
  };

  return (
    <table>
      <thead>
        <tr>
          <th>Équipage</th>
          <th>Timestamp</th>
          <th>Temps de course</th>
        </tr>
      </thead>
      <tbody>
        {timings.map(timing => (
          <tr key={timing.id}>
            <td>{timing.crew?.name || 'Non assigné'}</td>
            <td>{formatTimeManual(timing.timestamp)}</td>
            <td>
              {timing.relative_time_ms !== null 
                ? formatDuration(timing.relative_time_ms)
                : '--:--.---'
              }
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
```

## 📝 Notes importantes

### Compatibilité navigateurs

- `new Date().toISOString()` inclut automatiquement les millisecondes (support universel)
- `new Date(timestamp).getMilliseconds()` fonctionne dans tous les navigateurs modernes
- `toLocaleTimeString()` avec `fractionalSecondDigits` a un support limité (Chrome 77+, Firefox 70+)

**Recommandation** : Utilisez le formatage manuel pour une compatibilité maximale.

### Précision

- Les timestamps sont maintenant stockés avec une précision de **millisecondes** (3 décimales)
- Les calculs de durée utilisent déjà les millisecondes via `getTime()`
- L'affichage doit maintenant refléter cette précision pour un logiciel de chronométrage professionnel

### Migration des données existantes

Les timestamps existants dans la base de données seront automatiquement compatibles. Les millisecondes seront à `000` pour les anciens enregistrements, mais les nouveaux enregistrements auront la précision complète.

## 🎯 Checklist frontend

- [ ] Vérifier que les timestamps envoyés incluent les millisecondes (automatique avec `toISOString()`)
- [ ] Mettre à jour les fonctions d'affichage pour montrer les millisecondes
- [ ] Tester l'affichage des timestamps avec millisecondes dans l'interface
- [ ] Vérifier que les calculs de durée fonctionnent correctement (déjà OK)
- [ ] Mettre à jour la documentation frontend si nécessaire
