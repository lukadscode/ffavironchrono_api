const express = require("express");
const router = express.Router();
const controller = require("../controllers/eventDistanceController");
const auth = require("../middlewares/authMiddleware");
const { requireEventRole, resolvers } = require("../middlewares/requireEventRole");

// Associer une distance à un événement
router.post(
  "/",
  auth,
  requireEventRole({ roles: ["editor"], getEventId: resolvers.eventIdFromBody("event_id") }),
  controller.associateDistanceToEvent
);

// Associer plusieurs distances à un événement en une fois
router.post(
  "/batch",
  auth,
  requireEventRole({ roles: ["editor"], getEventId: resolvers.eventIdFromBody("event_id") }),
  controller.associateMultipleDistances
);

// Récupérer toutes les distances d'un événement
router.get(
  "/event/:event_id",
  auth,
  requireEventRole({ roles: ["viewer"], getEventId: resolvers.eventIdFromParams("event_id") }),
  controller.getEventDistances
);

// Dissocier une distance d'un événement
router.delete(
  "/event/:event_id/distance/:distance_id",
  auth,
  requireEventRole({ roles: ["editor"], getEventId: resolvers.eventIdFromParams("event_id") }),
  controller.dissociateDistanceFromEvent
);

module.exports = router;

