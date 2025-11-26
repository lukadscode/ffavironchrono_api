const { v4: uuidv4 } = require("uuid");
const Race = require("../models/Race");
const RacePhase = require("../models/RacePhase");
const Distance = require("../models/Distance");
const RaceCrew = require("../models/RaceCrew");
const RankingPoint = require("../models/RankingPoint");
const Notification = require("../models/Notification");

exports.createRace = async (req, res) => {
  try {
    const race = await Race.create({ ...req.body, id: uuidv4() });
    res.status(201).json({ status: "success", data: race });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getRaces = async (req, res) => {
  try {
    const list = await Race.findAll({
      include: [RacePhase, Distance],
      order: [["race_number", "ASC"]],
    });
    res.json({ status: "success", data: list });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getRacesByEvent = async (req, res) => {
  try {
    const { event_id } = req.params;

    const list = await Race.findAll({
      include: [
        {
          model: RacePhase,
          where: { event_id },
          required: true,
        },
        {
          model: Distance,
        },
        {
          model: require("../models/RaceCrew"),
          as: "race_crews",
          include: [
            {
              model: require("../models/Crew"),
              as: "crew",
              include: [
                {
                  model: require("../models/Category"),
                  as: "category",
                },
              ],
            },
          ],
        },
      ],
      order: [["race_number", "ASC"]],
    });

    res.json({ status: "success", data: list });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getRace = async (req, res) => {
  try {
    const race = await Race.findByPk(req.params.id, {
      include: [RacePhase, Distance],
    });
    if (!race)
      return res.status(404).json({ status: "error", message: "Non trouvé" });
    res.json({ status: "success", data: race });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.updateRace = async (req, res) => {
  try {
    const race = await Race.findByPk(req.params.id, {
      include: [{ model: RacePhase, include: [require("../models/Event")] }],
    });
    if (!race)
      return res.status(404).json({ status: "error", message: "Non trouvé" });

    const oldStatus = race.status;
    await race.update(req.body);

    if (req.body.status && req.body.status !== oldStatus && race.RacePhase) {
      const io = req.app.get("io");
      const event_id = race.RacePhase.event_id;

      io.to(`event:${event_id}`).emit("raceStatusUpdate", {
        race_id: race.id,
        status: req.body.status,
      });
    }

    res.json({ status: "success", data: race });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.deleteRace = async (req, res) => {
  try {
    const { id } = req.params;
    const race = await Race.findByPk(id);
    if (!race)
      return res.status(404).json({ status: "error", message: "Non trouvé" });

    // 🔄 Suppression automatique de tout ce qui dépend de la course
    // 1) Supprimer les RaceCrew liés à cette course
    await RaceCrew.destroy({ where: { race_id: id } });

    // 2) Supprimer les RankingPoint liés à cette course (classements)
    await RankingPoint.destroy({ where: { race_id: id } });

    // 3) Supprimer les Notifications liées à cette course
    await Notification.destroy({ where: { race_id: id } });

    // 4) Supprimer enfin la course
    await race.destroy();

    res.json({
      status: "success",
      message: "Course et données associées supprimées automatiquement",
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

// GET races with non_official status (for arbitres page)
exports.getNonOfficialRaces = async (req, res) => {
  try {
    const Event = require("../models/Event");

    const races = await Race.findAll({
      where: { status: "non_official" },
      include: [
        {
          model: RacePhase,
          as: "race_phase",
          include: [
            {
              model: Event,
              as: "event",
            },
          ],
        },
        {
          model: Distance,
        },
        {
          model: require("../models/RaceCrew"),
          as: "race_crews",
          include: [
            {
              model: require("../models/Crew"),
              as: "crew",
              include: [
                {
                  model: require("../models/Category"),
                  as: "category",
                },
              ],
            },
          ],
        },
      ],
      order: [
        [
          { model: RacePhase, as: "race_phase" },
          { model: Event, as: "event" },
          "name",
          "ASC",
        ],
        ["race_number", "ASC"],
      ],
    });

    res.json({ status: "success", data: races });
  } catch (err) {
    console.error("Error fetching non-official races:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// GET race results by race ID
exports.getRaceResults = async (req, res) => {
  try {
    const { race_id } = req.params;
    const RaceCrew = require("../models/RaceCrew");
    const Crew = require("../models/Crew");
    const Category = require("../models/Category");
    const TimingAssignment = require("../models/TimingAssignment");
    const Timing = require("../models/Timing");
    const TimingPoint = require("../models/TimingPoint");
    const Event = require("../models/Event");

    const race = await Race.findByPk(race_id, {
      include: [
        {
          model: RacePhase,
          as: "race_phase",
          include: [
            {
              model: require("../models/Event"),
              as: "event",
              include: [
                {
                  model: require("../models/TimingPoint"),
                  as: "timing_points",
                },
              ],
            },
          ],
        },
      ],
    });

    if (!race) {
      return res
        .status(404)
        .json({ status: "error", message: "Course non trouvée" });
    }

    // Accéder à l'événement via la relation
    const event = race.race_phase?.event;
    if (!event || !event.timing_points) {
      return res.json({ status: "success", data: [] });
    }

    const timingPoints = event.timing_points.sort(
      (a, b) => a.order_index - b.order_index
    );
    const startPoint = timingPoints[0];
    const finishPoint =
      timingPoints.find(
        (tp) =>
          tp.label === "Finish" ||
          tp.label === "finish" ||
          tp.label === "Arrivée" ||
          tp.label === "arrivée"
      ) || timingPoints[timingPoints.length - 1];

    if (!startPoint || !finishPoint) {
      return res.json({ status: "success", data: [] });
    }

    // Récupérer tous les équipages de la course
    const raceCrews = await RaceCrew.findAll({
      where: { race_id },
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
      order: [["lane", "ASC"]],
    });

    const results = [];

    for (const raceCrew of raceCrews) {
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
        lane: raceCrew.lane,
        club_name: raceCrew.crew?.club_name || null,
        club_code: raceCrew.crew?.club_code || null,
        category: raceCrew.crew?.category
          ? {
              id: raceCrew.crew.category.id,
              code: raceCrew.crew.category.code,
              label: raceCrew.crew.category.label,
              age_group: raceCrew.crew.category.age_group,
              gender: raceCrew.crew.category.gender,
            }
          : null,
        finish_time,
        final_time: duration_ms !== null ? duration_ms.toString() : null,
        has_timing: finish_time !== null,
      });
    }

    // Trier par temps et calculer les positions
    const sortedResults = results
      .filter((r) => r.has_timing)
      .sort((a, b) => {
        const timeA = parseInt(a.final_time || "999999999", 10);
        const timeB = parseInt(b.final_time || "999999999", 10);
        return timeA - timeB;
      });

    sortedResults.forEach((r, index) => {
      r.position = index + 1;
    });

    // Ajouter les résultats sans timing à la fin
    const resultsWithoutTiming = results
      .filter((r) => !r.has_timing)
      .map((r) => ({ ...r, position: null }));

    const allResults = [...sortedResults, ...resultsWithoutTiming];

    res.json({ status: "success", data: allResults });
  } catch (err) {
    console.error("Error fetching race results:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};
