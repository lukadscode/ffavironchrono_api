const Event = require("../models/Event");
const Race = require("../models/Race");
const RacePhase = require("../models/RacePhase");
const RaceCrew = require("../models/RaceCrew");
const Crew = require("../models/Crew");
const Category = require("../models/Category");
const TimingPoint = require("../models/TimingPoint");
const TimingAssignment = require("../models/TimingAssignment");
const Timing = require("../models/Timing");
const { assignDeadHeatPositions } = require("../utils/rankingUtils");

function resolveFinishPoint(timingPoints) {
  const sorted = [...timingPoints].sort((a, b) => a.order_index - b.order_index);
  const startPoint = sorted[0];
  const finishPoint =
    sorted.find(
      (tp) =>
        tp.label === "Finish" ||
        tp.label === "finish" ||
        tp.label === "Arrivée" ||
        tp.label === "arrivée"
    ) || sorted[sorted.length - 1];
  return { startPoint, finishPoint };
}

/**
 * Résultats d'un événement regroupés par catégorie (courses official / non_official / finished).
 */
async function getEventResultsByCategory(eventId) {
  const event = await Event.findByPk(eventId, {
    include: [{ model: TimingPoint, as: "timing_points" }],
  });
  if (!event) {
    const err = new Error("Événement non trouvé");
    err.statusCode = 404;
    throw err;
  }

  const { startPoint, finishPoint } = resolveFinishPoint(event.timing_points || []);
  if (!startPoint || !finishPoint) {
    return [];
  }

  const races = await Race.findAll({
    where: { status: ["official", "non_official", "finished"] },
    include: [
      {
        model: RacePhase,
        where: { event_id: eventId },
        required: true,
      },
      {
        model: RaceCrew,
        as: "race_crews",
        include: [
          {
            model: Crew,
            as: "crew",
            include: [{ model: Category, as: "category" }],
          },
        ],
      },
    ],
    order: [["race_number", "ASC"]],
  });

  const flatResults = [];

  for (const race of races) {
    const phase = race.RacePhase;
    for (const raceCrew of race.race_crews || []) {
      const category = raceCrew.crew?.category;
      if (!category) continue;

      const timingAssignments = await TimingAssignment.findAll({
        where: { crew_id: raceCrew.crew_id },
        include: [
          {
            model: Timing,
            as: "timing",
            where: { timing_point_id: [startPoint.id, finishPoint.id] },
            required: false,
          },
        ],
      });

      const startTiming = timingAssignments.find(
        (ta) => ta.timing && ta.timing.timing_point_id === startPoint.id
      );
      const finishTiming = timingAssignments.find(
        (ta) => ta.timing && ta.timing.timing_point_id === finishPoint.id
      );

      let duration_ms = null;
      let finish_time = null;

      if (finishTiming?.timing?.timestamp) {
        finish_time = finishTiming.timing.timestamp;
        if (startTiming?.timing?.timestamp) {
          duration_ms =
            new Date(finishTiming.timing.timestamp).getTime() -
            new Date(startTiming.timing.timestamp).getTime();
        }
      }

      const adjustmentMs = Number(raceCrew.adjustment_ms) || 0;
      if (duration_ms !== null) {
        duration_ms += adjustmentMs;
      }

      flatResults.push({
        race_id: race.id,
        race_number: race.race_number,
        phase_id: race.phase_id,
        phase_name: phase?.name || null,
        crew_id: raceCrew.crew_id,
        lane: raceCrew.lane,
        club_name: raceCrew.crew?.club_name || null,
        club_code: raceCrew.crew?.club_code || null,
        finish_time,
        final_time: duration_ms !== null ? String(duration_ms) : null,
        has_timing: finish_time !== null,
        category,
      });
    }
  }

  const grouped = new Map();
  for (const row of flatResults) {
    const cat = row.category;
    if (!grouped.has(cat.id)) {
      grouped.set(cat.id, {
        category: {
          id: cat.id,
          code: cat.code,
          label: cat.label,
          age_group: cat.age_group,
          gender: cat.gender,
        },
        results: [],
      });
    }
    const { category: _cat, ...resultRow } = row;
    grouped.get(cat.id).results.push(resultRow);
  }

  const formatted = Array.from(grouped.values()).map(({ category, results }) => {
    const withTiming = results
      .filter((r) => r.has_timing && r.final_time !== null)
      .sort((a, b) => parseInt(a.final_time, 10) - parseInt(b.final_time, 10));
    const withoutTiming = results
      .filter((r) => !r.has_timing || r.final_time === null)
      .map((r) => ({ ...r, position: null }));

    const ranked = assignDeadHeatPositions(withTiming, (r) =>
      r.final_time !== null ? parseInt(r.final_time, 10) : null
    );

    return {
      category,
      results: [...ranked, ...withoutTiming].sort(
        (a, b) => (a.position ?? 999) - (b.position ?? 999)
      ),
    };
  });

  formatted.sort((a, b) =>
    (a.category.label || a.category.code || "").localeCompare(
      b.category.label || b.category.code || ""
    )
  );

  return formatted;
}

module.exports = { getEventResultsByCategory };
