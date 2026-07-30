const UserEvent = require("../models/UserEvent");
const Crew = require("../models/Crew");
const Race = require("../models/Race");
const RacePhase = require("../models/RacePhase");
const Timing = require("../models/Timing");
const TimingPoint = require("../models/TimingPoint");
const Notification = require("../models/Notification");
const TimingAssignment = require("../models/TimingAssignment");
const CrewParticipant = require("../models/CrewParticipant");
const RaceCrew = require("../models/RaceCrew");
const EventCategory = require("../models/EventCategory");

const { getRank, minRequiredRank } = require("../utils/rbacRoleRank");
const apiResponse = require("../utils/apiResponse");

function forbidden(res, message) {
  return apiResponse.forbidden(res, message);
}

function unauthorized(res, message) {
  return apiResponse.unauthorized(res, message);
}

async function resolveEventIdFromRaceId(raceId) {
  const race = await Race.findByPk(raceId);
  if (!race) return null;
  const phase = await RacePhase.findByPk(race.phase_id);
  return phase?.event_id ?? null;
}

async function resolveEventIdFromRacePhaseId(phaseId) {
  const phase = await RacePhase.findByPk(phaseId);
  return phase?.event_id ?? null;
}

async function resolveEventIdFromCrewId(crewId) {
  const crew = await Crew.findByPk(crewId);
  return crew?.event_id ?? null;
}

async function resolveEventIdFromTimingPointId(timingPointId) {
  const tp = await TimingPoint.findByPk(timingPointId);
  return tp?.event_id ?? null;
}

async function resolveEventIdFromTimingId(timingId) {
  const timing = await Timing.findByPk(timingId);
  if (!timing?.timing_point_id) return null;
  return await resolveEventIdFromTimingPointId(timing.timing_point_id);
}

async function resolveEventIdFromTimingAssignmentId(assignmentId) {
  const assignment = await TimingAssignment.findByPk(assignmentId);
  if (!assignment?.timing_id) return null;
  return await resolveEventIdFromTimingId(assignment.timing_id);
}

async function resolveEventIdFromCrewParticipantId(crewParticipantId) {
  const cp = await CrewParticipant.findByPk(crewParticipantId);
  if (!cp?.crew_id) return null;
  return await resolveEventIdFromCrewId(cp.crew_id);
}

async function resolveEventIdFromRaceCrewId(raceCrewId) {
  const rc = await RaceCrew.findByPk(raceCrewId);
  if (!rc?.race_id) return null;
  return await resolveEventIdFromRaceId(rc.race_id);
}

async function resolveEventIdFromEventCategoryId(eventCategoryId) {
  const ec = await EventCategory.findByPk(eventCategoryId);
  return ec?.event_id ?? null;
}

async function resolveEventIdFromEventDistanceParams(eventId) {
  return eventId ?? null;
}

async function resolveEventIdFromNotificationId(notificationId) {
  const notif = await Notification.findByPk(notificationId);
  return notif?.event_id ?? null;
}

async function resolveEventIdFromUserEventId(userEventId) {
  const ue = await UserEvent.findByPk(userEventId);
  return ue?.event_id ?? null;
}

async function resolveEventIdFromTimingProfileId(timingProfileId) {
  const TimingProfile = require("../models/TimingProfile");
  const profile = await TimingProfile.findByPk(timingProfileId);
  return profile?.event_id ?? null;
}

/**
 * RBAC par événement.
 *
 * - Admin/superadmin passent toujours.
 * - Pour un utilisateur standard : vérifie `user_events` et applique une hiérarchie de rôles.
 * - Optionnel : autoriser un token timing point (`req.timingPoint`) pour des routes chrono
 *   (dans ce cas, seul l'event_id doit matcher).
 */
function requireEventRole({
  roles,
  getEventId,
  allowTimingPointToken = false,
} = {}) {
  const requiredRank = minRequiredRank(roles);

  return async (req, res, next) => {
    try {
      const eventId = await (typeof getEventId === "function" ? getEventId(req) : null);
      if (!eventId) {
        return forbidden(res, "Impossible de déterminer l'événement pour cette action");
      }

      // Token timing point (mobile/poste chrono)
      if (allowTimingPointToken && req.timingPoint?.event_id) {
        if (req.timingPoint.event_id !== eventId) {
          return forbidden(res, "Accès interdit (timing point)");
        }
        return next();
      }

      // Token utilisateur requis
      if (!req.user?.userId) {
        return unauthorized(res, "Authentification requise");
      }

      // Bypass global admins
      if (req.user.role === "admin" || req.user.role === "superadmin") {
        return next();
      }

      const membership = await UserEvent.findOne({
        where: { user_id: req.user.userId, event_id: eventId },
      });

      if (!membership) {
        return forbidden(res, "Accès interdit à cet événement");
      }

      const userRank = getRank(membership.role);
      if (userRank < requiredRank) {
        return forbidden(res, "Permissions insuffisantes pour cet événement");
      }

      req.eventAccess = { event_id: eventId, role: membership.role };
      return next();
    } catch (err) {
      return res.status(500).json({ status: "error", message: "Erreur RBAC événement" });
    }
  };
}

// Helpers de résolution d'event_id pour les routes
const resolvers = {
  eventIdFromParams: (paramName) => async (req) => req.params?.[paramName] ?? null,
  eventIdFromBody: (key) => async (req) => req.body?.[key] ?? null,
  eventIdFromCrewIdParam: (paramName) => async (req) =>
    await resolveEventIdFromCrewId(req.params?.[paramName]),
  eventIdFromRaceIdParam: (paramName) => async (req) =>
    await resolveEventIdFromRaceId(req.params?.[paramName]),
  eventIdFromRacePhaseIdParam: (paramName) => async (req) =>
    await resolveEventIdFromRacePhaseId(req.params?.[paramName]),
  eventIdFromRacePhaseBody: (key) => async (req) =>
    await resolveEventIdFromRacePhaseId(req.body?.[key]),
  eventIdFromTimingPointIdParam: (paramName) => async (req) =>
    await resolveEventIdFromTimingPointId(req.params?.[paramName]),
  eventIdFromTimingIdParam: (paramName) => async (req) =>
    await resolveEventIdFromTimingId(req.params?.[paramName]),
  eventIdFromTimingAssignmentIdParam: (paramName) => async (req) =>
    await resolveEventIdFromTimingAssignmentId(req.params?.[paramName]),
  eventIdFromCrewParticipantIdParam: (paramName) => async (req) =>
    await resolveEventIdFromCrewParticipantId(req.params?.[paramName]),
  eventIdFromRaceCrewIdParam: (paramName) => async (req) =>
    await resolveEventIdFromRaceCrewId(req.params?.[paramName]),
  eventIdFromEventCategoryIdParam: (paramName) => async (req) =>
    await resolveEventIdFromEventCategoryId(req.params?.[paramName]),
  eventIdFromNotificationIdParam: (paramName) => async (req) =>
    await resolveEventIdFromNotificationId(req.params?.[paramName]),
  eventIdFromUserEventIdParam: (paramName) => async (req) =>
    await resolveEventIdFromUserEventId(req.params?.[paramName]),
  eventIdFromRaceBody: (key) => async (req) => await resolveEventIdFromRaceId(req.body?.[key]),
  eventIdFromCrewBody: (key) => async (req) => await resolveEventIdFromCrewId(req.body?.[key]),
  eventIdFromTimingPointBody: (key) => async (req) =>
    await resolveEventIdFromTimingPointId(req.body?.[key]),
  eventIdFromTimingBody: (key) => async (req) => await resolveEventIdFromTimingId(req.body?.[key]),
  eventIdFromTimingProfileIdParam: (paramName) => async (req) =>
    await resolveEventIdFromTimingProfileId(req.params?.[paramName]),
};

module.exports = { requireEventRole, resolvers };

