const express = require("express");
const router = express.Router();
const controller = require("../controllers/timingController");
const flexibleAuth = require("../middlewares/flexibleAuthMiddleware");

router.get("/", controller.getTimings);
router.post("/", flexibleAuth, controller.createTiming);
// Routes spécifiques avant les routes génériques
router.get("/event/:event_id", controller.getTimingsByEvent);
router.get("/race/:race_id", controller.getTimingsByRace);
// Routes génériques après les routes spécifiques
router.get("/:id", controller.getTiming);
router.put("/:id", flexibleAuth, controller.updateTiming);
router.delete("/:id", flexibleAuth, controller.deleteTiming);

module.exports = router;
