const { v4: uuidv4 } = require("uuid");
const Crew = require("../models/Crew");
const Event = require("../models/Event");
const Category = require("../models/Category");
const CrewParticipant = require("../models/CrewParticipant");
const Participant = require("../models/Participant");
const RaceCrew = require("../models/RaceCrew");

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
      include: [Event, { model: Category, as: "category" }],
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
        { model: Category, as: "category" },
        {
          model: CrewParticipant,
          as: "crew_participants",
          include: [
            {
              model: Participant,
              as: "participant",
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
    const { id } = req.params;
    const crew = await Crew.findByPk(id);
    if (!crew)
      return res.status(404).json({ status: "error", message: "Non trouvé" });

    // 1) Supprimer les CrewParticipant liés à cet équipage
    await CrewParticipant.destroy({ where: { crew_id: id } });

    // 2) Supprimer les RaceCrew liés à cet équipage
    await RaceCrew.destroy({ where: { crew_id: id } });

    // 3) Supprimer enfin l'équipage
    await crew.destroy();

    res.json({
      status: "success",
      message: "Équipage et données associées supprimées automatiquement",
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getCrewsByEvent = async (req, res) => {
  try {
    const { event_id } = req.params;

    const crews = await Crew.findAll({
      where: { event_id },
      include: [Event, { model: Category, as: "category" }],
      order: [["club_name", "ASC"]],
    });

    res.json({ status: "success", data: crews });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};
