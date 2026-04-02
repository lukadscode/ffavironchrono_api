/**
 * Exécute la migration 009 (table endurance_mer_import_results).
 * Utilise les variables d'environnement du .env (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME).
 *
 * Usage : à la racine du projet : node scripts/run-migration-009.js
 */
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const sequelize = require("../src/models/index");

const migrationPath = path.join(__dirname, "..", "docs", "migrations", "009_create_endurance_mer_import_results.sql");

async function run() {
  const sql = fs.readFileSync(migrationPath, "utf8");
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  try {
    await sequelize.authenticate();
    console.log("Connexion à la base OK.");
    for (const statement of statements) {
      if (statement) {
        await sequelize.query(statement);
        console.log("Requête exécutée.");
      }
    }
    console.log("Migration 009 terminée avec succès.");
  } catch (err) {
    console.error("Erreur migration 009:", err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

run();
