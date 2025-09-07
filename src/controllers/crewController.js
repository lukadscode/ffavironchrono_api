const { v4: uuidv4 } = require("uuid");
const Crew = require("../models/Crew");
const Event = require("../models/Event");
const Category = require("../models/Category");
const CrewParticipant = require("../models/CrewParticipant");
const Participant = require("../models/Participant");

exports.createCrew = async (req, res) => {
  try {
    const data = req.body;
    const crew = await Crew.create({ ...data, id: uuidv4() });
    res.status(201).json({ status: "success", data: crew });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getCrews = async (req, res) => {
  try {
    const list = await Crew.findAll({
      include: [Event, Category],
      order: [["club_name", "ASC"]],
    });
    res.json({ status: "success", data: list });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getCrew = async (req, res) => {
  try {
    const crew = await Crew.findByPk(req.params.id, {
      include: [
        Event,
        Category,
        {
          model: CrewParticipant,
          include: [
            {
              model: Participant,
              attributes: [
                "id",
                "first_name",
                "last_name",
                "license_number",
                "gender",
                "club_name",
              ],
            },
          ],
        },
      ],
    });

    if (!crew)
      return res.status(404).json({ status: "error", message: "Non trouvé" });

    res.json({ status: "success", data: crew });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.updateCrew = async (req, res) => {
  try {
    const crew = await Crew.findByPk(req.params.id);
    if (!crew)
      return res.status(404).json({ status: "error", message: "Non trouvé" });
    await crew.update(req.body);
    res.json({ status: "success", data: crew });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.deleteCrew = async (req, res) => {
  try {
    const crew = await Crew.findByPk(req.params.id);
    if (!crew)
      return res.status(404).json({ status: "error", message: "Non trouvé" });
    await crew.destroy();
    res.json({ status: "success", message: "Équipage supprimé" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getCrewsByEvent = async (req, res) => {
  try {
    const { event_id } = req.params;

    const crews = await Crew.findAll({
      where: { event_id },
      include: [Event, Category],
      order: [["club_name", "ASC"]],
    });

    res.json({ status: "success", data: crews });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};
