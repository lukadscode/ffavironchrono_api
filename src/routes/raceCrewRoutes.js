const express = require("express");
const router = express.Router();
const controller = require("../controllers/raceCrewController");
const auth = require("../middlewares/authMiddleware");
const flexibleAuth = require("../middlewares/flexibleAuthMiddleware");
const { requireEventRole, resolvers } = require("../middlewares/requireEventRole");
const validate = require("../middlewares/validateSchema");
const schema = require("../schemas/raceCrewSchema");

router.post(
  "/",
  auth,
  requireEventRole({ roles: ["editor"], getEventId: resolvers.eventIdFromRaceBody("race_id") }),
  validate(schema.createSchema),
  controller.assignCrewToRace
);
router.get(
  "/:race_id",
  auth,
  requireEventRole({ roles: ["viewer"], getEventId: resolvers.eventIdFromRaceIdParam("race_id") }),
  controller.getRaceCrews
);
router.delete(
  "/:id",
  auth,
  requireEventRole({ roles: ["editor"], getEventId: resolvers.eventIdFromRaceCrewIdParam("id") }),
  controller.removeRaceCrew
);
router.patch(
  "/:id/adjustment",
  auth,
  requireEventRole({ roles: ["referee", "editor"], getEventId: resolvers.eventIdFromRaceCrewIdParam("id") }),
  validate(schema.adjustmentSchema),
  controller.updateAdjustment
);
// Statut rapide DNS/DNF/DSQ : accessible aussi aux postes de chronométrage (mobile),
// pour donner de la liberté au chronométreur terrain sans compte utilisateur.
router.patch(
  "/:id/status",
  flexibleAuth,
  requireEventRole({
    roles: ["referee", "timing", "editor"],
    allowTimingPointToken: true,
    getEventId: resolvers.eventIdFromRaceCrewIdParam("id"),
  }),
  validate(schema.statusSchema),
  controller.updateStatus
);

module.exports = router;
