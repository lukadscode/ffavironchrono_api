const express = require("express");
const router = express.Router();
const controller = require("../controllers/participantController");
const auth = require("../middlewares/authMiddleware");
const requireAdmin = require("../middlewares/requireAdmin");
const { requireEventRole, resolvers } = require("../middlewares/requireEventRole");
const validate = require("../middlewares/validateSchema");
const schema = require("../schemas/participantSchema");

router.get("/", auth, requireAdmin, controller.getParticipants);
router.get("/licencie/:numeroLicence", auth, controller.searchLicencie);
router.get("/:participant_id/crews", auth, controller.getCrewsByParticipant);
router.get("/:id", auth, controller.getParticipant);
router.post(
  "/",
  auth,
  requireAdmin,
  validate(schema.createSchema),
  controller.createParticipant
);
router.get(
  "/event/:event_id",
  auth,
  requireEventRole({ roles: ["viewer"], getEventId: resolvers.eventIdFromParams("event_id") }),
  controller.getParticipantsByEvent
);
router.put(
  "/:id",
  auth,
  requireAdmin,
  validate(schema.updateSchema),
  controller.updateParticipant
);
router.delete("/:id", auth, requireAdmin, controller.deleteParticipant);

module.exports = router;
