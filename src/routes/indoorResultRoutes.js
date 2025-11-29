const express = require("express");
const router = express.Router();
const controller = require("../controllers/indoorResultController");
const auth = require("../middlewares/authMiddleware");
const validate = require("../middlewares/validateSchema");
const schema = require("../schemas/indoorResultSchema");

// Import des résultats depuis ErgRace
router.post(
  "/import",
  auth,
  validate(schema.importSchema),
  controller.importResults
);

// Récupérer les résultats d'une course
router.get("/race/:race_id", auth, controller.getRaceResults);

// Récupérer tous les résultats d'un événement
router.get("/event/:event_id", auth, controller.getEventResults);

module.exports = router;

