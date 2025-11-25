const { v4: uuidv4 } = require("uuid");
const Notification = require("../models/Notification");
const Event = require("../models/Event");
const Race = require("../models/Race");
const { Op } = require("sequelize");

/**
 * Créer une nouvelle notification
 */
exports.createNotification = async (req, res) => {
  try {
    const {
      event_id,
      race_id,
      message,
      importance = "info",
      is_active = true,
      start_date,
      end_date,
    } = req.body;

    // Validation : au moins event_id ou race_id doit être fourni
    if (!event_id && !race_id) {
      return res.status(400).json({
        status: "error",
        message: "event_id ou race_id est requis",
      });
    }

    // Vérifier que l'événement existe si event_id est fourni
    if (event_id) {
      const event = await Event.findByPk(event_id);
      if (!event) {
        return res.status(404).json({
          status: "error",
          message: "Événement introuvable",
        });
      }
    }

    // Vérifier que la course existe si race_id est fourni
    if (race_id) {
      const race = await Race.findByPk(race_id);
      if (!race) {
        return res.status(404).json({
          status: "error",
          message: "Course introuvable",
        });
      }
    }

    const notification = await Notification.create({
      id: uuidv4(),
      event_id: event_id || null,
      race_id: race_id || null,
      message,
      importance,
      is_active,
      start_date: start_date ? new Date(start_date) : null,
      end_date: end_date ? new Date(end_date) : null,
      created_by: req.user?.userId || null,
    });

    // Diffuser la notification via WebSocket si elle est active
    if (notification.is_active) {
      const io = req.app.get("io");
      if (io) {
        const socketEvents = require("../services/socketEvents")(io);
        socketEvents.broadcastNotification(notification);
      }
    }

    res.status(201).json({
      status: "success",
      data: notification,
    });
  } catch (err) {
    console.error("Error creating notification:", err);
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

/**
 * Récupérer toutes les notifications actives pour un événement
 */
exports.getEventNotifications = async (req, res) => {
  try {
    const { event_id } = req.params;
    const now = new Date();

    const notifications = await Notification.findAll({
      where: {
        event_id,
        is_active: true,
        [Op.and]: [
          {
            [Op.or]: [
              { start_date: null },
              { start_date: { [Op.lte]: now } },
            ],
          },
          {
            [Op.or]: [
              { end_date: null },
              { end_date: { [Op.gte]: now } },
            ],
          },
        ],
      },
      order: [
        ["importance", "DESC"], // error > warning > success > info
        ["created_at", "DESC"],
      ],
    });

    res.json({
      status: "success",
      data: notifications,
    });
  } catch (err) {
    console.error("Error fetching event notifications:", err);
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

/**
 * Récupérer toutes les notifications actives pour une course
 */
exports.getRaceNotifications = async (req, res) => {
  try {
    const { race_id } = req.params;
    const now = new Date();

    // Récupérer les notifications spécifiques à la course ET celles de l'événement
    const race = await Race.findByPk(race_id, {
      include: [{ model: require("../models/RacePhase"), as: "race_phase" }],
    });

    if (!race) {
      return res.status(404).json({
        status: "error",
        message: "Course introuvable",
      });
    }

    const event_id = race.race_phase?.event_id;

    const notifications = await Notification.findAll({
      where: {
        [Op.and]: [
          {
            [Op.or]: [
              { race_id },
              { event_id, race_id: null }, // Notifications de l'événement
            ],
          },
          { is_active: true },
          {
            [Op.or]: [
              { start_date: null },
              { start_date: { [Op.lte]: now } },
            ],
          },
          {
            [Op.or]: [
              { end_date: null },
              { end_date: { [Op.gte]: now } },
            ],
          },
        ],
      },
      order: [
        ["importance", "DESC"],
        ["created_at", "DESC"],
      ],
    });

    res.json({
      status: "success",
      data: notifications,
    });
  } catch (err) {
    console.error("Error fetching race notifications:", err);
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

/**
 * Récupérer toutes les notifications (pour le backoffice)
 */
exports.getAllNotifications = async (req, res) => {
  try {
    const { event_id, race_id, is_active } = req.query;

    const where = {};
    if (event_id) where.event_id = event_id;
    if (race_id) where.race_id = race_id;
    if (is_active !== undefined) where.is_active = is_active === "true";

    const notifications = await Notification.findAll({
      where,
      include: [
        { model: Event, as: "event", required: false },
        { model: Race, as: "race", required: false },
        { model: require("../models/User"), as: "creator", required: false },
      ],
      order: [["created_at", "DESC"]],
    });

    res.json({
      status: "success",
      data: notifications,
    });
  } catch (err) {
    console.error("Error fetching all notifications:", err);
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

/**
 * Mettre à jour une notification
 */
exports.updateNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      message,
      importance,
      is_active,
      start_date,
      end_date,
    } = req.body;

    const notification = await Notification.findByPk(id);
    if (!notification) {
      return res.status(404).json({
        status: "error",
        message: "Notification introuvable",
      });
    }

    const wasActive = notification.is_active;
    const updates = {};
    if (message !== undefined) updates.message = message;
    if (importance !== undefined) updates.importance = importance;
    if (is_active !== undefined) updates.is_active = is_active;
    if (start_date !== undefined) updates.start_date = start_date ? new Date(start_date) : null;
    if (end_date !== undefined) updates.end_date = end_date ? new Date(end_date) : null;

    await notification.update(updates);

    // Diffuser la mise à jour via WebSocket
    const io = req.app.get("io");
    if (io) {
      const socketEvents = require("../services/socketEvents")(io);
      if (notification.is_active && !wasActive) {
        // Notification activée
        socketEvents.broadcastNotification(notification);
      } else if (notification.is_active) {
        // Notification mise à jour
        socketEvents.broadcastNotification(notification);
      } else {
        // Notification désactivée
        socketEvents.removeNotification(notification);
      }
    }

    res.json({
      status: "success",
      data: notification,
    });
  } catch (err) {
    console.error("Error updating notification:", err);
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

/**
 * Supprimer une notification
 */
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findByPk(id);
    if (!notification) {
      return res.status(404).json({
        status: "error",
        message: "Notification introuvable",
      });
    }

    // Diffuser la suppression via WebSocket
    const io = req.app.get("io");
    if (io && notification.is_active) {
      const socketEvents = require("../services/socketEvents")(io);
      socketEvents.removeNotification(notification);
    }

    await notification.destroy();

    res.json({
      status: "success",
      message: "Notification supprimée",
    });
  } catch (err) {
    console.error("Error deleting notification:", err);
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

