const express = require("express");
const router = express.Router();
const importController = require("../controllers/importController");
const crewImportController = require("../controllers/crewImportController");
const auth = require("../middlewares/authMiddleware");
const requireAdmin = require("../middlewares/requireAdmin");
const { requireEventRole, resolvers } = require("../middlewares/requireEventRole");

router.get(
  "/manifestations",
  auth,
  requireAdmin,
  importController.listManifestations,
);
router.post(
  "/manifestation/:id",
  auth,
  requireAdmin,
  importController.importManifestation
);
router.post(
  "/manifestation/:id/update",
  auth,
  requireEventRole({
    roles: ["editor"],
    getEventId: resolvers.eventIdFromBody("event_id"),
  }),
  importController.updateEventFromManifestation
);

// Import d'équipages depuis données JSON (le frontend parse le fichier Excel/JSON)
router.post(
  "/crews",
  auth,
  requireEventRole({ roles: ["editor"], getEventId: resolvers.eventIdFromBody("event_id") }),
  crewImportController.importCrews
);

module.exports = router;
