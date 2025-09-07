const { v4: uuidv4 } = require("uuid");
const CrewParticipant = require("../models/CrewParticipant");
const Participant = require("../models/Participant");

exports.addParticipantToCrew = async (req, res) => {
  try {
    const {
      crew_id,
      participant_id,
      is_coxswain,
      coxswain_weight,
      seat_position,
    } = req.body;

    const existing = await CrewParticipant.findOne({
      where: { crew_id, participant_id },
    });
    if (existing) {
      return res
        .status(400)
        .json({ status: "error", message: "Déjà affecté à cet équipage" });
    }

    const cp = await CrewParticipant.create({
      id: uuidv4(),
      crew_id,
      participant_id,
      is_coxswain,
      coxswain_weight,
      seat_position,
    });

    res.status(201).json({ status: "success", data: cp });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getCrewParticipants = async (req, res) => {
  try {
    const crew_id = req.params.crew_id;
    const list = await CrewParticipant.findAll({
      where: { crew_id },
      include: [{ model: Participant }],
      order: [["seat_position", "ASC"]],
    });
    res.json({ status: "success", data: list });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.removeCrewParticipant = async (req, res) => {
  try {
    const { id } = req.params;
    const cp = await CrewParticipant.findByPk(id);
    if (!cp)
      return res.status(404).json({ status: "error", message: "Non trouvé" });
    await cp.destroy();
    res.json({ status: "success", message: "Retiré de l’équipage" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};
