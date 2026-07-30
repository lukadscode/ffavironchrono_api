const express = require("express");
const router = express.Router();
const controller = require("../controllers/userEventController");
const auth = require("../middlewares/authMiddleware");
const { requireEventRole, resolvers } = require("../middlewares/requireEventRole");
const validate = require("../middlewares/validateSchema");
const schema = require("../schemas/userEventSchema");

router.post(
  "/",
  auth,
  requireEventRole({
    roles: ["organiser"],
    getEventId: resolvers.eventIdFromBody("event_id"),
  }),
  validate(schema.addUserToEventSchema),
  controller.addUserToEvent
);
router.delete(
  "/:id",
  auth,
  requireEventRole({
    roles: ["organiser"],
    getEventId: resolvers.eventIdFromUserEventIdParam("id"),
  }),
  controller.removeUserFromEvent
);
router.get(
  "/event/:event_id",
  auth,
  requireEventRole({
    roles: ["viewer"],
    getEventId: resolvers.eventIdFromParams("event_id"),
  }),
  controller.listEventUsers
);

module.exports = router;
