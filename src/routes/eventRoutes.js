const express = require("express");
const router = express.Router();
const multer = require("multer");
const eventController = require("../controllers/eventController");
const eventImportController = require("../controllers/eventImportController");
const auth = require("../middlewares/authMiddleware");
const validate = require("../middlewares/validateSchema");
const schema = require("../schemas/eventSchema");

// Configuration de multer pour l'upload de fichiers (CSV / Excel)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
});

router.get("/", eventController.getEvents);
router.get("/:id/statistics", auth, eventController.getEventStatistics);
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

// Import participants + équipages depuis un fichier CSV / Excel
router.post(
  "/:event_id/import-participants",
  auth,
  upload.single("file"),
  eventImportController.importParticipantsFromFile
);

module.exports = router;
