const express = require("express");
const router = express.Router();
const controller = require("../controllers/rankingController");
const auth = require("../middlewares/authMiddleware");
const requireAdmin = require("../middlewares/requireAdmin");
const { requireEventRole, resolvers } = require("../middlewares/requireEventRole");
const validate = require("../middlewares/validateSchema");

// Routes pour les classements
router.get("/clubs/dashboard", controller.getClubsDashboard);
router.get(
  "/indoor/season/:season",
  auth,
  controller.getSeasonIndoorClubRanking
);
router.get(
  "/event/:event_id/ranking",
  auth,
  requireEventRole({ roles: ["viewer"], getEventId: resolvers.eventIdFromParams("event_id") }),
  controller.getClubRanking
);
router.get(
  "/event/:event_id/club/:club_name/points",
  auth,
  requireEventRole({ roles: ["viewer"], getEventId: resolvers.eventIdFromParams("event_id") }),
  controller.getClubPoints
);
router.get(
  "/clubs/by-type/:event_type",
  auth,
  controller.getClubRankingsByEventType
);
router.post(
  "/event/:event_id/recalculate",
  auth,
  requireEventRole({ roles: ["editor"], getEventId: resolvers.eventIdFromParams("event_id") }),
  validate(require("../schemas/rankingSchema").recalculateRanksSchema),
  controller.recalculateRanks
);

// Routes pour les points
router.post(
  "/race/:race_id/calculate-points",
  auth,
  requireEventRole({ roles: ["referee"], getEventId: resolvers.eventIdFromRaceIdParam("race_id") }),
  controller.calculatePointsForRace
);

// Routes pour les templates
router.get("/templates", auth, controller.getScoringTemplates);
router.post(
  "/templates",
  auth,
  requireAdmin,
  validate(require("../schemas/rankingSchema").createScoringTemplateSchema),
  controller.createScoringTemplate
);

module.exports = router;

