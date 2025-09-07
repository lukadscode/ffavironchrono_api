const express = require("express");
const router = express.Router();
const controller = require("../controllers/timingAssignmentController");
const auth = require("../middlewares/authMiddleware");
const validate = require("../middlewares/validateSchema");
const schema = require("../Schemas/timingAssignmentSchema");

router.post("/", auth, validate(schema.assignSchema), controller.assignTiming);
router.put(
  "/:id",
  auth,
  validate(schema.assignSchema),
  controller.updateAssignment
);
router.get("/crew/:crew_id", controller.getAssignmentsByCrew);
router.get("/event/:event_id", controller.getAssignmentsByEvent);
router.get("/race/:race_id", controller.getAssignmentsByRace);
router.delete("/:id", auth, controller.deleteAssignment);

module.exports = router;
