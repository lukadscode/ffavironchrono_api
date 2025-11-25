const express = require("express");
const router = express.Router();
const controller = require("../controllers/rankingController");
const auth = require("../middlewares/authMiddleware");
const validate = require("../middlewares/validateSchema");

// Routes pour les classements
router.get(
  "/event/:event_id/ranking",
  auth,
  controller.getClubRanking
);
router.get(
  "/event/:event_id/club/:club_name/points",
  auth,
  controller.getClubPoints
);
router.post(
  "/event/:event_id/recalculate",
  auth,
  validate(require("../schemas/rankingSchema").recalculateRanksSchema),
  controller.recalculateRanks
);

// Routes pour les points
router.post(
  "/race/:race_id/calculate-points",
  auth,
  controller.calculatePointsForRace
);

// Routes pour les templates
router.get("/templates", auth, controller.getScoringTemplates);
router.post(
  "/templates",
  auth,
  validate(require("../schemas/rankingSchema").createScoringTemplateSchema),
  controller.createScoringTemplate
);

module.exports = router;

