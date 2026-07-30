const express = require("express");
const router = express.Router();
const eventController = require("../controllers/eventController");
const eventImportController = require("../controllers/eventImportController");
const enduranceMerController = require("../controllers/enduranceMerController");
const auth = require("../middlewares/authMiddleware");
const requireCommission = require("../middlewares/requireCommission");
const { requireEventRole, resolvers } = require("../middlewares/requireEventRole");
const validate = require("../middlewares/validateSchema");
const schema = require("../schemas/eventSchema");
const { createUploadMiddleware } = require("../middlewares/validateUpload");

const uploadSpreadsheet = createUploadMiddleware();

// Endurance mer global (doit etre avant /:id)
router.get("/endurance-mer/global-ranking", enduranceMerController.getGlobalRanking);
router.get("/endurance-mer/territorial-bonus", enduranceMerController.listTerritorialBonus);
router.post(
  "/endurance-mer/territorial-bonus",
  auth,
  requireCommission,
  enduranceMerController.createTerritorialBonus
);

router.get("/", eventController.getEvents);
router.get(
  "/:id/statistics",
  auth,
  requireEventRole({ roles: ["viewer"], getEventId: resolvers.eventIdFromParams("id") }),
  eventController.getEventStatistics
);
router.get("/:id", eventController.getEvent);
router.post("/", auth, validate(schema.eventCreateSchema), eventController.createEvent);
router.put(
  "/:id",
  auth,
  requireEventRole({ roles: ["organiser"], getEventId: resolvers.eventIdFromParams("id") }),
  validate(schema.eventUpdateSchema),
  eventController.updateEvent
);
router.delete(
  "/:id",
  auth,
  requireEventRole({ roles: ["organiser"], getEventId: resolvers.eventIdFromParams("id") }),
  eventController.deleteEvent
);

router.post(
  "/:event_id/import-participants",
  auth,
  requireEventRole({ roles: ["editor"], getEventId: resolvers.eventIdFromParams("event_id") }),
  uploadSpreadsheet,
  eventImportController.importParticipantsFromFile
);

router.post(
  "/:eventId/endurance-mer/import",
  auth,
  requireEventRole({ roles: ["editor"], getEventId: resolvers.eventIdFromParams("eventId") }),
  uploadSpreadsheet,
  enduranceMerController.importResults
);
router.get("/:eventId/endurance-mer/import-results", enduranceMerController.getImportResults);
router.get("/:eventId/endurance-mer/ranking", enduranceMerController.getRanking);
router.get(
  "/:eventId/results-by-category",
  auth,
  requireEventRole({ roles: ["viewer"], getEventId: resolvers.eventIdFromParams("eventId") }),
  eventController.getEventResultsByCategory
);

module.exports = router;