/**
 * Middleware pour vérifier que l'utilisateur a le rôle "commission" ou supérieur
 * Les rôles autorisés sont : commission, admin, superadmin
 */
module.exports = (req, res, next) => {
  if (!req.user || !req.user.userId) {
    return res.status(401).json({ status: "error", message: "Non autorisé" });
  }

  // Vérifier que l'utilisateur est commission, admin ou superadmin
  const allowedRoles = ["commission", "admin", "superadmin"];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      status: "error",
      message: "Accès réservé aux membres de la commission et aux administrateurs",
    });
  }

  next();
};

