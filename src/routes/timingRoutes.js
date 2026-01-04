const express = require("express");
const router = express.Router();
const controller = require("../controllers/timingController");
const timingPointAuth = require("../middlewares/timingPointAuthMiddleware");

router.get("/", controller.getTimings);
router.post("/", timingPointAuth, controller.createTiming);
// Routes spécifiques avant les routes génériques
router.get("/event/:event_id", controller.getTimingsByEvent);
router.get("/race/:race_id", controller.getTimingsByRace);
// Routes génériques après les routes spécifiques
router.get("/:id", controller.getTiming);
router.put("/:id", timingPointAuth, controller.updateTiming);
router.delete("/:id", timingPointAuth, controller.deleteTiming);

module.exports = router;
