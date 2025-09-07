const bcrypt = require("bcrypt");
const SALT_ROUNDS = 12;

exports.hashPassword = (password) => bcrypt.hash(password, SALT_ROUNDS);
exports.comparePassword = (plain, hash) => bcrypt.compare(plain, hash);
exports.hashToken = (token) => bcrypt.hash(token, SALT_ROUNDS);
