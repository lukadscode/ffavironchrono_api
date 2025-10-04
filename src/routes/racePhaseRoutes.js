const express = require("express");
const router = express.Router();
const controller = require("../controllers/racePhaseController");
const auth = require("../middlewares/authMiddleware");
const validate = require("../middlewares/validateSchema");
const schema = require("../Schemas/racePhaseSchema");

router.post(
  "/",
  auth,
  validate(schema.createSchema),
  controller.createRacePhase
);
router.get("/:event_id", controller.getRacePhasesByEvent);
router.get("/:id/results", controller.getPhaseResults);
router.put(
  "/:id",
  auth,
  validate(schema.updateSchema),
  controller.updateRacePhase
);
router.delete("/:id", auth, controller.deleteRacePhase);

module.exports = router;
