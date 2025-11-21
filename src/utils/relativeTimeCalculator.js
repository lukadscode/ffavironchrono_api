const TimingAssignment = require("../models/TimingAssignment");
const Timing = require("../models/Timing");
const TimingPoint = require("../models/TimingPoint");

/**
 * Trouve le point de départ pour un événement
 * Le point de départ est le point avec le order_index le plus petit
 */
async function getStartTimingPoint(eventId) {
  const startPoint = await TimingPoint.findOne({
    where: { event_id: eventId },
    order: [["order_index", "ASC"]],
  });
  return startPoint;
}

/**
 * Trouve le timing de départ pour un équipage dans une course
 * @param {string} crewId - ID de l'équipage
 * @param {string} startPointId - ID du point de départ
 * @returns {Promise<Timing|null>} Le timing de départ ou null
 */
async function getStartTiming(crewId, startPointId) {
  const assignment = await TimingAssignment.findOne({
    where: { crew_id: crewId },
    include: [
      {
        model: Timing,
        as: "timing",
        where: { timing_point_id: startPointId },
        required: true,
      },
    ],
    order: [[{ model: Timing, as: "timing" }, "timestamp", "DESC"]],
  });

  return assignment?.timing || null;
}

/**
 * Calcule le temps relatif en millisecondes depuis le départ
 * @param {Object} timing - L'objet Timing
 * @param {string} crewId - ID de l'équipage (peut être null)
 * @param {string} eventId - ID de l'événement
 * @returns {Promise<number|null>} Temps relatif en ms ou null
 */
async function calculateRelativeTime(timing, crewId, eventId) {
  // Si pas d'équipage assigné, pas de calcul possible
  if (!crewId) {
    return null;
  }

  // Si pas de timestamp, pas de calcul possible
  if (!timing.timestamp) {
    return null;
  }

  try {
    // 1. Trouver le point de départ
    const startPoint = await getStartTimingPoint(eventId);
    if (!startPoint) {
      return null;
    }

    // 2. Si c'est le point de départ lui-même, retourner 0
    if (timing.timing_point_id === startPoint.id) {
      return 0;
    }

    // 3. Trouver le timing de départ pour cet équipage
    const startTiming = await getStartTiming(crewId, startPoint.id);
    if (!startTiming || !startTiming.timestamp) {
      return null;
    }

    // 4. Calculer la différence en millisecondes
    const startTime = new Date(startTiming.timestamp).getTime();
    const currentTime = new Date(timing.timestamp).getTime();
    const diffMs = currentTime - startTime;

    // 5. Vérifier que le temps est valide (positif et raisonnable)
    if (diffMs < 0) {
      // Temps négatif = erreur de logique
      return null;
    }

    if (diffMs > 1800000) {
      // Plus de 30 minutes = probablement une erreur
      return null;
    }

    return diffMs;
  } catch (error) {
    console.error("Error calculating relative time:", error);
    return null;
  }
}

/**
 * Enrichit un timing avec relative_time_ms, crew_id, et race_id
 * @param {Object} timing - L'objet Timing avec ses relations
 * @returns {Object} Timing enrichi
 */
async function enrichTimingWithRelativeTime(timing) {
  // Extraire crew_id et race_id depuis les relations
  let crewId = null;
  let raceId = null;
  let eventId = null;

  // Convertir en JSON pour accéder facilement aux propriétés
  const timingData = timing.toJSON ? timing.toJSON() : timing;

  // Chercher crew_id dans TimingAssignment
  // Sequelize peut utiliser TimingAssignment (singulier) ou TimingAssignments (pluriel)
  let assignment = null;

  // Essayer d'abord au singulier (hasOne relation)
  if (timingData.TimingAssignment) {
    assignment = timingData.TimingAssignment;
  }
  // Puis au pluriel (si Sequelize l'a créé ainsi)
  else if (timingData.TimingAssignments) {
    if (
      Array.isArray(timingData.TimingAssignments) &&
      timingData.TimingAssignments.length > 0
    ) {
      assignment = timingData.TimingAssignments[0];
    } else if (
      timingData.TimingAssignments &&
      !Array.isArray(timingData.TimingAssignments)
    ) {
      assignment = timingData.TimingAssignments;
    }
  }
  // Essayer aussi sur l'objet Sequelize directement (avant toJSON)
  else if (timing.TimingAssignment) {
    const rawAssignment = timing.TimingAssignment;
    assignment = rawAssignment.toJSON ? rawAssignment.toJSON() : rawAssignment;
  } else if (timing.TimingAssignments) {
    if (
      Array.isArray(timing.TimingAssignments) &&
      timing.TimingAssignments.length > 0
    ) {
      const rawAssignment = timing.TimingAssignments[0];
      assignment = rawAssignment.toJSON
        ? rawAssignment.toJSON()
        : rawAssignment;
    }
  }

  if (assignment) {
    crewId = assignment.crew_id;

    // Chercher race_id dans les relations
    if (assignment.Crew) {
      const crew = assignment.Crew;
      const crewData = crew.toJSON ? crew.toJSON() : crew;

      // RaceCrews peut être un tableau ou un objet unique
      const raceCrews = crewData.RaceCrews
        ? Array.isArray(crewData.RaceCrews)
          ? crewData.RaceCrews
          : [crewData.RaceCrews]
        : [];

      if (raceCrews.length > 0) {
        const raceCrew = raceCrews[0];
        const raceCrewData = raceCrew.toJSON ? raceCrew.toJSON() : raceCrew;
        if (raceCrewData.Race) {
          const race = raceCrewData.Race;
          const raceData = race.toJSON ? race.toJSON() : race;
          raceId = raceData.id;
        }
      }
    }
  }

  // Chercher event_id depuis TimingPoint
  if (timingData.TimingPoint) {
    eventId = timingData.TimingPoint.event_id;
  } else if (timing.TimingPoint) {
    const point = timing.TimingPoint;
    const pointData = point.toJSON ? point.toJSON() : point;
    eventId = pointData.event_id;
  }

  // Calculer le temps relatif
  let relativeTimeMs = null;

  if (eventId && crewId) {
    // Timing assigné à un équipage - calculer le temps relatif
    relativeTimeMs = await calculateRelativeTime(timing, crewId, eventId);
  }

  // Retourner l'objet enrichi
  return {
    ...timingData,
    relative_time_ms: relativeTimeMs,
    crew_id: crewId,
    race_id: raceId,
  };
}

/**
 * Enrichit plusieurs timings avec relative_time_ms
 * @param {Array} timings - Tableau de timings
 * @returns {Promise<Array>} Tableau de timings enrichis
 */
async function enrichTimingsWithRelativeTime(timings) {
  // Pour optimiser, on groupe par event_id et crew_id pour éviter les requêtes répétées
  const enrichedTimings = await Promise.all(
    timings.map((timing) => enrichTimingWithRelativeTime(timing))
  );

  return enrichedTimings;
}

/**
 * Enrichit un timing assignment avec relative_time_ms
 * @param {Object} assignment - L'objet TimingAssignment avec ses relations
 * @returns {Object} Assignment enrichi
 */
async function enrichAssignmentWithRelativeTime(assignment) {
  let crewId = null;
  let raceId = null;
  let eventId = null;
  let timing = null;

  // Extraire les informations
  if (assignment.crew_id) {
    crewId = assignment.crew_id;
  }

  // Chercher race_id et event_id depuis Crew -> RaceCrews -> Race -> RacePhase
  if (assignment.Crew) {
    const raceCrews = assignment.Crew.RaceCrews
      ? Array.isArray(assignment.Crew.RaceCrews)
        ? assignment.Crew.RaceCrews
        : [assignment.Crew.RaceCrews]
      : [];

    if (raceCrews.length > 0) {
      const raceCrew = raceCrews[0];
      if (raceCrew.Race) {
        raceId = raceCrew.Race.id;
        if (raceCrew.Race.RacePhase) {
          eventId = raceCrew.Race.RacePhase.event_id;
        }
      }
    }
  }

  // Chercher event_id depuis timing -> TimingPoint si pas encore trouvé
  if (assignment.timing) {
    timing = assignment.timing;
    if (timing.TimingPoint && !eventId) {
      eventId = timing.TimingPoint.event_id;
    }
  }

  // Calculer le temps relatif
  const relativeTimeMs =
    timing && eventId
      ? await calculateRelativeTime(timing, crewId, eventId)
      : null;

  // Retourner l'objet enrichi
  const assignmentJson = assignment.toJSON ? assignment.toJSON() : assignment;
  const enriched = {
    ...assignmentJson,
    relative_time_ms: relativeTimeMs,
  };

  // Si on a un timing, l'enrichir aussi
  if (enriched.timing) {
    enriched.timing = {
      ...enriched.timing,
      relative_time_ms: relativeTimeMs,
      crew_id: crewId,
      race_id: raceId,
    };
  }

  return enriched;
}

/**
 * Enrichit plusieurs assignments avec relative_time_ms
 * @param {Array} assignments - Tableau d'assignments
 * @returns {Promise<Array>} Tableau d'assignments enrichis
 */
async function enrichAssignmentsWithRelativeTime(assignments) {
  const enrichedAssignments = await Promise.all(
    assignments.map((assignment) =>
      enrichAssignmentWithRelativeTime(assignment)
    )
  );

  return enrichedAssignments;
}

module.exports = {
  calculateRelativeTime,
  enrichTimingWithRelativeTime,
  enrichTimingsWithRelativeTime,
  enrichAssignmentWithRelativeTime,
  enrichAssignmentsWithRelativeTime,
  getStartTimingPoint,
  getStartTiming,
};
