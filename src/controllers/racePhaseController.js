const { v4: uuidv4 } = require("uuid");
const RacePhase = require("../models/RacePhase");
const Event = require("../models/Event");

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
    await phase.destroy();
    res.json({ status: "success", message: "Phase supprimée" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};
