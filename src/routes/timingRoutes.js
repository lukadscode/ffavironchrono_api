const express = require("express");
const router = express.Router();
const controller = require("../controllers/timingController");

router.get("/", controller.getTimings);
router.post("/", controller.createTiming);
// Routes spécifiques avant les routes génériques
router.get("/event/:event_id", controller.getTimingsByEvent);
router.get("/race/:race_id", controller.getTimingsByRace);
// Routes génériques après les routes spécifiques
router.get("/:id", controller.getTiming);
router.put("/:id", controller.updateTiming);
router.delete("/:id", controller.deleteTiming);

module.exports = router;
