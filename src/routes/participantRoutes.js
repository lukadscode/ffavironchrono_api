const express = require("express");
const router = express.Router();
const controller = require("../controllers/participantController");
const auth = require("../middlewares/authMiddleware");
const validate = require("../middlewares/validateSchema");
const schema = require("../Schemas/participantSchema");

router.get("/", controller.getParticipants);
router.get("/:id", controller.getParticipant);
router.post(
  "/",
  auth,
  validate(schema.createSchema),
  controller.createParticipant
);
router.get("/event/:event_id", auth, controller.getParticipantsByEvent);
router.put(
  "/:id",
  auth,
  validate(schema.updateSchema),
  controller.updateParticipant
);
router.delete("/:id", auth, controller.deleteParticipant);

module.exports = router;
