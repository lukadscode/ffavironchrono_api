const { v4: uuidv4 } = require("uuid");
const Event = require("../models/Event");

// CREATE
exports.createEvent = async (req, res) => {
  try {
    const data = req.body;
    const event = await Event.create({
      ...data,
      id: uuidv4(),
      created_by: req.user.userId,
    });
    res.status(201).json({ status: "success", data: event });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

// LIST
exports.getEvents = async (req, res) => {
  try {
    const events = await Event.findAll({ order: [["start_date", "DESC"]] });
    res.json({ status: "success", data: events });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

// GET BY ID
exports.getEvent = async (req, res) => {
  try {
    const event = await Event.findByPk(req.params.id);
    if (!event)
      return res.status(404).json({ status: "error", message: "Non trouvé" });
    res.json({ status: "success", data: event });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

// UPDATE
exports.updateEvent = async (req, res) => {
  try {
    const event = await Event.findByPk(req.params.id);
    if (!event)
      return res.status(404).json({ status: "error", message: "Non trouvé" });
    await event.update(req.body);
    res.json({ status: "success", data: event });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

// DELETE
exports.deleteEvent = async (req, res) => {
  try {
    const event = await Event.findByPk(req.params.id);
    if (!event)
      return res.status(404).json({ status: "error", message: "Non trouvé" });
    await event.destroy();
    res.json({ status: "success", message: "Événement supprimé" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};
