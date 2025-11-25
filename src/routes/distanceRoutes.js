const express = require("express");
const router = express.Router();
const controller = require("../controllers/distanceController");
const auth = require("../middlewares/authMiddleware");
const validate = require("../middlewares/validateSchema");
const schema = require("../schemas/distanceSchema");

router.get("/", controller.getDistances);
router.post(
  "/",
  auth,
  validate(schema.createSchema),
  controller.createDistance
);
router.get("/event/:event_id", auth, controller.getDistancesByEvent);
router.delete("/:id", auth, controller.deleteDistance);

module.exports = router;
