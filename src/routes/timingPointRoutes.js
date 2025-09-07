const express = require("express");
const router = express.Router();
const controller = require("../controllers/timingPointController");
const auth = require("../middlewares/authMiddleware");
const validate = require("../middlewares/validateSchema");
const schema = require("../Schemas/timingPointSchema");

router.post(
  "/",
  auth,
  validate(schema.createSchema),
  controller.createTimingPoint
);
router.get("/event/:event_id", controller.getTimingPointsByEvent);
router.put(
  "/:id",
  auth,
  validate(schema.updateSchema),
  controller.updateTimingPoint
);
router.delete("/:id", auth, controller.deleteTimingPoint);

module.exports = router;
