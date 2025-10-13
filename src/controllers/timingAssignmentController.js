const { v4: uuidv4 } = require("uuid");
const TimingAssignment = require("../models/TimingAssignment");
const Timing = require("../models/Timing");
const Crew = require("../models/Crew");
const RaceCrew = require("../models/RaceCrew");
const TimingPoint = require("../models/TimingPoint");
const Race = require("../models/Race");
const RacePhase = require("../models/RacePhase");
const Event = require("../models/Event");
const Category = require("../models/Category");
const CrewParticipant = require("../models/CrewParticipant");
const Participant = require("../models/Participant");

exports.assignTiming = async (req, res) => {
  try {
    const { timing_id, crew_id } = req.body;

    const assignment = await TimingAssignment.create({
      id: uuidv4(),
      timing_id,
      crew_id,
    });

    const timing = await Timing.findByPk(timing_id, {
      include: [TimingPoint],
    });

    const raceCrew = await RaceCrew.findOne({
      where: { crew_id },
      include: [
        {
          model: Race,
          include: [{ model: RacePhase, include: [Event] }],
        },
      ],
    });

    if (timing && raceCrew && raceCrew.Race) {
      const race = raceCrew.Race;
      const timingPoint = timing.TimingPoint;
      const event_id = race.RacePhase?.event_id;

      const startTime = new Date(race.start_time).getTime();
      const timingTime = new Date(timing.timestamp).getTime();
      const time_ms = timingTime - startTime;

      const io = req.app.get("io");

      const allTimingPoints = await TimingPoint.findAll({
        where: { event_id },
        order: [["order_index", "ASC"]],
      });

      const maxOrderIndex = Math.max(
        ...allTimingPoints.map((tp) => tp.order_index)
      );

      if (timingPoint.order_index === maxOrderIndex) {
        io.to(`event:${event_id}`).emit("raceFinalUpdate", {
          race_id: race.id,
          crew_id,
          final_time: time_ms.toString(),
        });
      } else {
        io.to(`event:${event_id}`).emit("raceIntermediateUpdate", {
          race_id: race.id,
          crew_id,
          timing_point_id: timingPoint.id,
          timing_point_label: timingPoint.label,
          distance_m: timingPoint.distance_m,
          time_ms: time_ms.toString(),
          order_index: timingPoint.order_index,
        });
      }
    }

    res.status(201).json({ status: "success", data: assignment });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.updateAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const { timing_id, crew_id } = req.body;

    const assignment = await TimingAssignment.findByPk(id);
    if (!assignment)
      return res.status(404).json({ status: "error", message: "Non trouvé" });

    await assignment.update({ timing_id, crew_id });
    res.json({ status: "success", data: assignment });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getAssignmentsByCrew = async (req, res) => {
  try {
    const list = await TimingAssignment.findAll({
      where: { crew_id: req.params.crew_id },
    });

    res.json({ status: "success", data: list });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.deleteAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const assignment = await TimingAssignment.findByPk(id);
    if (!assignment)
      return res.status(404).json({ status: "error", message: "Non trouvé" });

    await assignment.destroy();
    res.json({ status: "success", message: "Assignation supprimée" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getAssignmentsByEvent = async (req, res) => {
  try {
    const { event_id } = req.params;

    const list = await TimingAssignment.findAll({
      include: [
        {
          model: Crew,
          include: [
            {
              model: RaceCrew,
              as: "RaceCrews",
              include: [
                {
                  model: Race,
                  include: [
                    {
                      model: RacePhase,
                      where: { event_id },
                      include: [Event],
                    },
                  ],
                },
              ],
            },
            {
              model: Category,
              as: "category",
            },
            {
              model: CrewParticipant,
              as: "crew_participants",
              include: [
                {
                  model: Participant,
                  as: "participant",
                },
              ],
            },
          ],
        },
        {
          model: Timing,
          include: [
            {
              model: TimingPoint,
              // On filtre uniquement sur event_id, qui existe
              where: { event_id },
              // NE PAS inclure race_id ici !
            },
          ],
        },
      ],
    });

    res.json({ status: "success", data: list });
  } catch (err) {
    console.error("getAssignmentsByEvent error:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getAssignmentsByRace = async (req, res) => {
  try {
    const { race_id } = req.params;

    const raceCrews = await RaceCrew.findAll({
      where: { race_id },
      attributes: ["crew_id"],
    });

    const crewIds = raceCrews.map((rc) => rc.crew_id);

    if (crewIds.length === 0) {
      return res.json({ status: "success", data: [] });
    }

    const list = await TimingAssignment.findAll({
      where: {
        crew_id: crewIds,
      },
      include: [
        {
          model: Crew,
          include: [
            {
              model: RaceCrew,
              as: "RaceCrews",
              where: { race_id },
              include: [
                {
                  model: Race,
                  include: [
                    {
                      model: RacePhase,
                      include: [Event],
                    },
                  ],
                },
              ],
            },
            {
              model: Category,
              as: "category",
            },
            {
              model: CrewParticipant,
              as: "crew_participants",
              include: [
                {
                  model: Participant,
                  as: "participant",
                },
              ],
            },
          ],
        },
        {
          model: Timing,
          as: "timing",
          include: [TimingPoint],
        },
      ],
    });

    res.json({ status: "success", data: list });
  } catch (err) {
    console.error("getAssignmentsByRace error:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};
