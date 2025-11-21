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
const {
  enrichTimingsWithRelativeTime,
} = require("../utils/relativeTimeCalculator");

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
      // Enrichir le timing avec relative_time_ms avant d'envoyer via WebSocket
      const timingWithRelations = await Timing.findByPk(timing.id, {
        include: [
          {
            model: TimingPoint,
          },
          {
            model: TimingAssignment,
            required: false,
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
                        include: [RacePhase],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });

      if (timingWithRelations) {
        const enrichedTimings = await enrichTimingsWithRelativeTime([
          timingWithRelations,
        ]);
        const enrichedTiming = enrichedTimings[0];
        io.to(`point_${point.id}`).emit("timingImpulse", enrichedTiming);
      } else {
        // Fallback si l'enrichissement échoue
        io.to(`point_${point.id}`).emit("timingImpulse", timing);
      }
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
          required: false,
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
                      include: [RacePhase],
                    },
                  ],
                },
                {
                  model: Category,
                  as: "category",
                },
              ],
            },
          ],
        },
      ],
      order: [["timestamp", "DESC"]],
    });

    // Enrichir avec relative_time_ms, crew_id, race_id
    const enrichedList = await enrichTimingsWithRelativeTime(list);

    res.json({ status: "success", data: enrichedList });
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
        {
          model: TimingAssignment,
          required: false,
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
                      include: [RacePhase],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      order: [["timestamp", "DESC"]],
    });

    // Enrichir avec relative_time_ms, crew_id, race_id
    const enrichedList = await enrichTimingsWithRelativeTime(list);

    res.json({ status: "success", data: enrichedList });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getTiming = async (req, res) => {
  try {
    const timing = await Timing.findByPk(req.params.id, {
      include: [
        {
          model: TimingPoint,
        },
        {
          model: TimingAssignment,
          required: false,
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
                      include: [RacePhase],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    if (!timing)
      return res.status(404).json({ status: "error", message: "Non trouvé" });

    // Enrichir avec relative_time_ms, crew_id, race_id
    const enrichedTiming = await enrichTimingsWithRelativeTime([timing]);
    res.json({ status: "success", data: enrichedTiming[0] });
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

// GET timings by race
exports.getTimingsByRace = async (req, res) => {
  try {
    const { race_id } = req.params;

    // Trouver tous les équipages de la course
    const raceCrews = await RaceCrew.findAll({
      where: { race_id },
      attributes: ["crew_id"],
    });

    const crewIds = raceCrews.map((rc) => rc.crew_id);

    if (crewIds.length === 0) {
      return res.json({ status: "success", data: [] });
    }

    // Trouver tous les timings assignés à ces équipages
    const list = await Timing.findAll({
      include: [
        {
          model: TimingPoint,
          required: true,
        },
        {
          model: TimingAssignment,
          required: true,
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
                      include: [RacePhase],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      order: [["timestamp", "DESC"]],
    });

    // Enrichir avec relative_time_ms, crew_id, race_id
    const enrichedList = await enrichTimingsWithRelativeTime(list);

    res.json({ status: "success", data: enrichedList });
  } catch (err) {
    console.error("getTimingsByRace error:", err);
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
