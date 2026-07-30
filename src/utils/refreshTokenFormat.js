const { generateRefreshToken } = require("../services/tokenService");

function makeSessionBoundRefreshToken(sessionId) {
  const secret = generateRefreshToken(); // 64 bytes hex
  return { token: `${sessionId}.${secret}`, secret };
}

function parseSessionBoundRefreshToken(refreshToken) {
  if (typeof refreshToken !== "string") return null;
  const parts = refreshToken.split(".");
  if (parts.length !== 2) return null;
  const [sessionId, secret] = parts;
  if (!sessionId || !secret) return null;
  return { sessionId, secret };
}

module.exports = { makeSessionBoundRefreshToken, parseSessionBoundRefreshToken };

