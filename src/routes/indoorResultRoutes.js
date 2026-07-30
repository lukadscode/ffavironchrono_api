const express = require("express");
const router = express.Router();
const controller = require("../controllers/indoorResultController");
const auth = require("../middlewares/authMiddleware");
const optionalAuth = require("../middlewares/optionalAuthMiddleware");
const { requireEventRole, resolvers } = require("../middlewares/requireEventRole");
const validate = require("../middlewares/validateSchema");
const schema = require("../schemas/indoorResultSchema");
const Race = require("../models/Race");
const RacePhase = require("../models/RacePhase");

// Import des résultats depuis ErgRace
router.post(
  "/import",
  auth,
  requireEventRole({
    roles: ["editor"],
    // ErgRace payload contient la course de notre plateforme dans results.c2_race_id
    getEventId: async (req) => {
      const raceId = req.body?.results?.c2_race_id;
      if (!raceId) return null;
      const race = await Race.findByPk(raceId);
      if (!race) return null;
      const phase = await RacePhase.findByPk(race.phase_id);
      return phase?.event_id ?? null;
    },
  }),
  validate(schema.importSchema),
  controller.importResults
);

// Création / mise à jour d'un résultat indoor manuel pour une course
router.post(
  "/race/:raceId/manual",
  auth,
  requireEventRole({
    roles: ["referee"],
    getEventId: resolvers.eventIdFromRaceIdParam("raceId"),
  }),
  validate(schema.manualResultSchema),
  controller.createOrUpdateManualResult
);

// Récupérer les résultats d'une course (accès public si course "non_official" ou "official")
router.get("/race/:race_id", optionalAuth, controller.getRaceResults);

// Récupérer tous les résultats d'un événement
router.get(
  "/event/:event_id",
  auth,
  requireEventRole({
    roles: ["viewer"],
    getEventId: resolvers.eventIdFromParams("event_id"),
  }),
  controller.getEventResults
);

// Récupérer tous les résultats d'un événement groupés par catégorie
router.get(
  "/event/:event_id/bycategorie",
  auth,
  requireEventRole({
    roles: ["viewer"],
    getEventId: resolvers.eventIdFromParams("event_id"),
  }),
  controller.getEventResultsByCategory
);

module.exports = router;

