const { verifyTimingPointToken } = require("../services/tokenService");

module.exports = async (req, res, next) => {
  const auth = req.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer "))
    return res
      .status(401)
      .json({ status: "error", message: "No token provided" });

  const token = auth.split(" ")[1];
  try {
    const decoded = verifyTimingPointToken(token);

    // Injecter les informations du timing point dans req
    req.timingPoint = {
      timing_point_id: decoded.timing_point_id,
      event_id: decoded.event_id,
    };

    next();
  } catch (err) {
    return res.status(401).json({ status: "error", message: "Invalid token" });
  }
};

