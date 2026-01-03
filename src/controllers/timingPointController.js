const { v4: uuidv4 } = require("uuid");
const TimingPoint = require("../models/TimingPoint");

// Fonction utilitaire pour générer un token de type 123-456-789
const generateToken = () => {
  const part = () => Math.floor(100 + Math.random() * 900).toString();
  return `${part()}-${part()}-${part()}`;
};

exports.createTimingPoint = async (req, res) => {
  try {
    const { event_id, label, order_index, distance_m } = req.body;

    let token;
    let isUnique = false;

    // Assurer l'unicité du token
    while (!isUnique) {
      token = generateToken();
      const existing = await TimingPoint.findOne({ where: { token } });
      if (!existing) isUnique = true;
    }

    const tp = await TimingPoint.create({
      id: uuidv4(),
      event_id,
      label,
      order_index,
      distance_m,
      token,
    });

    res.status(201).json({ status: "success", data: tp });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getTimingPointsByEvent = async (req, res) => {
  try {
    const { event_id } = req.params;

    const points = await TimingPoint.findAll({
      where: { event_id },
      order: [["order_index", "ASC"]],
    });

    res.json({ status: "success", data: points });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.updateTimingPoint = async (req, res) => {
  try {
    const tp = await TimingPoint.findByPk(req.params.id);
    if (!tp)
      return res.status(404).json({ status: "error", message: "Non trouvé" });

    // Si on veut modifier le token, on doit vérifier qu’il est unique
    if (req.body.token) {
      const existing = await TimingPoint.findOne({
        where: { token: req.body.token },
      });
      if (existing && existing.id !== req.params.id) {
        return res.status(400).json({
          status: "error",
          message: "Token déjà utilisé",
        });
      }
    }

    await tp.update(req.body);
    res.json({ status: "success", data: tp });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.deleteTimingPoint = async (req, res) => {
  try {
    const tp = await TimingPoint.findByPk(req.params.id);
    if (!tp)
      return res.status(404).json({ status: "error", message: "Non trouvé" });

    await tp.destroy();
    res.json({ status: "success", message: "Point supprimé" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.resolveToken = async (req, res) => {
  try {
    const { token } = req.body;

    const Event = require("../models/Event");

    // Rechercher le timing point par token avec les informations de l'événement
    const timingPoint = await TimingPoint.findOne({
      where: { token },
      include: [
        {
          model: Event,
          attributes: ["id", "name", "location", "start_date", "end_date"],
        },
      ],
    });

    if (!timingPoint) {
      return res.status(404).json({
        status: "error",
        message: "Token de timing point invalide ou introuvable",
      });
    }

    // Retourner les données au format demandé avec les infos de l'événement
    res.json({
      status: "success",
      data: {
        timing_point_id: timingPoint.id,
        timing_point_label: timingPoint.label,
        event_id: timingPoint.event_id,
        event_name: timingPoint.Event?.name || null,
        event_location: timingPoint.Event?.location || null,
        event_start_date: timingPoint.Event?.start_date || null,
        event_end_date: timingPoint.Event?.end_date || null,
        order_index: timingPoint.order_index,
        distance_m: timingPoint.distance_m,
        token: timingPoint.token,
      },
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};