const express = require("express");
const router = express.Router();
const controller = require("../controllers/raceController");
const importController = require("../controllers/importController");
const auth = require("../middlewares/authMiddleware");
const validate = require("../middlewares/validateSchema");
const schema = require("../Schemas/raceSchema");

router.get("/", controller.getRaces);
router.get("/:id", controller.getRace);
router.post("/", auth, validate(schema.createSchema), controller.createRace);
router.get("/event/:event_id", auth, controller.getRacesByEvent);
router.post("/generate", importController.generateInitialRaces);
router.put("/:id", auth, validate(schema.updateSchema), controller.updateRace);
router.delete("/:id", auth, controller.deleteRace);

module.exports = router;
