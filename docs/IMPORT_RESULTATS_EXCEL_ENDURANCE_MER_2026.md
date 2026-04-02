# Import des résultats par fichier Excel – Aviron de mer / ENDURO 2026

**Contexte** : En attendant le développement d’une solution native, les résultats des régates d’aviron de mer (ENDURO, Beach Rowing Sprint) sont importés via des **fichiers Excel** fournis par la FFAviron, à raison d’**un fichier par événement**. Les données sont chargées dans une **table dédiée** pour être récupérées par événement et pour alimenter le classement mer des clubs selon la réglementation sportive 2026.

**Référence règlement** : *Réglementation sportive 2026 – Adoptée par le Comité Directeur du 04 octobre 2025* (extrait « Classement mer des clubs », points ENDURO / BRS / championnats).

### Distinction format / niveau de compétition

- **Format d’épreuve** : **ENDURO** ou **BRS** (Beach Rowing Sprint). C’est le type de course (régate enduro vs sprint plage).
- **Niveau de compétition** : **régate territoriale**, **challenge territorial**, **championnat de France**, etc.

Un **challenge territorial** ou un **championnat de France** peut être **ENDURO** ou **BRS**. Le barème à appliquer dépend des deux :
- *Régate / challenge territorial* en ENDURO → barème ENDURO (section 4.2) + pondération partants.
- *Régate / challenge territorial* en BRS → barème BRS (section 4.3) + pondération partants.
- *Championnat de France* en ENDURO → barème Championnats de France (section 4.6, colonnes 1x/2x/4x+).
- *Championnat de France* en BRS → barème Championnats de France (section 4.6, selon type d’épreuve BRS).

L’événement (ou le fichier de remontée) doit donc être caractérisé à la fois par son **niveau** (territorial / France) et par son **format** (enduro / brs) pour choisir le bon tableau de points.

---

## 1. Objectifs et périmètre

- **Un fichier Excel par événement** : chaque régate (ex. « Régates aviron La Rochelle ») fait l’objet d’un fichier de remontée des résultats.
- **Table dédiée** : les lignes importées sont stockées dans une table dédiée (ex. `endurance_mer_import_results` ou `event_result_imports`) avec une clé `event_id` pour filtrer par événement existant en base.
- **Récupération par événement** : l’API permet de lister / consulter les résultats d’un événement donné (par épreuve, par club, etc.).
- **Règles de calcul** : les points (ENDURO, BRS, pondération, plafonds) sont documentés ci‑dessous pour une implémentation ultérieure (calcul côté back‑office ou lors de l’import).

---

## 2. Structure attendue du fichier Excel (remontée résultats)

Le fichier type est celui fourni par la FFAviron au format **« Remontée résultats régates »** (ex. `FFaviron-ENDURO-2026-RemonteeResultats_Regates_aviron_la_rochelle.xlsx`). La structure exacte doit être validée sur le **fichier officiel** ou le modèle fourni par la Fédération.

### 2.1 Colonnes typiques (à adapter au template officiel)

| Colonne (exemple)           | Description                                      | Usage import                          |
|----------------------------|--------------------------------------------------|----------------------------------------|
| Identifiant épreuve / Code épreuve | Référence de l’épreuve (ex. `U17F1I`, `SM2x`)   | Lien vers catégorie / type d’épreuve   |
| Libellé épreuve            | Nom de l’épreuve                                 | Affichage, vérification                |
| Place                      | Classement (1, 2, 3, …)                          | Calcul des points (barème)             |
| Club / Nom club / Code club | Club de l’équipage                               | Club, répartition points si mixte     |
| Équipage / Nom équipage     | Désignation de l’équipage                        | Affichage                             |
| Temps                      | Temps réalisé (ex. `HH:MM:SS` ou `MM:SS`)        | Stockage, affichage                    |
| Équipage mixte (O/N)       | Indication équipage mixte de clubs              | Répartition des points (prorata)       |
| Clubs concernés (si mixte) | Liste des clubs pour répartition                 | Répartition points                    |
| …                          | Autres colonnes du template FFAviron             | À mapper selon le fichier réel        |

- **Feuille(s)** : en général une feuille par épreuve ou un tableau avec une colonne « épreuve ». À confirmer avec le fichier réel.
- **Ligne d’en-tête** : ligne 1 = noms de colonnes (à utiliser pour le mapping).
- **Encodage** : UTF‑8 recommandé pour les exports Excel.

Si le fichier joint « Remontée résultats régates aviron la rochelle » a des libellés de colonnes différents, il suffit de mettre à jour le **mapping colonne → champ** dans le code d’import (voir section 6).

---

## 3. Base de données – Table dédiée « résultats importés »

Une table dédiée permet de stocker **une ligne par résultat** (une place par équipage par épreuve) et de les rattacher à un **événement** existant (`events.id`).

### 3.1 Proposition de schéma

**Table : `endurance_mer_import_results`** (ou `event_result_imports`)

| Colonne            | Type            | Contraintes / Description |
|-------------------|-----------------|---------------------------|
| `id`              | CHAR(36)        | PK, UUID                  |
| `event_id`        | CHAR(36)        | FK → `events.id`, NOT NULL |
| `epreuve_code`     | VARCHAR(100)    | Code ou identifiant épreuve (ex. U17F1I, SM2x) |
| `epreuve_libelle`  | VARCHAR(255)    | Libellé épreuve           |
| `place`           | INT             | Classement (1, 2, 3, …)    |
| `club_code`       | VARCHAR(50)     | Code club (si disponible) |
| `club_name`        | VARCHAR(150)    | Nom du club               |
| `crew_name`       | VARCHAR(255)    | Nom équipage (optionnel)   |
| `time_raw`        | VARCHAR(50)     | Temps brut (chaîne)        |
| `time_seconds`    | INT             | Temps en secondes (optionnel, pour tri/calcul) |
| `is_mixed_clubs`  | BOOLEAN         | Équipage mixte de clubs   |
| `club_codes_mixed`| VARCHAR(255)    | Codes des clubs (ex. "C972007,C972008") pour répartition |
| `points_attributed`| DECIMAL(10,2)  | Points attribués (après pondération, avant plafond) |
| `event_format`    | VARCHAR(20)     | Format de l’épreuve : `enduro` ou `brs` |
| `event_level`     | VARCHAR(50)     | Niveau : `territorial`, `championnat_france` (challenge/championnat peut être enduro ou brs) |
| `partants_count`  | INT             | Nombre de partants dans l’épreuve (pour pondération) |
| `import_batch_id` | CHAR(36)        | Optionnel : lot d’import (pour remplacer un import précédent) |
| `created_at`      | DATETIME        | Date d’import             |

- **Index recommandés** : `(event_id)`, `(event_id, epreuve_code)`, `(event_id, club_code)`.
- **Contrainte** : un même `event_id` peut avoir plusieurs imports (ex. remplacement) ; `import_batch_id` permet de garder un historique ou de « remplacer » les résultats d’un lot.

### 3.2 Faut-il stocker les points en BDD (RankingPoint / ClubRanking) ?

Le classement mer évolue souvent (nouveaux événements, re-imports, plafonds…). **Stocker les points dans RankingPoint et ClubRanking n’est donc pas indispensable.**

**Deux approches :**

| Approche | Description | Avantages | Inconvénients |
|----------|-------------|-----------|----------------|
| **A. Calcul à la volée** | Une seule source de vérité : **endurance_mer_import_results**. Pour le classement, on lit cette table, on applique barème + pondération + plafonds, on trie et on renvoie. | Pas de duplication, classement toujours cohérent. Idéal si le classement change souvent. | Un peu plus de logique côté lecture (agrégation, plafonds). |
| **B. Stockage RankingPoint + ClubRanking** | Après chaque import, on remplit **RankingPoint** et **ClubRanking** avec `ranking_type = 'endurance_mer'`. | Même API que l'indoor, requêtes simples. | Données dupliquées ; en re-import ou changement de règles, il faut recalculer et resynchroniser. |

**Recommandation** : privilégier le **calcul à la volée** à partir de `endurance_mer_import_results`. Le classement par club est calculé à l’affichage (ou via un endpoint qui agrège depuis cette table). Un cache (ClubRanking) pourra être ajouté plus tard si besoin.

### 3.3 ScoringTemplate (barèmes uniquement)

Les **règles** (barèmes) restent en BDD : un **ScoringTemplate** de type `endurance_mer` avec un `config` JSON (tableaux ENDURO, BRS, Championnats de France, pondération) centralise les règles. Les points calculés ne vivent que dans `endurance_mer_import_results` et sont agrégés à la volée.

### 3.4 Lien avec les tables existantes

- **`event_id`** : doit correspondre à un enregistrement de `events` (événement déjà créé dans le logiciel de chronométrage).
- **Catégories / épreuves** : le champ `epreuve_code` peut être utilisé pour faire le lien avec `categories.code` si les codes sont alignés (sinon, un mapping code fichier → `category_id` peut être ajouté).
- **Clubs** : `club_code` peut être relié à `clubs.code` ; `club_name` pour affichage.

**Extension des ENUM existants** : pour utiliser le même flux que l’indoor, ajouter la valeur `endurance_mer` (ou `enduro_brs`) dans `ScoringTemplate.type` et dans `ClubRanking.ranking_type`. Si le schéma actuel n’accepte que `indoor_points`, `defis_capitaux`, `custom`, il faudra une migration pour ajouter ce type.

---

## 4. Règles de calcul des points (réglementation 2026)

Les points sont calculés **après chaque épreuve**, arrondis au **centième**, puis cumulés. Les règles ci‑dessous servent à calculer `points_attributed` (et éventuellement à alimenter un classement clubs).

### 4.1 Pondération selon le nombre de partants

- **Moins de 7 partants** : **75 %** des points sont attribués.
- **À partir de 7 partants** : **100 %** des points.

À appliquer après lecture du barème (place → points bruts), puis multiplication par 0,75 ou 1.

### 4.2 Barème ENDURO – Régates aviron de mer

Points par **place** selon le **type d’épreuve** (1x, 2x, 4x+/+ Senior, 2x U19, 4x+/+ U17 et U19) :

| Place | 1x | 2x | 4x+/+ Senior | 2x U19 | 4x+/+ U17 et U19 |
|-------|-----|-----|--------------|--------|------------------|
| 1     | 30  | 45  | 67,5         | 90     | 90               |
| 2     | 24  | 36  | 54           | 72     | 72               |
| 3     | 18  | 27  | 40,5         | 54     | 54               |
| 4     | 13,5| 20,25| 30          | 40     | 40               |
| 5     | 9   | 13,5| 20,25        | 27     | 27               |
| 6     | 6   | 9   | 13,5         | 18     | 18               |
| 7     | 3   | 4,5 | 6,75         | 9      | 9                |
| 8     | 1,5 | 2,25| 3,375        | 4,5    | 4,5              |
| 9     | 1,5 | 2,25| 3,375        | 4,5    | 4,5              |
| 10    | 1,5 | 2,25| 3,375        | 4,5    | 4,5              |
| 11 et + | 0,75| 1,5 | 2,25         | 3      | 3                |

**Règle ENDURO – Plafond par épreuve et par club** : sur chaque épreuve de la régate, seuls les **deux équipages** du club ayant rapporté le **plus de points** comptent pour le cumul. Les équipages mixtes U17 sont pris en compte pour ce plafond.

### 4.3 Barème Beach Rowing Sprint (BRS)

| Place | Épreuves U19 (1x) | Épreuves U19 (2x et 2xMix) | Épreuves Senior (1x, 2xMix ou 4x+Mix) |
|-------|-------------------|----------------------------|----------------------------------------|
| 1     | 60                | 80                         | 60                                     |
| 2     | 48                | 60                         | 48                                     |
| 3     | 36                | 48                         | 36                                     |
| 4     | 27                | 36                         | 27                                     |
| 5     | 18                | 27                         | 18                                     |
| 6     | 12                | 18                         | 12                                     |
| 7     | 6                 | 12                         | 6                                      |
| 8     | 3                 | 6                          | 3                                      |
| 9     | 3                 | 3                          | 3                                      |
| 10    | 3                 | 3                          | 3                                      |
| 11 et + | 0               | 0                          | 0                                      |

**Règle BRS – Plafond** : sur chaque épreuve, le cumul par club est limité aux points des **deux équipages juniors** et des **deux équipages seniors** rapportant le plus de points.

### 4.4 Équipages mixtes de clubs

- **Autorisés** : les équipages mixtes de clubs peuvent courir et être classés.
- **Points** : seuls les équipages mixtes **U17** avec **au maximum deux clubs** (en incluant le barreur le cas échéant) rapportent des points.
- **Répartition** : les points sont répartis **au prorata** entre les deux clubs constituant l’équipage (ex. 50 % / 50 % si deux clubs à part égale).

Pour une ligne importée avec `is_mixed_clubs = true` et `club_codes_mixed` renseigné, le calcul devra répartir `points_attributed` entre les clubs listés.

### 4.5 Championnat territorial d’aviron de mer

- Le **club vainqueur** du championnat territorial obtient un **bonus de 67,5 points**.
- Un club vainqueur de **plusieurs** championnats territoriaux ne bénéficie du bonus **qu’une seule fois** dans le classement mer des clubs.

### 4.6 Championnats de France (aviron de mer et BRS)

Barème par place et par type d’épreuve (les épreuves masters sont dissociées du classement Senior) :

| Place | 1x U19 | 1x Senior | 2x U19 | 2x Senior | 4x+ U17 et U19 | 4x+ et 4+ Senior |
|-------|--------|-----------|--------|-----------|----------------|-------------------|
| 1     | 75     | 50        | 100    | 75        | 150            | 112,5             |
| 2     | 63     | 42        | 90     | 63        | 126            | 94,5              |
| 3     | 54     | 36        | 75     | 54        | 108            | 81                |
| 4     | 45     | 30        | 63     | 45        | 90             | 67,5              |
| 5     | 39     | 26        | 54     | 39        | 78             | 58,5              |
| 6     | 33     | 22        | 45     | 33        | 66             | 49,5              |
| 7     | 27     | 18        | 39     | 27        | 54             | 40,5              |
| 8     | 22,5   | 14        | 33     | 22,5      | 45             | 33,8              |
| 9     | 18     | 12        | 27     | 18        | 36             | 27                |
| 10    | 15     | 10        | 22,5   | 15        | 30             | 22,5              |
| 11    | 13,5   | 9         | 18     | 13,5      | 27             | 20,3              |
| 12    | 12     | 8         | 15     | 12        | 24             | 18                |
| 13    | 10,5   | 7         | 13,5   | 10,5      | 21             | 15,8              |
| 14    | 9      | 6         | 12     | 9         | 18             | 13,5              |
| 15    | 7,5    | 5         | 10,5   | 7,5       | 15             | 11,3              |
| 16    | 6      | 4         | 9      | 6         | 12             | 9                 |
| 17    | 4,5    | 3         | 7,5    | 4,5       | 9              | 6,8               |
| 18    | 3      | 2         | 5      | 3         | 6              | 4,5               |
| 19    | 1,5    | 1         | 1      | 1,5       | 3              | 2,3               |
| 20 et + | 1,5   | 1         | 1      | 1,5       | 3              | 2,3               |

Référence : tableau « Championnats – Points attribués » du règlement 2026.

---

## 5. Répartition des rôles (qui fait quoi)

| Étape | Rôle | Description |
|-------|------|-------------|
| 1. Fichier Excel | Organisateur / FFAviron | Un fichier par régate (un par événement). |
| 2. Création événement | Logiciel chrono | L’événement existe déjà dans `events` (créé à l’avance ou via import manifestation). |
| 3. Import fichier | Logiciel chrono | Upload du fichier, parsing, vérification `event_id`. |
| 4. Enregistrement | Logiciel chrono | Insertion des lignes dans `endurance_mer_import_results` avec `event_id`. |
| 5. Calcul des points | Logiciel chrono (optionnel à l’import) | Application du bon barème (ENDURO / BRS) selon le type d’épreuve, pondération &lt; 7 partants, répartition mixte, puis éventuellement plafond 2 équipages par club par épreuve. |
| 6. Consultation | API / Front | Récupération des résultats par `event_id` (par épreuve, par club, etc.). |

---

## 6. Mapping épreuve fichier → barème (format + niveau)

Pour appliquer le bon barème (ENDURO 1x, 2x, 4x+… ou BRS U19 1x, U19 2x, Senior…), il faut déduire le **type d’épreuve** à partir du fichier (ex. colonne « Code épreuve » ou « Libellé épreuve »).

- **ENDURO** : 1x, 2x, 4x+/+ Senior ; 2x U19 ; 4x+/+ U17 et U19.  
  Exemples de codes : `SM1x`, `SM2x`, `U19M2x`, `U17F4x+`, etc.
- **BRS** : U19 (1x), U19 (2x, 2xMix), Senior (1x, 2xMix, 4x+Mix).  
  Mapping à définir selon les libellés/codes du fichier (ex. `BRS_U19_1x`, `BRS_Senior_4x+`).

Selon le couple (niveau, format), on applique le tableau correspondant (ENDURO territorial, BRS territorial, Championnats de France ENDURO/BRS). Un mapping **event_level + event_format + code_epreuve → colonne barème** peut être utilisé pour remplir les points et les champs `event_format` / `event_level`.

---

## 7. Workflow d’import suggéré (API)

1. **Vérifier l’événement**  
   `GET /events/:id` ou équivalent pour s’assurer que `event_id` existe.

2. **Upload du fichier**  
   `POST /events/:eventId/import-results` (ou `/events/:eventId/endurance-mer/import`) avec le fichier Excel en multipart.  
   - Option : envoyer aussi `replace_previous = true` pour supprimer / désactiver les résultats du précédent import pour cet événement.

3. **Traitement côté serveur**  
   - Lire le fichier (ex. librairie `xlsx` déjà utilisée dans le projet).  
   - Détecter la feuille et les colonnes (mapping configurable ou détection par en-tête).  
   - Pour chaque ligne : valider (place, club, épreuve), calculer les points (barème + pondération), répartition si mixte.  
   - Insérer dans `endurance_mer_import_results` avec `event_id` et éventuellement `import_batch_id`.

4. **Réponse**  
   Retourner un résumé : nombre de lignes importées, nombre d’épreuves, erreurs éventuelles (lignes ignorées, doublons, etc.).

5. **Récupération des résultats**  
   - `GET /events/:eventId/imported-results` : liste des résultats de l’événement (filtres possibles : par `epreuve_code`, par `club_code`).  
   - Option : `GET /events/:eventId/imported-results/summary` : agrégation par club (total points après plafond) pour affichage classement.

---

## 8. Fichier Excel – À valider avec le modèle officiel

La structure exacte du fichier **« Remontée résultats régates »** (colonnes, noms de feuilles, cas des équipages mixtes, nombre de partants par épreuve) doit être validée sur le fichier fourni par la FFAviron (ex. « Régates aviron La Rochelle »). Dès que le fichier réel est disponible dans le projet :

1. Lister les **noms des colonnes** et les **feuilles**.
2. Adapter le **mapping** dans le code d’import (ou un fichier de config).
3. Vérifier comment sont indiqués : **équipage mixte**, **clubs**, **nombre de partants** (par épreuve), **type d’épreuve** (ENDURO 1x/2x/4x+ ou BRS U19/Senior).

---

## 9. Résumé des points à implémenter

- **Table** : `endurance_mer_import_results` (ou nom choisi) avec au minimum `event_id`, épreuve, place, club(s), temps, points, type de points.
- **Import** : une route d’upload par événement, parsing Excel, remplissage de la table (+ option remplacement).
- **Règles** : pondération 75 % si &lt; 7 partants ; barèmes ENDURO et BRS ; répartition prorata équipages mixtes U17 (max 2 clubs) ; plafond 2 équipages par club et par épreuve (ENDURO) ; 2 juniors + 2 seniors (BRS).
- **API lecture** : récupération des résultats par `event_id`, avec filtres et option agrégation par club pour le classement mer.

Cette doc peut servir de base pour le développement du module d’import et du calcul des points sans modifier le cœur du chronométrage ; une fois une solution native en place, la table dédiée pourra être conservée pour l’historique ou migrée selon le nouveau modèle.

---

## 10. Implémentation (référence technique)

Le module d’import et le classement à la volée sont en place. Voir le guide technique et API : **docs/API_ENDURANCE_MER_IMPORT.md**.

- Migration : `docs/migrations/009_create_endurance_mer_import_results.sql`
- Endpoints : `POST /events/:eventId/endurance-mer/import`, `GET /events/:eventId/endurance-mer/import-results`, `GET /events/:eventId/endurance-mer/ranking`
- Classement : calculé à la volée depuis `endurance_mer_import_results` (plafond 2 équipages par épreuve par club).

---

## Annexe A – Exemple de migration SQL (table résultats importés)

Le fichier de migration est créé : `docs/migrations/009_create_endurance_mer_import_results.sql`. Contenu type :

```sql
-- Table dédiée aux résultats importés par fichier Excel (1 fichier = 1 événement)
CREATE TABLE IF NOT EXISTS endurance_mer_import_results (
  id CHAR(36) NOT NULL PRIMARY KEY,
  event_id CHAR(36) NOT NULL,
  epreuve_code VARCHAR(100) DEFAULT NULL,
  epreuve_libelle VARCHAR(255) DEFAULT NULL,
  place INT NOT NULL,
  club_code VARCHAR(50) DEFAULT NULL,
  club_name VARCHAR(150) DEFAULT NULL,
  crew_name VARCHAR(255) DEFAULT NULL,
  time_raw VARCHAR(50) DEFAULT NULL,
  time_seconds INT DEFAULT NULL,
  is_mixed_clubs TINYINT(1) DEFAULT 0,
  club_codes_mixed VARCHAR(255) DEFAULT NULL,
  points_attributed DECIMAL(10,2) DEFAULT NULL,
  event_format VARCHAR(20) DEFAULT NULL COMMENT 'enduro | brs',
  event_level VARCHAR(50) DEFAULT NULL COMMENT 'territorial | championnat_france (challenge/championnat peut être enduro ou brs)',
  partants_count INT DEFAULT NULL,
  import_batch_id CHAR(36) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_event_id (event_id),
  INDEX idx_event_epreuve (event_id, epreuve_code),
  INDEX idx_event_club (event_id, club_code),
  INDEX idx_import_batch (import_batch_id),
  CONSTRAINT fk_emir_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Résultats remontés par fichier Excel (1 fichier par événement) – Aviron mer ENDURO/BRS 2026';
```

---

## Annexe B – Cumul classement mer des clubs (rappel règlement)

Le classement mer des clubs est établi à partir du cumul des points :

- Régates d’aviron de mer (enduro + beach rowing sprint) du championnat territorial ;
- Bonus victoire championnat territorial (67,5 points, une seule fois par club) ;
- Classement sur les Championnats de France (aviron de mer, BRS), Critériums nationaux ;
- Sélections en Beach Rowing Sprint.

Règles de cumul pour les clubs :

- **ENDURO** : 4 régates enduro au plus (celles rapportant le plus de points) + 1 compétition BRS (2 épreuves seniors + 2 épreuves juniors au plus). Un challenge territorial ou un championnat de France peut être enduro ou BRS ; le barème appliqué est celui du niveau (territorial vs France) pour le format concerné.
- **Masters** : catégories dissociées des classements seniors ; points calculés sur les mêmes barèmes mais dans un classement dédié.
