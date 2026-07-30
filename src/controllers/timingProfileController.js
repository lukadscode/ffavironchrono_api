const { v4: uuidv4 } = require("uuid");
const { Op } = require("sequelize");
const TimingProfile = require("../models/TimingProfile");
const Event = require("../models/Event");
const Race = require("../models/Race");
const apiResponse = require("../utils/apiResponse");
const logger = require("../utils/logger");

// Profil "usine" utilisé quand un événement n'a configuré aucun profil.
// Reste permissif : toute la liberté est laissée à l'organisateur, mais le
// chronométreur dispose déjà de tous les modes de capture.
const SYSTEM_DEFAULT_PROFILE = {
  id: null,
  event_id: null,
  name: "Profil standard FFAviron",
  allowed_capture_modes: TimingProfile.CAPTURE_MODES,
  default_capture_mode: "lane_first",
  requires_lane_selection: true,
  allow_raw_capture: true,
  allow_status_shortcuts: true,
  allow_penalties: false,
  auto_start_on_first_detection: false,
  auto_dns_after_minutes: null,
  splits_enabled: false,
  is_default: true,
  is_system_default: true,
};

function whitelist(data = {}) {
  const out = {};
  if (typeof data.name === "string" && data.name.trim()) out.name = data.name.trim().slice(0, 100);
  if (Array.isArray(data.allowed_capture_modes)) {
    const modes = data.allowed_capture_modes.filter((m) => TimingProfile.CAPTURE_MODES.includes(m));
    out.allowed_capture_modes = modes.length ? modes : TimingProfile.CAPTURE_MODES;
  }
  if (
    typeof data.default_capture_mode === "string" &&
    TimingProfile.CAPTURE_MODES.includes(data.default_capture_mode)
  ) {
    out.default_capture_mode = data.default_capture_mode;
  }
  for (const boolField of [
    "requires_lane_selection",
    "allow_raw_capture",
    "allow_status_shortcuts",
    "allow_penalties",
    "auto_start_on_first_detection",
    "splits_enabled",
    "is_default",
  ]) {
    if (typeof data[boolField] === "boolean") out[boolField] = data[boolField];
  }
  if (data.auto_dns_after_minutes === null) out.auto_dns_after_minutes = null;
  else if (Number.isFinite(Number(data.auto_dns_after_minutes))) {
    out.auto_dns_after_minutes = Math.max(1, Math.min(600, Number(data.auto_dns_after_minutes)));
  }
  return out;
}

exports.listProfiles = async (req, res) => {
  try {
    const { event_id } = req.query;
    const where = event_id ? { [Op.or]: [{ event_id }, { event_id: null }] } : {};
    const profiles = await TimingProfile.findAll({
      where,
      order: [
        ["event_id", "DESC"],
        ["created_at", "ASC"],
      ],
    });
    return apiResponse.success(res, profiles);
  } catch (err) {
    logger.error({ err }, "listProfiles error");
    return apiResponse.serverError(res, err.message);
  }
};

exports.getProfile = async (req, res) => {
  try {
    const profile = await TimingProfile.findByPk(req.params.id);
    if (!profile) return apiResponse.notFound(res, "Profil de chronométrage introuvable");
    return apiResponse.success(res, profile);
  } catch (err) {
    return apiResponse.serverError(res, err.message);
  }
};

exports.createProfile = async (req, res) => {
  try {
    const data = whitelist(req.body);
    if (!data.name) return apiResponse.error(res, "Le nom du profil est requis", 400);
    const event_id = req.body?.event_id ?? null;

    const profile = await TimingProfile.create({
      id: uuidv4(),
      event_id,
      allowed_capture_modes: TimingProfile.CAPTURE_MODES,
      ...data,
    });

    if (data.is_default && event_id) {
      await TimingProfile.update(
        { is_default: false },
        { where: { event_id, id: { [Op.ne]: profile.id } } }
      );
    }

    return apiResponse.success(res, profile, 201);
  } catch (err) {
    logger.error({ err }, "createProfile error");
    return apiResponse.serverError(res, err.message);
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const profile = await TimingProfile.findByPk(req.params.id);
    if (!profile) return apiResponse.notFound(res, "Profil de chronométrage introuvable");

    const data = whitelist(req.body);
    await profile.update(data);

    if (data.is_default && profile.event_id) {
      await TimingProfile.update(
        { is_default: false },
        { where: { event_id: profile.event_id, id: { [Op.ne]: profile.id } } }
      );
    }

    return apiResponse.success(res, profile);
  } catch (err) {
    logger.error({ err }, "updateProfile error");
    return apiResponse.serverError(res, err.message);
  }
};

exports.deleteProfile = async (req, res) => {
  try {
    const profile = await TimingProfile.findByPk(req.params.id);
    if (!profile) return apiResponse.notFound(res, "Profil de chronométrage introuvable");

    await Event.update({ timing_profile_id: null }, { where: { timing_profile_id: profile.id } });
    await Race.update({ timing_profile_id: null }, { where: { timing_profile_id: profile.id } });
    await profile.destroy();

    return apiResponse.message(res, "Profil supprimé");
  } catch (err) {
    return apiResponse.serverError(res, err.message);
  }
};

/**
 * Résout le profil effectif applicable à une course :
 * override course > profil par défaut de l'événement > profil "is_default" de l'événement
 * > profil système par défaut (permissif, tout autorisé).
 */
async function resolveEffectiveProfile({ eventId, raceId }) {
  let race = null;
  if (raceId) {
    race = await Race.findByPk(raceId);
    if (race?.timing_profile_id) {
      const raceProfile = await TimingProfile.findByPk(race.timing_profile_id);
      if (raceProfile) return raceProfile;
    }
  }

  const event = eventId ? await Event.findByPk(eventId) : null;
  if (event?.timing_profile_id) {
    const eventProfile = await TimingProfile.findByPk(event.timing_profile_id);
    if (eventProfile) return eventProfile;
  }

  if (eventId) {
    const defaultProfile = await TimingProfile.findOne({
      where: { event_id: eventId, is_default: true },
      order: [["created_at", "ASC"]],
    });
    if (defaultProfile) return defaultProfile;
  }

  return SYSTEM_DEFAULT_PROFILE;
}

exports.resolveProfile = async (req, res) => {
  try {
    const { event_id, race_id } = req.query;
    if (!event_id && !race_id) {
      return apiResponse.error(res, "event_id ou race_id requis", 400);
    }
    let eventId = event_id ?? null;
    if (!eventId && race_id) {
      const race = await Race.findByPk(race_id);
      const RacePhase = require("../models/RacePhase");
      const phase = race ? await RacePhase.findByPk(race.phase_id) : null;
      eventId = phase?.event_id ?? null;
    }

    // Un poste de chronométrage ne peut résoudre que le profil de son propre événement.
    if (req.timingPoint?.event_id && eventId && req.timingPoint.event_id !== eventId) {
      return apiResponse.forbidden(res, "Accès interdit (timing point)");
    }

    const profile = await resolveEffectiveProfile({ eventId, raceId: race_id ?? null });
    return apiResponse.success(res, profile);
  } catch (err) {
    logger.error({ err }, "resolveProfile error");
    return apiResponse.serverError(res, err.message);
  }
};

exports.resolveEffectiveProfile = resolveEffectiveProfile;
exports.SYSTEM_DEFAULT_PROFILE = SYSTEM_DEFAULT_PROFILE;
