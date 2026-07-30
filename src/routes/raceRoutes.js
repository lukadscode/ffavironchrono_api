const express = require("express");
const router = express.Router();
const controller = require("../controllers/raceController");
const importController = require("../controllers/importController");
const finishLynxController = require("../controllers/finishLynxController");
const auth = require("../middlewares/authMiddleware");
const { requireEventRole, resolvers } = require("../middlewares/requireEventRole");
const validate = require("../middlewares/validateSchema");
const schema = require("../schemas/raceSchema");
const {
  createUploadMiddleware,
  SPREADSHEET_MIMES,
  SPREADSHEET_EXTENSIONS,
} = require("../middlewares/validateUpload");

const finishLynxUpload = createUploadMiddleware({
  fieldName: "file",
  allowedMimes: new Set([...SPREADSHEET_MIMES, "application/octet-stream"]),
  allowedExtensions: new Set([...SPREADSHEET_EXTENSIONS, ".lif"]),
});

router.get("/", controller.getRaces);
router.post(
  "/",
  auth,
  // createRace reçoit généralement phase_id, donc on résout l’event via la phase.
  requireEventRole({
    roles: ["editor"],
    getEventId: resolvers.eventIdFromRacePhaseBody("phase_id"),
  }),
  validate(schema.createSchema),
  controller.createRace
);
// Routes spécifiques avant les routes génériques
router.get("/non-official", auth, controller.getNonOfficialRaces);
router.get("/event/:event_id", controller.getRacesByEvent);
router.get("/results/:race_id", controller.getRaceResults);
router.post(
  "/generate",
  auth,
  requireEventRole({
    roles: ["editor"],
    getEventId: resolvers.eventIdFromBody("event_id"),
  }),
  validate(require("../schemas/generateRacesSchema").generateInitialRacesSchema),
  importController.generateInitialRaces
);
router.post(
  "/generate-from-series",
  auth,
  requireEventRole({
    roles: ["editor"],
    getEventId: resolvers.eventIdFromBody("event_id"),
  }),
  validate(require("../schemas/generateRacesSchema").generateRacesFromSeriesSchema),
  importController.generateRacesFromSeries
);

router.post(
  "/generate-time-trial",
  auth,
  requireEventRole({
    roles: ["editor"],
    getEventId: resolvers.eventIdFromBody("event_id"),
  }),
  validate(
    require("../schemas/generateRacesSchema").generateTimeTrialRacesSchema
  ),
  importController.generateTimeTrialRaces
);
// Routes génériques après les routes spécifiques
router.get("/:id", controller.getRace);
router.put(
  "/:id",
  auth,
  requireEventRole({
    roles: ["editor"],
    getEventId: resolvers.eventIdFromRaceIdParam("id"),
  }),
  validate(schema.updateSchema),
  controller.updateRace
);
router.post(
  "/:id/gun-start",
  auth,
  requireEventRole({
    roles: ["referee", "timing"],
    getEventId: resolvers.eventIdFromRaceIdParam("id"),
  }),
  controller.gunStart
);
router.post(
  "/:id/false-start",
  auth,
  requireEventRole({
    roles: ["referee", "timing"],
    getEventId: resolvers.eventIdFromRaceIdParam("id"),
  }),
  controller.falseStart
);
router.post(
  "/:id/validate",
  auth,
  requireEventRole({
    roles: ["referee"],
    getEventId: resolvers.eventIdFromRaceIdParam("id"),
  }),
  controller.validateRace
);
router.post(
  "/:id/finishlynx/preview",
  auth,
  requireEventRole({
    roles: ["referee", "timing"],
    getEventId: resolvers.eventIdFromRaceIdParam("id"),
  }),
  finishLynxUpload,
  finishLynxController.previewFinishLynx
);
router.post(
  "/:id/finishlynx/import",
  auth,
  requireEventRole({
    roles: ["referee", "timing"],
    getEventId: resolvers.eventIdFromRaceIdParam("id"),
  }),
  finishLynxUpload,
  finishLynxController.importFinishLynx
);
router.delete(
  "/:id",
  auth,
  requireEventRole({
    roles: ["editor"],
    getEventId: resolvers.eventIdFromRaceIdParam("id"),
  }),
  controller.deleteRace
);

module.exports = router;
