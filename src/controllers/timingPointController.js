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
