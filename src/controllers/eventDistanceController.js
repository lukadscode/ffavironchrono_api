const { v4: uuidv4 } = require("uuid");
const EventDistance = require("../models/EventDistance");
const Event = require("../models/Event");
const Distance = require("../models/Distance");

/**
 * Associer une distance à un événement
 * 
 * POST /event-distances
 * Body: { event_id, distance_id }
 */
exports.associateDistanceToEvent = async (req, res) => {
  try {
    const { event_id, distance_id } = req.body;

    if (!event_id || !distance_id) {
      return res.status(400).json({
        status: "error",
        message: "event_id et distance_id sont requis",
      });
    }

    // Vérifier que l'événement existe
    const event = await Event.findByPk(event_id);
    if (!event) {
      return res.status(404).json({
        status: "error",
        message: "Événement non trouvé",
      });
    }

    // Vérifier que la distance existe
    const distance = await Distance.findByPk(distance_id);
    if (!distance) {
      return res.status(404).json({
        status: "error",
        message: "Distance non trouvée",
      });
    }

    // Créer ou récupérer l'association
    const [eventDistance, created] = await EventDistance.findOrCreate({
      where: {
        event_id,
        distance_id,
      },
      defaults: {
        id: uuidv4(),
        event_id,
        distance_id,
      },
    });

    // Charger les relations pour la réponse
    await eventDistance.reload({
      include: [
        { model: Event, as: "event", attributes: ["id", "name"] },
        {
          model: Distance,
          as: "distance",
        },
      ],
    });

    res.json({
      status: "success",
      data: eventDistance,
      created,
      message: created
        ? "Distance associée à l'événement"
        : "Association déjà existante",
    });
  } catch (err) {
    console.error("Erreur lors de l'association distance-événement:", err);
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

/**
 * Dissocier une distance d'un événement
 * 
 * DELETE /event-distances/event/:event_id/distance/:distance_id
 */
exports.dissociateDistanceFromEvent = async (req, res) => {
  try {
    const { event_id, distance_id } = req.params;

    const eventDistance = await EventDistance.findOne({
      where: {
        event_id,
        distance_id,
      },
    });

    if (!eventDistance) {
      return res.status(404).json({
        status: "error",
        message: "Association non trouvée",
      });
    }

    await eventDistance.destroy();

    res.json({
      status: "success",
      message: "Distance dissociée de l'événement",
    });
  } catch (err) {
    console.error("Erreur lors de la dissociation:", err);
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

/**
 * Récupérer toutes les distances d'un événement
 * (Déjà géré par GET /distances/event/:event_id, mais on peut ajouter cette route pour cohérence)
 * 
 * GET /event-distances/event/:event_id
 */
exports.getEventDistances = async (req, res) => {
  try {
    const { event_id } = req.params;

    const eventDistances = await EventDistance.findAll({
      where: { event_id },
      include: [
        {
          model: Distance,
          as: "distance",
          required: true,
        },
      ],
    });

    res.json({
      status: "success",
      data: eventDistances,
    });
  } catch (err) {
    console.error("Erreur lors de la récupération:", err);
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

/**
 * Associer plusieurs distances à un événement en une fois
 * 
 * POST /event-distances/batch
 * Body: { event_id, distance_ids: [id1, id2, ...] }
 */
exports.associateMultipleDistances = async (req, res) => {
  try {
    const { event_id, distance_ids } = req.body;

    if (!event_id || !Array.isArray(distance_ids) || distance_ids.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "event_id et distance_ids (tableau) sont requis",
      });
    }

    // Vérifier que l'événement existe
    const event = await Event.findByPk(event_id);
    if (!event) {
      return res.status(404).json({
        status: "error",
        message: "Événement non trouvé",
      });
    }

    // Vérifier que toutes les distances existent
    const distances = await Distance.findAll({
      where: { id: distance_ids },
    });

    if (distances.length !== distance_ids.length) {
      return res.status(404).json({
        status: "error",
        message: "Une ou plusieurs distances n'existent pas",
      });
    }

    // Créer les associations
    const associations = [];
    const created = [];
    const existing = [];

    for (const distance_id of distance_ids) {
      const [eventDistance, wasCreated] = await EventDistance.findOrCreate({
        where: {
          event_id,
          distance_id,
        },
        defaults: {
          id: uuidv4(),
          event_id,
          distance_id,
        },
      });

      associations.push(eventDistance);
      if (wasCreated) {
        created.push(distance_id);
      } else {
        existing.push(distance_id);
      }
    }

    res.json({
      status: "success",
      data: associations,
      created_count: created.length,
      existing_count: existing.length,
      created_ids: created,
      existing_ids: existing,
    });
  } catch (err) {
    console.error("Erreur lors de l'association multiple:", err);
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

