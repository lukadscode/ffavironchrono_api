const express = require("express");
const router = express.Router();
const controller = require("../controllers/clubController");
const auth = require("../middlewares/authMiddleware");

// Synchroniser les clubs depuis l'API FFAviron (nécessite authentification)
router.post("/sync", auth, controller.syncClubs);

// Récupérer tous les clubs (avec filtres optionnels : ?code=xxx&nom_court=yyy&type=CLU)
router.get("/", controller.getClubs);

// Récupérer un club par son code
router.get("/code/:code", controller.getClubByCode);

// Récupérer un club par son nom_court
router.get("/nom-court/:nom_court", controller.getClubByNomCourt);

module.exports = router;
