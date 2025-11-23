const { v4: uuidv4 } = require("uuid");
const Participant = require("../models/Participant");
const CrewParticipant = require("../models/CrewParticipant");
const Crew = require("../models/Crew");
const Category = require("../models/Category");
const fetchExternalData = require("../utils/fetchExternalData");

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
          required: true, // ← IMPORTANT : Ne retourner que les participants qui ont un équipage
          include: [
            {
              model: Crew,
              where: { event_id }, // Filtrer par event_id
              required: true, // ← IMPORTANT : Ne retourner que les équipages de cet événement
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
      distinct: true, // Éviter les doublons si un participant a plusieurs équipages
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

// SEARCH LICENCIÉ BY LICENSE NUMBER
exports.searchLicencie = async (req, res) => {
  try {
    const { numeroLicence } = req.params;

    if (!numeroLicence) {
      return res
        .status(400)
        .json({ status: "error", message: "Numéro de licence requis" });
    }

    // Appel à l'API externe
    const externalData = await fetchExternalData(
      `/licences/verification/adherent/${numeroLicence}`
    );

    if (!externalData || !externalData.data) {
      return res
        .status(404)
        .json({ status: "error", message: "Licencié non trouvé" });
    }

    const data = externalData.data;

    // Récupérer la première licence (la plus récente généralement)
    const firstLicence =
      data.licences && data.licences.length > 0 ? data.licences[0] : null;

    // Formater la réponse avec seulement les champs demandés
    const response = {
      numero_licence: data.numero_licence,
      prenom: data.prenom,
      nom: data.nom,
      ddn: data.ddn,
      genre: data.genre,
      mail: data.adresse?.mail || null,
      saison: firstLicence?.saison || null,
      type_libelle: firstLicence?.type_libelle || null,
      club_code: firstLicence?.club?.code || null,
      club_nom_court: firstLicence?.club?.nom_court || null,
    };

    res.json({ status: "success", data: response });
  } catch (err) {
    // Gérer les erreurs spécifiques de l'API externe
    if (err.response && err.response.status === 404) {
      return res
        .status(404)
        .json({ status: "error", message: "Licencié non trouvé" });
    }

    res.status(500).json({
      status: "error",
      message: err.message || "Erreur lors de la recherche du licencié",
    });
  }
};
