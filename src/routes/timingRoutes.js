const express = require("express");
const router = express.Router();
const controller = require("../controllers/timingController");
const flexibleAuth = require("../middlewares/flexibleAuthMiddleware");
const { requireEventRole, resolvers } = require("../middlewares/requireEventRole");
const TimingPoint = require("../models/TimingPoint");

router.get("/", controller.getTimings);
router.post(
  "/",
  flexibleAuth,
  requireEventRole({
    roles: ["timing"],
    allowTimingPointToken: true,
    getEventId: resolvers.eventIdFromTimingPointBody("timing_point_id"),
  }),
  controller.createTiming
);

// Synchronisation par lot (mobile hors-ligne, idempotente via client_read_id)
router.post(
  "/batch",
  flexibleAuth,
  requireEventRole({
    roles: ["timing"],
    allowTimingPointToken: true,
    getEventId: async (req) => {
      if (req.timingPoint?.event_id) return req.timingPoint.event_id;
      const firstPointId = req.body?.reads?.[0]?.timing_point_id;
      if (!firstPointId) return null;
      const point = await TimingPoint.findByPk(firstPointId);
      return point?.event_id ?? null;
    },
  }),
  controller.batchCreateTimings
);
// Routes spécifiques avant les routes génériques
router.get("/event/:event_id", controller.getTimingsByEvent);
router.get("/race/:race_id", controller.getTimingsByRace);
router.get(
  "/point/:timing_point_id/duplicates",
  flexibleAuth,
  requireEventRole({
    roles: ["timing", "referee"],
    getEventId: resolvers.eventIdFromTimingPointIdParam("timing_point_id"),
  }),
  controller.getDuplicatesByPoint
);
router.post(
  "/reconcile",
  flexibleAuth,
  requireEventRole({
    roles: ["timing", "referee"],
    getEventId: resolvers.eventIdFromTimingBody("keep_id"),
  }),
  controller.reconcileTimings
);
// Routes génériques après les routes spécifiques
router.get("/:id", controller.getTiming);
router.put(
  "/:id",
  flexibleAuth,
  requireEventRole({
    roles: ["timing"],
    allowTimingPointToken: true,
    getEventId: resolvers.eventIdFromTimingIdParam("id"),
  }),
  controller.updateTiming
);
router.delete(
  "/:id",
  flexibleAuth,
  requireEventRole({
    roles: ["timing"],
    allowTimingPointToken: true,
    getEventId: resolvers.eventIdFromTimingIdParam("id"),
  }),
  controller.deleteTiming
);

module.exports = router;
