const { v4: uuidv4 } = require("uuid");
const Race = require("../models/Race");
const RacePhase = require("../models/RacePhase");
const Distance = require("../models/Distance");

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
          include: [
            {
              model: require("../models/Crew"),
              include: [require("../models/Category")],
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
    const race = await Race.findByPk(req.params.id);
    if (!race)
      return res.status(404).json({ status: "error", message: "Non trouvé" });
    await race.update(req.body);
    res.json({ status: "success", data: race });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.deleteRace = async (req, res) => {
  try {
    const race = await Race.findByPk(req.params.id);
    if (!race)
      return res.status(404).json({ status: "error", message: "Non trouvé" });
    await race.destroy();
    res.json({ status: "success", message: "Course supprimée" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};
