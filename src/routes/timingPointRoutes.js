const express = require("express");
const router = express.Router();
const controller = require("../controllers/timingPointController");
const auth = require("../middlewares/authMiddleware");
const validate = require("../middlewares/validateSchema");
const schema = require("../schemas/timingPointSchema");

router.post(
  "/",
  auth,
  validate(schema.createSchema),
  controller.createTimingPoint
);
router.get("/event/:event_id", controller.getTimingPointsByEvent);
router.post(
  "/resolve-token",
  validate(schema.resolveTokenSchema),
  controller.resolveToken
);
router.put(
  "/:id",
  auth,
  validate(schema.updateSchema),
  controller.updateTimingPoint
);
router.delete("/:id", auth, controller.deleteTimingPoint);

module.exports = router;
