const { v4: uuidv4 } = require("uuid");
const Timing = require("../models/Timing");

const TimingPoint = require("../models/TimingPoint");
const Race = require("../models/Race");
const RacePhase = require("../models/RacePhase");
const Event = require("../models/Event");
const TimingAssignment = require("../models/TimingAssignment");
const Crew = require("../models/Crew");
const RaceCrew = require("../models/RaceCrew");
const Category = require("../models/Category");

exports.createTiming = async (req, res) => {
  try {
    const timing = await Timing.create({
      id: uuidv4(),
      ...req.body,
    });

    const point = await TimingPoint.findByPk(timing.timing_point_id, {
      include: Event,
    });

    const io = req.app.get("io");
    if (io && point?.Event?.id) {
      io.to(`point_${point.id}`).emit("timingImpulse", timing);
    }

    res.status(201).json({ status: "success", data: timing });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

// GET timings by event
exports.getTimingsByEvent = async (req, res) => {
  try {
    const { event_id } = req.params;

    const list = await Timing.findAll({
      include: [
        {
          model: TimingPoint,
          required: true,
          where: { event_id },
          include: [Event], // Facultatif
        },
        {
          model: TimingAssignment,
          required: false, // on veut les timings même sans assignation
          include: [
            {
              model: Crew,
              include: [
                {
                  model: RaceCrew,
                  include: [
                    {
                      model: Race,
                      include: [RacePhase],
                    },
                  ],
                },
                Category,
              ],
            },
          ],
        },
      ],
      order: [["timestamp", "DESC"]],
    });

    res.json({ status: "success", data: list });
  } catch (err) {
    console.error("getTimingsByEvent error:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getTimings = async (req, res) => {
  try {
    const list = await Timing.findAll({
      include: [
        {
          model: TimingPoint,
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
      ],
      order: [["timestamp", "DESC"]],
    });

    res.json({ status: "success", data: list });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getTiming = async (req, res) => {
  try {
    const timing = await Timing.findByPk(req.params.id);
    if (!timing)
      return res.status(404).json({ status: "error", message: "Non trouvé" });
    res.json({ status: "success", data: timing });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.updateTiming = async (req, res) => {
  try {
    const timing = await Timing.findByPk(req.params.id);
    if (!timing)
      return res.status(404).json({ status: "error", message: "Non trouvé" });
    await timing.update(req.body);
    res.json({ status: "success", data: timing });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.deleteTiming = async (req, res) => {
  try {
    const timing = await Timing.findByPk(req.params.id);
    if (!timing)
      return res.status(404).json({ status: "error", message: "Non trouvé" });
    await timing.destroy();
    res.json({ status: "success", message: "Timing supprimé" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};
