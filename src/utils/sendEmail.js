// Configuration flexible pour supporter plusieurs providers
// Par défaut : Resend (recommandé)
// Alternative : SMTP via nodemailer

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const USE_RESEND = process.env.USE_RESEND !== "false" && RESEND_API_KEY; // Resend par défaut si la clé est présente

/**
 * Envoie un email via Resend (recommandé) ou SMTP (fallback)
 * @param {string} to - Destinataire
 * @param {string} subject - Sujet
 * @param {string} text - Corps du message (texte)
 * @param {string} html - Corps du message (HTML, optionnel)
 */
module.exports = async (to, subject, text, html = null) => {
  // Utiliser Resend si disponible
  if (USE_RESEND) {
    try {
      const { Resend } = require("resend");
      const resend = new Resend(RESEND_API_KEY);

      const from = process.env.RESEND_FROM_EMAIL || process.env.SMTP_USER || "noreply@aviron-app.com";

      const result = await resend.emails.send({
        from,
        to,
        subject,
        text,
        html: html || text.replace(/\n/g, "<br>"), // Convertir le texte en HTML basique si pas de HTML fourni
      });

      console.log("✅ Email envoyé via Resend:", result.data?.id || "succès");
      return result;
    } catch (error) {
      console.error("❌ Erreur Resend:", error.message);
      // Si USE_RESEND est explicitement true, ne pas fallback
      if (process.env.USE_RESEND === "true") {
        throw new Error(`Erreur Resend: ${error.message}`);
      }
      // Sinon, fallback vers SMTP
      console.log("🔄 Fallback vers SMTP...");
    }
  }

  // Fallback vers SMTP (nodemailer)
  const nodemailer = require("nodemailer");

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true", // true pour 465, false pour autres ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html: html || text.replace(/\n/g, "<br>"),
  };

  const result = await transporter.sendMail(mailOptions);
  console.log("Email envoyé via SMTP:", result.messageId);
  return result;
};
