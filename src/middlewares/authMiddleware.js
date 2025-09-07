const { verifyAccessToken } = require("../services/tokenService");
const User = require("../models/User");

module.exports = async (req, res, next) => {
  const auth = req.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer "))
    return res
      .status(401)
      .json({ status: "error", message: "No token provided" });

  const token = auth.split(" ")[1];
  try {
    const decoded = verifyAccessToken(token); // contient userId

    const user = await User.findByPk(decoded.userId);
    if (!user)
      return res
        .status(401)
        .json({ status: "error", message: "Utilisateur non trouvé" });

    // Injecte toutes les infos nécessaires
    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    };

    next();
  } catch (err) {
    return res.status(401).json({ status: "error", message: "Invalid token" });
  }
};
