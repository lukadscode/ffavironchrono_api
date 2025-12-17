# Guide Frontend : Création / mise à jour d’un résultat indoor manuel

## 📋 Vue d'ensemble

Cette route permet au front d’**ajouter ou modifier un résultat indoor manuel** pour un équipage donné sur une course indoor, **sans passer par le format ErgRace**.

Elle sert dans le cas où :
- on n’a **pas de fichier ErgRace** pour la course,
- ou on veut **corriger / saisir manuellement** un temps pour un équipage.

La route renvoie la **même structure** que `GET /indoor-results/race/:race_id`, ce qui permet de réutiliser facilement les composants déjà existants côté front.

## 📡 Endpoint API

### POST `/indoor-results/race/:raceId/manual`

Crée ou met à jour un résultat **indoor manuel** pour un équipage dans une course.

- Si un résultat existe déjà pour le couple (`race_id`, `crew_id`), il est **mis à jour**.
- Sinon, un nouveau résultat est **créé**.

**Paramètres URL** :
- `raceId` : ID de la course (UUID)

**Authentification** :
- Requise (Bearer token)
- Même logique que les autres routes indoor (rôles autorisés à gérer les résultats de l’événement).

## 📦 Payload (body)

### Champs obligatoires

```typescript
interface ManualIndoorResultPayload {
  crew_id: string;        // UUID de l’équipage FFA
  time_display: string;   // Temps formaté, ex: "7:21.1"
  time_ms: number;        // Temps en millisecondes (> 0)
  distance: number;       // Distance parcourue en mètres (> 0)

  // Optionnel si présent dans l’URL :
  race_id?: string;       // UUID de la course (si non passé en :raceId)

  // Champs optionnels :
  lane?: number;
  avg_pace?: string;
  spm?: number;
  calories?: number;
  machine_type?: string;
  logged_time?: string;   // ISO datetime
  splits_data?: any[];    // optionnel, peut être omis
}
```

**Règles** :
- `raceId` dans l’URL est prioritaire ; `race_id` dans le body est accepté en fallback.
- `time_ms` doit être **strictement > 0**.
- `distance` doit être **strictement > 0**.

### Exemple de payload minimal

```json
{
  "crew_id": "f6a0e5a8-2b0c-4e1d-a9b9-2a6dcce8b123",
  "time_display": "7:21.1",
  "time_ms": 441100,
  "distance": 1000
}
```

### Exemple de payload complet

```json
{
  "crew_id": "f6a0e5a8-2b0c-4e1d-a9b9-2a6dcce8b123",
  "lane": 3,
  "time_display": "7:21.1",
  "time_ms": 441100,
  "distance": 1000,
  "avg_pace": "1:50.5",
  "spm": 32,
  "calories": 120,
  "machine_type": "Rameur",
  "logged_time": "2025-12-17T09:11:48.721Z",
  "splits_data": [
    {
      "split_distance": 250,
      "split_time": "110.5",
      "split_avg_pace": "1:50.0",
      "split_stroke_rate": 32
    }
  ]
}
```

### Calcul automatique de l’allure (`avg_pace`)

- Si `avg_pace` **n’est pas fourni** :
  - le backend calcule automatiquement l’allure moyenne pour **500m**, à partir de `time_ms` et `distance`,
  - format retourné : `"M:SS.d"` (par ex. `"1:50.5"`).

### Gestion de `logged_time`

- Si `logged_time` **n’est pas fourni** :
  - le backend utilise la date/heure **courante** (`now()`).

## 📤 Exemple de requête côté frontend

### TypeScript – appel simple

```typescript
async function saveManualIndoorResult(
  raceId: string,
  payload: ManualIndoorResultPayload,
  token: string
) {
  const response = await fetch(`/indoor-results/race/${raceId}/manual`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();

  if (result.status !== "success") {
    throw new Error(result.message || "Erreur lors de l'enregistrement du résultat manuel");
  }

  return result.data;
}
```

## 📥 Format de réponse

La réponse reprend **exactement** la structure utilisée par `GET /indoor-results/race/:race_id`.

### Interface TypeScript

```typescript
interface IndoorRaceResultResponse {
  status: "success" | "error";
  data: {
    race_result: {
      id: string;
      race_id: string;
      ergrace_race_id: string | null;
      race_start_time: string | null;
      race_end_time: string | null;
      duration: number | null;
    };
    participants: IndoorParticipantResultDto[];
  };
}

interface IndoorParticipantResultDto {
  id: string;
  place: number | null;
  time_display: string | null;
  time_ms: number | null;
  score: string | null;
  distance: number | null;
  avg_pace: string | null;
  spm: number | null;
  calories: number | null;
  machine_type: string | null;
  logged_time: string | null;
  crew_id: string | null;
  crew: {
    id: string;
    club_name: string | null;
    club_code: string | null;
    category: {
      id: string;
      code: string | null;
      label: string | null;
    } | null;
  } | null;
  ergrace_participant_id: string | null;
  splits_data: any[] | null;
}
```

### Exemple de réponse (succès)

```json
{
  "status": "success",
  "data": {
    "race_result": {
      "id": "0b7c8b54-5d4d-4e1b-b4c9-2c1f7b7ab123",
      "race_id": "b6f1b9d2-2c6a-4f5f-96a4-7f6d9a1bc321",
      "ergrace_race_id": "manual-b6f1b9d2-2c6a-4f5f-96a4-7f6d9a1bc321",
      "race_start_time": null,
      "race_end_time": null,
      "duration": 441100
    },
    "participants": [
      {
        "id": "f3a2b1c4-9d8e-4f1a-b7c6-2a4d5e6f7890",
        "place": 1,
        "time_display": "7:21.1",
        "time_ms": 441100,
        "score": "7:21.1",
        "distance": 1000,
        "avg_pace": "1:50.5",
        "spm": 32,
        "calories": 120,
        "machine_type": "Rameur",
        "logged_time": "2025-12-17T09:11:48.721Z",
        "crew_id": "f6a0e5a8-2b0c-4e1d-a9b9-2a6dcce8b123",
        "crew": {
          "id": "f6a0e5a8-2b0c-4e1d-a9b9-2a6dcce8b123",
          "club_name": "MEYZIEU AM",
          "club_code": "C069011",
          "category": {
            "id": "73e29ee6-6ab6-44cf-9772-62733ea40182",
            "code": "TAF1I_1000m",
            "label": "TAF1I 1000m"
          }
        },
        "ergrace_participant_id": "f6a0e5a8-2b0c-4e1d-a9b9-2a6dcce8b123",
        "splits_data": []
      }
    ]
  }
}
```

## 🔁 Impact sur le classement / affichage

- Après chaque appel à `POST /indoor-results/race/:raceId/manual` :
  - le backend **recalcule les places (`place`)** pour **tous les participants** de la course, en triant par `time_ms` (du plus petit au plus grand),
  - les participants sans temps valide (`time_ms` nul ou 0) reçoivent `place = null`.
- Si la course n’était pas encore terminée, son statut est mis à jour en **`finished`** (sauf si déjà `finished` ou `official`).

Pour le front, cela signifie que :
- après sauvegarde, il suffit de **rafraîchir les données** avec `result.data` pour avoir la liste des participants **à jour et triée**.

## 💻 Exemple de composant React (formulaire simple)

```typescript
import React, { useState } from "react";

interface ManualIndoorResultFormProps {
  raceId: string;
  crewId: string;
  onSaved?: () => void;
}

export const ManualIndoorResultForm: React.FC<ManualIndoorResultFormProps> = ({
  raceId,
  crewId,
  onSaved,
}) => {
  const [timeDisplay, setTimeDisplay] = useState("");
  const [timeMs, setTimeMs] = useState<number | "">("");
  const [distance, setDistance] = useState<number | "">(1000);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!timeDisplay || !timeMs || !distance) {
      setError("Merci de renseigner le temps et la distance.");
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem("token") || "";

      const payload = {
        crew_id: crewId,
        time_display: timeDisplay,
        time_ms: Number(timeMs),
        distance: Number(distance),
      };

      const response = await fetch(`/indoor-results/race/${raceId}/manual`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.status !== "success") {
        throw new Error(result.message || "Erreur lors de l'enregistrement du résultat");
      }

      if (onSaved) {
        onSaved();
      }
    } catch (err: any) {
      setError(err.message || "Erreur réseau");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="manual-indoor-result-form">
      <div className="form-row">
        <label>Temps (affiché)</label>
        <input
          type="text"
          value={timeDisplay}
          onChange={(e) => setTimeDisplay(e.target.value)}
          placeholder="7:21.1"
        />
      </div>

      <div className="form-row">
        <label>Temps (ms)</label>
        <input
          type="number"
          value={timeMs}
          onChange={(e) => setTimeMs(e.target.value ? Number(e.target.value) : "")}
          placeholder="441100"
        />
      </div>

      <div className="form-row">
        <label>Distance (m)</label>
        <input
          type="number"
          value={distance}
          onChange={(e) => setDistance(e.target.value ? Number(e.target.value) : "")}
          placeholder="1000"
        />
      </div>

      {error && <div className="form-error">{error}</div>}

      <button type="submit" disabled={saving}>
        {saving ? "Enregistrement..." : "Enregistrer le résultat"}
      </button>
    </form>
  );
};
```

## ⚠️ Erreurs possibles côté front

- **400 – Bad Request** :
  - `race_id` / `crew_id` manquant ou invalide,
  - `time_ms <= 0` ou `distance <= 0`,
  - format JSON invalide.
- **404 – Not Found** :
  - course introuvable,
  - équipage introuvable,
  - équipage ne faisant pas partie de l’événement de la course.
- **500 – Internal Server Error** :
  - erreur inattendue côté backend (mais **sans** erreurs de type `.split` sur `undefined`, la route ne dépend plus du format ErgRace).

Le front doit afficher un message clair à l’utilisateur (popup / toast / banner) en cas d’erreur 400/404/500.

## ✅ Résumé pour le front

- Utiliser `POST /indoor-results/race/:raceId/manual` pour **créer ou modifier** un résultat manuel d’équipage.
- Envoyer **au minimum** : `crew_id`, `time_display`, `time_ms`, `distance`.
- Récupérer la réponse et mettre à jour l’affichage avec `data.race_result` et `data.participants`.
- La structure de réponse est **compatible** avec `GET /indoor-results/race/:race_id`, donc réutilisable dans les composants existants.


