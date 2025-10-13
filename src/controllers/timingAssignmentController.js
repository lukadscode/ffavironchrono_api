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

    const list = await TimingAssignment.findAll({
      include: [
        {
          model: Crew,
          required: true,
          include: [
            {
              model: RaceCrew,
              as: "RaceCrews",
              required: true,
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
