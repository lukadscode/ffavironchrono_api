const express = require("express");
const router = express.Router();
const controller = require("../controllers/racePhaseController");
const auth = require("../middlewares/authMiddleware");
const validate = require("../middlewares/validateSchema");
const schema = require("../schemas/racePhaseSchema");

router.post(
  "/",
  auth,
  validate(schema.createSchema),
  controller.createRacePhase
);
router.get("/:event_id", controller.getRacePhasesByEvent);
router.get("/:id/results", controller.getPhaseResults);
router.get(
  "/:id/generation-schema",
  auth,
  controller.getGenerationSchema
);
router.post(
  "/:id/generate-from-schema",
  auth,
  controller.generateFromSavedSchema
);
router.put(
  "/:id",
  auth,
  validate(schema.updateSchema),
  controller.updateRacePhase
);
router.put(
  "/:id/generation-schema",
  auth,
  validate(require("../schemas/generateRacesSchema").updateGenerationSchemaSchema),
  controller.updateGenerationSchema
);
router.delete("/:id", auth, controller.deleteRacePhase);

module.exports = router;
