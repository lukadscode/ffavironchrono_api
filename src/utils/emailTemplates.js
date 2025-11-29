const BASE_URL = process.env.FRONTEND_URL || "https://timing.ffaviron.fr";

/**
 * Template de base pour tous les emails
 */
const baseTemplate = (content, title) => `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      background-color: #f4f4f4;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .email-header {
      background-color: #2563eb;
      background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
      padding: 40px 30px;
      text-align: center;
      color: #ffffff;
    }
    .email-header h1 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 10px;
      letter-spacing: -0.5px;
      color: #ffffff !important;
    }
    .email-header p {
      font-size: 16px;
      color: #ffffff !important;
      opacity: 1;
    }
    .email-body {
      padding: 40px 30px;
    }
    .email-content {
      color: #1f2937;
      font-size: 16px;
      line-height: 1.8;
    }
    .email-content h2 {
      color: #111827;
      font-size: 24px;
      margin-bottom: 20px;
      font-weight: 700;
    }
    .email-content p {
      margin-bottom: 16px;
      color: #374151;
    }
    .email-content strong {
      color: #111827;
      font-weight: 600;
    }
    .button-container {
      text-align: center;
      margin: 35px 0;
    }
    .button {
      display: inline-block;
      padding: 16px 40px;
      background-color: #2563eb;
      background: #2563eb; /* Fallback pour compatibilité email */
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      box-shadow: 0 4px 15px rgba(37, 99, 235, 0.4);
      transition: transform 0.2s, box-shadow 0.2s;
      border: 2px solid #1d4ed8;
    }
    .button:hover {
      background-color: #1d4ed8;
      background: #1d4ed8;
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(37, 99, 235, 0.5);
    }
    .info-box {
      background-color: #e8f0fe;
      border-left: 4px solid #2563eb;
      padding: 20px;
      margin: 25px 0;
      border-radius: 4px;
      border: 1px solid #cbd5e0;
    }
    .info-box strong {
      color: #1e40af;
      display: block;
      margin-bottom: 8px;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 700;
    }
    .info-box p {
      color: #1f2937;
    }
    .credentials-box {
      background-color: #fff5f5;
      border: 2px solid #fed7d7;
      border-radius: 8px;
      padding: 20px;
      margin: 25px 0;
    }
    .credentials-box h3 {
      color: #c53030;
      font-size: 18px;
      margin-bottom: 15px;
      font-weight: 600;
    }
    .credential-item {
      margin: 12px 0;
      padding: 12px;
      background-color: #ffffff;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
    }
    .credential-label {
      font-weight: 600;
      color: #4a5568;
      font-size: 14px;
      margin-bottom: 4px;
    }
    .credential-value {
      color: #2d3748;
      font-size: 16px;
      font-family: 'Courier New', monospace;
      word-break: break-all;
    }
    .warning-box {
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 20px;
      margin: 25px 0;
      border-radius: 4px;
      border: 1px solid #fcd34d;
    }
    .warning-box strong {
      color: #92400e;
      display: block;
      margin-bottom: 8px;
      font-weight: 700;
    }
    .warning-box p {
      color: #1f2937;
    }
    .email-footer {
      background-color: #f7fafc;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
    .email-footer p {
      color: #718096;
      font-size: 14px;
      margin: 8px 0;
    }
    .email-footer a {
      color: #667eea;
      text-decoration: none;
    }
    .divider {
      height: 1px;
      background: linear-gradient(to right, transparent, #e2e8f0, transparent);
      margin: 30px 0;
    }
    @media only screen and (max-width: 600px) {
      .email-body {
        padding: 30px 20px;
      }
      .email-header {
        padding: 30px 20px;
      }
      .email-header h1 {
        font-size: 24px;
      }
      .button {
        padding: 14px 30px;
        font-size: 15px;
      }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1 style="color: #ffffff !important; font-weight: 700;">FFAVIRON - TIMING</h1>
      <p style="color: #ffffff !important;">Gestion de chronométrage</p>
    </div>
    <div class="email-body">
      ${content}
    </div>
    <div class="email-footer">
      <p><strong>FFAVIRON - TIMING</strong></p>
      <p>Plateforme de gestion de chronométrage</p>
      <p style="margin-top: 15px;">
        <a href="${BASE_URL}">Visiter le site</a> | 
        <a href="${BASE_URL}/contact">Contact</a>
      </p>
      <p style="margin-top: 15px; font-size: 12px; color: #a0aec0;">
        Cet email a été envoyé automatiquement, merci de ne pas y répondre.
      </p>
    </div>
  </div>
</body>
</html>
`;

/**
 * Email de vérification d'adresse email
 */
exports.verificationEmail = (token, userName = "Utilisateur") => {
  const verifyUrl = `${BASE_URL}/verify-email?token=${token}`;
  
  const content = `
    <div class="email-content">
      <h2>Bienvenue ${userName} ! 👋</h2>
      <p>Merci de vous être inscrit sur <strong>FFAVIRON - TIMING</strong>.</p>
      <p>Pour finaliser votre inscription et activer votre compte, veuillez vérifier votre adresse email en cliquant sur le bouton ci-dessous :</p>
      
      <div class="button-container">
        <a href="${verifyUrl}" class="button">Vérifier mon email</a>
      </div>
      
      <div class="info-box" style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9;">
        <strong style="color: #0c4a6e; font-weight: 700;">🔒 SÉCURITÉ</strong>
        <p style="color: #1f2937;">Ce lien est valide pendant 24 heures. Si vous n'avez pas créé de compte, vous pouvez ignorer cet email.</p>
      </div>
      
      <div class="divider"></div>
      
      <p style="font-size: 14px; color: #4b5563;">
        Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :<br>
        <a href="${verifyUrl}" style="color: #2563eb; word-break: break-all; font-weight: 600;">${verifyUrl}</a>
      </p>
    </div>
  `;
  
  return {
    subject: "Vérification de votre adresse email - FFAVIRON - TIMING",
    html: baseTemplate(content, "Vérification de votre email"),
    text: `Bienvenue ${userName} !\n\nPour activer votre compte, veuillez cliquer sur ce lien : ${verifyUrl}\n\nCe lien est valide pendant 24 heures.`
  };
};

/**
 * Email de création de compte avec mot de passe provisoire
 */
exports.accountCreationEmail = (userName, email, temporaryPassword, token) => {
  const verifyUrl = `${BASE_URL}/verify-email?token=${token}`;
  
  const content = `
    <div class="email-content">
      <h2>Votre compte a été créé ! 🎉</h2>
      <p>Bonjour <strong>${userName}</strong>,</p>
      <p>Votre compte <strong>FFAVIRON - TIMING</strong> a été créé avec succès. Vous pouvez maintenant accéder à la plateforme de gestion de chronométrage.</p>
      
      <div class="credentials-box">
        <h3>🔑 Vos identifiants de connexion</h3>
        <div class="credential-item">
          <div class="credential-label">Email</div>
          <div class="credential-value">${email}</div>
        </div>
        <div class="credential-item">
          <div class="credential-label">Mot de passe provisoire</div>
          <div class="credential-value">${temporaryPassword}</div>
        </div>
      </div>
      
      <div class="warning-box">
        <strong>⚠️ IMPORTANT</strong>
        <p>Pour votre sécurité, veuillez <strong>changer ce mot de passe</strong> lors de votre première connexion.</p>
      </div>
      
      <div class="button-container">
        <a href="${BASE_URL}/login" class="button">Se connecter</a>
      </div>
      
      <div class="info-box" style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9;">
        <strong style="color: #0c4a6e; font-weight: 700;">📧 ACTIVATION DU COMPTE</strong>
        <p style="color: #1f2937;">Pour activer votre compte, veuillez vérifier votre adresse email en cliquant sur le lien ci-dessous :</p>
        <div style="margin-top: 15px;">
          <a href="${verifyUrl}" style="color: #2563eb; text-decoration: underline; font-weight: 600;">Activer mon compte</a>
        </div>
      </div>
    </div>
  `;
  
  return {
    subject: "Création de votre compte - Mot de passe provisoire",
    html: baseTemplate(content, "Création de votre compte"),
    text: `Bonjour ${userName},\n\nVotre compte a été créé.\n\nEmail : ${email}\nMot de passe provisoire : ${temporaryPassword}\n\n⚠️ IMPORTANT : Veuillez changer ce mot de passe lors de votre première connexion.\n\nPour activer votre compte : ${verifyUrl}`
  };
};

/**
 * Email d'ajout à un événement avec mot de passe provisoire
 */
exports.eventInvitationEmail = (userName, email, temporaryPassword, eventName, token) => {
  const verifyUrl = `${BASE_URL}/verify-email?token=${token}`;
  
  const content = `
    <div class="email-content">
      <h2>Invitation à un événement 🏁</h2>
      <p>Bonjour <strong>${userName}</strong>,</p>
      <p>Vous avez été ajouté à l'événement <strong>${eventName}</strong> sur <strong>FFAVIRON - TIMING</strong>.</p>
      <p>Un compte a été créé pour vous permettre d'accéder à la plateforme.</p>
      
      <div class="credentials-box">
        <h3>🔑 Vos identifiants de connexion</h3>
        <div class="credential-item">
          <div class="credential-label">Email</div>
          <div class="credential-value">${email}</div>
        </div>
        <div class="credential-item">
          <div class="credential-label">Mot de passe provisoire</div>
          <div class="credential-value">${temporaryPassword}</div>
        </div>
      </div>
      
      <div class="warning-box">
        <strong>⚠️ IMPORTANT</strong>
        <p>Pour votre sécurité, veuillez <strong>changer ce mot de passe</strong> lors de votre première connexion.</p>
      </div>
      
      <div class="button-container">
        <a href="${BASE_URL}/login" class="button">Accéder à l'événement</a>
      </div>
      
      <div class="info-box" style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9;">
        <strong style="color: #0c4a6e; font-weight: 700;">📧 ACTIVATION DU COMPTE</strong>
        <p style="color: #1f2937;">Pour activer votre compte, veuillez vérifier votre adresse email :</p>
        <div style="margin-top: 15px;">
          <a href="${verifyUrl}" style="color: #2563eb; text-decoration: underline; font-weight: 600;">Activer mon compte</a>
        </div>
      </div>
    </div>
  `;
  
  return {
    subject: `Invitation à l'événement ${eventName} - FFAVIRON - TIMING`,
    html: baseTemplate(content, "Invitation à un événement"),
    text: `Bonjour ${userName},\n\nVous avez été ajouté à l'événement ${eventName}.\n\nEmail : ${email}\nMot de passe provisoire : ${temporaryPassword}\n\n⚠️ IMPORTANT : Veuillez changer ce mot de passe lors de votre première connexion.\n\nPour activer votre compte : ${verifyUrl}`
  };
};

/**
 * Email d'ajout à un événement pour un utilisateur existant (sans mot de passe)
 */
exports.eventAddedEmail = (userName, eventName, role) => {
  const roleLabels = {
    viewer: "Visualiseur",
    editor: "Éditeur",
    referee: "Arbitre",
    organiser: "Organisateur"
  };
  
  const roleLabel = roleLabels[role] || role;
  
  const content = `
    <div class="email-content">
      <h2>Vous avez été ajouté à un événement ! 🏁</h2>
      <p>Bonjour <strong>${userName}</strong>,</p>
      <p>Vous avez été ajouté à l'événement <strong>${eventName}</strong> sur <strong>FFAVIRON - TIMING</strong>.</p>
      
      <div class="info-box" style="background-color: #dbeafe; border-left: 4px solid #2563eb; border: 1px solid #93c5fd;">
        <strong style="color: #1e40af; font-weight: 700;">👤 VOTRE RÔLE</strong>
        <p style="font-size: 20px; color: #1e40af; font-weight: 700; margin-top: 12px; background-color: #ffffff; padding: 12px; border-radius: 6px; border: 2px solid #2563eb; display: inline-block; min-width: 150px; text-align: center;">${roleLabel}</p>
      </div>
      
      <p>Vous pouvez maintenant accéder à cet événement avec votre compte existant.</p>
      
      <div class="button-container">
        <a href="${BASE_URL}/login" class="button">Accéder à l'événement</a>
      </div>
      
      <div class="info-box" style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9;">
        <strong style="color: #0c4a6e; font-weight: 700;">💡 INFORMATION</strong>
        <p style="color: #1f2937;">Utilisez vos identifiants habituels pour vous connecter. Si vous avez oublié votre mot de passe, vous pouvez le réinitialiser depuis la page de connexion.</p>
      </div>
    </div>
  `;
  
  return {
    subject: `Ajout à l'événement ${eventName} - FFAVIRON - TIMING`,
    html: baseTemplate(content, "Ajout à un événement"),
    text: `Bonjour ${userName},\n\nVous avez été ajouté à l'événement ${eventName} avec le rôle ${roleLabel}.\n\nVous pouvez accéder à l'événement en vous connectant : ${BASE_URL}/login`
  };
};

/**
 * Email de réinitialisation de mot de passe
 */
exports.passwordResetEmail = (userName, token) => {
  const resetUrl = `${BASE_URL}/reset-password?token=${token}`;
  
  const content = `
    <div class="email-content">
      <h2>Réinitialisation de mot de passe 🔐</h2>
      <p>Bonjour <strong>${userName}</strong>,</p>
      <p>Vous avez demandé à réinitialiser votre mot de passe sur <strong>FFAVIRON - TIMING</strong>.</p>
      <p>Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
      
      <div class="button-container">
        <a href="${resetUrl}" class="button">Réinitialiser mon mot de passe</a>
      </div>
      
      <div class="info-box" style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9;">
        <strong style="color: #0c4a6e; font-weight: 700;">🔒 SÉCURITÉ</strong>
        <p style="color: #1f2937;">Ce lien est valide pendant <strong style="color: #111827;">1 heure</strong>. Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email en toute sécurité.</p>
      </div>
      
      <div class="divider"></div>
      
      <p style="font-size: 14px; color: #4b5563;">
        Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :<br>
        <a href="${resetUrl}" style="color: #2563eb; word-break: break-all; font-weight: 600;">${resetUrl}</a>
      </p>
    </div>
  `;
  
  return {
    subject: "Réinitialisation de votre mot de passe - FFAVIRON - TIMING",
    html: baseTemplate(content, "Réinitialisation de mot de passe"),
    text: `Bonjour ${userName},\n\nPour réinitialiser votre mot de passe, cliquez sur ce lien : ${resetUrl}\n\nCe lien est valide pendant 1 heure.`
  };
};

/**
 * Email de confirmation de changement de mot de passe
 */
exports.passwordChangedEmail = (userName) => {
  const content = `
    <div class="email-content">
      <h2>Mot de passe modifié ✅</h2>
      <p>Bonjour <strong>${userName}</strong>,</p>
      <p>Votre mot de passe a été modifié avec succès.</p>
      
      <div class="info-box" style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9;">
        <strong style="color: #0c4a6e; font-weight: 700;">🔒 SÉCURITÉ</strong>
        <p style="color: #1f2937;">Si vous n'avez pas effectué cette modification, veuillez <strong style="color: #111827;">contacter immédiatement</strong> le support.</p>
      </div>
      
      <div class="button-container">
        <a href="${BASE_URL}/login" class="button">Se connecter</a>
      </div>
    </div>
  `;
  
  return {
    subject: "Mot de passe modifié - FFAVIRON - TIMING",
    html: baseTemplate(content, "Mot de passe modifié"),
    text: `Bonjour ${userName},\n\nVotre mot de passe a été modifié avec succès.\n\nSi vous n'avez pas effectué cette modification, contactez immédiatement le support.`
  };
};

