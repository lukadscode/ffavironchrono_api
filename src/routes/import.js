const express = require("express");
const router = express.Router();
const importController = require("../controllers/importController");
const crewImportController = require("../controllers/crewImportController");
const auth = require("../middlewares/authMiddleware");

router.post("/manifestation/:id", auth, importController.importManifestation);
router.post(
  "/manifestation/:id/update",
  auth,
  importController.updateEventFromManifestation
);

// Import d'équipages depuis données JSON (le frontend parse le fichier Excel/JSON)
router.post("/crews", auth, crewImportController.importCrews);

module.exports = router;
