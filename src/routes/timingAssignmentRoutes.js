const express = require("express");
const router = express.Router();
const controller = require("../controllers/timingAssignmentController");
const auth = require("../middlewares/authMiddleware");
const flexibleAuth = require("../middlewares/flexibleAuthMiddleware");
const { requireEventRole, resolvers } = require("../middlewares/requireEventRole");
const validate = require("../middlewares/validateSchema");
const schema = require("../schemas/timingAssignmentSchema");

router.post(
  "/",
  flexibleAuth,
  // event_id via timing_id du body -> timing -> timing_point -> event
  requireEventRole({
    roles: ["timing"],
    allowTimingPointToken: true,
    getEventId: resolvers.eventIdFromTimingBody("timing_id"),
  }),
  validate(schema.assignSchema),
  controller.assignTiming
);
router.put(
  "/:id",
  flexibleAuth,
  requireEventRole({
    roles: ["timing"],
    allowTimingPointToken: true,
    getEventId: resolvers.eventIdFromTimingAssignmentIdParam("id"),
  }),
  validate(schema.assignSchema),
  controller.updateAssignment
);
router.get("/crew/:crew_id", controller.getAssignmentsByCrew);
router.get("/event/:event_id", controller.getAssignmentsByEvent);
router.get("/race/:race_id", controller.getAssignmentsByRace);
router.delete(
  "/:id",
  flexibleAuth,
  requireEventRole({
    roles: ["timing"],
    allowTimingPointToken: true,
    getEventId: resolvers.eventIdFromTimingAssignmentIdParam("id"),
  }),
  controller.deleteAssignment
);

module.exports = router;
