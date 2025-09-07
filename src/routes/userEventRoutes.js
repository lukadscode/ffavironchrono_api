const express = require("express");
const router = express.Router();
const controller = require("../controllers/userEventController");
const auth = require("../middlewares/authMiddleware");

router.post("/", auth, controller.addUserToEvent);
router.delete("/:id", auth, controller.removeUserFromEvent);
router.get("/event/:event_id", auth, controller.listEventUsers);

module.exports = router;
