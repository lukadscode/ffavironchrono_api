const jwt = require("jsonwebtoken");
const crypto = require("crypto");
require("dotenv").config();

exports.generateAccessToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "5h" });
};

exports.generateRefreshToken = () => {
  return crypto.randomBytes(64).toString("hex");
};

exports.verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

// Token spécial pour les timing points (app mobile)
exports.generateTimingPointToken = (timingPointId, eventId) => {
  return jwt.sign(
    { timing_point_id: timingPointId, event_id: eventId, type: "timing_point" },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  );
};

exports.verifyTimingPointToken = (token) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  if (decoded.type !== "timing_point") {
    throw new Error("Invalid token type");
  }
  return decoded;
};