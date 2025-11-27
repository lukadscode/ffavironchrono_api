const express = require("express");
const router = express.Router();
const controller = require("../controllers/raceController");
const importController = require("../controllers/importController");
const auth = require("../middlewares/authMiddleware");
const validate = require("../middlewares/validateSchema");
const schema = require("../schemas/raceSchema");

router.get("/", controller.getRaces);
router.post("/", auth, validate(schema.createSchema), controller.createRace);
// Routes spécifiques avant les routes génériques
router.get("/non-official", auth, controller.getNonOfficialRaces);
router.get("/event/:event_id", controller.getRacesByEvent);
router.get("/results/:race_id", controller.getRaceResults);
router.post(
  "/generate",
  auth,
  validate(require("../schemas/generateRacesSchema").generateInitialRacesSchema),
  importController.generateInitialRaces
);
router.post(
  "/generate-from-series",
  auth,
  validate(require("../schemas/generateRacesSchema").generateRacesFromSeriesSchema),
  importController.generateRacesFromSeries
);
// Routes génériques après les routes spécifiques
router.get("/:id", controller.getRace);
router.put("/:id", auth, validate(schema.updateSchema), controller.updateRace);
router.delete("/:id", auth, controller.deleteRace);

module.exports = router;
