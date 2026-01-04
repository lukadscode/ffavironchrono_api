const { verifyAccessToken, verifyTimingPointToken } = require("../services/tokenService");
const User = require("../models/User");

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
  
  // Essayer d'abord un token utilisateur
  try {
    const decoded = verifyAccessToken(token);
    const user = await User.findByPk(decoded.userId);
    if (user) {
      req.user = {
        userId: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
      };
      return next();
    }
  } catch (err) {
    // Ce n'est pas un token utilisateur, continuer
  }

  // Essayer un token de timing point
  try {
    const decoded = verifyTimingPointToken(token);
    req.timingPoint = {
      timing_point_id: decoded.timing_point_id,
      event_id: decoded.event_id,
    };
    return next();
  } catch (err) {
    // Ce n'est pas un token de timing point non plus
  }

  // Si on arrive ici, aucun token n'est valide
  return res.status(401).json({ status: "error", message: "Invalid token" });
};

