const { v4: uuidv4 } = require("uuid");
const EventCategory = require("../models/EventCategory");
const Category = require("../models/Category");

exports.linkCategoryToEvent = async (req, res) => {
  try {
    const { event_id, category_id } = req.body;
    const exists = await EventCategory.findOne({
      where: { event_id, category_id },
    });
    if (exists)
      return res.status(400).json({ status: "error", message: "Déjà lié" });

    const link = await EventCategory.create({
      id: uuidv4(),
      event_id,
      category_id,
    });

    res.status(201).json({ status: "success", data: link });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getCategoriesByEvent = async (req, res) => {
  try {
    const event_id = req.params.event_id;
    const list = await EventCategory.findAll({
      where: { event_id },
      include: [{ model: Category }],
    });
    res.json({ status: "success", data: list });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.unlinkCategoryFromEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const row = await EventCategory.findByPk(id);
    if (!row)
      return res
        .status(404)
        .json({ status: "error", message: "Lien introuvable" });
    await row.destroy();
    res.json({ status: "success", message: "Lien supprimé" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};
