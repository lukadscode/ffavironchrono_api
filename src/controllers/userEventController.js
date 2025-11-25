const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");
const { Op } = require("sequelize");
const UserEvent = require("../models/UserEvent");
const User = require("../models/User");
const { hashPassword } = require("../utils/hash");
const sendEmail = require("../utils/sendEmail");

/**
 * Génère un mot de passe provisoire aléatoire
 */
function generateTemporaryPassword() {
  const length = 12;
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

/**
 * Extrait le nom depuis l'email (partie avant @)
 */
function extractNameFromEmail(email) {
  const namePart = email.split("@")[0];
  // Capitaliser la première lettre
  return namePart.charAt(0).toUpperCase() + namePart.slice(1);
}

exports.addUserToEvent = async (req, res) => {
  try {
    const { email, event_id, role, name } = req.body;

    // Validation des champs requis
    if (!email || !event_id || !role) {
      return res.status(400).json({
        status: "error",
        message: "email, event_id et role sont requis",
      });
    }

    // Vérifier si l'utilisateur existe
    let user = await User.findOne({
      where: { email },
    });

    let userCreated = false;
    let temporaryPassword = null;

    // Si l'utilisateur n'existe pas, le créer
    if (!user) {
      temporaryPassword = generateTemporaryPassword();
      const hashedPassword = await hashPassword(temporaryPassword);
      const email_verification_token = crypto.randomBytes(32).toString("hex");

      // Utiliser le nom fourni ou extraire depuis l'email
      const userName = name || extractNameFromEmail(email);

      user = await User.create({
        id: uuidv4(),
        name: userName,
        email,
        password: hashedPassword,
        email_verification_token,
        status: "inactive", // L'utilisateur devra activer son compte
      });

      userCreated = true;

      // Envoyer un email avec le mot de passe provisoire
      const emailSubject = "Création de votre compte - Mot de passe provisoire";
      const emailText = `Bonjour ${userName},

Votre compte a été créé pour accéder à l'événement.

Vos identifiants de connexion :
- Email : ${email}
- Mot de passe provisoire : ${temporaryPassword}

⚠️ IMPORTANT : Veuillez changer ce mot de passe lors de votre première connexion.

Pour activer votre compte, veuillez cliquer sur le lien suivant :
https://aviron-app.com/verify-email?token=${email_verification_token}

Cordialement,
L'équipe AvironApp`;

      try {
        await sendEmail(email, emailSubject, emailText);
      } catch (emailError) {
        console.error("Erreur lors de l'envoi de l'email:", emailError);
        // On continue même si l'email n'a pas pu être envoyé
      }
    }

    // Créer ou mettre à jour le lien UserEvent
    const [record, created] = await UserEvent.findOrCreate({
      where: { user_id: user.id, event_id },
      defaults: {
        id: uuidv4(),
        role,
      },
    });

    if (!created) {
      record.role = role;
      await record.save();
    }

    res.json({
      status: "success",
      data: {
        user_event: record,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        user_created: userCreated,
        temporary_password: userCreated ? temporaryPassword : null,
      },
    });
  } catch (err) {
    console.error("Error adding user to event:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.removeUserFromEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await UserEvent.findByPk(id);
    if (!record)
      return res
        .status(404)
        .json({ status: "error", message: "Lien non trouvé" });

    await record.destroy();
    res.json({ status: "success", message: "Supprimé" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.listEventUsers = async (req, res) => {
  try {
    const { event_id } = req.params;
    const users = await UserEvent.findAll({
      where: { event_id },
      include: [
        {
          model: require("../models/User"),
          attributes: ["id", "name", "email"],
        },
      ],
    });
    res.json({ status: "success", data: users });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};
