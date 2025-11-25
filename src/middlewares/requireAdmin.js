module.exports = (req, res, next) => {
  if (!req.user || !req.user.userId) {
    return res.status(401).json({ status: "error", message: "Non autorisé" });
  }

  // Vérifier que l'utilisateur est admin ou superadmin
  if (req.user.role !== "admin" && req.user.role !== "superadmin") {
    return res.status(403).json({
      status: "error",
      message: "Accès réservé aux administrateurs",
    });
  }

  next();
};

