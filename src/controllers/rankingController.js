const rankingService = require("../services/rankingService");
const clubsDashboardService = require("../services/clubsDashboardService");
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

/**
 * Récupère les classements des clubs groupés par événement pour un type d'événement donné
 */
exports.getClubRankingsByEventType = async (req, res) => {
  try {
    const { event_type } = req.params;
    const { ranking_type = "indoor_points" } = req.query;

    const rankings = await rankingService.getClubRankingsByEventType(
      event_type,
      ranking_type
    );

    res.json({ status: "success", data: rankings });
  } catch (err) {
    console.error("Error fetching club rankings by event type:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * Classement indoor agrégé par saison (règles FF : max meeting standard + CF + défis)
 */
exports.getSeasonIndoorClubRanking = async (req, res) => {
  try {
    const { season } = req.params;
    const data = await rankingService.getSeasonIndoorClubRanking(season);
    res.json({ status: "success", data });
  } catch (err) {
    console.error("Error fetching season indoor ranking:", err);
    const status = err.message && err.message.includes("requis") ? 400 : 500;
    res.status(status).json({ status: "error", message: err.message });
  }
};

/**
 * Dashboard clubs : byEvent + global en un appel (indoor | mer | riviere).
 * Query: type, season?, include_territorial_bonus? (mer uniquement, défaut true)
 */
exports.getClubsDashboard = async (req, res) => {
  try {
    const type = String(req.query.type || "")
      .toLowerCase()
      .trim();
    if (!type || !["indoor", "mer", "riviere"].includes(type)) {
      return res.status(400).json({
        status: "error",
        message: "Query obligatoire : type=indoor|mer|riviere",
      });
    }
    const season = String(
      req.query.season != null
        ? req.query.season
        : new Date().getUTCFullYear(),
    );
    const includeTerritorialBonus =
      String(req.query.include_territorial_bonus ?? "true").toLowerCase() !==
      "false";

    const data = await clubsDashboardService.getClubsDashboard({
      type,
      season,
      includeTerritorialBonus,
    });

    return res.json({
      status: "success",
      data,
      meta: {
        type,
        season,
        include_territorial_bonus: includeTerritorialBonus,
      },
    });
  } catch (err) {
    console.error("Error clubs dashboard:", err);
    const status = err.message && err.message.includes("invalide") ? 400 : 500;
    res.status(status).json({ status: "error", message: err.message });
  }
};

function httpStatusFromErr(err, fallback = 500) {
  if (err && Number.isFinite(Number(err.statusCode))) {
    return Number(err.statusCode);
  }
  return fallback;
}

/**
 * GET /rankings/indoor/defis-capitaux?season=
 */
exports.getDefisCapitauxSeasonRanking = async (req, res) => {
  try {
    const importService = require("../services/importDefisCapitauxRanking");
    const season = String(req.query.season || "").trim();
    const data = await importService.getDefisCapitauxSeasonRanking(season);
    return res.json({ status: "success", data });
  } catch (err) {
    console.error("Error fetching défis capitaux ranking:", err);
    return res
      .status(httpStatusFromErr(err))
      .json({ status: "error", message: err.message });
  }
};

/**
 * POST /rankings/indoor/defis-capitaux/preview  (multipart file)
 */
exports.previewDefisCapitauxImport = async (req, res) => {
  try {
    const importService = require("../services/importDefisCapitauxRanking");
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        status: "error",
        message: "Fichier Excel requis (champ 'file')",
      });
    }
    const data = await importService.previewDefisCapitauxRanking(
      req.file.buffer,
      req.file.originalname
    );
    data.season = String(req.body.season || req.query.season || "").trim() || null;
    return res.json({ status: "success", data });
  } catch (err) {
    console.error("Error previewing défis capitaux import:", err);
    return res
      .status(httpStatusFromErr(err))
      .json({ status: "error", message: err.message });
  }
};

/**
 * POST /rankings/indoor/defis-capitaux/import
 * multipart (file + season) ou JSON { season, rows, source_filename }
 */
exports.importDefisCapitauxRanking = async (req, res) => {
  try {
    const importService = require("../services/importDefisCapitauxRanking");
    const season = String(req.body.season || req.query.season || "").trim();
    if (!season) {
      return res.status(400).json({
        status: "error",
        message: "Paramètre season requis",
      });
    }

    let rows = req.body.rows;
    if (typeof rows === "string") {
      try {
        rows = JSON.parse(rows);
      } catch (_e) {
        rows = null;
      }
    }
    if (!Array.isArray(rows)) {
      rows = null;
    }
    let sourceFilename = req.body.source_filename || null;

    if (!rows) {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({
          status: "error",
          message: "Fichier Excel ou tableau `rows` requis",
        });
      }
      const preview = await importService.previewDefisCapitauxRanking(
        req.file.buffer,
        req.file.originalname
      );
      rows = preview.rows;
      sourceFilename = preview.source_filename;
    }

    const data = await importService.saveDefisCapitauxSeasonRanking({
      season,
      rows,
      sourceFilename,
      importedBy: req.user && req.user.userId,
    });
    return res.status(201).json({
      status: "success",
      message: `${data.rows_count} club(s) importé(s) — points défis capitaux ajoutés au classement indoor`,
      data,
    });
  } catch (err) {
    console.error("Error importing défis capitaux ranking:", err);
    return res
      .status(httpStatusFromErr(err))
      .json({ status: "error", message: err.message });
  }
};

/**
 * DELETE /rankings/indoor/defis-capitaux?season=
 */
exports.deleteDefisCapitauxSeasonRanking = async (req, res) => {
  try {
    const importService = require("../services/importDefisCapitauxRanking");
    const season = String(req.query.season || req.body.season || "").trim();
    const data = await importService.deleteDefisCapitauxSeasonRanking(season);
    return res.json({
      status: "success",
      message: "Import 7 défis capitaux supprimé pour cette saison",
      data,
    });
  } catch (err) {
    console.error("Error deleting défis capitaux ranking:", err);
    return res
      .status(httpStatusFromErr(err))
      .json({ status: "error", message: err.message });
  }
};

