const { v4: uuidv4 } = require("uuid");
const { Op } = require("sequelize");
const Crew = require("../models/Crew");
const Event = require("../models/Event");
const Category = require("../models/Category");
const CrewParticipant = require("../models/CrewParticipant");
const Participant = require("../models/Participant");
const RaceCrew = require("../models/RaceCrew");
const CREW_STATUS = require("../constants/crewStatus");

exports.createCrew = async (req, res) => {
  try {
    const data = req.body;

    // Normaliser le statut pour gérer l'ancien format numérique (ex: 8)
    let normalizedStatus = data.status;

    // Si le front envoie encore un nombre (ancienne version)
    if (typeof normalizedStatus === "number") {
      // 8 était la valeur par défaut historique => "registered"
      if (normalizedStatus === 8) {
        normalizedStatus = CREW_STATUS.REGISTERED;
      } else {
        // Pour toute autre valeur numérique inconnue, on se rabat sur "registered"
        normalizedStatus = CREW_STATUS.REGISTERED;
      }
    }

    // Si le statut est une chaîne vide ou invalide, on force sur "registered"
    if (
      typeof normalizedStatus === "string" &&
      !CREW_STATUS.VALID_STATUSES.includes(normalizedStatus)
    ) {
      normalizedStatus = CREW_STATUS.REGISTERED;
    }

    const payload = {
      ...data,
      id: uuidv4(),
      // Ne pas écraser la valeur par défaut du modèle si aucun statut n'est fourni
      ...(normalizedStatus ? { status: normalizedStatus } : {}),
    };

    const crew = await Crew.create(payload);
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

/**
 * Liste des équipages d'un événement avec participants, recherche et pagination
 *
 * GET /crews/event/:event_id/with-participants
 *
 * Query params :
 * - search (optionnel) : filtre sur club, catégorie, participants
 * - page (optionnel, défaut 1)
 * - pageSize (optionnel, défaut 50, max 200)
 */
exports.getCrewsWithParticipantsByEvent = async (req, res) => {
  try {
    const { event_id } = req.params;
    let { search, page = 1, pageSize = 50 } = req.query;

    page = parseInt(page, 10) || 1;
    pageSize = parseInt(pageSize, 10) || 50;
    // Limiter la taille de page pour éviter les abus
    const limit = Math.min(Math.max(pageSize, 1), 200);
    const offset = (page - 1) * limit;

    const where = { event_id };

    // Conditions de recherche
    if (search && typeof search === "string") {
      const term = `%${search.trim()}%`;
      where[Op.or] = [
        // Sur l'équipage
        { club_name: { [Op.like]: term } },
        { club_code: { [Op.like]: term } },
        // Sur les participants
        { "$crew_participants.participant.first_name$": { [Op.like]: term } },
        { "$crew_participants.participant.last_name$": { [Op.like]: term } },
        {
          "$crew_participants.participant.license_number$": {
            [Op.like]: term,
          },
        },
      ];
    }

    const include = [
      {
        model: Category,
        as: "category",
        attributes: ["id", "code", "label", "age_group", "gender"],
        required: false,
      },
      {
        model: CrewParticipant,
        as: "crew_participants",
        required: false,
        include: [
          {
            model: Participant,
            as: "participant",
            attributes: [
              "id",
              "first_name",
              "last_name",
              "license_number",
              "club_name",
              "gender",
            ],
          },
        ],
      },
    ];

    // Compter le total (distinct sur l'id d'équipage)
    const total = await Crew.count({
      where,
      include,
      distinct: true,
      col: "id",
    });

    const crews = await Crew.findAll({
      where,
      include,
      order: [
        ["status", "ASC"],
        ["club_name", "ASC"],
      ],
      limit,
      offset,
    });

    res.json({
      status: "success",
      data: crews,
      pagination: {
        page,
        pageSize: limit,
        total,
      },
    });
  } catch (err) {
    console.error("Erreur dans getCrewsWithParticipantsByEvent:", err);
    res.status(500).json({
      status: "error",
      message: err.message || "Erreur lors de la récupération des équipages",
    });
  }
};
