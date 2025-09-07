const { v4: uuidv4 } = require("uuid");
const Distance = require("../models/Distance");
const Event = require("../models/Event");

exports.createDistance = async (req, res) => {
  try {
    const distance = await Distance.create({
      id: uuidv4(),
      ...req.body,
    });
    res.status(201).json({ status: "success", data: distance });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getDistances = async (req, res) => {
  try {
    const list = await Distance.findAll({ order: [["meters", "ASC"]] });
    res.json({ status: "success", data: list });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getDistancesByEvent = async (req, res) => {
  try {
    const { event_id } = req.params;

    const distances = await Distance.findAll({
      include: [
        {
          model: Event,
          where: { id: event_id },
          attributes: [],
        },
      ],
      group: ["Distance.id"],
      order: [["meters", "ASC"]],
    });

    res.json({ status: "success", data: distances });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.deleteDistance = async (req, res) => {
  try {
    const { id } = req.params;
    const distance = await Distance.findByPk(id);
    if (!distance)
      return res.status(404).json({ status: "error", message: "Non trouvée" });
    await distance.destroy();
    res.json({ status: "success", message: "Supprimée" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};
