const express = require("express");
const router = express.Router();
const controller = require("../controllers/timingController");

router.get("/", controller.getTimings);
router.post("/", controller.createTiming);
router.get("/:id", controller.getTiming);
router.get("/event/:event_id", controller.getTimingsByEvent);
router.put("/:id", controller.updateTiming);
router.delete("/:id", controller.deleteTiming);

module.exports = router;
