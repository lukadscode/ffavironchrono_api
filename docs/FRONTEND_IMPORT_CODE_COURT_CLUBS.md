# Guide Frontend : Import des Codes Courts des Clubs

## 📋 Contexte

Le champ `code_court` a été ajouté à la table `clubs` pour permettre d'identifier les clubs avec un code court (ex: "CAM" pour "CLUB AVIRON MARSEILLE"). 

**Important** : Ce champ n'est **pas disponible** dans l'API FFAviron, il doit donc être importé manuellement via un fichier JSON ou Excel.

## 🎯 Objectif

Permettre aux administrateurs d'importer les codes courts des clubs depuis un fichier JSON ou Excel (converti en JSON côté frontend).

## 📡 Routes API

### GET `/clubs/code-court/:code_court`

Récupérer un club par son code court.

**Authentification** : Non requise

**Paramètre d'URL** : `code_court` (ex: "CAM")

**Exemple** : `GET /clubs/code-court/CAM`

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

### POST `/clubs/import-code-court`

**Authentification** : Requise (token JWT)

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

## 📝 Format du fichier JSON

Le fichier JSON doit être un tableau d'objets, chaque objet contenant :
- `code` (string, requis) : Le code unique du club (ex: "C130001")
- `code_court` (string, requis) : Le code court du club (ex: "CAM")

**Exemple de fichier JSON** :
```json
[
  {
    "code": "C130001",
    "code_court": "CAM"
  },
  {
    "code": "C130002",
    "code_court": "CAB"
  },
  {
    "code": "C130003",
    "code_court": "CNM"
  }
]
```

## 📊 Format du fichier Excel

Si vous préférez utiliser Excel, le fichier doit avoir les colonnes suivantes :

| code      | code_court |
|-----------|------------|
| C130001   | CAM        |
| C130002   | CAB        |
| C130003   | CNM        |

**Note** : Le frontend devra convertir le fichier Excel en JSON avant l'envoi à l'API.

## 🔧 Implémentation Frontend

### Option 1 : Import depuis fichier JSON

```javascript
// Exemple avec React
const handleJsonImport = async (file) => {
  const reader = new FileReader();
  
  reader.onload = async (e) => {
    try {
      const jsonData = JSON.parse(e.target.result);
      
      // Vérifier que c'est un tableau
      if (!Array.isArray(jsonData)) {
        throw new Error("Le fichier JSON doit contenir un tableau");
      }
      
      // Vérifier la structure
      const isValid = jsonData.every(
        item => item.code && item.code_court
      );
      
      if (!isValid) {
        throw new Error("Chaque élément doit avoir 'code' et 'code_court'");
      }
      
      // Envoyer à l'API
      const response = await fetch('/clubs/import-code-court', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ clubs: jsonData })
      });
      
      const result = await response.json();
      
      if (result.status === 'success') {
        console.log(`${result.data.updated} clubs mis à jour`);
        if (result.data.details) {
          console.warn('Erreurs:', result.data.details);
        }
      }
    } catch (error) {
      console.error('Erreur lors de l\'import:', error);
    }
  };
  
  reader.readAsText(file);
};
```

### Option 2 : Import depuis fichier Excel

Pour Excel, vous pouvez utiliser une bibliothèque comme `xlsx` (SheetJS) :

```bash
npm install xlsx
```

```javascript
import * as XLSX from 'xlsx';

const handleExcelImport = async (file) => {
  const reader = new FileReader();
  
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      
      // Prendre la première feuille
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      
      // Convertir en JSON
      const jsonData = XLSX.utils.sheet_to_json(firstSheet);
      
      // Vérifier que les colonnes existent
      const isValid = jsonData.every(
        item => item.code && item.code_court
      );
      
      if (!isValid) {
        throw new Error("Le fichier Excel doit contenir les colonnes 'code' et 'code_court'");
      }
      
      // Envoyer à l'API
      const response = await fetch('/clubs/import-code-court', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ clubs: jsonData })
      });
      
      const result = await response.json();
      
      if (result.status === 'success') {
        console.log(`${result.data.updated} clubs mis à jour`);
        if (result.data.details) {
          console.warn('Erreurs:', result.data.details);
        }
      }
    } catch (error) {
      console.error('Erreur lors de l\'import:', error);
    }
  };
  
  reader.readAsArrayBuffer(file);
};
```

### Option 3 : Interface utilisateur complète (React)

```jsx
import React, { useState } from 'react';
import * as XLSX from 'xlsx';

const ImportCodeCourtClubs = () => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      setError('Veuillez sélectionner un fichier');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let jsonData;

      // Détecter le type de fichier
      if (file.name.endsWith('.json')) {
        // Fichier JSON
        const text = await file.text();
        jsonData = JSON.parse(text);
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        // Fichier Excel
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        jsonData = XLSX.utils.sheet_to_json(firstSheet);
      } else {
        throw new Error('Format de fichier non supporté. Utilisez .json ou .xlsx');
      }

      // Vérifier la structure
      if (!Array.isArray(jsonData)) {
        throw new Error('Le fichier doit contenir un tableau');
      }

      if (jsonData.length === 0) {
        throw new Error('Le fichier est vide');
      }

      const isValid = jsonData.every(
        item => item.code && item.code_court
      );

      if (!isValid) {
        throw new Error('Chaque ligne doit contenir les champs "code" et "code_court"');
      }

      // Envoyer à l'API
      const token = localStorage.getItem('token'); // Adapter selon votre gestion d'auth
      const response = await fetch('/clubs/import-code-court', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ clubs: jsonData })
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        setResult(data.data);
      } else {
        throw new Error(data.message || 'Erreur lors de l\'import');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="import-code-court">
      <h2>Import des codes courts des clubs</h2>
      
      <div className="file-input">
        <input
          type="file"
          accept=".json,.xlsx,.xls"
          onChange={handleFileChange}
          disabled={loading}
        />
        <button onClick={handleImport} disabled={loading || !file}>
          {loading ? 'Import en cours...' : 'Importer'}
        </button>
      </div>

      {error && (
        <div className="error">
          <strong>Erreur :</strong> {error}
        </div>
      )}

      {result && (
        <div className="result">
          <h3>Résultat de l'import</h3>
          <ul>
            <li>Total : {result.total}</li>
            <li>Mis à jour : {result.updated}</li>
            <li>Non trouvés : {result.not_found}</li>
            <li>Erreurs : {result.errors}</li>
          </ul>
          
          {result.details && result.details.length > 0 && (
            <div className="errors-details">
              <h4>Détails des erreurs :</h4>
              <ul>
                {result.details.map((detail, index) => (
                  <li key={index}>
                    {detail.code || 'N/A'} : {detail.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ImportCodeCourtClubs;
```

## ✅ Validation des données

Avant l'envoi à l'API, le frontend devrait valider :

1. **Format du fichier** : JSON ou Excel (.xlsx, .xls)
2. **Structure** : Le fichier doit contenir un tableau d'objets
3. **Champs requis** : Chaque objet doit avoir `code` et `code_court`
4. **Types** : Les deux champs doivent être des strings non vides
5. **Doublons** : Vérifier s'il y a des codes en double dans le fichier

## 🔍 Récupération des clubs existants

Avant l'import, vous pouvez récupérer la liste des clubs pour vérifier quels codes existent :

```javascript
// GET /clubs
const response = await fetch('/clubs', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { data: clubs } = await response.json();

// Créer un map pour vérification rapide
const clubsMap = new Map(clubs.map(c => [c.code, c]));
```

## 📋 Checklist pour l'implémentation

- [ ] Créer une page/component pour l'import
- [ ] Ajouter un input file acceptant .json, .xlsx, .xls
- [ ] Parser le fichier (JSON ou Excel)
- [ ] Valider la structure des données
- [ ] Afficher un aperçu des données avant import
- [ ] Envoyer les données à l'API avec authentification
- [ ] Afficher les résultats (succès, erreurs, détails)
- [ ] Gérer les erreurs (fichier invalide, API erreur, etc.)
- [ ] Optionnel : Télécharger un template Excel/JSON

## 🎨 Exemple de template Excel

Vous pouvez fournir un fichier template Excel avec les colonnes pré-remplies :

| code      | code_court |
|-----------|------------|
| C130001   |            |
| C130002   |            |

L'utilisateur n'aura qu'à remplir la colonne `code_court`.

## 📝 Notes importantes

1. **Authentification** : La route nécessite un token JWT valide
2. **Codes non trouvés** : Si un code n'existe pas dans la base, il sera ignoré (compté dans `not_found`)
3. **Mise à jour** : Seul le champ `code_court` sera mis à jour, les autres champs restent inchangés
4. **Performance** : Pour de gros fichiers (1000+ clubs), envisager un traitement par lots
5. **Idempotence** : L'import peut être relancé plusieurs fois sans problème

## 🚀 Améliorations possibles

- **Traitement par lots** : Pour les gros fichiers, diviser en lots de 100-200 clubs
- **Prévisualisation** : Afficher un aperçu des données avant validation
- **Export** : Permettre d'exporter la liste actuelle des clubs avec leurs codes courts
- **Recherche** : Filtrer les clubs par code ou nom avant l'import
- **Template** : Générer un fichier template avec tous les clubs existants

