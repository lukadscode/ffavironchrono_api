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

// Récupérer les résultats d'une course (accès public si course "non_official" ou "official")
router.get("/race/:race_id", optionalAuth, controller.getRaceResults);

// Récupérer tous les résultats d'un événement
router.get("/event/:event_id", auth, controller.getEventResults);

module.exports = router;

