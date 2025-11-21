# Page Arbitres - Documentation

## Vue d'ensemble

La page "Arbitres" permet aux arbitres de valider les courses qui ont le statut `non_official`. Cette page affiche la liste des courses en attente de validation et permet de visualiser leurs résultats avant de les valider.

## Routes API

### 1. Obtenir les courses non officielles

**Endpoint:** `GET /races/non-official`

**Authentification:** Requise (Bearer token)

**Réponse:**
```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "race_number": 1,
      "name": "Course 1",
      "status": "non_official",
      "race_phase": {
        "id": "uuid",
        "name": "Phase principale",
        "event": {
          "id": "uuid",
          "name": "Championnat de France"
        }
      },
      "Distance": {
        "id": "uuid",
        "value": 2000
      },
      "race_crews": [...]
    }
  ]
}
```

### 2. Obtenir les résultats d'une course

**Endpoint:** `GET /races/results/:race_id`

**Authentification:** Non requise (route publique)

**Réponse:**
```json
{
  "status": "success",
  "data": [
    {
      "crew_id": "uuid",
      "lane": 1,
      "club_name": "Club Aviron",
      "club_code": "CLB",
      "category": {
        "id": "uuid",
        "code": "U17F1I_2000m",
        "label": "U17 Féminin 1x",
        "age_group": "U17",
        "gender": "F"
      },
      "finish_time": "2024-01-01T10:30:00.000Z",
      "final_time": "420000",
      "has_timing": true,
      "position": 1
    }
  ]
}
```

### 3. Valider une course

**Endpoint:** `PUT /races/:id`

**Authentification:** Requise (Bearer token)

**Body:**
```json
{
  "status": "official"
}
```

**Réponse:**
```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "status": "official",
    ...
  }
}
```

## Intégration dans le backoffice

### 1. Ajouter la route dans votre routeur React

```jsx
import ArbitresPage from './pages/ArbitresPage';

// Dans votre routeur
<Route path="/backoffice/arbitres" element={<ArbitresPage />} />
```

### 2. Ajouter l'élément au menu du backoffice

Ajoutez un élément de menu dans votre composant de navigation :

```jsx
<MenuItem to="/backoffice/arbitres">
  <Icon name="gavel" /> {/* ou l'icône de votre choix */}
  Arbitres
</MenuItem>
```

### 3. Configuration de l'API

Assurez-vous que la variable d'environnement `REACT_APP_API_URL` est configurée dans votre fichier `.env` :

```
REACT_APP_API_URL=http://localhost:3010
```

## Fonctionnalités

1. **Liste des courses non officielles** : Affiche toutes les courses avec le statut `non_official`
2. **Visualisation des résultats** : Cliquer sur une course affiche ses résultats détaillés
3. **Validation** : Un bouton permet de valider une course (changement de statut de `non_official` à `official`)
4. **Mise à jour en temps réel** : Après validation, la course est retirée de la liste

## Notes importantes

- La route `/races/non-official` nécessite une authentification
- La route `/races/results/:race_id` est publique (pas d'authentification requise)
- La route `/races/:id` (PUT) nécessite une authentification pour la mise à jour
- Les courses validées sont automatiquement retirées de la liste après validation
- Les résultats sont triés par position (temps final)

## Exemple d'utilisation

Voir le fichier `ArbitresPage.example.jsx` pour un exemple complet d'implémentation.

