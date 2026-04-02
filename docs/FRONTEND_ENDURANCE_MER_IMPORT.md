# Frontend Endurance Mer - Guide complet

Ce guide couvre l'integration frontend complete du module Endurance Mer 2026:
- import Excel (ENDURO/BRS)
- consultation des resultats importes
- classement evenement
- classement global saison (reglement 2026)
- gestion du bonus territorial (backoffice)

## 1) Endpoints

### Import evenement
- POST `/events/:eventId/endurance-mer/import` (auth)
- multipart/form-data:
  - `file` (xlsx) obligatoire
  - `event_format`: `enduro` | `brs`
  - `event_level`: `territorial` | `championnat_france`
  - `replace_previous`: `true` | `false`

### Resultats importes
- GET `/events/:eventId/endurance-mer/import-results`
- query optionnelles: `epreuve_code`, `club_code`

### Classement evenement
- GET `/events/:eventId/endurance-mer/ranking`

### Classement global saison (reglement)
- GET `/events/endurance-mer/global-ranking?season=2026&include_territorial_bonus=true`

### Bonus territorial (backoffice)
- GET `/events/endurance-mer/territorial-bonus?season=2026`
- POST `/events/endurance-mer/territorial-bonus` (auth)
  - body JSON: `{ season, club_code?, club_name, points=67.5, is_active=true, notes? }`

## 2) Regles appliquees par l'API

### ENDURO (territorial)
- Bareme ENDURO officiel
- Ponderation partants (<7 => 75%, >=7 => 100%)
- Plafond evenement: max 2 equipages par club et par epreuve
- Mixtes U17: seuls les mixtes U17 a 2 clubs max marquent; points repartis au prorata (Club1/Club2), sinon 0

### BRS (territorial)
- Bareme BRS officiel
- Ponderation partants
- Plafond evenement: max 2 juniors + 2 seniors par club et par epreuve

### Championnat de France
- Bareme Championnats officiel (1x U19, 1x Senior, 2x U19, 2x Senior, 4x U17/U19, 4x Senior)

### Classement global saison (club)
Total =
- Top 4 events ENDURO territoriaux
+ Top 1 event BRS territorial
+ Tous les points Championnats de France
+ Bonus territorial (67.5) si actif

## 3) Ecrans frontend recommandes

### Ecran "Import Endurance Mer" (event)
- file input `.xlsx`
- select format: Enduro/BRS
- select niveau: Territorial/Championnat de France
- checkbox "Remplacer les imports precedents"
- bouton Import
- retour: inserted, epreuves, erreurs

### Ecran "Resultats importes" (event)
- tableau: epreuve_code, place, club_code, club_name, points_attributed, partants_count
- filtres: epreuve, club

### Ecran "Classement evenement"
- tableau: rank, club_name, club_code, total_points

### Ecran "Classement global mer" (saison)
- filtres: saison, inclure bonus territorial
- tableau: rank, club, total_points
- detail breakdown:
  - enduro_top4
  - brs_top1
  - championnat_france
  - territorial_bonus

### Ecran backoffice "Bonus territorial"
- liste par saison
- ajout/modification activation

## 4) Exemples frontend (fetch)

### Import
```js
const fd = new FormData();
fd.append('file', file);
fd.append('event_format', 'enduro');
fd.append('event_level', 'territorial');
fd.append('replace_previous', 'true');

const res = await fetch(`/events/${eventId}/endurance-mer/import`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: fd,
});
```

### Classement global
```js
const res = await fetch('/events/endurance-mer/global-ranking?season=2026&include_territorial_bonus=true');
const json = await res.json();
```

## 5) Gestion d'erreurs a prevoir
- 400: file manquant / payload invalide
- 401: token absent ou invalide
- 404: event introuvable
- 500: erreur parsing Excel / erreur calcul

## 6) Source de verite et templates
- Les points importes sont traces dans `endurance_mer_import_results`.
- Le bareme editable est dans `scoring_templates` (`type = endurance_mer`, `config` JSON).
- Le front backoffice peut modifier ce template via endpoints ranking templates existants.

## 7) Migrations a executer
- `009_create_endurance_mer_import_results.sql`
- `010_add_endurance_mer_scoring_template.sql`
- `011_create_endurance_mer_territorial_bonus.sql`
