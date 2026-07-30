const express = require("express");
const router = express.Router();
const controller = require("../controllers/timingPointController");
const auth = require("../middlewares/authMiddleware");
const { requireEventRole, resolvers } = require("../middlewares/requireEventRole");
const validate = require("../middlewares/validateSchema");
const schema = require("../schemas/timingPointSchema");
const rateLimit = require("express-rate-limit");

const resolveTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_RESOLVE_TOKEN_PER_15M || 60),
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.post(
  "/",
  auth,
  requireEventRole({ roles: ["editor"], getEventId: resolvers.eventIdFromBody("event_id") }),
  validate(schema.createSchema),
  controller.createTimingPoint
);
router.get(
  "/event/:event_id",
  auth,
  requireEventRole({ roles: ["viewer"], getEventId: resolvers.eventIdFromParams("event_id") }),
  controller.getTimingPointsByEvent
);
router.put(
  "/:id",
  auth,
  requireEventRole({
    roles: ["editor"],
    getEventId: resolvers.eventIdFromTimingPointIdParam("id"),
  }),
  validate(schema.updateSchema),
  controller.updateTimingPoint
);
router.delete(
  "/:id",
  auth,
  requireEventRole({
    roles: ["editor"],
    getEventId: resolvers.eventIdFromTimingPointIdParam("id"),
  }),
  controller.deleteTimingPoint
);

module.exports = router;
