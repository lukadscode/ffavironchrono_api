const express = require("express");
const router = express.Router();
const multer = require("multer");
const eventController = require("../controllers/eventController");
const eventImportController = require("../controllers/eventImportController");
const enduranceMerController = require("../controllers/enduranceMerController");
const auth = require("../middlewares/authMiddleware");
const validate = require("../middlewares/validateSchema");
const schema = require("../schemas/eventSchema");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Endurance mer global (doit etre avant /:id)
router.get("/endurance-mer/global-ranking", enduranceMerController.getGlobalRanking);
router.get("/endurance-mer/territorial-bonus", enduranceMerController.listTerritorialBonus);
router.post("/endurance-mer/territorial-bonus", auth, enduranceMerController.createTerritorialBonus);

router.get("/", eventController.getEvents);
router.get("/:id/statistics", auth, eventController.getEventStatistics);
router.get("/:id", eventController.getEvent);
router.post("/", auth, validate(schema.eventCreateSchema), eventController.createEvent);
router.put("/:id", auth, validate(schema.eventUpdateSchema), eventController.updateEvent);
router.delete("/:id", auth, eventController.deleteEvent);

router.post("/:event_id/import-participants", auth, upload.single("file"), eventImportController.importParticipantsFromFile);

router.post("/:eventId/endurance-mer/import", auth, upload.single("file"), enduranceMerController.importResults);
router.get("/:eventId/endurance-mer/import-results", enduranceMerController.getImportResults);
router.get("/:eventId/endurance-mer/ranking", enduranceMerController.getRanking);

module.exports = router;