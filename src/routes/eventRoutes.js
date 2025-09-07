const express = require("express");
const router = express.Router();
const eventController = require("../controllers/eventController");
const auth = require("../middlewares/authMiddleware");
const validate = require("../middlewares/validateSchema");
const schema = require("../Schemas/eventSchema");

router.get("/", eventController.getEvents);
router.get("/:id", eventController.getEvent);
router.post(
  "/",
  auth,
  validate(schema.eventCreateSchema),
  eventController.createEvent
);
router.put(
  "/:id",
  auth,
  validate(schema.eventUpdateSchema),
  eventController.updateEvent
);
router.delete("/:id", auth, eventController.deleteEvent);

module.exports = router;
