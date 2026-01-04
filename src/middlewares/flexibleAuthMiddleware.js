const jwt = require("jsonwebtoken");
const User = require("../models/User");
require("dotenv").config();

/**
 * Middleware qui accepte soit un token utilisateur, soit un token de timing point
 * Utilisé pour les routes qui peuvent être accessibles par les deux types d'authentification
 */
module.exports = async (req, res, next) => {
  const auth = req.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer "))
    return res
      .status(401)
      .json({ status: "error", message: "No token provided" });

  const token = auth.split(" ")[1];
  
  // Essayer d'abord de décoder le token pour voir son type
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ status: "error", message: "Invalid token" });
  }

  // Si le token a un userId, c'est un token utilisateur
  if (decoded.userId) {
    try {
      const user = await User.findByPk(decoded.userId);
      if (!user) {
        return res.status(401).json({ status: "error", message: "Utilisateur non trouvé" });
      }
      req.user = {
        userId: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
      };
      return next();
    } catch (err) {
      return res.status(401).json({ status: "error", message: "Erreur d'authentification" });
    }
  }

  // Si le token a timing_point_id et type: 'timing_point', c'est un token de timing point
  if (decoded.timing_point_id && decoded.type === "timing_point") {
    req.timingPoint = {
      timing_point_id: decoded.timing_point_id,
      event_id: decoded.event_id,
    };
    return next();
  }

  // Si on arrive ici, le token n'est ni un token utilisateur ni un token de timing point
  return res.status(401).json({ status: "error", message: "Invalid token type" });
};

