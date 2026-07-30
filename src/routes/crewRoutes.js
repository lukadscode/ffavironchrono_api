const express = require("express");
const router = express.Router();
const controller = require("../controllers/crewController");
const auth = require("../middlewares/authMiddleware");
const flexibleAuth = require("../middlewares/flexibleAuthMiddleware");
const { requireEventRole, resolvers } = require("../middlewares/requireEventRole");
const validate = require("../middlewares/validateSchema");
const schema = require("../schemas/crewSchema");

router.get("/", controller.getCrews);
router.get("/:id", controller.getCrew);
router.get("/event/:event_id", controller.getCrewsByEvent);
router.get(
  "/event/:event_id/with-participants",
  controller.getCrewsWithParticipantsByEvent
);
router.post(
  "/",
  auth,
  requireEventRole({ roles: ["editor"], getEventId: resolvers.eventIdFromBody("event_id") }),
  validate(schema.createSchema),
  controller.createCrew
);
router.put(
  "/:id",
  auth,
  requireEventRole({ roles: ["editor"], getEventId: resolvers.eventIdFromCrewIdParam("id") }),
  validate(schema.updateSchema),
  controller.updateCrew
);
router.delete(
  "/:id",
  auth,
  requireEventRole({ roles: ["editor"], getEventId: resolvers.eventIdFromCrewIdParam("id") }),
  controller.deleteCrew
);

// Statut rapide DNS/DNF/DSQ depuis le poste de chronométrage (mobile)
router.patch(
  "/:id/status",
  flexibleAuth,
  requireEventRole({
    roles: ["timing"],
    allowTimingPointToken: true,
    getEventId: resolvers.eventIdFromCrewIdParam("id"),
  }),
  controller.updateCrewStatus
);

module.exports = router;
