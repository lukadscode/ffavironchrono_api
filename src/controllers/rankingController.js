const rankingService = require("../services/rankingService");
const ScoringTemplate = require("../models/ScoringTemplate");
const ClubRanking = require("../models/ClubRanking");
const RankingPoint = require("../models/RankingPoint");

/**
 * Calcule les points pour une course
 */
exports.calculatePointsForRace = async (req, res) => {
  try {
    const { race_id } = req.params;
    const { ranking_type = "indoor_points" } = req.query;

    const result = await rankingService.calculatePointsForRace(
      race_id,
      ranking_type
    );

    res.json({ status: "success", data: result });
  } catch (err) {
    console.error("Error calculating points:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * Récupère le classement des clubs pour un événement
 */
exports.getClubRanking = async (req, res) => {
  try {
    const { event_id } = req.params;
    const { ranking_type = "indoor_points" } = req.query;

    const rankings = await rankingService.getClubRanking(
      event_id,
      ranking_type
    );

    res.json({ status: "success", data: rankings });
  } catch (err) {
    console.error("Error fetching club ranking:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * Recalcule les rangs pour un événement
 */
exports.recalculateRanks = async (req, res) => {
  try {
    const { event_id } = req.params;
    const { ranking_type = "indoor_points" } = req.body;

    const rankings = await rankingService.recalculateRanks(
      event_id,
      ranking_type
    );

    res.json({
      status: "success",
      message: "Rangs recalculés",
      data: rankings,
    });
  } catch (err) {
    console.error("Error recalculating ranks:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * Récupère les templates de points
 */
exports.getScoringTemplates = async (req, res) => {
  try {
    const { type } = req.query;
    const where = type ? { type } : {};
    const templates = await ScoringTemplate.findAll({ where });
    res.json({ status: "success", data: templates });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * Crée un template de points
 */
exports.createScoringTemplate = async (req, res) => {
  try {
    const { v4: uuidv4 } = require("uuid");
    const template = await ScoringTemplate.create({
      id: uuidv4(),
      ...req.body,
    });
    res.status(201).json({ status: "success", data: template });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * Récupère les points détaillés pour un club
 */
exports.getClubPoints = async (req, res) => {
  try {
    const { event_id, club_name } = req.params;
    const { ranking_type = "indoor_points" } = req.query;

    const clubRanking = await ClubRanking.findOne({
      where: {
        event_id,
        club_name,
        ranking_type,
      },
      include: [
        {
          model: RankingPoint,
          as: "ranking_points",
          include: [
            {
              model: require("../models/Race"),
              required: false,
            },
            {
              model: require("../models/Crew"),
              required: false,
            },
          ],
        },
      ],
    });

    if (!clubRanking) {
      return res.status(404).json({
        status: "error",
        message: "Classement non trouvé pour ce club",
      });
    }

    res.json({ status: "success", data: clubRanking });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};



