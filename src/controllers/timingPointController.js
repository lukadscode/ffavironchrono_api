const { v4: uuidv4 } = require("uuid");
const TimingPoint = require("../models/TimingPoint");
const crypto = require("crypto");

// Token timing point : haute entropie (partage humain + anti bruteforce)
// Format : xxxx-xxxx-xxxx (base32, sans caractères ambigus)
const generateToken = () => {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sans I,L,O,0,1
  const chunk = (n) => {
    const bytes = crypto.randomBytes(n);
    let out = "";
    for (let i = 0; i < bytes.length; i++) out += alphabet[bytes[i] % alphabet.length];
    return out;
  };
  return `${chunk(4)}-${chunk(4)}-${chunk(4)}`;
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

    const data = req.body || {};
    // Par sécurité, on n'autorise pas la modification du token via l'API (rotation à implémenter séparément).
    if (data.token) {
      return res.status(400).json({
        status: "error",
        message: "La rotation du token n'est pas supportée via cet endpoint",
      });
    }

    await tp.update({
      label: data.label,
      order_index: data.order_index,
      distance_m: data.distance_m,
    });
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
    const { generateTimingPointToken } = require("../services/tokenService");

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

    // Générer un access token JWT pour ce timing point
    const accessToken = generateTimingPointToken(
      timingPoint.id,
      timingPoint.event_id
    );

    // Retourner les données au format demandé avec les infos de l'événement et le token
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
        access_token: accessToken,
      },
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};