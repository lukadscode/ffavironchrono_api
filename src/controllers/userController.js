const { v4: uuidv4 } = require("uuid");
const { Op } = require("sequelize");
const User = require("../models/User");
const UserSession = require("../models/UserSession");
const { hashPassword } = require("../utils/hash");
const sendEmail = require("../utils/sendEmail");
const emailTemplates = require("../utils/emailTemplates");
const crypto = require("crypto");

// GET /users - Liste des utilisateurs avec pagination et filtres
exports.getUsers = async (req, res) => {
  try {
    const { search, role, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Construire les conditions de recherche
    const where = {};
    if (role) {
      where.role = role;
    }
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { num_license: { [Op.like]: `%${search}%` } },
      ];
    }

    // Récupérer les utilisateurs avec pagination
    const { count, rows } = await User.findAndCountAll({
      where,
      attributes: [
        "id",
        "name",
        "email",
        "num_license",
        "avatar",
        "status",
        "role",
        "slug",
        "created_at",
        "updated_at",
      ],
      limit: parseInt(limit),
      offset: offset,
      order: [["created_at", "DESC"]],
    });

    res.json({
      status: "success",
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error("Error getting users:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// POST /users - Créer un utilisateur (admin uniquement)
exports.createUser = async (req, res) => {
  try {
    const { name, email, num_license, role = "user" } = req.body;

    // Vérifier si l'email existe déjà
    const existingByEmail = await User.findOne({ where: { email } });
    if (existingByEmail) {
      return res.status(400).json({
        status: "error",
        message: "Cet email est déjà utilisé",
      });
    }

    // Vérifier si le num_license existe déjà (si fourni)
    if (num_license) {
      const existingByLicense = await User.findOne({
        where: { num_license },
      });
      if (existingByLicense) {
        return res.status(400).json({
          status: "error",
          message: "Ce numéro de licence est déjà utilisé",
        });
      }
    }

    // Générer un mot de passe temporaire
    const temporaryPassword = crypto.randomBytes(12).toString("hex");
    const hashedPassword = await hashPassword(temporaryPassword);
    const email_verification_token = crypto.randomBytes(32).toString("hex");

    const newUser = await User.create({
      id: uuidv4(),
      name,
      email,
      num_license: num_license || null,
      password: hashedPassword,
      role,
      status: "inactive",
      email_verification_token,
    });

    // Envoyer un email avec le mot de passe temporaire
    const emailData = emailTemplates.accountCreationEmail(
      name,
      email,
      temporaryPassword,
      email_verification_token
    );

    try {
      await sendEmail(email, emailData.subject, emailData.text, emailData.html);
    } catch (emailError) {
      console.error("Erreur lors de l'envoi de l'email:", emailError);
      // On continue même si l'email n'a pas pu être envoyé
    }

    res.status(201).json({
      status: "success",
      data: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        temporary_password: temporaryPassword,
      },
    });
  } catch (err) {
    console.error("Error creating user:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// GET /users/{identifier} - Détail d'un utilisateur (par id, email ou num_license)
exports.getUserByIdentifier = async (req, res) => {
  try {
    const { identifier } = req.params;

    const user = await User.findOne({
      where: {
        [Op.or]: [
          { id: identifier },
          { email: identifier },
          { num_license: identifier },
        ],
      },
      attributes: [
        "id",
        "name",
        "email",
        "num_license",
        "avatar",
        "status",
        "role",
        "slug",
        "created_at",
        "updated_at",
      ],
    });

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "Utilisateur non trouvé",
      });
    }

    // TODO: Ajouter les clubs et groupes si les modèles existent
    res.json({
      status: "success",
      data: {
        ...user.dataValues,
        clubs: [], // À implémenter si le modèle Club existe
        groups: [], // À implémenter si le modèle Group existe
      },
    });
  } catch (err) {
    console.error("Error getting user:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// PATCH /users/{id} - Modifier un utilisateur
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, num_license, avatar, status, role } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "Utilisateur non trouvé",
      });
    }

    // Vérifier les conflits d'email
    if (email && email !== user.email) {
      const existingByEmail = await User.findOne({
        where: { email, id: { [Op.ne]: id } },
      });
      if (existingByEmail) {
        return res.status(400).json({
          status: "error",
          message: "Cet email est déjà utilisé",
        });
      }
      user.email = email;
    }

    // Vérifier les conflits de num_license
    if (num_license && num_license !== user.num_license) {
      const existingByLicense = await User.findOne({
        where: { num_license, id: { [Op.ne]: id } },
      });
      if (existingByLicense) {
        return res.status(400).json({
          status: "error",
          message: "Ce numéro de licence est déjà utilisé",
        });
      }
      user.num_license = num_license;
    }

    // Mettre à jour les autres champs
    if (name) user.name = name;
    if (avatar !== undefined) user.avatar = avatar;
    if (status) user.status = status;
    if (role) user.role = role;

    try {
      await user.save();
    } catch (saveErr) {
      if (
        saveErr.name === "SequelizeUniqueConstraintError" ||
        saveErr.name === "SequelizeValidationError"
      ) {
        return res.status(400).json({
          status: "error",
          message: "Erreur de validation ou contrainte unique",
        });
      }
      throw saveErr;
    }

    res.json({
      status: "success",
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        num_license: user.num_license,
        avatar: user.avatar,
        status: user.status,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// DELETE /users/{id} - Désactiver un utilisateur
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "Utilisateur non trouvé",
      });
    }

    // Désactiver l'utilisateur au lieu de le supprimer
    user.status = "inactive";
    await user.save();

    res.json({
      status: "success",
      message: "Utilisateur désactivé",
    });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// GET /users/{id}/session-summary - Résumé des sessions d'un utilisateur
exports.getUserSessionSummary = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "Utilisateur non trouvé",
      });
    }

    // TODO: Implémenter la logique de calcul des sessions
    // Pour l'instant, on retourne des valeurs par défaut
    res.json({
      status: "success",
      data: {
        totalSessions: 0,
        noShowSessions: 0,
        points: 0,
      },
    });
  } catch (err) {
    console.error("Error getting session summary:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// GET /users/{userId}/sessions - Liste des sessions d'un utilisateur
exports.getUserSessions = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "Utilisateur non trouvé",
      });
    }

    const sessions = await UserSession.findAll({
      where: { user_id: userId },
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

    res.json({
      status: "success",
      data: sessions,
    });
  } catch (err) {
    console.error("Error getting user sessions:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// GET /users/me/session-summary - Résumé des sessions pour l'utilisateur connecté
exports.getMySessionSummary = async (req, res) => {
  try {
    const userId = req.user.userId;

    // TODO: Implémenter la logique de calcul des sessions
    // Pour l'instant, on retourne des valeurs par défaut
    res.json({
      status: "success",
      data: {
        totalSessions: 0,
        noShowSessions: 0,
        points: 0,
      },
    });
  } catch (err) {
    console.error("Error getting my session summary:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// POST /users/assign-club - Associer un utilisateur à un club
exports.assignClub = async (req, res) => {
  try {
    const { user_id, club_id, role = "member" } = req.body;

    const user = await User.findByPk(user_id);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "Utilisateur non trouvé",
      });
    }

    // TODO: Implémenter l'association avec le modèle Club si il existe
    // Pour l'instant, on retourne une réponse de succès
    res.json({
      status: "success",
      message: "Utilisateur associé au club",
      data: {
        user_id,
        club_id,
        role,
      },
    });
  } catch (err) {
    console.error("Error assigning club:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

