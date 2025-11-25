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
