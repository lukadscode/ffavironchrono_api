const { v4: uuidv4 } = require("uuid");
const Category = require("../models/Category");
const EventCategory = require("../models/EventCategory");
const Crew = require("../models/Crew");

// CREATE
exports.createCategory = async (req, res) => {
  try {
    const category = await Category.create({ ...req.body, id: uuidv4() });
    res.status(201).json({ status: "success", data: category });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

// LIST
exports.getCategories = async (req, res) => {
  try {
    const list = await Category.findAll({ order: [["label", "ASC"]] });
    res.json({ status: "success", data: list });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

// GET BY ID
exports.getCategory = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category)
      return res.status(404).json({ status: "error", message: "Non trouvé" });
    res.json({ status: "success", data: category });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getCategoriesByEventWithCrews = async (req, res) => {
  try {
    const { event_id } = req.params;

    const categories = await Category.findAll({
      include: [
        {
          model: Crew,
          where: { event_id },
          required: false,
        },
        {
          model: EventCategory,
          where: { event_id },
          attributes: [],
        },
      ],
      order: [["label", "ASC"]],
    });

    const data = categories.map((cat) => ({
      id: cat.id,
      code: cat.code,
      label: cat.label,
      age_group: cat.age_group,
      gender: cat.gender,
      boat_seats: cat.boat_seats,
      has_coxswain: cat.has_coxswain,
      crew_count: cat.Crews?.length || 0,
      crews: cat.Crews || [],
    }));

    res.json({ status: "success", data });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

// UPDATE
exports.updateCategory = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category)
      return res.status(404).json({ status: "error", message: "Non trouvé" });
    await category.update(req.body);
    res.json({ status: "success", data: category });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

// DELETE
exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category)
      return res.status(404).json({ status: "error", message: "Non trouvé" });
    await category.destroy();
    res.json({ status: "success", message: "Supprimé" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};
