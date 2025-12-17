const express = require("express");
const router = express.Router();
const controller = require("../controllers/indoorResultController");
const auth = require("../middlewares/authMiddleware");
const optionalAuth = require("../middlewares/optionalAuthMiddleware");
const validate = require("../middlewares/validateSchema");
const schema = require("../schemas/indoorResultSchema");

// Import des résultats depuis ErgRace
router.post(
  "/import",
  auth,
  validate(schema.importSchema),
  controller.importResults
);

// Création / mise à jour d'un résultat indoor manuel pour une course
router.post(
  "/race/:raceId/manual",
  auth,
  validate(schema.manualResultSchema),
  controller.createOrUpdateManualResult
);

// Récupérer les résultats d'une course (accès public si course "non_official" ou "official")
router.get("/race/:race_id", optionalAuth, controller.getRaceResults);

// Récupérer tous les résultats d'un événement
router.get("/event/:event_id", auth, controller.getEventResults);

// Récupérer tous les résultats d'un événement groupés par catégorie
router.get("/event/:event_id/bycategorie", auth, controller.getEventResultsByCategory);

module.exports = router;

