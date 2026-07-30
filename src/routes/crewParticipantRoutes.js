const express = require("express");
const router = express.Router();
const controller = require("../controllers/crewParticipantController");
const auth = require("../middlewares/authMiddleware");
const { requireEventRole, resolvers } = require("../middlewares/requireEventRole");
const validate = require("../middlewares/validateSchema");
const schema = require("../schemas/crewParticipantSchema");

router.post(
  "/",
  auth,
  requireEventRole({ roles: ["editor"], getEventId: resolvers.eventIdFromCrewBody("crew_id") }),
  validate(schema.createSchema),
  controller.addParticipantToCrew
);
router.get(
  "/:crew_id",
  auth,
  requireEventRole({ roles: ["viewer"], getEventId: resolvers.eventIdFromCrewIdParam("crew_id") }),
  controller.getCrewParticipants
);
router.delete(
  "/:id",
  auth,
  requireEventRole({
    roles: ["editor"],
    getEventId: resolvers.eventIdFromCrewParticipantIdParam("id"),
  }),
  controller.removeCrewParticipant
);

module.exports = router;
