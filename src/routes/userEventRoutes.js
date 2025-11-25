const express = require("express");
const router = express.Router();
const controller = require("../controllers/userEventController");
const auth = require("../middlewares/authMiddleware");
const validate = require("../middlewares/validateSchema");
const schema = require("../schemas/userEventSchema");

router.post(
  "/",
  auth,
  validate(schema.addUserToEventSchema),
  controller.addUserToEvent
);
router.delete("/:id", auth, controller.removeUserFromEvent);
router.get("/event/:event_id", auth, controller.listEventUsers);

module.exports = router;
