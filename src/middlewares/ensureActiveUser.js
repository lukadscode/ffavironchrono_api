module.exports = (req, res, next) => {
  if (!req.user || !req.user.userId) {
    return res.status(401).json({ status: "error", message: "Non autorisé" });
  }

  const User = require("../models/User");

  User.findByPk(req.user.userId)
    .then((user) => {
      if (!user || user.status !== "active") {
        return res
          .status(403)
          .json({
            status: "error",
            message: "Email non vérifié ou compte inactif",
          });
      }
      next();
    })
    .catch((err) => {
      return res
        .status(500)
        .json({ status: "error", message: "Erreur serveur" });
    });
};
