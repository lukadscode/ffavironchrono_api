const { v4: uuidv4 } = require("uuid");
const Participant = require("../models/Participant");
const CrewParticipant = require("../models/CrewParticipant");
const Crew = require("../models/Crew");
const Category = require("../models/Category");

// CREATE
exports.createParticipant = async (req, res) => {
  try {
    const data = req.body;
    const participant = await Participant.create({
      ...data,
      id: uuidv4(),
    });
    res.status(201).json({ status: "success", data: participant });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

// LIST
exports.getParticipants = async (req, res) => {
  try {
    const list = await Participant.findAll({ order: [["last_name", "ASC"]] });
    res.json({ status: "success", data: list });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

// GET BY ID
exports.getParticipant = async (req, res) => {
  try {
    const p = await Participant.findByPk(req.params.id, {
      include: [
        {
          model: CrewParticipant,
          include: [
            {
              model: Crew,
              include: [
                {
                  model: Category,
                  as: "category",
                  attributes: ["id", "code", "label", "age_group", "gender"],
                },
              ],
              attributes: ["id", "event_id", "club_name", "club_code"],
            },
          ],
        },
      ],
    });

    if (!p)
      return res.status(404).json({ status: "error", message: "Non trouvé" });

    res.json({ status: "success", data: p });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

// GET BY EVENT

exports.getParticipantsByEvent = async (req, res) => {
  try {
    const { event_id } = req.params;

    const participants = await Participant.findAll({
      include: [
        {
          model: CrewParticipant,
          include: [
            {
              model: Crew,
              where: { event_id },
              attributes: [
                "id",
                "club_name",
                "club_code",
                "event_id",
                "category_id",
              ],
              include: [
                {
                  model: Category,
                  as: "category",
                  attributes: ["id", "code", "label", "age_group", "gender"],
                },
              ],
            },
          ],
        },
      ],
      order: [["last_name", "ASC"]],
    });

    res.json({ status: "success", data: participants });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

// UPDATE
exports.updateParticipant = async (req, res) => {
  try {
    const p = await Participant.findByPk(req.params.id);
    if (!p)
      return res.status(404).json({ status: "error", message: "Non trouvé" });
    await p.update(req.body);
    res.json({ status: "success", data: p });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

// DELETE
exports.deleteParticipant = async (req, res) => {
  try {
    const p = await Participant.findByPk(req.params.id);
    if (!p)
      return res.status(404).json({ status: "error", message: "Non trouvé" });
    await p.destroy();
    res.json({ status: "success", message: "Participant supprimé" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};
