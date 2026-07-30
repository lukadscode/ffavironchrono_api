/**
 * Exécute la migration 018 (timing_profiles + support batch idempotent).
 * Tolère les colonnes/tables déjà existantes (ré-exécution sans danger).
 *
 * Usage : à la racine du projet : node scripts/run-migration-018.js
 */
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const sequelize = require("../src/models/index");

const migrationPath = path.join(
  __dirname,
  "..",
  "docs",
  "migrations",
  "018_add_timing_profiles_and_batch_support.sql"
);

async function run() {
  const sql = fs
    .readFileSync(migrationPath, "utf8")
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  try {
    await sequelize.authenticate();
    console.log("Connexion à la base OK.");
    for (const statement of statements) {
      try {
        await sequelize.query(statement);
        console.log("OK:", statement.slice(0, 80).replace(/\s+/g, " "));
      } catch (err) {
        if (/duplicate column|already exists|Duplicate key name/i.test(err.message)) {
          console.log("Ignoré (déjà appliqué):", err.message);
        } else {
          throw err;
        }
      }
    }
    console.log("Migration 018 terminée avec succès.");
  } catch (err) {
    console.error("Erreur migration 018:", err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

run();
