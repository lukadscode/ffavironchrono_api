const express = require("express");
const router = express.Router();
const controller = require("../controllers/raceCrewController");
const auth = require("../middlewares/authMiddleware");
const validate = require("../middlewares/validateSchema");
const schema = require("../schemas/raceCrewSchema");

router.post(
  "/",
  auth,
  validate(schema.createSchema),
  controller.assignCrewToRace
);
router.get("/:race_id", controller.getRaceCrews);
router.delete("/:id", auth, controller.removeRaceCrew);

module.exports = router;
