const express = require("express");
const router = express.Router();
const controller = require("../controllers/crewParticipantController");
const auth = require("../middlewares/authMiddleware");
const validate = require("../middlewares/validateSchema");
const schema = require("../Schemas/crewParticipantSchema");

router.post(
  "/",
  auth,
  validate(schema.createSchema),
  controller.addParticipantToCrew
);
router.get("/:crew_id", controller.getCrewParticipants);
router.delete("/:id", auth, controller.removeCrewParticipant);

module.exports = router;
