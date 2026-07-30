const { v4: uuidv4 } = require("uuid");
const Race = require("../models/Race");
const RacePhase = require("../models/RacePhase");
const Event = require("../models/Event");
const TimingPoint = require("../models/TimingPoint");
const RaceCrew = require("../models/RaceCrew");
const Crew = require("../models/Crew");
const Timing = require("../models/Timing");
const TimingAssignment = require("../models/TimingAssignment");
const { assertRaceMutable } = require("../utils/raceLock");
const { resolveStartAndFinishPoints } = require("../utils/timingPointUtils");
const {
  parseLifContent,
  mergeTimeWithDate,
} = require("../utils/finishLynxParser");
const { calculateRelativeTime } = require("../utils/relativeTimeCalculator");

const DEVICE_ID = "finishlynx";

function getReferenceDate(race, event) {
  if (race.start_time) return new Date(race.start_time);
  if (event?.start_date) return new Date(event.start_date);
  return new Date();
}

function resolveGunStartDate(parsed, race, event) {
  const referenceDate = getReferenceDate(race, event);

  if (race.start_time) {
    return new Date(race.start_time);
  }

  if (parsed.event.startTimeMs != null) {
    return mergeTimeWithDate(parsed.event.startTimeMs, referenceDate);
  }

  const firstCompetitorStart = parsed.competitors.find(
    (c) => c.timeTrialStartMs != null
  );
  if (firstCompetitorStart) {
    return mergeTimeWithDate(
      firstCompetitorStart.timeTrialStartMs,
      referenceDate
    );
  }

  return null;
}

function computeFinishTimestamp(competitor, parsed, race, event) {
  if (competitor.timeMs == null) return null;

  const referenceDate = getReferenceDate(race, event);
  const gunStart = resolveGunStartDate(parsed, race, event);

  if (competitor.timeTrialStartMs != null) {
    const rowStart = mergeTimeWithDate(
      competitor.timeTrialStartMs,
      referenceDate
    );
    if (rowStart) {
      return new Date(rowStart.getTime() + competitor.timeMs);
    }
  }

  if (gunStart) {
    return new Date(gunStart.getTime() + competitor.timeMs);
  }

  return null;
}

async function loadRaceContext(raceId) {
  const race = await Race.findByPk(raceId, {
    include: [
      {
        model: RacePhase,
        as: "race_phase",
        include: [
          {
            model: Event,
            as: "event",
            include: [{ model: TimingPoint, as: "timing_points" }],
          },
        ],
      },
    ],
  });

  if (!race) {
    const err = new Error("Course non trouvée");
    err.statusCode = 404;
    throw err;
  }

  const event = race.race_phase?.event;
  const timingPoints = event?.timing_points || [];
  const { startPoint, finishPoint } = resolveStartAndFinishPoints(timingPoints);

  if (!finishPoint) {
    const err = new Error("Point d'arrivée introuvable pour cet événement");
    err.statusCode = 400;
    throw err;
  }

  const raceCrews = await RaceCrew.findAll({
    where: { race_id: raceId },
    include: [{ model: Crew, as: "crew" }],
    order: [["lane", "ASC"]],
  });

  return { race, event, startPoint, finishPoint, raceCrews };
}

async function getExistingFinishAssignment(crewId, finishPointId) {
  const assignments = await TimingAssignment.findAll({
    where: { crew_id: crewId },
    include: [
      {
        model: Timing,
        as: "timing",
        where: { timing_point_id: finishPointId },
        required: true,
      },
    ],
  });
  return assignments[0] || null;
}

function buildPreviewRow(competitor, raceCrews, parsed, race, event, finishPointId) {
  const raceCrew = raceCrews.find((rc) => rc.lane === competitor.lane);
  const finishTimestamp = computeFinishTimestamp(competitor, parsed, race, event);

  let action = "skip";
  let message = null;

  if (!competitor.lane) {
    action = "error";
    message = "Couloir manquant dans le fichier LIF";
  } else if (!raceCrew) {
    action = "error";
    message = `Aucun équipage au couloir ${competitor.lane}`;
  } else if (competitor.status) {
    action = "status";
    message = `Statut FinishLynx : ${competitor.place}`;
  } else if (competitor.timeMs == null) {
    action = "skip";
    message = "Temps d'arrivée absent ou invalide";
  } else if (!finishTimestamp) {
    action = "error";
    message = "Impossible de calculer l'horodatage (heure de départ manquante)";
  } else {
    action = "import";
  }

  return {
    lane: competitor.lane,
    place: competitor.place,
    time_raw: competitor.timeRaw,
    time_ms: competitor.timeMs,
    finish_timestamp: finishTimestamp ? finishTimestamp.toISOString() : null,
    status: competitor.status,
    competitor_name: [competitor.firstName, competitor.lastName]
      .filter(Boolean)
      .join(" "),
    affiliation: competitor.affiliation,
    crew_id: raceCrew?.crew_id || null,
    crew_label: raceCrew?.crew?.crew_name || raceCrew?.crew?.club_name || null,
    action,
    message,
    finish_point_id: finishPointId,
  };
}

async function buildFinishLynxPreview(raceId, lifContent) {
  const parsed = parseLifContent(lifContent);
  const { race, event, finishPoint, raceCrews } = await loadRaceContext(raceId);

  const rows = parsed.competitors
    .filter((c) => c.isLikelyCompetitorRow)
    .map((competitor) =>
      buildPreviewRow(competitor, raceCrews, parsed, race, event, finishPoint.id)
    );

  const heatMatches =
    parsed.event.heatNumber != null &&
    race.race_number != null &&
    parsed.event.heatNumber === race.race_number;

  return {
    event: parsed.event,
    race: {
      id: race.id,
      name: race.name,
      race_number: race.race_number,
      status: race.status,
      start_time: race.start_time,
    },
    finish_point: {
      id: finishPoint.id,
      label: finishPoint.label,
    },
    heat_matches: heatMatches,
    rows,
    summary: {
      total: rows.length,
      to_import: rows.filter((r) => r.action === "import").length,
      status_updates: rows.filter((r) => r.action === "status").length,
      errors: rows.filter((r) => r.action === "error").length,
      skipped: rows.filter((r) => r.action === "skip").length,
    },
  };
}

async function emitFinishUpdate(io, eventId, raceId, crewId, timing) {
  if (!io || !eventId) return;

  const relativeTimeMs = await calculateRelativeTime(
    timing,
    crewId,
    eventId,
    raceId
  );

  io.to(`event:${eventId}`).emit("raceFinalUpdate", {
    race_id: raceId,
    crew_id: crewId,
    final_time: relativeTimeMs !== null ? relativeTimeMs.toString() : null,
    relative_time_ms: relativeTimeMs,
  });
}

async function importFinishLynxToRace(raceId, lifContent, options = {}) {
  const { userId, replaceExisting = false, io } = options;

  await assertRaceMutable(raceId);

  const preview = await buildFinishLynxPreview(raceId, lifContent);
  const parsed = parseLifContent(lifContent);
  const { race, event, finishPoint, raceCrews } = await loadRaceContext(raceId);

  const results = [];

  for (const row of preview.rows) {
    if (row.action === "skip") {
      results.push({ ...row, result: "skipped" });
      continue;
    }

    if (row.action === "error") {
      results.push({ ...row, result: "error" });
      continue;
    }

    const raceCrew = raceCrews.find((rc) => rc.lane === row.lane);
    if (!raceCrew) {
      results.push({ ...row, result: "error", message: row.message });
      continue;
    }

    if (row.action === "status") {
      await raceCrew.update({ status: row.status });
      results.push({ ...row, result: "status_updated" });
      continue;
    }

    const existing = await getExistingFinishAssignment(
      raceCrew.crew_id,
      finishPoint.id
    );

    if (existing && !replaceExisting) {
      results.push({
        ...row,
        result: "skipped",
        message: "Arrivée déjà enregistrée pour cet équipage",
      });
      continue;
    }

    if (existing && replaceExisting) {
      await existing.destroy();
      if (existing.timing) {
        await existing.timing.update({ status: "hidden" });
      }
    }

    const finishTimestamp = new Date(row.finish_timestamp);
    const timing = await Timing.create({
      id: uuidv4(),
      timing_point_id: finishPoint.id,
      timestamp: finishTimestamp,
      manual_entry: false,
      status: "assigned",
      entered_by: userId || null,
      device_id: DEVICE_ID,
    });

    await TimingAssignment.create({
      id: uuidv4(),
      timing_id: timing.id,
      crew_id: raceCrew.crew_id,
    });

    await emitFinishUpdate(io, event?.id, race.id, raceCrew.crew_id, timing);

    results.push({
      ...row,
      result: "imported",
      timing_id: timing.id,
    });
  }

  const importedCount = results.filter((r) => r.result === "imported").length;
  if (
    importedCount > 0 &&
    race.status !== "official" &&
    race.status !== "finished"
  ) {
    await race.update({ status: "non_official" });
    race.status = "non_official";
  }

  return {
    ...preview.summary,
    imported: importedCount,
    results,
    race_status: race.status,
  };
}

module.exports = {
  buildFinishLynxPreview,
  importFinishLynxToRace,
  computeFinishTimestamp,
};
