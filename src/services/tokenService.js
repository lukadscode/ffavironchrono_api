const jwt = require("jsonwebtoken");
const crypto = require("crypto");
require("dotenv").config();

function getJwtSecretOrThrow() {
  const secret = process.env.JWT_SECRET;
  if (!secret || typeof secret !== "string") {
    throw new Error("JWT_SECRET manquant");
  }

  // Refuser les secrets trop faibles en prod.
  // - 32 bytes min (= 256 bits) recommandé
  // - tolère base64/hex/texte, on mesure en octets
  const byteLen = Buffer.byteLength(secret, "utf8");
  const isWeak =
    byteLen < 32 ||
    secret === "ultra-secret-key" ||
    secret.toLowerCase().includes("secret");

  if (process.env.NODE_ENV === "production" && isWeak) {
    throw new Error("JWT_SECRET trop faible (>= 32 bytes requis en production)");
  }

  return secret;
}

exports.generateAccessToken = (userId) => {
  // Court par défaut (refresh token rotatif côté API).
  // Configurable via env: ACCESS_TOKEN_EXPIRES_IN="15m" | "30m" | "1h" ...
  const expiresIn = process.env.ACCESS_TOKEN_EXPIRES_IN || "30m";
  return jwt.sign({ userId }, getJwtSecretOrThrow(), { expiresIn });
};

exports.generateRefreshToken = () => {
  return crypto.randomBytes(64).toString("hex");
};

exports.verifyAccessToken = (token) => {
  return jwt.verify(token, getJwtSecretOrThrow());
};

// Token spécial pour les timing points (app mobile)
exports.generateTimingPointToken = (timingPointId, eventId) => {
  const expiresIn = process.env.TIMING_POINT_TOKEN_EXPIRES_IN || "24h";
  return jwt.sign(
    { timing_point_id: timingPointId, event_id: eventId, type: "timing_point" },
    getJwtSecretOrThrow(),
    { expiresIn }
  );
};

exports.verifyTimingPointToken = (token) => {
  const decoded = jwt.verify(token, getJwtSecretOrThrow());
  if (decoded.type !== "timing_point") {
    throw new Error("Invalid token type");
  }
  return decoded;
};

exports._getJwtSecretOrThrow = getJwtSecretOrThrow;