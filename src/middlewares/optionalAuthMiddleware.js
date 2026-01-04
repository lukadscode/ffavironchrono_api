const { verifyAccessToken } = require("../services/tokenService");
const User = require("../models/User");

/**
 * Middleware d'authentification optionnelle
 * Si un token est fourni et valide, l'utilisateur est injecté dans req.user
 * Si aucun token n'est fourni ou invalide, on continue sans authentification
 */
module.exports = async (req, res, next) => {
  const auth = req.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer ")) {
    return next(); // Pas de token, continuer sans authentification
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
    }
    // Même si l'utilisateur n'est pas trouvé, on continue (authentification optionnelle)
    next();
  } catch (err) {
    // Token invalide, continuer quand même (authentification optionnelle)
    next();
  }
};

