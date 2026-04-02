const { v4: uuidv4 } = require("uuid");
const EnduranceMerImportResult = require("../models/EnduranceMerImportResult");
const EnduranceMerTerritorialBonus = require("../models/EnduranceMerTerritorialBonus");
const Event = require("../models/Event");
const { importEnduranceMerExcel, getEnduranceMerRankingForEvent, getGlobalMerRanking } = require("../services/importEnduranceMerResults");

async function importResults(req, res) {
  try {
    const { eventId } = req.params;
    if (!eventId) return res.status(400).json({ status: "error", message: "eventId requis" });
    if (!req.file || !req.file.buffer) return res.status(400).json({ status: "error", message: "Fichier Excel requis (champ 'file')" });

    const eventFormat = (req.body.event_format || "enduro").toLowerCase();
    const eventLevel = (req.body.event_level || "territorial").toLowerCase();
    const replacePrevious = req.body.replace_previous === "true" || req.body.replace_previous === true;

    const result = await importEnduranceMerExcel(eventId, req.file.buffer, {
      event_format: eventFormat,
      event_level: eventLevel,
      replace_previous: replacePrevious,
    });

    return res.status(201).json({
      status: "success",
      message: `${result.inserted} resultat(s) importe(s)`,
      data: { event_id: eventId, inserted: result.inserted, epreuves: result.epreuves, errors: result.errors.length ? result.errors : undefined },
    });
  } catch (err) {
    console.error("Import endurance mer:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
}

async function getImportResults(req, res) {
  try {
    const { eventId } = req.params;
    const { epreuve_code, club_code } = req.query;

    const event = await Event.findByPk(eventId);
    if (!event) return res.status(404).json({ status: "error", message: "Evenement introuvable" });

    const where = { event_id: eventId };
    if (epreuve_code) where.epreuve_code = epreuve_code;
    if (club_code) where.club_code = club_code;

    const results = await EnduranceMerImportResult.findAll({ where, order: [["epreuve_code", "ASC"], ["place", "ASC"]] });
    return res.json({ status: "success", data: results });
  } catch (err) {
    console.error("List endurance mer results:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
}

async function getRanking(req, res) {
  try {
    const { eventId } = req.params;
    const event = await Event.findByPk(eventId);
    if (!event) return res.status(404).json({ status: "error", message: "Evenement introuvable" });

    const ranking = await getEnduranceMerRankingForEvent(eventId);
    return res.json({ status: "success", data: ranking });
  } catch (err) {
    console.error("Endurance mer ranking:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
}

async function getGlobalRanking(req, res) {
  try {
    const season = String(req.query.season || new Date().getUTCFullYear());
    const includeTerritorialBonus = String(req.query.include_territorial_bonus || "true").toLowerCase() !== "false";
    const ranking = await getGlobalMerRanking({ season, includeTerritorialBonus });
    return res.json({ status: "success", data: ranking, meta: { season, include_territorial_bonus: includeTerritorialBonus } });
  } catch (err) {
    console.error("Endurance mer global ranking:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
}

async function createTerritorialBonus(req, res) {
  try {
    const { season = "2026", club_code = null, club_name, points = 67.5, notes = null, is_active = true } = req.body;
    if (!club_name) return res.status(400).json({ status: "error", message: "club_name requis" });

    const bonus = await EnduranceMerTerritorialBonus.create({
      id: uuidv4(),
      season: String(season),
      club_code,
      club_name,
      points,
      notes,
      is_active,
    });

    return res.status(201).json({ status: "success", data: bonus });
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
}

async function listTerritorialBonus(req, res) {
  try {
    const season = String(req.query.season || "2026");
    const items = await EnduranceMerTerritorialBonus.findAll({ where: { season }, order: [["club_name", "ASC"]] });
    return res.json({ status: "success", data: items });
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
}

module.exports = {
  importResults,
  getImportResults,
  getRanking,
  getGlobalRanking,
  createTerritorialBonus,
  listTerritorialBonus,
};