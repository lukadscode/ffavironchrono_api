const express = require("express");
const router = express.Router();
const controller = require("../controllers/clubController");
const auth = require("../middlewares/authMiddleware");

// Récupérer la liste des clubs (nécessite authentification)
router.get("/", auth, controller.getClubs);

module.exports = router;


