const express = require("express");
const router = express.Router();
const controller = require("../controllers/timingAssignmentController");
const auth = require("../middlewares/authMiddleware");
const flexibleAuth = require("../middlewares/flexibleAuthMiddleware");
const validate = require("../middlewares/validateSchema");
const schema = require("../schemas/timingAssignmentSchema");

router.post("/", flexibleAuth, validate(schema.assignSchema), controller.assignTiming);
router.put(
  "/:id",
  flexibleAuth,
  validate(schema.assignSchema),
  controller.updateAssignment
);
router.get("/crew/:crew_id", controller.getAssignmentsByCrew);
router.get("/event/:event_id", controller.getAssignmentsByEvent);
router.get("/race/:race_id", controller.getAssignmentsByRace);
router.delete("/:id", flexibleAuth, controller.deleteAssignment);

module.exports = router;
