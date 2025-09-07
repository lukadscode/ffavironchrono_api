const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");
const { Op } = require("sequelize");
const User = require("../models/User");
const UserSession = require("../models/UserSession");
const UserEvent = require("../models/UserEvent");
const Event = require("../models/Event");

const { hashPassword, comparePassword, hashToken } = require("../utils/hash");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../services/tokenService");
const sendEmail = require("../utils/sendEmail");

// REGISTER
exports.register = async (req, res) => {
  try {
    const { name, email, password, num_license } = req.body;
    const existing = await User.findOne({
      where: {
        [Op.or]: [{ email }, { num_license: email }],
      },
    });
    if (existing)
      return res
        .status(400)
        .json({ status: "error", message: "Email ou numéro déjà utilisé" });

    const hashed = await hashPassword(password);
    const email_verification_token = crypto.randomBytes(32).toString("hex");

    const newUser = await User.create({
      id: uuidv4(),
      name,
      email,
      num_license,
      password: hashed,
      email_verification_token,
    });

    await sendEmail(
      email,
      "Vérification de votre adresse",
      `Cliquez pour vérifier : https://aviron-app.com/verify-email?token=${email_verification_token}`
    );

    res.status(201).json({
      status: "success",
      data: { id: newUser.id, email: newUser.email },
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

// LOGIN
exports.login = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    const user = await User.findOne({
      where: {
        [Op.or]: [{ email: identifier }, { num_license: identifier }],
      },
    });

    if (!user)
      return res
        .status(401)
        .json({ status: "error", message: "Invalid credentials" });

    const valid = await comparePassword(password, user.password);
    if (!valid)
      return res
        .status(401)
        .json({ status: "error", message: "Invalid credentials" });

    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken();
    const hashedRefresh = await hashToken(refreshToken);

    const userAgent = req.headers["user-agent"];
    const ipAddress = req.ip;

    const existingSession = await UserSession.findOne({
      where: {
        user_id: user.id,
        user_agent: userAgent,
        ip_address: ipAddress,
        is_active: true,
      },
    });

    if (existingSession) {
      existingSession.refresh_token_hash = hashedRefresh;
      existingSession.expires_at = new Date(
        Date.now() + 1000 * 60 * 60 * 24 * 7
      );
      await existingSession.save();
    } else {
      await UserSession.create({
        id: uuidv4(),
        user_id: user.id,
        refresh_token_hash: hashedRefresh,
        user_agent: userAgent,
        ip_address: ipAddress,
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      });
    }

    res.json({
      status: "success",
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
      },
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

// REFRESH TOKEN
exports.refreshToken = async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token)
    return res
      .status(400)
      .json({ status: "error", message: "Missing refresh token" });

  const sessions = await UserSession.findAll({ where: { is_active: true } });
  for (const session of sessions) {
    const match = await comparePassword(
      refresh_token,
      session.refresh_token_hash
    );
    if (match) {
      const newAccess = generateAccessToken(session.user_id);
      return res.json({ status: "success", data: { access_token: newAccess } });
    }
  }

  return res
    .status(401)
    .json({ status: "error", message: "Invalid refresh token" });
};

// LOGOUT
exports.logout = async (req, res) => {
  const { refresh_token } = req.body;
  const sessions = await UserSession.findAll({ where: { is_active: true } });
  for (const session of sessions) {
    const match = await comparePassword(
      refresh_token,
      session.refresh_token_hash
    );
    if (match) {
      session.is_active = false;
      await session.save();
      return res.json({ status: "success", message: "Logged out" });
    }
  }
  return res.status(400).json({ status: "error", message: "Token not found" });
};

// ME
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.userId, {
      attributes: [
        "id",
        "name",
        "email",
        "avatar",
        "slug",
        "num_license",
        "role",
      ],
    });

    if (!user)
      return res
        .status(404)
        .json({ status: "error", message: "Utilisateur non trouvé" });

    const events = await UserEvent.findAll({
      where: { user_id: user.id },
      include: [
        {
          model: Event,
          as: "Event", // 👈 important !
          attributes: ["id", "name", "start_date", "end_date", "location"],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    res.json({
      status: "success",
      data: {
        user,
        events: events.map((e) => ({ ...e.Event.dataValues, role: e.role })),
      },
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

// VERIFY EMAIL
exports.verifyEmail = async (req, res) => {
  const { token } = req.query;
  const user = await User.findOne({
    where: { email_verification_token: token },
  });
  if (!user)
    return res.status(400).json({ status: "error", message: "Token invalide" });

  user.email_verification_token = null;
  user.status = "active";
  await user.save();

  res.json({ status: "success", message: "Email vérifié avec succès" });
};

// REQUEST PASSWORD RESET
exports.requestPasswordReset = async (req, res) => {
  const { identifier } = req.body;
  const user = await User.findOne({
    where: {
      [Op.or]: [{ email: identifier }, { num_license: identifier }],
    },
  });
  if (!user)
    return res
      .status(404)
      .json({ status: "error", message: "Utilisateur non trouvé" });

  const token = crypto.randomBytes(32).toString("hex");
  user.reset_password_token = token;
  user.reset_password_expires = new Date(Date.now() + 3600 * 1000); // 1h
  await user.save();

  await sendEmail(
    user.email,
    "Réinitialisation de mot de passe",
    `Cliquez ici pour réinitialiser : https://aviron-app.com/reset-password?token=${token}`
  );
  res.json({ status: "success", message: "Email envoyé" });
};

// RESET PASSWORD
exports.resetPassword = async (req, res) => {
  const { token, new_password } = req.body;
  const user = await User.findOne({
    where: {
      reset_password_token: token,
      reset_password_expires: { [Op.gt]: new Date() },
    },
  });

  if (!user)
    return res
      .status(400)
      .json({ status: "error", message: "Token invalide ou expiré" });

  user.password = await hashPassword(new_password);
  user.reset_password_token = null;
  user.reset_password_expires = null;
  await user.save();

  res.json({ status: "success", message: "Mot de passe mis à jour" });
};

// GET SESSIONS
exports.getSessions = async (req, res) => {
  try {
    const sessions = await UserSession.findAll({
      where: { user_id: req.user.userId },
      attributes: [
        "id",
        "user_agent",
        "ip_address",
        "is_active",
        "expires_at",
        "created_at",
      ],
      order: [["created_at", "DESC"]],
    });
    res.json({ status: "success", data: sessions });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

// DELETE SESSION
exports.deleteSession = async (req, res) => {
  try {
    const { id } = req.params;
    const session = await UserSession.findOne({
      where: {
        id,
        user_id: req.user.userId,
        is_active: true,
      },
    });

    if (!session) {
      return res.status(404).json({
        status: "error",
        message: "Session non trouvée ou déjà inactive",
      });
    }

    session.is_active = false;
    await session.save();

    res.json({ status: "success", message: "Session déconnectée" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

// POST /auth/change-password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findByPk(req.user.userId);
    if (!user)
      return res
        .status(404)
        .json({ status: "error", message: "Utilisateur introuvable" });

    const isValid = await comparePassword(currentPassword, user.password);
    if (!isValid)
      return res
        .status(400)
        .json({ status: "error", message: "Mot de passe actuel incorrect" });

    user.password = await hashPassword(newPassword);
    await user.save();

    res.json({ status: "success", message: "Mot de passe mis à jour" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};
