# API Endurance Mer - Guide technique

## Endpoints

- POST `/events/:eventId/endurance-mer/import` (auth)
- GET `/events/:eventId/endurance-mer/import-results`
- GET `/events/:eventId/endurance-mer/ranking`
- GET `/events/endurance-mer/global-ranking`
- GET `/events/endurance-mer/territorial-bonus`
- POST `/events/endurance-mer/territorial-bonus` (auth)

## Import

Body multipart:

- file (xlsx)
- event_format: enduro|brs
- event_level: territorial|championnat_france
- replace_previous: true|false

## Regles

- Ponderation partants <7 => 75%, sinon 100%
- ENDURO: plafond 2 equipages par club et par epreuve
- BRS: plafond 2 juniors + 2 seniors par club et par epreuve
- CF: bareme championnat de france
- Mixtes U17 ENDURO: prorata 2 clubs max

## Classement global (saison)

Formule:

- top 4 enduro territoriaux
- - top 1 BRS territorial
- - championnats de france
- - bonus territorial (67.5, une fois)

## Migrations

- 009_create_endurance_mer_import_results.sql
- 010_add_endurance_mer_scoring_template.sql
- 011_create_endurance_mer_territorial_bonus.sql

## Voir aussi

- `docs/FRONTEND_ENDURANCE_MER_IMPORT.md`
- `docs/IMPORT_RESULTATS_EXCEL_ENDURANCE_MER_2026.md`
