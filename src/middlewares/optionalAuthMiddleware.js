const { verifyAccessToken } = require("../services/tokenService");
const User = require("../models/User");

/**
 * Middleware d'authentification optionnelle
 * - Si un token est fourni, vérifie et injecte req.user
 * - Si aucun token n'est fourni, continue sans erreur (req.user sera undefined)
 */
module.exports = async (req, res, next) => {
  const auth = req.headers["authorization"];
  
  // Si aucun token n'est fourni, on continue sans authentification
  if (!auth || !auth.startsWith("Bearer ")) {
    req.user = null;
    return next();
  }

  const token = auth.split(" ")[1];
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
    } else {
      req.user = null;
    }
    
    next();
  } catch (err) {
    // Si le token est invalide, on continue quand même (sera vérifié dans le contrôleur si nécessaire)
    req.user = null;
    next();
  }
};

