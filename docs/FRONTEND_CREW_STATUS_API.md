## API backend – Optimisation page statuts d’équipages

Cette page concerne la vue `/event/:eventId/crew-status` (et la vue publique associée).

---

## 1. Liste d’équipages avec participants (sans N+1)

### Endpoint

- **GET** `/crews/event/:event_id/with-participants`

### Query params

- `search` *(optionnel, string)* :
  - filtre sur (LIKE `%search%`, insensible à la casse côté SQL classique) :
    - `club_name`
    - `club_code`
    - `category.code`, `category.label`
    - `crew_participants.participant.first_name`
    - `crew_participants.participant.last_name`
    - `crew_participants.participant.license_number`
- `page` *(optionnel, défaut 1)*
- `pageSize` *(optionnel, défaut 50, max 200)*

### Réponse

```json
{
  "status": "success",
  "data": [
    {
      "id": "crew-id",
      "event_id": "event-id",
      "category_id": "cat-id",
      "status": "registered",
      "club_name": "Club de Test",
      "club_code": "ABC",
      "temps_pronostique": 1920,
      "category": {
        "id": "cat-id",
        "code": "J18H2x",
        "label": "Juniors 18 Hommes 2x",
        "age_group": "J18",
        "gender": "Homme"
      },
      "crew_participants": [
        {
          "id": "crew-participant-id",
          "seat_position": 1,
          "is_coxswain": false,
          "participant": {
            "id": "participant-id",
            "first_name": "Jean",
            "last_name": "Dupont",
            "license_number": "123456",
            "club_name": "Club de Test",
            "gender": "Homme"
          }
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "total": 237
  }
}
```

### Détails d’implémentation

- Chargement **en une seule requête** via Sequelize (`include` sur `Category` et `CrewParticipant` + `Participant`).
- Tri par défaut :
  - `status ASC`, puis `club_name ASC`.
- Le champ `temps_pronostique` (en secondes) est inclus si présent.

---

## 2. Recherche de participants d’un événement

### Endpoint

- **GET** `/participants/event/:event_id`

### Query params

- `search` *(optionnel, string)* :
  - filtre sur :
    - `first_name`
    - `last_name`
    - `license_number`
    - `club_name`
- `page` *(optionnel, défaut 1)*
- `pageSize` *(optionnel, défaut 50, max 200)*

### Réponse

```json
{
  "status": "success",
  "data": [
    {
      "id": "participant-id",
      "first_name": "Jean",
      "last_name": "Dupont",
      "license_number": "123456",
      "club_name": "Club de Test",
      "gender": "Homme"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "total": 1234
  }
}
```

### Notes

- Ne renvoie **que les participants ayant au moins un équipage** dans l’événement :
  - jointure `Participant -> CrewParticipant -> Crew` filtrée sur `event_id`.
- Format stabilisé : `status`, `data`, `pagination`.

---

## 3. Équipages d’un participant

### Endpoint

- **GET** `/participants/:participant_id/crews`

### Réponse

Même structure d’objets `Crew` que pour `GET /crews/event/:event_id/with-participants`, limitée aux équipages auxquels appartient le participant :

```json
{
  "status": "success",
  "data": [
    {
      "id": "crew-id",
      "club_name": "Club de Test",
      "club_code": "ABC",
      "status": "registered",
      "category": {
        "id": "cat-id",
        "code": "J18H2x",
        "label": "Juniors 18 Hommes 2x"
      },
      "crew_participants": [
        {
          "id": "crew-participant-id",
          "seat_position": 1,
          "is_coxswain": false,
          "participant": {
            "id": "participant-id",
            "first_name": "Jean",
            "last_name": "Dupont",
            "license_number": "123456"
          }
        }
      ]
    }
  ]
}
```

### Usage côté front

1. Appeler `GET /participants/event/:event_id?search=...` pour trouver un participant.
2. Sur clic d’un participant, appeler `GET /participants/:participant_id/crews`.
3. Réutiliser les mêmes composants que pour la page de statuts (les données `Crew` ont le même shape que `with-participants`).

---

## 4. Remarques front importantes

- **Statuts d’équipages** : inchangés, toujours ceux de `CrewStatus` :
  - `registered`, `dns`, `dnf`, `disqualified`, `changed`, `withdrawn`, `scratch`.
- Les listes renvoient toujours :
  - `status: "success" | "error"`
  - `data: [...]`
  - éventuellement `pagination`.
- En cas d’erreur, le message lisible est dans :
  - `response.data.message`

---

## 5. Résumé rapide pour implémentation front

- Pour remplacer le N+1 actuel :
  - Utiliser **`GET /crews/event/:event_id/with-participants`** avec `search`, `page`, `pageSize`.
- Pour recherche multi‑phases :
  1. `GET /participants/event/:event_id?search=...` → liste paginée de participants.
  2. `GET /participants/:participant_id/crews` → équipages de ce participant (même structure que `with-participants`).

