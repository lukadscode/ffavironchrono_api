const express = require("express");
const router = express.Router();
const controller = require("../controllers/racePhaseController");
const auth = require("../middlewares/authMiddleware");
const { requireEventRole, resolvers } = require("../middlewares/requireEventRole");
const validate = require("../middlewares/validateSchema");
const schema = require("../schemas/racePhaseSchema");

router.post(
  "/",
  auth,
  requireEventRole({ roles: ["editor"], getEventId: resolvers.eventIdFromBody("event_id") }),
  validate(schema.createSchema),
  controller.createRacePhase
);
router.get("/:event_id", controller.getRacePhasesByEvent);
router.get("/:id/results", controller.getPhaseResults);
router.get("/:id/races-with-crews", controller.getRacesWithCrewsByPhase);
router.get(
  "/:id/generation-schema",
  auth,
  requireEventRole({
    roles: ["viewer"],
    getEventId: resolvers.eventIdFromRacePhaseIdParam("id"),
  }),
  controller.getGenerationSchema
);
router.post(
  "/:id/generate-from-schema",
  auth,
  requireEventRole({
    roles: ["editor"],
    getEventId: resolvers.eventIdFromRacePhaseIdParam("id"),
  }),
  controller.generateFromSavedSchema
);
router.put(
  "/:id",
  auth,
  requireEventRole({
    roles: ["editor"],
    getEventId: resolvers.eventIdFromRacePhaseIdParam("id"),
  }),
  validate(schema.updateSchema),
  controller.updateRacePhase
);
router.put(
  "/:id/generation-schema",
  auth,
  requireEventRole({
    roles: ["editor"],
    getEventId: resolvers.eventIdFromRacePhaseIdParam("id"),
  }),
  validate(require("../schemas/generateRacesSchema").updateGenerationSchemaSchema),
  controller.updateGenerationSchema
);
router.delete(
  "/:id",
  auth,
  requireEventRole({
    roles: ["editor"],
    getEventId: resolvers.eventIdFromRacePhaseIdParam("id"),
  }),
  controller.deleteRacePhase
);

module.exports = router;
