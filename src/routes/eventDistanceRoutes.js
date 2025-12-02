const express = require("express");
const router = express.Router();
const controller = require("../controllers/eventDistanceController");
const auth = require("../middlewares/authMiddleware");

// Associer une distance à un événement
router.post("/", auth, controller.associateDistanceToEvent);

// Associer plusieurs distances à un événement en une fois
router.post("/batch", auth, controller.associateMultipleDistances);

// Récupérer toutes les distances d'un événement
router.get("/event/:event_id", auth, controller.getEventDistances);

// Dissocier une distance d'un événement
router.delete("/event/:event_id/distance/:distance_id", auth, controller.dissociateDistanceFromEvent);

module.exports = router;

