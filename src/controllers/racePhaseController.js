const { v4: uuidv4 } = require("uuid");
const RacePhase = require("../models/RacePhase");
const Event = require("../models/Event");
const Race = require("../models/Race");
const RaceCrew = require("../models/RaceCrew");
const Crew = require("../models/Crew");
const Category = require("../models/Category");
const TimingPoint = require("../models/TimingPoint");
const Timing = require("../models/Timing");
const TimingAssignment = require("../models/TimingAssignment");

exports.createRacePhase = async (req, res) => {
  try {
    const { event_id, name, order_index } = req.body;
    const phase = await RacePhase.create({
      id: uuidv4(),
      event_id,
      name,
      order_index,
    });
    res.status(201).json({ status: "success", data: phase });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getRacePhasesByEvent = async (req, res) => {
  try {
    const event_id = req.params.event_id;
    const phases = await RacePhase.findAll({
      where: { event_id },
      order: [["order_index", "ASC"]],
    });
    res.json({ status: "success", data: phases });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.updateRacePhase = async (req, res) => {
  try {
    const { id } = req.params;
    const phase = await RacePhase.findByPk(id);
    if (!phase)
      return res.status(404).json({ status: "error", message: "Non trouvée" });
    await phase.update(req.body);
    res.json({ status: "success", data: phase });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.deleteRacePhase = async (req, res) => {
  try {
    const { id } = req.params;
    const phase = await RacePhase.findByPk(id);
    if (!phase)
      return res.status(404).json({ status: "error", message: "Non trouvée" });

    // 🔄 Suppression automatique de tout ce qui dépend de la phase
    // 1) Récupérer toutes les courses de cette phase
    const races = await Race.findAll({ where: { phase_id: id } });
    const raceIds = races.map((r) => r.id);

    // 2) Supprimer les RaceCrew liés à ces courses
    if (raceIds.length > 0) {
      await RaceCrew.destroy({ where: { race_id: raceIds } });
    }

    // 3) Supprimer les courses de cette phase
    await Race.destroy({ where: { phase_id: id } });

    // 4) Supprimer enfin la phase
    await phase.destroy();

    res.json({
      status: "success",
      message: "Phase et courses associées supprimées automatiquement",
      data: {
        deleted_races: raceIds.length,
      },
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getPhaseResults = async (req, res) => {
  try {
    const { id } = req.params;
    const { groupByCategory } = req.query;

    const races = await Race.findAll({
      where: { phase_id: id },
      include: [
        {
          model: RaceCrew,
          as: "race_crews",
          include: [
            {
              model: Crew,
              as: "crew",
              include: [
                {
                  model: Category,
                  as: "category",
                },
              ],
            },
          ],
        },
        {
          model: RacePhase,
          as: "race_phase",
          include: [
            {
              model: Event,
              as: "event",
              include: [
                {
                  model: TimingPoint,
                  as: "timing_points",
                },
              ],
            },
          ],
        },
      ],
    });

    if (races.length === 0) {
      return res
        .status(404)
        .json({ message: "Phase not found or no races" });
    }

    const event = races[0].race_phase.event;
    const timingPoints = event.timing_points.sort((a, b) => a.order - b.order);

    const startPoint = timingPoints[0];
    const finishPoint =
      timingPoints.find(
        (tp) =>
          tp.label === "Finish" ||
          tp.label === "finish" ||
          tp.label === "Arrivée" ||
          tp.label === "arrivée"
      ) || timingPoints[timingPoints.length - 1];

    const results = [];

    for (const race of races) {
      for (const raceCrew of race.race_crews) {
        const timingAssignments = await TimingAssignment.findAll({
          where: { crew_id: raceCrew.crew_id },
          include: [
            {
              model: Timing,
              as: "timing",
              where: {
                timing_point_id: [startPoint.id, finishPoint.id],
              },
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
            const start = new Date(startTiming.timing.timestamp);
            const finish = new Date(finishTiming.timing.timestamp);
            duration_ms = finish - start;
          }
        }

        results.push({
          crew_id: raceCrew.crew_id,
          crew: {
            id: raceCrew.crew.id,
            club_name: raceCrew.crew.club_name,
            club_code: raceCrew.crew.club_code,
            category_id: raceCrew.crew.category_id,
            category_label: raceCrew.crew.category?.label || null,
          },
          race: {
            id: race.id,
            name: race.name,
            race_number: race.race_number,
          },
          lane: raceCrew.lane,
          finish_time,
          duration_ms,
          has_timing: finish_time !== null,
        });
      }
    }

    const raceGroups = {};
    results.forEach((r) => {
      if (!raceGroups[r.race.id]) raceGroups[r.race.id] = [];
      raceGroups[r.race.id].push(r);
    });

    Object.values(raceGroups).forEach((raceResults) => {
      const sorted = raceResults
        .filter((r) => r.has_timing)
        .sort((a, b) => new Date(a.finish_time) - new Date(b.finish_time));

      sorted.forEach((r, index) => {
        r.rank_in_race = index + 1;
      });

      raceResults.filter((r) => !r.has_timing).forEach((r) => {
        r.rank_in_race = null;
      });
    });

    const categoryGroups = {};
    results.forEach((r) => {
      const catId = r.crew.category_id;
      if (!categoryGroups[catId]) categoryGroups[catId] = [];
      categoryGroups[catId].push(r);
    });

    Object.values(categoryGroups).forEach((catResults) => {
      const sorted = catResults
        .filter((r) => r.has_timing)
        .sort((a, b) => new Date(a.finish_time) - new Date(b.finish_time));

      sorted.forEach((r, index) => {
        r.rank_scratch = index + 1;
      });

      catResults.filter((r) => !r.has_timing).forEach((r) => {
        r.rank_scratch = null;
      });
    });

    if (groupByCategory === "true") {
      const grouped = {};
      results.forEach((r) => {
        const catLabel = r.crew.category_label || "Sans catégorie";
        if (!grouped[catLabel]) grouped[catLabel] = [];
        grouped[catLabel].push(r);
      });

      Object.keys(grouped).forEach((cat) => {
        grouped[cat].sort((a, b) => {
          if (!a.has_timing) return 1;
          if (!b.has_timing) return -1;
          return (a.rank_scratch || 999) - (b.rank_scratch || 999);
        });
      });

      return res.json({ data: grouped });
    }

    results.sort((a, b) => {
      if (a.crew.category_label !== b.crew.category_label) {
        return (a.crew.category_label || "").localeCompare(
          b.crew.category_label || ""
        );
      }
      if (!a.has_timing) return 1;
      if (!b.has_timing) return -1;
      return (a.rank_scratch || 999) - (b.rank_scratch || 999);
    });

    res.json({ data: results });
  } catch (error) {
    console.error("Error fetching phase results:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
