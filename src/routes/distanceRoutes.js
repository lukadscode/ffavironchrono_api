const express = require("express");
const router = express.Router();
const controller = require("../controllers/distanceController");
const auth = require("../middlewares/authMiddleware");
const requireAdmin = require("../middlewares/requireAdmin");
const { requireEventRole, resolvers } = require("../middlewares/requireEventRole");
const validate = require("../middlewares/validateSchema");
const schema = require("../schemas/distanceSchema");

router.get("/", controller.getDistances);
router.post(
  "/",
  auth,
  requireAdmin,
  validate(schema.createSchema),
  controller.createDistance
);
router.get(
  "/event/:event_id",
  auth,
  requireEventRole({ roles: ["viewer"], getEventId: resolvers.eventIdFromParams("event_id") }),
  controller.getDistancesByEvent
);
router.delete("/:id", auth, requireAdmin, controller.deleteDistance);

module.exports = router;
