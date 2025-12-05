# Guide Frontend : Import d'Équipages depuis Excel/JSON

## 📋 Vue d'ensemble

Une nouvelle route permet d'importer des équipages depuis des données JSON. **Le frontend doit parser le fichier Excel ou JSON** et envoyer les données à l'API.

Cette fonctionnalité permet de créer des équipages avec leurs participants et le temps pronostique directement depuis un fichier.

**Note** : Pour parser les fichiers Excel côté frontend, vous aurez besoin de la bibliothèque `xlsx` :

```bash
npm install xlsx
```

---

## 🔌 Route API

### POST `/import/crews`

**Authentification** : ✅ Requise (token JWT)

**Content-Type** : `application/json`

**Body** :

```json
{
  "event_id": "uuid-de-l-evenement",
  "crews": [
    {
      "code_categorie": "SFR4",
      "nom_club": "LE ROBERT ACR",
      "code_club": "C972007",
      "temps_pronostique": "32:00",
      "prenom_1": "Dominique",
      "nom_1": "EUTIONNAT",
      "numero_licence_1": "570312",
      "sexe_1": "Femme",
      ...
    }
  ]
}
```

**Paramètres** :

- `event_id` (string, requis) : ID de l'événement
- `crews` (array, requis) : Tableau d'objets représentant les équipages (parsé depuis Excel/JSON par le frontend)

**Réponse succès (200)** :

```json
{
  "status": "success",
  "message": "Import terminé",
  "data": {
    "total_rows": 10,
    "crews_created": 8,
    "crews_updated": 2,
    "participants_created": 45,
    "errors_count": 0
  }
}
```

**Réponse avec erreurs (200)** :

```json
{
  "status": "success",
  "message": "Import terminé",
  "data": {
    "total_rows": 10,
    "crews_created": 7,
    "crews_updated": 1,
    "participants_created": 40,
    "errors_count": 2,
    "errors": [
      {
        "row": 3,
        "error": "Catégorie \"SFR4\" non trouvée"
      },
      {
        "row": 5,
        "participant": 2,
        "error": "Erreur lors de la création du participant 2: ..."
      }
    ]
  }
}
```

**Réponse erreur (400)** :

```json
{
  "status": "error",
  "message": "event_id est requis dans le body"
}
```

---

## 📊 Modèle de fichier Excel

### Colonnes requises

| Colonne                                         | Description                           | Requis | Exemple           |
| ----------------------------------------------- | ------------------------------------- | ------ | ----------------- |
| `code_categorie`                                | Code de la catégorie                  | ✅ Oui | `SFR4`            |
| `nom_club` ou `club_name`                       | Nom du club                           | ❌ Non | `LE ROBERT ACR`   |
| `code_club` ou `club_code`                      | Code du club                          | ❌ Non | `C972007`         |
| `nom_entraineur` ou `coach_name`                | Nom de l'entraîneur                   | ❌ Non | `Jean Dupont`     |
| `temps_pronostique` ou `temps_pronostique_crew` | Temps pronostique (MM:SS ou secondes) | ❌ Non | `32:00` ou `1920` |

### Colonnes pour les participants (rameurs 1 à 8)

Pour chaque rameur (1 à 8), les colonnes suivantes sont disponibles :

| Colonne                                                                      | Description              | Requis               | Exemple             |
| ---------------------------------------------------------------------------- | ------------------------ | -------------------- | ------------------- |
| `prenom_1`, `prenom_2`, ..., `prenom_8`                                      | Prénom du rameur         | ⚠️ Si nom présent    | `Dominique`         |
| `nom_1`, `nom_2`, ..., `nom_8`                                               | Nom du rameur            | ⚠️ Si prénom présent | `EUTIONNAT`         |
| `numero_licence_1`, ..., `numero_licence_8` ou `licence_1`, ..., `licence_8` | Numéro de licence        | ❌ Non               | `570312`            |
| `sexe_1`, ..., `sexe_8` ou `genre_1`, ..., `genre_8`                         | Sexe (Homme/Femme/Mixte) | ❌ Non               | `Femme`             |
| `club_1`, ..., `club_8`                                                      | Club du rameur           | ❌ Non               | `LE ROBERT ACR`     |
| `email_1`, ..., `email_8`                                                    | Email du rameur          | ❌ Non               | `email@example.com` |

### Colonnes pour le barreur

| Colonne                                       | Description           | Requis               | Exemple             |
| --------------------------------------------- | --------------------- | -------------------- | ------------------- |
| `prenom_barreur`                              | Prénom du barreur     | ⚠️ Si nom présent    | `Marilyne`          |
| `nom_barreur`                                 | Nom du barreur        | ⚠️ Si prénom présent | `MARTOT`            |
| `numero_licence_barreur` ou `licence_barreur` | Numéro de licence     | ❌ Non               | `369857`            |
| `sexe_barreur` ou `genre_barreur`             | Sexe                  | ❌ Non               | `Femme`             |
| `club_barreur`                                | Club du barreur       | ❌ Non               | `LE ROBERT ACR`     |
| `email_barreur`                               | Email du barreur      | ❌ Non               | `email@example.com` |
| `poids_barreur`                               | Poids du barreur (kg) | ❌ Non               | `55.5`              |

### Exemple de fichier Excel

| code_categorie | nom_club              | code_club | temps_pronostique | prenom_1  | nom_1     | numero_licence_1 | sexe_1 | prenom_2 | nom_2        | numero_licence_2 | sexe_2 | prenom_barreur | nom_barreur | numero_licence_barreur |
| -------------- | --------------------- | --------- | ----------------- | --------- | --------- | ---------------- | ------ | -------- | ------------ | ---------------- | ------ | -------------- | ----------- | ---------------------- |
| SFR4           | LE ROBERT ACR         | C972007   | 32:00             | Dominique | EUTIONNAT | 570312           | Femme  | Nickita  | JACOBY KOALY | 601747           | Femme  | Marilyne       | MARTOT      | 369857                 |
| SFR2           | CLUB AVIRON MARSEILLE | C130001   | 25:30             | Jean      | DUPONT    | 123456           | Homme  | Marie    | MARTIN       | 789012           | Femme  |                |             |                        |

---

## 📄 Format JSON

Le fichier JSON doit être un tableau d'objets, chaque objet représentant un équipage :

### Exemple minimal (requis uniquement)

```json
[
  {
    "code_categorie": "SFR4",
    "prenom_1": "Dominique",
    "nom_1": "EUTIONNAT"
  }
]
```

### Exemple complet

```json
[
  {
    "code_categorie": "SFR4",
    "nom_club": "LE ROBERT ACR",
    "code_club": "C972007",
    "nom_entraineur": "Jean Dupont",
    "temps_pronostique": "32:00",
    "prenom_1": "Dominique",
    "nom_1": "EUTIONNAT",
    "numero_licence_1": "570312",
    "sexe_1": "Femme",
    "club_1": "LE ROBERT ACR",
    "email_1": "dominique@example.com",
    "prenom_2": "Nickita",
    "nom_2": "JACOBY KOALY",
    "numero_licence_2": "601747",
    "sexe_2": "Femme",
    "club_2": "LE ROBERT ACR",
    "prenom_3": "Marilyne",
    "nom_3": "MARTOT",
    "numero_licence_3": "369857",
    "sexe_3": "Femme",
    "prenom_4": "Mireille",
    "nom_4": "YOKESSA",
    "numero_licence_4": "385715",
    "sexe_4": "Femme",
    "prenom_barreur": "Marilyne",
    "nom_barreur": "MARTOT",
    "numero_licence_barreur": "369857",
    "sexe_barreur": "Femme",
    "poids_barreur": 55.5
  },
  {
    "code_categorie": "SFR2",
    "nom_club": "CLUB AVIRON MARSEILLE",
    "code_club": "C130001",
    "temps_pronostique": 1530,
    "prenom_1": "Jean",
    "nom_1": "DUPONT",
    "numero_licence_1": "123456",
    "sexe_1": "Homme",
    "prenom_2": "Marie",
    "nom_2": "MARTIN",
    "numero_licence_2": "789012",
    "sexe_2": "Femme"
  }
]
```

**Note** : Tous les champs sont optionnels sauf `code_categorie` et au moins un participant (`prenom_1` + `nom_1`).

---

## 💡 Format du temps pronostique

Le temps pronostique peut être fourni dans plusieurs formats :

| Format            | Exemple   | Résultat (secondes) |
| ----------------- | --------- | ------------------- |
| `MM:SS`           | `32:00`   | 1920                |
| `HH:MM:SS`        | `1:08:00` | 4080                |
| Nombre (secondes) | `1920`    | 1920                |

---

## 🔧 Implémentation Frontend

### Installation de xlsx

```bash
npm install xlsx
```

### Exemple avec React

```jsx
import React, { useState } from "react";
import * as XLSX from "xlsx";

const ImportCrewsForm = ({ eventId }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setResult(null);
      setPreview(null);

      // Parser le fichier pour prévisualisation
      parseFile(selectedFile);
    }
  };

  const parseFile = async (file) => {
    try {
      let data;

      if (file.name.endsWith(".json")) {
        // Fichier JSON
        const text = await file.text();
        data = JSON.parse(text);
      } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        // Fichier Excel
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        data = XLSX.utils.sheet_to_json(firstSheet, { defval: null });
      } else {
        throw new Error("Format de fichier non supporté");
      }

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error(
          "Le fichier est vide ou ne contient pas de données valides"
        );
      }

      setPreview({
        rowCount: data.length,
        columns: Object.keys(data[0] || {}),
        sample: data.slice(0, 3), // Aperçu des 3 premières lignes
      });
    } catch (err) {
      setError(`Erreur lors du parsing: ${err.message}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!file) {
      setError("Veuillez sélectionner un fichier");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let crewsData;

      // Parser le fichier
      if (file.name.endsWith(".json")) {
        const text = await file.text();
        crewsData = JSON.parse(text);
      } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        crewsData = XLSX.utils.sheet_to_json(firstSheet, { defval: null });
      } else {
        throw new Error("Format de fichier non supporté");
      }

      if (!Array.isArray(crewsData) || crewsData.length === 0) {
        throw new Error(
          "Le fichier est vide ou ne contient pas de données valides"
        );
      }

      // Envoyer les données à l'API
      const token = localStorage.getItem("token");
      const response = await fetch("/import/crews", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event_id: eventId,
          crews: crewsData,
        }),
      });

      const data = await response.json();

      if (response.ok && data.status === "success") {
        setResult(data.data);
      } else {
        throw new Error(data.message || "Erreur lors de l'import");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="import-crews-form">
      <h2>Importer des équipages</h2>

      <form onSubmit={handleSubmit}>
        <div className="file-input">
          <label>
            Fichier (Excel ou JSON) :
            <input
              type="file"
              accept=".xlsx,.xls,.json"
              onChange={handleFileChange}
              disabled={loading}
            />
          </label>
        </div>

        {preview && (
          <div className="preview">
            <h3>Aperçu du fichier</h3>
            <p>{preview.rowCount} lignes trouvées</p>
            <p>Colonnes : {preview.columns.join(", ")}</p>
            {preview.sample.length > 0 && (
              <div className="sample">
                <h4>Exemple (3 premières lignes) :</h4>
                <pre>{JSON.stringify(preview.sample, null, 2)}</pre>
              </div>
            )}
          </div>
        )}

        <button type="submit" disabled={loading || !file}>
          {loading ? "Import en cours..." : "Importer"}
        </button>
      </form>

      {error && (
        <div className="error">
          <strong>Erreur :</strong> {error}
        </div>
      )}

      {result && (
        <div className="result">
          <h3>Résultat de l'import</h3>
          <ul>
            <li>Lignes traitées : {result.total_rows}</li>
            <li>Équipages créés : {result.crews_created}</li>
            <li>Équipages mis à jour : {result.crews_updated}</li>
            <li>Participants créés : {result.participants_created}</li>
            <li>Erreurs : {result.errors_count}</li>
          </ul>

          {result.errors && result.errors.length > 0 && (
            <div className="errors-details">
              <h4>Détails des erreurs :</h4>
              <ul>
                {result.errors.map((err, index) => (
                  <li key={index}>
                    Ligne {err.row}
                    {err.participant && ` - Participant ${err.participant}`}
                    {" : "}
                    {err.error}
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

export default ImportCrewsForm;
```

### Exemple avec fetch vanilla

```javascript
import * as XLSX from "xlsx";

const parseFile = async (file) => {
  if (file.name.endsWith(".json")) {
    const text = await file.text();
    return JSON.parse(text);
  } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(firstSheet, { defval: null });
  } else {
    throw new Error("Format non supporté");
  }
};

const importCrews = async (file, eventId) => {
  // Parser le fichier
  const crewsData = await parseFile(file);

  // Envoyer à l'API
  const token = localStorage.getItem("token");
  const response = await fetch("/import/crews", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      event_id: eventId,
      crews: crewsData,
    }),
  });

  const result = await response.json();
  return result;
};

// Utilisation
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];
const eventId = "uuid-de-l-evenement";

importCrews(file, eventId)
  .then((result) => {
    console.log("Import réussi:", result);
  })
  .catch((error) => {
    console.error("Erreur:", error);
  });
```

---

## ✅ Validation des données

### Règles de validation

1. **Champs requis** :

   - `code_categorie` : Doit exister et être lié à l'événement
   - Au moins un participant (prénom_1 + nom_1) est requis

2. **Participants** :

   - Si un prénom est fourni, le nom correspondant est requis
   - Si un nom est fourni, le prénom correspondant est requis
   - Même règle pour le barreur

3. **Catégorie** :
   - La catégorie doit exister dans la base de données
   - La catégorie doit être liée à l'événement

### Messages d'erreur

Les erreurs de validation sont retournées dans le tableau `errors` :

```json
{
  "errors": [
    {
      "row": 3,
      "error": "Catégorie \"SFR4\" non trouvée"
    },
    {
      "row": 5,
      "error": "Le participant 2 doit avoir à la fois un prénom et un nom"
    },
    {
      "row": 7,
      "participant": "barreur",
      "error": "Erreur lors de la création du barreur: ..."
    }
  ]
}
```

---

## 🔄 Comportement de l'import

### Création vs Mise à jour

- **Création** : Un nouvel équipage est créé si aucun équipage avec la même catégorie, club_name et club_code n'existe pour cet événement
- **Mise à jour** : Si un équipage existe déjà, il est mis à jour avec les nouvelles informations (club_name, club_code, coach_name, temps_pronostique)

### Participants

- Les participants sont créés ou trouvés par numéro de licence
- Si pas de numéro de licence, un numéro temporaire est généré
- Les participants sont liés à l'équipage via `CrewParticipant`
- Les participants déjà liés ne sont pas dupliqués

### Temps pronostique

- Le temps pronostique est parsé et stocké en secondes
- Si plusieurs formats sont fournis, le premier valide est utilisé
- Les formats supportés : `MM:SS`, `HH:MM:SS`, ou nombre en secondes

---

## 📋 Template Excel à télécharger

### Structure complète du template

Voici la structure complète recommandée pour le fichier Excel :

| Colonne                          | Description                           | Requis | Exemple             |
| -------------------------------- | ------------------------------------- | ------ | ------------------- |
| **Informations équipage**        |
| `code_categorie`                 | Code de la catégorie                  | ✅     | `SFR4`              |
| `nom_club`                       | Nom du club                           | ❌     | `LE ROBERT ACR`     |
| `code_club`                      | Code du club                          | ❌     | `C972007`           |
| `nom_entraineur`                 | Nom de l'entraîneur                   | ❌     | `Jean Dupont`       |
| `temps_pronostique`              | Temps pronostique (MM:SS ou secondes) | ❌     | `32:00` ou `1920`   |
| **Rameur 1**                     |
| `prenom_1`                       | Prénom                                | ⚠️     | `Dominique`         |
| `nom_1`                          | Nom                                   | ⚠️     | `EUTIONNAT`         |
| `numero_licence_1`               | Numéro de licence                     | ❌     | `570312`            |
| `sexe_1`                         | Sexe (Homme/Femme)                    | ❌     | `Femme`             |
| `club_1`                         | Club du rameur                        | ❌     | `LE ROBERT ACR`     |
| `email_1`                        | Email                                 | ❌     | `email@example.com` |
| **Rameur 2**                     |
| `prenom_2`                       | Prénom                                | ❌     | `Nickita`           |
| `nom_2`                          | Nom                                   | ❌     | `JACOBY KOALY`      |
| `numero_licence_2`               | Numéro de licence                     | ❌     | `601747`            |
| `sexe_2`                         | Sexe                                  | ❌     | `Femme`             |
| `club_2`                         | Club                                  | ❌     | `LE ROBERT ACR`     |
| `email_2`                        | Email                                 | ❌     |                     |
| **... (Rameurs 3 à 8)**          |
| Même structure que rameur 1 et 2 |                                       |        |                     |
| **Barreur**                      |
| `prenom_barreur`                 | Prénom                                | ❌     | `Marilyne`          |
| `nom_barreur`                    | Nom                                   | ❌     | `MARTOT`            |
| `numero_licence_barreur`         | Numéro de licence                     | ❌     | `369857`            |
| `sexe_barreur`                   | Sexe                                  | ❌     | `Femme`             |
| `club_barreur`                   | Club                                  | ❌     | `LE ROBERT ACR`     |
| `email_barreur`                  | Email                                 | ❌     |                     |
| `poids_barreur`                  | Poids (kg)                            | ❌     | `55.5`              |

### Exemple de fichier Excel complet

| code_categorie | nom_club              | code_club | temps_pronostique | prenom_1  | nom_1     | numero_licence_1 | sexe_1 | prenom_2 | nom_2        | numero_licence_2 | sexe_2 | prenom_3 | nom_3  | numero_licence_3 | sexe_3 | prenom_4 | nom_4   | numero_licence_4 | sexe_4 | prenom_barreur | nom_barreur | numero_licence_barreur |
| -------------- | --------------------- | --------- | ----------------- | --------- | --------- | ---------------- | ------ | -------- | ------------ | ---------------- | ------ | -------- | ------ | ---------------- | ------ | -------- | ------- | ---------------- | ------ | -------------- | ----------- | ---------------------- |
| SFR4           | LE ROBERT ACR         | C972007   | 32:00             | Dominique | EUTIONNAT | 570312           | Femme  | Nickita  | JACOBY KOALY | 601747           | Femme  | Marilyne | MARTOT | 369857           | Femme  | Mireille | YOKESSA | 385715           | Femme  |                |             |                        |
| SFR2           | CLUB AVIRON MARSEILLE | C130001   | 25:30             | Jean      | DUPONT    | 123456           | Homme  | Marie    | MARTIN       | 789012           | Femme  |          |        |                  |        |          |         |                  |        |                |             |                        |

**Note** : Vous pouvez omettre les colonnes que vous n'utilisez pas. Seules `code_categorie` et au moins un participant (`prenom_1` + `nom_1`) sont requis.

---

## 🎯 Cas d'usage

### 1. Import initial

1. Préparer un fichier Excel avec tous les équipages
2. Remplir les informations (catégorie, participants, temps pronostique)
3. Uploader le fichier via l'interface
4. Vérifier les résultats et corriger les erreurs si nécessaire

### 2. Mise à jour de temps pronostique

1. Exporter la liste actuelle des équipages
2. Ajouter/modifier les temps pronostiques
3. Réimporter le fichier (les équipages existants seront mis à jour)

### 3. Ajout de nouveaux équipages

1. Créer un fichier avec uniquement les nouveaux équipages
2. Importer le fichier
3. Les nouveaux équipages seront créés, les existants mis à jour

---

## ⚠️ Points importants

1. **Format de fichier** : Seuls .xlsx, .xls et .json sont supportés
2. **Taille maximale** : 10 MB
3. **Authentification** : Requise (token JWT)
4. **Catégorie** : Doit exister et être liée à l'événement
5. **Participants** : Au moins un participant est requis par équipage
6. **Temps pronostique** : Optionnel, mais recommandé pour le tri automatique

---

## 🔗 Routes API concernées

- `POST /import/crews` - Import d'équipages depuis fichier
- `GET /crews/event/:event_id` - Liste des équipages (pour vérification)
- `GET /categories` - Liste des catégories (pour vérifier les codes)

---

**Dernière mise à jour** : 2024
