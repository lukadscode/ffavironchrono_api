const express = require("express");
const router = express.Router();
const controller = require("../controllers/notificationController");
const auth = require("../middlewares/authMiddleware");
const { requireEventRole, resolvers } = require("../middlewares/requireEventRole");
const validate = require("../middlewares/validateSchema");
const schema = require("../schemas/notificationSchema");

// Créer une notification (nécessite authentification)
router.post(
  "/",
  auth,
  requireEventRole({
    roles: ["editor"],
    getEventId: resolvers.eventIdFromBody("event_id"),
  }),
  validate(schema.createSchema),
  controller.createNotification
);

// Récupérer toutes les notifications (backoffice, nécessite authentification)
router.get("/", auth, controller.getAllNotifications);

// Récupérer les notifications actives d'un événement (public)
router.get("/event/:event_id", controller.getEventNotifications);

// Récupérer les notifications actives d'une course (public)
router.get("/race/:race_id", controller.getRaceNotifications);

// Mettre à jour une notification (nécessite authentification)
router.put(
  "/:id",
  auth,
  requireEventRole({
    roles: ["editor"],
    getEventId: resolvers.eventIdFromNotificationIdParam("id"),
  }),
  validate(schema.updateSchema),
  controller.updateNotification
);

// Supprimer une notification (nécessite authentification)
router.delete(
  "/:id",
  auth,
  requireEventRole({
    roles: ["editor"],
    getEventId: resolvers.eventIdFromNotificationIdParam("id"),
  }),
  controller.deleteNotification
);

module.exports = router;


