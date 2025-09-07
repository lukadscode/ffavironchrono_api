const { v4: uuidv4 } = require("uuid");
const UserEvent = require("../models/UserEvent");

exports.addUserToEvent = async (req, res) => {
  try {
    const { user_id, event_id, role } = req.body;

    const [record, created] = await UserEvent.findOrCreate({
      where: { user_id, event_id },
      defaults: {
        id: uuidv4(),
        role,
      },
    });

    if (!created) {
      record.role = role;
      await record.save();
    }

    res.json({ status: "success", data: record });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.removeUserFromEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await UserEvent.findByPk(id);
    if (!record)
      return res
        .status(404)
        .json({ status: "error", message: "Lien non trouvé" });

    await record.destroy();
    res.json({ status: "success", message: "Supprimé" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.listEventUsers = async (req, res) => {
  try {
    const { event_id } = req.params;
    const users = await UserEvent.findAll({
      where: { event_id },
      include: [
        {
          model: require("../models/User"),
          attributes: ["id", "name", "email"],
        },
      ],
    });
    res.json({ status: "success", data: users });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};
