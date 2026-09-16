-- Classement annuel « 7 défis capitaux » : tableau final importé (Excel),
-- puis conversion rang → points via le template `defis_capitaux`.
CREATE TABLE IF NOT EXISTS defis_capitaux_season_rankings (
  id CHAR(36) NOT NULL PRIMARY KEY,
  season VARCHAR(20) NOT NULL,
  imported_rank INT NOT NULL,
  club_code VARCHAR(50) DEFAULT NULL,
  club_name VARCHAR(255) NOT NULL,
  points DECIMAL(10,2) NOT NULL DEFAULT 0,
  club_matched TINYINT(1) NOT NULL DEFAULT 0,
  source_filename VARCHAR(255) DEFAULT NULL,
  import_batch_id CHAR(36) NOT NULL,
  imported_by CHAR(36) DEFAULT NULL,
  imported_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_defis_season (season),
  INDEX idx_defis_batch (import_batch_id),
  INDEX idx_defis_club (season, club_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Classement annuel 7 défis capitaux (tableau final importé)';
