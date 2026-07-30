const { v4: uuidv4 } = require("uuid");
const { Op } = require("sequelize");
const Crew = require("../models/Crew");
const Event = require("../models/Event");
const Category = require("../models/Category");
const CrewParticipant = require("../models/CrewParticipant");
const Participant = require("../models/Participant");
const RaceCrew = require("../models/RaceCrew");
const CREW_STATUS = require("../constants/crewStatus");
const Club = require("../models/Club");

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
        { model: Club, as: "club" },
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
    const data = req.body || {};

    let normalizedStatus = data.status;
    if (typeof normalizedStatus === "number") {
      if (normalizedStatus === 8) normalizedStatus = CREW_STATUS.REGISTERED;
      else normalizedStatus = CREW_STATUS.REGISTERED;
    }
    if (
      typeof normalizedStatus === "string" &&
      normalizedStatus &&
      !CREW_STATUS.VALID_STATUSES.includes(normalizedStatus)
    ) {
      normalizedStatus = CREW_STATUS.REGISTERED;
    }

    await crew.update({
      club_name: data.club_name,
      club_code: data.club_code,
      crew_name: data.crew_name,
      coach_name: data.coach_name,
      temps_pronostique: data.temps_pronostique,
      category_id: data.category_id,
      // Ne pas écraser si absent
      ...(normalizedStatus ? { status: normalizedStatus } : {}),
    });
    res.json({ status: "success", data: crew });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * Statut rapide DNS / DNF / DSQ depuis le poste de chronométrage.
 * Endpoint volontairement restreint (un seul champ) pour rester accessible
 * aux appareils authentifiés par token de point de chronométrage.
 */
exports.updateCrewStatus = async (req, res) => {
  try {
    const crew = await Crew.findByPk(req.params.id);
    if (!crew) return res.status(404).json({ status: "error", message: "Non trouvé" });

    const { status } = req.body || {};
    if (!CREW_STATUS.VALID_STATUSES.includes(status)) {
      return res.status(400).json({ status: "error", message: "Statut invalide" });
    }

    await crew.update({ status });

    const io = req.app.get("io");
    if (io) {
      io.to(`event:${crew.event_id}`).emit("crewStatusUpdate", {
        crew_id: crew.id,
        status,
      });
    }

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
      include: [Event, { model: Category, as: "category" }, { model: Club, as: "club" }],
      order: [["club_name", "ASC"]],
    });

    res.json({ status: "success", data: crews });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * Liste des équipages d'un événement avec participants et recherche
 *
 * GET /crews/event/:event_id/with-participants
 *
 * Query params :
 * - search (optionnel) : filtre sur club
 */
exports.getCrewsWithParticipantsByEvent = async (req, res) => {
  try {
    const { event_id } = req.params;
    const { search } = req.query;

    const where = { event_id };

    // Conditions de recherche
    if (search && typeof search === "string") {
      const term = `%${search.trim()}%`;
      // Pour éviter les problèmes de colonnes inconnues dans WHERE avec MariaDB,
      // on limite pour l'instant la recherche aux champs de la table crews.
      where[Op.or] = [
        { club_name: { [Op.like]: term } },
        { club_code: { [Op.like]: term } },
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
        model: Club,
        as: "club",
        attributes: ["id", "code", "code_court", "nom", "nom_court"],
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

    const crews = await Crew.findAll({
      where,
      include,
      order: [
        ["status", "ASC"],
        ["club_name", "ASC"],
      ],
    });

    res.json({
      status: "success",
      data: crews,
    });
  } catch (err) {
    console.error("Erreur dans getCrewsWithParticipantsByEvent:", err);
    res.status(500).json({
      status: "error",
      message: err.message || "Erreur lors de la récupération des équipages",
    });
  }
};
