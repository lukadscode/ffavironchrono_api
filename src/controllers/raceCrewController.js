const { v4: uuidv4 } = require("uuid");
const RaceCrew = require("../models/RaceCrew");
const Crew = require("../models/Crew");
const Category = require("../models/Category");

exports.assignCrewToRace = async (req, res) => {
  try {
    const { race_id, crew_id, lane, status } = req.body;

    const existing = await RaceCrew.findOne({ where: { race_id, crew_id } });
    if (existing)
      return res.status(400).json({ status: "error", message: "Déjà assigné" });

    const rc = await RaceCrew.create({
      id: uuidv4(),
      race_id,
      crew_id,
      lane,
      status,
    });

    res.status(201).json({ status: "success", data: rc });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getRaceCrews = async (req, res) => {
  try {
    const { race_id } = req.params;
    const list = await RaceCrew.findAll({
      where: { race_id },
      include: [
        {
          model: Crew,
          include: [Category],
        },
      ],
      order: [["lane", "ASC"]],
    });
    res.json({ status: "success", data: list });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.removeRaceCrew = async (req, res) => {
  try {
    const { id } = req.params;
    const rc = await RaceCrew.findByPk(id);
    if (!rc)
      return res.status(404).json({ status: "error", message: "Non trouvé" });
    await rc.destroy();
    res.json({ status: "success", message: "Désassigné" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};
