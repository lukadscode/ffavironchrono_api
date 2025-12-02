const { v4: uuidv4 } = require("uuid");
const Distance = require("../models/Distance");
const Event = require("../models/Event");
const sequelize = require("../models/index");

exports.createDistance = async (req, res) => {
  try {
    const { meters, is_relay, relay_count, is_time_based, duration_seconds } =
      req.body;

    // Construire le whereClause pour vérifier si une distance identique existe déjà
    const whereClause = {
      is_relay: is_relay || false,
      is_time_based: is_time_based || false,
    };

    // Pour les distances basées sur les mètres
    if (is_time_based) {
      whereClause.duration_seconds = duration_seconds;
      whereClause.meters = null;
    } else {
      whereClause.meters = meters;
      whereClause.duration_seconds = null;
    }

    // Pour les relais, inclure relay_count dans la recherche
    if (is_relay) {
      whereClause.relay_count = relay_count;
    } else {
      whereClause.relay_count = null;
    }

    // Chercher ou créer la distance (évite les doublons)
    const [distance, created] = await Distance.findOrCreate({
      where: whereClause,
      defaults: {
        id: uuidv4(),
        meters: meters || null,
        is_relay: is_relay || false,
        relay_count: relay_count || null,
        is_time_based: is_time_based || false,
        duration_seconds: duration_seconds || null,
      },
    });

    // Générer un label pour le log
    let distanceLabel;
    if (is_time_based && duration_seconds) {
      const minutes = Math.floor(duration_seconds / 60);
      const seconds = duration_seconds % 60;
      if (minutes > 0 && seconds > 0) {
        distanceLabel = `${minutes}min ${seconds}s`;
      } else if (minutes > 0) {
        distanceLabel = `${minutes}min`;
      } else {
        distanceLabel = `${duration_seconds}s`;
      }
    } else if (is_relay && relay_count && meters) {
      distanceLabel = `${relay_count}x${meters}m`;
    } else if (meters) {
      distanceLabel = `${meters}m`;
    } else {
      distanceLabel = "Distance inconnue";
    }

    if (created) {
      console.log(
        `✅ Nouvelle distance créée: ${distanceLabel} (id: ${distance.id})`
      );
    } else {
      console.log(
        `ℹ️  Distance déjà existante, réutilisée: ${distanceLabel} (id: ${distance.id})`
      );
    }

    res.status(created ? 201 : 200).json({
      status: "success",
      data: distance,
      created,
      message: created
        ? "Distance créée"
        : "Distance déjà existante, réutilisée",
    });
  } catch (err) {
    console.error("Erreur lors de la création de la distance:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getDistances = async (req, res) => {
  try {
    // Trier : d'abord les distances (par meters), puis les temps (par duration_seconds)
    // MySQL ne supporte pas NULLS LAST, on utilise une approche avec CASE
    const list = await Distance.findAll({
      order: [
        ["is_time_based", "ASC"], // Distances d'abord (false = 0), puis temps (true = 1)
        [
          sequelize.literal(
            "CASE WHEN meters IS NOT NULL THEN meters ELSE 999999 END"
          ),
          "ASC",
        ], // Pour les distances
        [
          sequelize.literal(
            "CASE WHEN duration_seconds IS NOT NULL THEN duration_seconds ELSE 999999 END"
          ),
          "ASC",
        ], // Pour les temps
      ],
    });
    res.json({ status: "success", data: list });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getDistancesByEvent = async (req, res) => {
  try {
    const { event_id } = req.params;
    const EventDistance = require("../models/EventDistance");

    // Récupérer les distances via EventDistance pour cet événement
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

    // Extraire les distances
    const distances = eventDistances
      .map((ed) => ed.distance)
      .filter((d) => d !== null)
      .sort((a, b) => {
        // Trier : distances d'abord, puis temps
        if (a.is_time_based !== b.is_time_based) {
          return a.is_time_based ? 1 : -1;
        }
        if (a.meters !== b.meters) {
          const aMeters = a.meters || 999999;
          const bMeters = b.meters || 999999;
          return aMeters - bMeters;
        }
        const aDuration = a.duration_seconds || 999999;
        const bDuration = b.duration_seconds || 999999;
        return aDuration - bDuration;
      });

    res.json({ status: "success", data: distances });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.deleteDistance = async (req, res) => {
  try {
    const { id } = req.params;
    const distance = await Distance.findByPk(id);
    if (!distance)
      return res.status(404).json({ status: "error", message: "Non trouvée" });
    await distance.destroy();
    res.json({ status: "success", message: "Supprimée" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};
