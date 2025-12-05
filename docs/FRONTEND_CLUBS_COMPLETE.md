# 📚 Guide Complet Frontend : Gestion des Clubs

## 📋 Vue d'ensemble

Ce document regroupe toutes les informations nécessaires pour créer une page dédiée à la gestion des clubs dans l'application FFAVIRON - TIMING.

Les clubs sont synchronisés depuis l'API FFAviron, mais certains champs (comme `code_court`) doivent être importés manuellement.

---

## 🗂️ Structure des données

### Modèle Club

```typescript
interface Club {
  id: string;                    // UUID (clé primaire)
  nom: string;                    // Nom complet du club (requis)
  nom_court: string | null;       // Nom court du club (optionnel)
  code: string;                   // Code unique du club (requis, unique)
  code_court: string | null;      // Code court du club (optionnel, à importer)
  etat: string | null;            // État du club ("A" = Actif, "I" = Inactif)
  type: string | null;             // Type de structure (généralement "CLU")
  logo_url: string | null;          // URL du logo du club
  created_at: string;              // Date de création (ISO 8601)
  updated_at: string;              // Date de mise à jour (ISO 8601)
}
```

### Exemple de club

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "nom": "CLUB AVIRON MARSEILLE",
  "nom_court": "CAM",
  "code": "C130001",
  "code_court": "CAM",
  "etat": "A",
  "type": "CLU",
  "logo_url": "https://intranet.ffaviron.fr/storage/logos_structures/...",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

---

## 🔌 Routes API

Base URL : `/clubs`

### 1. POST `/clubs/sync` - Synchroniser les clubs

Synchronise la liste des clubs depuis l'API FFAviron.

**Authentification** : ✅ Requise (token JWT)

**Description** :
- Récupère tous les clubs depuis l'API FFAviron
- Filtre uniquement les structures de type "CLU" (clubs)
- Crée les nouveaux clubs ou met à jour les existants
- Met à jour : `nom`, `nom_court`, `etat`, `type`, `logo_url`
- ⚠️ **Note** : Le champ `code_court` n'est PAS synchronisé (non disponible dans l'API)

**Réponse succès (200)** :
```json
{
  "status": "success",
  "message": "Synchronisation terminée",
  "data": {
    "total": 150,
    "created": 5,
    "updated": 10,
    "skipped": 135
  }
}
```

**Réponse erreur (500)** :
```json
{
  "status": "error",
  "message": "Erreur lors de la synchronisation des clubs"
}
```

**Exemple d'utilisation** :
```javascript
const syncClubs = async () => {
  const response = await fetch('/clubs/sync', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  const result = await response.json();
  console.log(`${result.data.updated} clubs mis à jour`);
};
```

---

### 2. GET `/clubs` - Liste des clubs

Récupère tous les clubs avec filtres optionnels.

**Authentification** : ❌ Non requise

**Paramètres de requête (query)** :
- `code` (string, optionnel) : Filtrer par code du club
- `nom_court` (string, optionnel) : Filtrer par nom court
- `code_court` (string, optionnel) : Filtrer par code court
- `type` (string, optionnel) : Filtrer par type (ex: "CLU")

**Exemples d'URL** :
- `/clubs` : Tous les clubs
- `/clubs?code=C130001` : Club avec ce code
- `/clubs?type=CLU` : Uniquement les clubs
- `/clubs?code_court=CAM` : Club avec ce code court
- `/clubs?nom_court=CAM&type=CLU` : Combinaison de filtres

**Réponse succès (200)** :
```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "nom": "CLUB AVIRON MARSEILLE",
      "nom_court": "CAM",
      "code": "C130001",
      "code_court": "CAM",
      "etat": "A",
      "type": "CLU",
      "logo_url": "https://...",
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "count": 1
}
```

**Exemple d'utilisation** :
```javascript
const getClubs = async (filters = {}) => {
  const params = new URLSearchParams(filters);
  const response = await fetch(`/clubs?${params}`);
  const { data } = await response.json();
  return data;
};

// Utilisation
const allClubs = await getClubs();
const activeClubs = await getClubs({ type: 'CLU' });
```

---

### 3. GET `/clubs/code/:code` - Club par code

Récupère un club par son code unique.

**Authentification** : ❌ Non requise

**Paramètre d'URL** : `code` (ex: "C130001")

**Exemple** : `GET /clubs/code/C130001`

**Réponse succès (200)** :
```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "nom": "CLUB AVIRON MARSEILLE",
    "nom_court": "CAM",
    "code": "C130001",
    "code_court": "CAM",
    "etat": "A",
    "type": "CLU",
    "logo_url": "https://...",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

**Réponse erreur (404)** :
```json
{
  "status": "error",
  "message": "Club non trouvé"
}
```

---

### 4. GET `/clubs/nom-court/:nom_court` - Club par nom court

Récupère un club par son nom court.

**Authentification** : ❌ Non requise

**Paramètre d'URL** : `nom_court` (ex: "CAM")

**Exemple** : `GET /clubs/nom-court/CAM`

**Réponse** : Même format que la route précédente

---

### 5. GET `/clubs/code-court/:code_court` - Club par code court

Récupère un club par son code court.

**Authentification** : ❌ Non requise

**Paramètre d'URL** : `code_court` (ex: "CAM")

**Exemple** : `GET /clubs/code-court/CAM`

**Réponse** : Même format que les routes précédentes

---

### 6. POST `/clubs/import-code-court` - Import des codes courts

Importe les codes courts des clubs depuis un fichier JSON ou Excel.

**Authentification** : ✅ Requise (token JWT)

**Content-Type** : `application/json`

**Body** :
```json
{
  "clubs": [
    {
      "code": "C130001",
      "code_court": "CAM"
    },
    {
      "code": "C130002",
      "code_court": "CAB"
    }
  ]
}
```

**Réponse succès (200)** :
```json
{
  "status": "success",
  "message": "Import des codes courts terminé",
  "data": {
    "total": 2,
    "updated": 2,
    "not_found": 0,
    "errors": 0
  }
}
```

**Réponse avec erreurs (200)** :
```json
{
  "status": "success",
  "message": "Import des codes courts terminé",
  "data": {
    "total": 3,
    "updated": 2,
    "not_found": 1,
    "errors": 0,
    "details": [
      {
        "code": "C999999",
        "error": "Club non trouvé avec ce code"
      }
    ]
  }
}
```

**Réponse erreur (400)** :
```json
{
  "status": "error",
  "message": "Le body doit contenir un tableau 'clubs' avec au moins un élément"
}
```

**Exemple d'utilisation** :
```javascript
const importCodeCourt = async (clubsData) => {
  const response = await fetch('/clubs/import-code-court', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ clubs: clubsData })
  });
  
  const result = await response.json();
  return result.data;
};
```

---

## 🎨 Exemple de page complète (React)

### Structure de la page

```jsx
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

const ClubsPage = () => {
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({});
  const [syncResult, setSyncResult] = useState(null);
  const [importResult, setImportResult] = useState(null);

  // Charger les clubs
  useEffect(() => {
    loadClubs();
  }, [filters]);

  const loadClubs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(filters);
      const response = await fetch(`/clubs?${params}`);
      const { data } = await response.json();
      setClubs(data);
    } catch (error) {
      console.error('Erreur lors du chargement des clubs:', error);
    } finally {
      setLoading(false);
    }
  };

  // Synchroniser depuis l'API FFAviron
  const handleSync = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/clubs/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      setSyncResult(result.data);
      await loadClubs(); // Recharger la liste
    } catch (error) {
      console.error('Erreur lors de la synchronisation:', error);
    } finally {
      setLoading(false);
    }
  };

  // Importer les codes courts
  const handleImportCodeCourt = async (file) => {
    setLoading(true);
    try {
      let jsonData;

      // Parser le fichier
      if (file.name.endsWith('.json')) {
        const text = await file.text();
        jsonData = JSON.parse(text);
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        jsonData = XLSX.utils.sheet_to_json(firstSheet);
      } else {
        throw new Error('Format non supporté');
      }

      // Valider
      if (!Array.isArray(jsonData) || jsonData.length === 0) {
        throw new Error('Le fichier doit contenir un tableau non vide');
      }

      const isValid = jsonData.every(item => item.code && item.code_court);
      if (!isValid) {
        throw new Error('Chaque ligne doit contenir "code" et "code_court"');
      }

      // Envoyer à l'API
      const token = localStorage.getItem('token');
      const response = await fetch('/clubs/import-code-court', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clubs: jsonData })
      });

      const result = await response.json();
      setImportResult(result.data);
      await loadClubs(); // Recharger la liste
    } catch (error) {
      console.error('Erreur lors de l\'import:', error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Exporter la liste actuelle
  const handleExport = () => {
    const exportData = clubs.map(club => ({
      code: club.code,
      nom: club.nom,
      nom_court: club.nom_court,
      code_court: club.code_court || ''
    }));

    // Créer un fichier Excel
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clubs');
    XLSX.writeFile(wb, 'clubs_export.xlsx');
  };

  return (
    <div className="clubs-page">
      <h1>Gestion des Clubs</h1>

      {/* Actions */}
      <div className="actions">
        <button onClick={handleSync} disabled={loading}>
          {loading ? 'Synchronisation...' : 'Synchroniser depuis FFAviron'}
        </button>
        
        <label>
          Importer codes courts
          <input
            type="file"
            accept=".json,.xlsx,.xls"
            onChange={(e) => {
              if (e.target.files[0]) {
                handleImportCodeCourt(e.target.files[0]);
              }
            }}
            disabled={loading}
            style={{ display: 'none' }}
          />
        </label>

        <button onClick={handleExport} disabled={loading || clubs.length === 0}>
          Exporter la liste
        </button>
      </div>

      {/* Résultats de synchronisation */}
      {syncResult && (
        <div className="sync-result">
          <h3>Résultat de la synchronisation</h3>
          <ul>
            <li>Total : {syncResult.total}</li>
            <li>Créés : {syncResult.created}</li>
            <li>Mis à jour : {syncResult.updated}</li>
            <li>Inchangés : {syncResult.skipped}</li>
          </ul>
        </div>
      )}

      {/* Résultats d'import */}
      {importResult && (
        <div className="import-result">
          <h3>Résultat de l'import</h3>
          <ul>
            <li>Total : {importResult.total}</li>
            <li>Mis à jour : {importResult.updated}</li>
            <li>Non trouvés : {importResult.not_found}</li>
            <li>Erreurs : {importResult.errors}</li>
          </ul>
          {importResult.details && importResult.details.length > 0 && (
            <div>
              <h4>Détails des erreurs :</h4>
              <ul>
                {importResult.details.map((detail, index) => (
                  <li key={index}>
                    {detail.code || 'N/A'} : {detail.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Filtres */}
      <div className="filters">
        <input
          type="text"
          placeholder="Rechercher par nom..."
          onChange={(e) => setFilters({ ...filters, nom: e.target.value })}
        />
        <input
          type="text"
          placeholder="Filtrer par code..."
          onChange={(e) => setFilters({ ...filters, code: e.target.value })}
        />
        <select
          onChange={(e) => setFilters({ ...filters, type: e.target.value || undefined })}
        >
          <option value="">Tous les types</option>
          <option value="CLU">Clubs</option>
        </select>
      </div>

      {/* Liste des clubs */}
      <div className="clubs-list">
        {loading ? (
          <p>Chargement...</p>
        ) : clubs.length === 0 ? (
          <p>Aucun club trouvé</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Nom</th>
                <th>Nom court</th>
                <th>Code court</th>
                <th>État</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {clubs.map((club) => (
                <tr key={club.id}>
                  <td>{club.code}</td>
                  <td>{club.nom}</td>
                  <td>{club.nom_court || '-'}</td>
                  <td>{club.code_court || '-'}</td>
                  <td>{club.etat || '-'}</td>
                  <td>{club.type || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ClubsPage;
```

---

## 📄 Format des fichiers d'import

### Format JSON

```json
[
  {
    "code": "C130001",
    "code_court": "CAM"
  },
  {
    "code": "C130002",
    "code_court": "CAB"
  }
]
```

### Format Excel

| code      | code_court |
|-----------|------------|
| C130001   | CAM        |
| C130002   | CAB        |

**Note** : Les colonnes doivent s'appeler exactement `code` et `code_court`.

---

## 🔍 Recherche et filtrage

### Recherche par nom (côté frontend)

```javascript
const searchClubs = (clubs, searchTerm) => {
  if (!searchTerm) return clubs;
  
  const term = searchTerm.toLowerCase();
  return clubs.filter(club => 
    club.nom.toLowerCase().includes(term) ||
    (club.nom_court && club.nom_court.toLowerCase().includes(term)) ||
    club.code.toLowerCase().includes(term) ||
    (club.code_court && club.code_court.toLowerCase().includes(term))
  );
};
```

### Filtrage avancé

```javascript
const filterClubs = (clubs, filters) => {
  return clubs.filter(club => {
    if (filters.type && club.type !== filters.type) return false;
    if (filters.etat && club.etat !== filters.etat) return false;
    if (filters.hasCodeCourt && !club.code_court) return false;
    return true;
  });
};
```

---

## 📊 Statistiques utiles

```javascript
const getClubStats = (clubs) => {
  return {
    total: clubs.length,
    withCodeCourt: clubs.filter(c => c.code_court).length,
    withoutCodeCourt: clubs.filter(c => !c.code_court).length,
    active: clubs.filter(c => c.etat === 'A').length,
    inactive: clubs.filter(c => c.etat === 'I').length
  };
};
```

---

## ✅ Checklist d'implémentation

### Fonctionnalités de base
- [ ] Afficher la liste des clubs
- [ ] Recherche par nom/code
- [ ] Filtres (type, état, code_court présent/absent)
- [ ] Pagination (si beaucoup de clubs)
- [ ] Tri par colonnes

### Synchronisation
- [ ] Bouton de synchronisation depuis FFAviron
- [ ] Afficher le résultat (créés, mis à jour, inchangés)
- [ ] Gestion des erreurs
- [ ] Indicateur de chargement

### Import codes courts
- [ ] Upload de fichier (JSON/Excel)
- [ ] Validation du format
- [ ] Prévisualisation avant import
- [ ] Affichage des résultats
- [ ] Gestion des erreurs détaillées

### Export
- [ ] Export Excel de la liste actuelle
- [ ] Export JSON
- [ ] Template d'import (fichier vide avec colonnes)

### UX/UI
- [ ] Design responsive
- [ ] Messages de succès/erreur
- [ ] Confirmations pour actions importantes
- [ ] Indicateurs de chargement
- [ ] Tooltips pour expliquer les fonctionnalités

---

## 🚨 Gestion des erreurs

### Erreurs communes

1. **Token expiré** (401)
```javascript
if (response.status === 401) {
  // Rediriger vers la page de connexion
  window.location.href = '/login';
}
```

2. **Club non trouvé** (404)
```javascript
if (response.status === 404) {
  const { message } = await response.json();
  alert(message); // "Club non trouvé"
}
```

3. **Erreur serveur** (500)
```javascript
if (response.status >= 500) {
  const { message } = await response.json();
  console.error('Erreur serveur:', message);
  alert('Une erreur est survenue. Veuillez réessayer plus tard.');
}
```

4. **Validation** (400)
```javascript
if (response.status === 400) {
  const { message } = await response.json();
  alert(`Erreur de validation: ${message}`);
}
```

---

## 🔐 Authentification

Toutes les routes nécessitant une authentification utilisent un token JWT dans le header :

```javascript
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

**Routes nécessitant l'authentification** :
- `POST /clubs/sync`
- `POST /clubs/import-code-court`

**Routes publiques** :
- `GET /clubs`
- `GET /clubs/code/:code`
- `GET /clubs/nom-court/:nom_court`
- `GET /clubs/code-court/:code_court`

---

## 📦 Dépendances recommandées

Pour une implémentation complète, vous aurez besoin de :

```json
{
  "dependencies": {
    "xlsx": "^0.18.5"  // Pour parser les fichiers Excel
  }
}
```

Installation :
```bash
npm install xlsx
# ou
yarn add xlsx
```

---

## 🎯 Cas d'usage typiques

### 1. Synchronisation initiale
1. L'admin clique sur "Synchroniser depuis FFAviron"
2. L'API récupère tous les clubs depuis l'API FFAviron
3. Les clubs sont créés/mis à jour dans la base
4. La liste est rechargée

### 2. Import des codes courts
1. L'admin prépare un fichier Excel avec les codes courts
2. Il clique sur "Importer codes courts"
3. Il sélectionne le fichier
4. Le fichier est parsé et validé
5. Les codes courts sont mis à jour dans la base
6. Un résumé est affiché (succès, erreurs, non trouvés)

### 3. Recherche d'un club
1. L'utilisateur tape dans la barre de recherche
2. Les clubs sont filtrés en temps réel
3. Les résultats sont affichés

### 4. Export pour modification
1. L'admin exporte la liste actuelle
2. Il modifie les codes courts dans Excel
3. Il réimporte le fichier modifié

---

## 📝 Notes importantes

1. **Synchronisation** : Ne met PAS à jour le champ `code_court` (non disponible dans l'API FFAviron)
2. **Import** : Seul le champ `code_court` est mis à jour lors de l'import
3. **Performance** : Pour de gros volumes (1000+ clubs), envisager la pagination
4. **Idempotence** : L'import peut être relancé plusieurs fois sans problème
5. **Codes non trouvés** : Les codes qui n'existent pas dans la base sont ignorés (comptés dans `not_found`)

---

## 🔗 Liens utiles

- [Guide détaillé import codes courts](./FRONTEND_IMPORT_CODE_COURT_CLUBS.md)
- Documentation Swagger : `/docs` (si disponible)
- API FFAviron : `https://intranet.ffaviron.fr/api/v1/ou_pratiquer/structures`

---

## 💡 Améliorations possibles

- **Édition inline** : Permettre d'éditer directement le `code_court` dans le tableau
- **Import par lot** : Traiter les gros fichiers par lots de 100-200 clubs
- **Historique** : Garder un historique des modifications
- **Validation** : Vérifier l'unicité des codes courts avant import
- **Auto-complétion** : Suggérer des codes courts basés sur le nom du club
- **Export sélectif** : Permettre d'exporter uniquement les clubs sans code_court

---

**Dernière mise à jour** : 2024

