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
const emailTemplates = require("../utils/emailTemplates");

// REGISTER
exports.register = async (req, res) => {
  try {
    const { name, email, password, num_license } = req.body;

    // Vérifier si l'email existe déjà
    const existingByEmail = await User.findOne({
      where: { email },
    });

    // Vérifier si le num_license existe déjà (si fourni)
    let existingByLicense = null;
    if (num_license) {
      existingByLicense = await User.findOne({
        where: { num_license },
      });
    }

    // Si l'utilisateur existe par email et est inactif, on met à jour son compte
    if (existingByEmail && existingByEmail.status === "inactive") {
      // Vérifier que le num_license fourni n'est pas déjà utilisé par un autre utilisateur actif
      if (
        num_license &&
        existingByLicense &&
        existingByLicense.id !== existingByEmail.id &&
        existingByLicense.status === "active"
      ) {
        return res.status(400).json({
          status: "error",
          message: "Ce numéro de licence est déjà utilisé par un autre compte",
        });
      }

      const hashed = await hashPassword(password);
      const email_verification_token = crypto.randomBytes(32).toString("hex");

      // Mettre à jour le compte inactif
      existingByEmail.password = hashed;
      existingByEmail.email_verification_token = email_verification_token;
      if (name) existingByEmail.name = name;
      if (num_license) existingByEmail.num_license = num_license;

      try {
        await existingByEmail.save();
      } catch (saveErr) {
        // Gérer les erreurs de contrainte unique (num_license déjà utilisé)
        if (
          saveErr.name === "SequelizeUniqueConstraintError" ||
          saveErr.name === "SequelizeValidationError"
        ) {
          return res.status(400).json({
            status: "error",
            message: "Ce numéro de licence est déjà utilisé",
          });
        }
        throw saveErr;
      }

      // Envoyer un nouvel email de vérification
      const emailData = emailTemplates.verificationEmail(email_verification_token, name);
      await sendEmail(email, emailData.subject, emailData.text, emailData.html);

      return res.status(200).json({
        status: "success",
        data: { id: existingByEmail.id, email: existingByEmail.email },
        message: "Compte mis à jour, veuillez vérifier votre email",
      });
    }

    // Si l'utilisateur existe par num_license et est inactif (mais email différent)
    if (
      existingByLicense &&
      existingByLicense.status === "inactive" &&
      existingByLicense.email !== email
    ) {
      // Si l'email fourni est déjà utilisé par un utilisateur actif, erreur
      if (existingByEmail && existingByEmail.status === "active") {
        return res.status(400).json({
          status: "error",
          message: "Cet email est déjà utilisé par un autre compte",
        });
      }

      // Mettre à jour l'utilisateur inactif trouvé par num_license
      const hashed = await hashPassword(password);
      const email_verification_token = crypto.randomBytes(32).toString("hex");

      existingByLicense.email = email; // Mettre à jour l'email
      existingByLicense.password = hashed;
      existingByLicense.email_verification_token = email_verification_token;
      if (name) existingByLicense.name = name;

      try {
        await existingByLicense.save();
      } catch (saveErr) {
        if (
          saveErr.name === "SequelizeUniqueConstraintError" ||
          saveErr.name === "SequelizeValidationError"
        ) {
          return res.status(400).json({
            status: "error",
            message: "Cet email est déjà utilisé",
          });
        }
        throw saveErr;
      }

      const emailData = emailTemplates.verificationEmail(email_verification_token, name);
      await sendEmail(email, emailData.subject, emailData.text, emailData.html);

      return res.status(200).json({
        status: "success",
        data: { id: existingByLicense.id, email: existingByLicense.email },
        message: "Compte mis à jour, veuillez vérifier votre email",
      });
    }

    // Si l'utilisateur existe et est actif, erreur
    if (existingByEmail && existingByEmail.status === "active") {
      return res.status(400).json({
        status: "error",
        message: "Cet email est déjà utilisé",
      });
    }

    if (existingByLicense && existingByLicense.status === "active") {
      return res.status(400).json({
        status: "error",
        message: "Ce numéro de licence est déjà utilisé",
      });
    }

    // Sinon, création d'un nouvel utilisateur
    const hashed = await hashPassword(password);
    const email_verification_token = crypto.randomBytes(32).toString("hex");

    try {
      const newUser = await User.create({
        id: uuidv4(),
        name,
        email,
        num_license,
        password: hashed,
        email_verification_token,
      });

      const emailData = emailTemplates.verificationEmail(email_verification_token, name);
      await sendEmail(email, emailData.subject, emailData.text, emailData.html);

      res.status(201).json({
        status: "success",
        data: { id: newUser.id, email: newUser.email },
      });
    } catch (createErr) {
      // Gérer les erreurs de contrainte unique
      if (
        createErr.name === "SequelizeUniqueConstraintError" ||
        createErr.name === "SequelizeValidationError"
      ) {
        const field = createErr.errors?.[0]?.path || "champ";
        return res.status(400).json({
          status: "error",
          message: `Ce ${field === "email" ? "email" : "numéro de licence"} est déjà utilisé`,
        });
      }
      throw createErr;
    }
  } catch (err) {
    console.error("Error in register:", err);
    res.status(500).json({
      status: "error",
      message: err.message || "Une erreur est survenue lors de l'inscription",
    });
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
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({ 
        status: "error", 
        message: "Token manquant" 
      });
    }

    // Nettoyer le token (supprimer les espaces et caractères invisibles)
    const cleanToken = token.trim().replace(/\s+/g, '');

    // Chercher l'utilisateur avec le token (comparaison exacte)
    let user = await User.findOne({
      where: { email_verification_token: cleanToken },
    });

    // Si pas trouvé, faire des logs de débogage détaillés
    if (!user) {
      console.log("🔍 Token recherché:", cleanToken);
      console.log("📏 Longueur du token recherché:", cleanToken.length);
      console.log("🔤 Token (hex):", Buffer.from(cleanToken).toString('hex'));
      
      // Chercher tous les utilisateurs avec un token non null pour comparaison
      const usersWithTokens = await User.findAll({
        where: {
          email_verification_token: { [Op.ne]: null }
        },
        attributes: ["id", "email", "email_verification_token"],
        limit: 10
      });
      
      console.log("📋 Tokens existants en base (échantillon):");
      let foundMatch = false;
      usersWithTokens.forEach(u => {
        const dbToken = u.email_verification_token;
        if (dbToken) {
          const dbTokenClean = dbToken.trim().replace(/\s+/g, '');
          console.log(`  - ${u.email}:`);
          console.log(`    Token (premiers 30 chars): ${dbToken.substring(0, 30)}...`);
          console.log(`    Longueur: ${dbToken.length}`);
          console.log(`    Longueur nettoyée: ${dbTokenClean.length}`);
          
          // Comparaison exacte
          if (dbToken === cleanToken || dbTokenClean === cleanToken) {
            console.log(`    ✅ MATCH TROUVÉ !`);
            foundMatch = true;
            // Réessayer avec le token exact de la base
            user = u;
          }
        }
      });

      if (!user && !foundMatch) {
        return res.status(400).json({ 
          status: "error", 
          message: "Token invalide ou déjà utilisé",
          debug: process.env.NODE_ENV === "development" ? {
            tokenLength: cleanToken.length,
            tokenPreview: cleanToken.substring(0, 20) + "...",
            tokensInDb: usersWithTokens.length
          } : undefined
        });
      }
    }

    // Vérifier si le compte est déjà actif
    if (user.status === "active") {
      return res.status(400).json({ 
        status: "error", 
        message: "Ce compte est déjà activé" 
      });
    }

    // Activer le compte
    user.email_verification_token = null;
    user.status = "active";
    await user.save();

    res.json({ 
      status: "success", 
      message: "Email vérifié avec succès",
      data: {
        email: user.email,
        name: user.name
      }
    });
  } catch (err) {
    console.error("Erreur lors de la vérification d'email:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Erreur serveur lors de la vérification" 
    });
  }
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

  const emailData = emailTemplates.passwordResetEmail(user.name, token);
  await sendEmail(user.email, emailData.subject, emailData.text, emailData.html);
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
