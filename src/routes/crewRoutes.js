const express = require("express");
const router = express.Router();
const controller = require("../controllers/crewController");
const auth = require("../middlewares/authMiddleware");
const validate = require("../middlewares/validateSchema");
const schema = require("../Schemas/crewSchema");

router.get("/", controller.getCrews);
router.get("/:id", controller.getCrew);
router.get("/event/:event_id", controller.getCrewsByEvent);
router.post("/", auth, validate(schema.createSchema), controller.createCrew);
router.put("/:id", auth, validate(schema.updateSchema), controller.updateCrew);
router.delete("/:id", auth, controller.deleteCrew);

module.exports = router;
