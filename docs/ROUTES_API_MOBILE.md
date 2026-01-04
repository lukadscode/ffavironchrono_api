# 📱 Documentation des Routes API - Application Mobile

Cette documentation liste toutes les routes API disponibles pour l'application mobile, avec les informations qu'elles renvoient.

## 🔑 Authentification

L'application mobile utilise un **token de timing point** pour l'authentification. Voir la documentation `API_MOBILE_TIMING_POINT.md` pour les détails.

**Note :** Toutes les routes listées ci-dessous sont **publiques** (pas d'authentification JWT requise), sauf indication contraire.

---

## 📍 Base URL

```
https://votre-api-url.com
```

---

## 🔐 1. Authentification Timing Point

### `POST /public/timing-points/resolve-token`

Résoudre un token de timing point et obtenir les informations de l'événement.

**Requête :**
```json
{
  "token": "123-456-789",
  "device_id": "device-uuid"
}
```

**Réponse (200) :**
```json
{
  "status": "success",
  "data": {
    "timing_point_id": "uuid",
    "timing_point_label": "Arrivée 2000m",
    "event_id": "uuid",
    "event_name": "Championnat de France 2024",
    "event_location": "Lac d'Aiguebelette",
    "event_start_date": "2024-06-15T08:00:00.000Z",
    "event_end_date": "2024-06-17T18:00:00.000Z",
    "order_index": 3,
    "distance_m": 2000,
    "token": "123-456-789"
  }
}
```

---

## 📅 2. Événements (Events)

### `GET /events`

Liste tous les événements.

**Réponse (200) :**
```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "name": "Championnat de France 2024",
      "location": "Lac d'Aiguebelette",
      "start_date": "2024-06-15T08:00:00.000Z",
      "end_date": "2024-06-17T18:00:00.000Z",
      "race_type": "ligne",
      "website_url": "https://...",
      "image_url": "https://...",
      "organiser_name": "FFAviron",
      "organiser_code": "FFA",
      "is_visible": true,
      "is_finished": false
    }
  ]
}
```

### `GET /events/:id`

Détails d'un événement spécifique.

**Réponse (200) :**
```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "name": "Championnat de France 2024",
    "location": "Lac d'Aiguebelette",
    "start_date": "2024-06-15T08:00:00.000Z",
    "end_date": "2024-06-17T18:00:00.000Z",
    "race_type": "ligne",
    "website_url": "https://...",
    "image_url": "https://...",
    "organiser_name": "FFAviron",
    "organiser_code": "FFA",
    "is_visible": true,
    "is_finished": false
  }
}
```

---

## 🏁 3. Courses (Races)

### `GET /races/event/:event_id`

Liste toutes les courses d'un événement.

**Réponse (200) :**
```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "race_number": 1,
      "name": "Course 1",
      "status": "official",
      "RacePhase": {
        "id": "uuid",
        "name": "Phase principale",
        "event_id": "uuid"
      },
      "Distance": {
        "id": "uuid",
        "value": 2000
      },
      "race_crews": [
        {
          "id": "uuid",
          "race_id": "uuid",
          "crew_id": "uuid",
          "lane": 1,
          "crew": {
            "id": "uuid",
            "name": "Équipage 1",
            "category": {
              "id": "uuid",
              "code": "U17F1I_2000m",
              "label": "U17 Féminin 1x",
              "age_group": "U17",
              "gender": "F"
            }
          }
        }
      ]
    }
  ]
}
```

### `GET /races/:id`

Détails d'une course spécifique.

**Réponse (200) :**
```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "race_number": 1,
    "name": "Course 1",
    "status": "official",
    "RacePhase": {
      "id": "uuid",
      "name": "Phase principale",
      "event_id": "uuid"
    },
    "Distance": {
      "id": "uuid",
      "value": 2000
    },
    "race_crews": [...]
  }
}
```

### `GET /races/results/:race_id`

Résultats d'une course (route publique).

**Réponse (200) :**
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
      "finish_time": "2024-06-15T10:30:00.000Z",
      "final_time": "420000",
      "has_timing": true,
      "position": 1
    }
  ]
}
```

**Champs :**
- `crew_id` : ID de l'équipage
- `lane` : Numéro de couloir
- `club_name` : Nom du club
- `club_code` : Code du club
- `category` : Informations de la catégorie
- `finish_time` : Date/heure d'arrivée (ISO 8601)
- `final_time` : Temps final en millisecondes (string)
- `has_timing` : Boolean indiquant si un timing existe
- `position` : Position finale (classement)

---

## ⏱️ 4. Timing Points

### `GET /timing-points/event/:event_id`

Liste tous les timing points d'un événement.

**Réponse (200) :**
```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "event_id": "uuid",
      "label": "Départ",
      "order_index": 0,
      "distance_m": 0,
      "token": "123-456-789"
    },
    {
      "id": "uuid",
      "event_id": "uuid",
      "label": "Arrivée 2000m",
      "order_index": 3,
      "distance_m": 2000,
      "token": "987-654-321"
    }
  ]
}
```

**Note :** Les timing points sont ordonnés par `order_index` (ASC).

---

## 🕐 5. Timings

### `POST /timings`

Créer un nouveau timing (pour l'appareil mobile).

**Authentification :** Requise (Bearer token obtenu via `/public/timing-points/resolve-token`)

**Headers :**
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Requête :**
```json
{
  "timing_point_id": "uuid",
  "timestamp": "2024-06-15T10:30:45.123Z",
  "manual_entry": false
}
```

**Réponse (201) :**
```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "timing_point_id": "uuid",
    "timestamp": "2024-06-15T10:30:45.123Z",
    "manual_entry": false,
    "status": "pending"
  }
}
```

**Note :** 
- L'access_token est obligatoire
- Ce timing sera automatiquement diffusé via WebSocket à tous les clients qui écoutent le timing point
- L'appareil ne peut créer des timings que pour son propre timing point (celui associé au token)

**Erreur (403) :** Si vous essayez de créer un timing pour un timing point différent de celui associé à votre token
```json
{
  "status": "error",
  "message": "Vous ne pouvez créer des timings que pour votre timing point"
}
```

### `GET /timings/event/:event_id`

Liste tous les timings d'un événement.

**Réponse (200) :**
```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "timing_point_id": "uuid",
      "timestamp": "2024-06-15T10:30:45.123Z",
      "manual_entry": false,
      "status": "pending",
      "TimingPoint": {
        "id": "uuid",
        "label": "Arrivée 2000m",
        "distance_m": 2000,
        "order_index": 3,
        "Event": {
          "id": "uuid",
          "name": "Championnat de France 2024"
        }
      },
      "TimingAssignment": {
        "id": "uuid",
        "timing_id": "uuid",
        "crew_id": "uuid",
        "Crew": {
          "id": "uuid",
          "name": "Équipage 1",
          "RaceCrews": [
            {
              "Race": {
                "id": "uuid",
                "race_number": 1,
                "RacePhase": {...}
              }
            }
          ]
        }
      },
      "crew_id": "uuid",
      "race_id": "uuid",
      "relative_time_ms": 420000
    }
  ]
}
```

**Champs enrichis :**
- `crew_id` : ID de l'équipage assigné (si assigné)
- `race_id` : ID de la course (si assigné)
- `relative_time_ms` : Temps relatif en millisecondes depuis le départ réel

### `GET /timings/race/:race_id`

Liste tous les timings d'une course spécifique.

**Réponse (200) :**
```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "timing_point_id": "uuid",
      "timestamp": "2024-06-15T10:30:45.123Z",
      "TimingPoint": {
        "id": "uuid",
        "label": "Arrivée 2000m",
        "distance_m": 2000,
        "order_index": 3
      },
      "TimingAssignment": {
        "Crew": {
          "id": "uuid",
          "name": "Équipage 1"
        }
      },
      "crew_id": "uuid",
      "race_id": "uuid",
      "relative_time_ms": 420000
    }
  ]
}
```

### `GET /timings/:id`

Détails d'un timing spécifique.

**Réponse (200) :**
```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "timing_point_id": "uuid",
    "timestamp": "2024-06-15T10:30:45.123Z",
    "manual_entry": false,
    "status": "pending",
    "TimingPoint": {...},
    "TimingAssignment": {...}
  }
}
```

### `PUT /timings/:id`

Modifier un timing.

**Authentification :** Requise (Bearer token obtenu via `/public/timing-points/resolve-token`)

**Headers :**
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Requête :**
```json
{
  "timestamp": "2024-06-15T10:30:45.123Z",
  "manual_entry": true,
  "status": "pending"
}
```

**Réponse (200) :**
```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "timing_point_id": "uuid",
    "timestamp": "2024-06-15T10:30:45.123Z",
    "manual_entry": true,
    "status": "pending"
  }
}
```

**Note :** L'appareil ne peut modifier que les timings de son propre timing point.

### `DELETE /timings/:id`

Supprimer un timing.

**Authentification :** Requise (Bearer token obtenu via `/public/timing-points/resolve-token`)

**Headers :**
```
Authorization: Bearer {access_token}
```

**Réponse (200) :**
```json
{
  "status": "success",
  "message": "Timing supprimé"
}
```

**Note :** L'appareil ne peut supprimer que les timings de son propre timing point.

---

## 🔗 6. Timing Assignments (Assignations de timings)

### `GET /timing-assignments/event/:event_id`

Liste toutes les assignations de timings pour un événement.

**Réponse (200) :**
```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "timing_id": "uuid",
      "crew_id": "uuid",
      "Crew": {
        "id": "uuid",
        "name": "Équipage 1",
        "category": {
          "id": "uuid",
          "code": "U17F1I_2000m",
          "label": "U17 Féminin 1x"
        },
        "RaceCrews": [
          {
            "Race": {
              "id": "uuid",
              "race_number": 1,
              "RacePhase": {
                "event_id": "uuid"
              }
            }
          }
        ],
        "crew_participants": [...]
      },
      "Timing": {
        "id": "uuid",
        "timing_point_id": "uuid",
        "timestamp": "2024-06-15T10:30:45.123Z",
        "TimingPoint": {
          "id": "uuid",
          "label": "Arrivée 2000m",
          "distance_m": 2000,
          "order_index": 3
        }
      },
      "relative_time_ms": 420000
    }
  ]
}
```

### `GET /timing-assignments/race/:race_id`

Liste toutes les assignations de timings pour une course.

**Réponse (200) :**
```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "timing_id": "uuid",
      "crew_id": "uuid",
      "Crew": {...},
      "Timing": {
        "TimingPoint": {
          "label": "Arrivée 2000m",
          "distance_m": 2000,
          "order_index": 3
        }
      },
      "relative_time_ms": 420000
    }
  ]
}
```

### `GET /timing-assignments/crew/:crew_id`

Liste toutes les assignations de timings pour un équipage.

**Réponse (200) :**
```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "timing_id": "uuid",
      "crew_id": "uuid",
      "Timing": {
        "TimingPoint": {
          "label": "Arrivée 2000m",
          "order_index": 3
        }
      },
      "relative_time_ms": 420000
    }
  ]
}
```

---

## 🚤 7. Équipages (Crews)

### `GET /crews/event/:event_id`

Liste tous les équipages d'un événement.

**Réponse (200) :**
```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "event_id": "uuid",
      "name": "Équipage 1",
      "category_id": "uuid",
      "category": {
        "id": "uuid",
        "code": "U17F1I_2000m",
        "label": "U17 Féminin 1x",
        "age_group": "U17",
        "gender": "F"
      }
    }
  ]
}
```

### `GET /crews/:id`

Détails d'un équipage spécifique.

**Réponse (200) :**
```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "event_id": "uuid",
    "name": "Équipage 1",
    "category_id": "uuid",
    "category": {...}
  }
}
```

---

## 📢 8. Notifications

### `GET /notifications/event/:event_id`

Liste toutes les notifications d'un événement.

**Réponse (200) :**
```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "event_id": "uuid",
      "race_id": "uuid" | null,
      "message": "La course suivante commence dans 5 minutes",
      "importance": "info",
      "is_active": true,
      "start_date": "2024-06-15T10:00:00.000Z",
      "end_date": "2024-06-15T18:00:00.000Z",
      "created_at": "2024-06-15T09:55:00.000Z"
    }
  ]
}
```

**Types d'importance :** `info`, `warning`, `error`, `success`

### `GET /notifications/race/:race_id`

Liste toutes les notifications d'une course.

**Réponse (200) :** Format identique à `/notifications/event/:event_id`

---

## 📊 9. Résultats de Courses (Race Crews)

### `GET /race-crews/:race_id`

Liste tous les équipages d'une course avec leurs informations.

**Réponse (200) :**
```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "race_id": "uuid",
      "crew_id": "uuid",
      "lane": 1,
      "crew": {
        "id": "uuid",
        "name": "Équipage 1",
        "category": {
          "id": "uuid",
          "code": "U17F1I_2000m",
          "label": "U17 Féminin 1x"
        }
      }
    }
  ]
}
```

---

## 🏆 10. Classements (Rankings)

### `GET /rankings/event/:event_id/club`

Classement par clubs pour un événement.

**Réponse (200) :**
```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "event_id": "uuid",
      "club_code": "CLB",
      "club_name": "Club Aviron",
      "total_points": 150,
      "ranking_points": [...]
    }
  ]
}
```

---

## 🕐 11. Horloge Serveur

### `GET /server-time`

Récupère l'heure actuelle du serveur (pour synchronisation).

**Réponse (200) :**
```json
{
  "status": "success",
  "data": {
    "server_time": "2024-06-15T10:30:45.123Z"
  }
}
```

### `GET /server-time-offset`

Récupère le décalage entre l'heure du serveur et l'heure locale.

**Réponse (200) :**
```json
{
  "status": "success",
  "data": {
    "offset_ms": 0
  }
}
```

---

## 🔄 12. Phases de Course (Race Phases)

### `GET /race-phases/:event_id`

Liste toutes les phases de course d'un événement.

**Réponse (200) :**
```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "event_id": "uuid",
      "name": "Phase principale",
      "order_index": 0
    }
  ]
}
```

### `GET /race-phases/:id/results`

Résultats d'une phase de course (toutes les courses de la phase avec leurs résultats).

**Réponse (200) :**
```json
{
  "status": "success",
  "data": {
    "phase": {
      "id": "uuid",
      "event_id": "uuid",
      "name": "Phase principale",
      "order_index": 0
    },
    "races": [
      {
        "id": "uuid",
        "race_number": 1,
        "name": "Course 1",
        "status": "official",
        "Distance": {
          "id": "uuid",
          "value": 2000
        },
        "race_crews": [...]
      }
    ]
  }
}
```

---

## 👥 13. Participants

### `GET /participants`

Liste tous les participants.

**Réponse (200) :**
```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "first_name": "Jean",
      "last_name": "Dupont",
      "license_number": "12345",
      "gender": "Homme",
      "email": "jean.dupont@example.com",
      "club_name": "Club Aviron"
    }
  ]
}
```

### `GET /participants/:id`

Détails d'un participant spécifique.

**Réponse (200) :**
```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "first_name": "Jean",
    "last_name": "Dupont",
    "license_number": "12345",
    "gender": "Homme",
    "email": "jean.dupont@example.com",
    "club_name": "Club Aviron"
  }
}
```

### `GET /participants/event/:event_id`

Liste tous les participants d'un événement.

**Réponse (200) :** Format identique à `GET /participants`

### `GET /participants/licencie/:numeroLicence`

Rechercher un participant par numéro de licence.

**Réponse (200) :**
```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "first_name": "Jean",
    "last_name": "Dupont",
    "license_number": "12345",
    "gender": "Homme",
    "email": "jean.dupont@example.com",
    "club_name": "Club Aviron"
  }
}
```

---

## 🏷️ 14. Catégories

### `GET /categories`

Liste toutes les catégories.

**Réponse (200) :**
```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "code": "U17F1I_2000m",
      "label": "U17 Féminin 1x",
      "age_group": "U17",
      "gender": "F",
      "boat_seats": 1,
      "has_coxswain": false
    }
  ]
}
```

### `GET /categories/:id`

Détails d'une catégorie spécifique.

**Réponse (200) :**
```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "code": "U17F1I_2000m",
    "label": "U17 Féminin 1x",
    "age_group": "U17",
    "gender": "F",
    "boat_seats": 1,
    "has_coxswain": false
  }
}
```

### `GET /event-categories/:event_id`

Liste toutes les catégories d'un événement.

**Réponse (200) :**
```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "event_id": "uuid",
      "category_id": "uuid",
      "Category": {
        "id": "uuid",
        "code": "U17F1I_2000m",
        "label": "U17 Féminin 1x"
      }
    }
  ]
}
```

---

## 🏢 15. Clubs

### `GET /clubs`

Liste tous les clubs (avec filtres optionnels : `?code=xxx&nom_court=yyy&code_court=zzz&type=CLU`).

**Réponse (200) :**
```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "code": "CLB",
      "nom_court": "Club Aviron",
      "code_court": "CA",
      "nom": "Club Aviron de Paris",
      "type": "CLU"
    }
  ]
}
```

### `GET /clubs/code/:code`

Récupérer un club par son code.

**Réponse (200) :**
```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "code": "CLB",
    "nom_court": "Club Aviron",
    "code_court": "CA",
    "nom": "Club Aviron de Paris",
    "type": "CLU"
  }
}
```

### `GET /clubs/nom-court/:nom_court`

Récupérer un club par son nom court.

**Réponse (200) :** Format identique à `GET /clubs/code/:code`

### `GET /clubs/code-court/:code_court`

Récupérer un club par son code court.

**Réponse (200) :** Format identique à `GET /clubs/code/:code`

---

## 👤 16. Participants d'Équipage (Crew Participants)

### `GET /crew-participants/:crew_id`

Liste tous les participants d'un équipage.

**Réponse (200) :**
```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "crew_id": "uuid",
      "participant_id": "uuid",
      "Participant": {
        "id": "uuid",
        "first_name": "Jean",
        "last_name": "Dupont",
        "license_number": "12345",
        "gender": "Homme"
      }
    }
  ]
}
```

---

## 📏 17. Distances

### `GET /distances`

Liste toutes les distances disponibles.

**Réponse (200) :**
```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "value": 2000
    },
    {
      "id": "uuid",
      "value": 5000
    }
  ]
}
```

---

## 🏋️ 18. Résultats Indoor

### `GET /indoor-results/race/:race_id`

Récupérer les résultats indoor d'une course (accès public).

**Réponse (200) :**
```json
{
  "status": "success",
  "data": {
    "race_id": "uuid",
    "results": [
      {
        "id": "uuid",
        "crew_id": "uuid",
        "time_ms": 420000,
        "distance_m": 2000,
        "Crew": {
          "id": "uuid",
          "name": "Équipage 1",
          "category": {
            "code": "U17F1I_2000m",
            "label": "U17 Féminin 1x"
          }
        }
      }
    ]
  }
}
```

---

## 📝 Format des Réponses Standard

Toutes les réponses suivent ce format :

### Succès (200/201)
```json
{
  "status": "success",
  "data": { ... } | [ ... ]
}
```

### Erreur (400/404/500)
```json
{
  "status": "error",
  "message": "Message d'erreur descriptif"
}
```

---

## 🔄 Codes de Statut HTTP

- **200 OK** : Requête réussie
- **201 Created** : Ressource créée avec succès
- **400 Bad Request** : Erreur de validation ou paramètres invalides
- **404 Not Found** : Ressource introuvable
- **500 Internal Server Error** : Erreur serveur

---

## ⚠️ Notes Importantes

1. **Authentification** : 
   - Les routes de **lecture** (GET) sont publiques et accessibles sans token
   - Les routes de **création/modification/suppression** (POST, PUT, DELETE) pour les timings nécessitent un **access_token** obtenu via `/public/timing-points/resolve-token`

2. **Authentification via token de timing point** : 
   - L'application mobile résout d'abord un token de timing point via `/public/timing-points/resolve-token`
   - Cette route retourne un `access_token` JWT valide 24h
   - Ce token doit être utilisé dans le header `Authorization: Bearer {access_token}` pour créer/modifier/supprimer des timings
   - Voir `API_MOBILE_TIMING_POINT.md` pour les détails

3. **Temps relatifs** : Les timings incluent un champ `relative_time_ms` qui représente le temps écoulé depuis le départ réel de la course (en millisecondes).

4. **WebSocket pour temps réel** : Pour les mises à jour en temps réel, utiliser WebSocket (voir `API_MOBILE_TIMING_POINT.md`).

5. **Format des dates** : Toutes les dates sont au format ISO 8601 (ex: `2024-06-15T10:30:45.123Z`).

6. **Format des temps** : Les temps sont exprimés en millisecondes, soit comme nombre (`relative_time_ms`) soit comme string (`final_time`).

---

## 📚 Documentation Complémentaire

- **Authentification et WebSocket** : `API_MOBILE_TIMING_POINT.md`
- **Documentation Swagger** : `/docs` (si disponible)

