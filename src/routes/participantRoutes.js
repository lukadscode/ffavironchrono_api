const express = require("express");
const router = express.Router();
const controller = require("../controllers/participantController");
const auth = require("../middlewares/authMiddleware");
const validate = require("../middlewares/validateSchema");
const schema = require("../schemas/participantSchema");

router.get("/", controller.getParticipants);
router.get("/licencie/:numeroLicence", controller.searchLicencie);
router.get("/:participant_id/crews", controller.getCrewsByParticipant);
router.get("/:id", controller.getParticipant);
router.post(
  "/",
  auth,
  validate(schema.createSchema),
  controller.createParticipant
);
router.get("/event/:event_id", controller.getParticipantsByEvent);
router.put(
  "/:id",
  auth,
  validate(schema.updateSchema),
  controller.updateParticipant
);
router.delete("/:id", auth, controller.deleteParticipant);

module.exports = router;
