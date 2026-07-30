const express = require("express");
const router = express.Router();
const controller = require("../controllers/eventCategoryController");
const auth = require("../middlewares/authMiddleware");
const { requireEventRole, resolvers } = require("../middlewares/requireEventRole");
const validate = require("../middlewares/validateSchema");
const schema = require("../schemas/eventCategorySchema");

router.post(
  "/",
  auth,
  requireEventRole({ roles: ["editor"], getEventId: resolvers.eventIdFromBody("event_id") }),
  validate(schema.linkSchema),
  controller.linkCategoryToEvent
);
router.get(
  "/:event_id",
  auth,
  requireEventRole({ roles: ["viewer"], getEventId: resolvers.eventIdFromParams("event_id") }),
  controller.getCategoriesByEvent
);
router.delete(
  "/:id",
  auth,
  requireEventRole({ roles: ["editor"], getEventId: resolvers.eventIdFromEventCategoryIdParam("id") }),
  controller.unlinkCategoryFromEvent
);

module.exports = router;
