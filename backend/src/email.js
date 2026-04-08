// backend/src/email.js
import nodemailer from "nodemailer";

function createTransport() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Send a password reset email.
 * @param {string} to - Recipient email
 * @param {string} resetUrl - Full reset URL with token
 * @param {string} lang - 'fr' | 'en' | 'es'
 */
export async function sendPasswordResetEmail(to, resetUrl, lang = "fr") {
  const transport = createTransport();
  if (!transport) {
    console.warn("[email] SMTP not configured — skipping email send");
    return;
  }

  const subjects = {
    fr: "Réinitialisation de votre mot de passe — ZoneDeGrimpe",
    en: "Reset your ZoneDeGrimpe password",
    es: "Restablece tu contraseña — ZoneDeGrimpe",
  };

  const bodies = {
    fr: `Bonjour,\n\nVous avez demandé la réinitialisation de votre mot de passe sur ZoneDeGrimpe.\n\nCliquez sur le lien suivant pour choisir un nouveau mot de passe (valable 15 minutes) :\n\n${resetUrl}\n\nSi vous n'avez pas fait cette demande, ignorez cet email.\n\nL'équipe ZoneDeGrimpe`,
    en: `Hello,\n\nYou requested a password reset on ZoneDeGrimpe.\n\nClick the link below to set a new password (valid for 15 minutes):\n\n${resetUrl}\n\nIf you did not request this, please ignore this email.\n\nThe ZoneDeGrimpe team`,
    es: `Hola,\n\nHas solicitado restablecer tu contraseña en ZoneDeGrimpe.\n\nHaz clic en el siguiente enlace para establecer una nueva contraseña (válido por 15 minutos):\n\n${resetUrl}\n\nSi no solicitaste esto, ignora este correo.\n\nEl equipo de ZoneDeGrimpe`,
  };

  const htmlBodies = {
    fr: `<p>Bonjour,</p><p>Vous avez demandé la réinitialisation de votre mot de passe sur ZoneDeGrimpe.</p><p><a href="${resetUrl}" style="background:#5D7052;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block">Réinitialiser mon mot de passe</a></p><p>Ce lien est valable <strong>15 minutes</strong>.</p><p>Si vous n'avez pas fait cette demande, ignorez cet email.</p>`,
    en: `<p>Hello,</p><p>You requested a password reset on ZoneDeGrimpe.</p><p><a href="${resetUrl}" style="background:#5D7052;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block">Reset my password</a></p><p>This link is valid for <strong>15 minutes</strong>.</p><p>If you did not request this, please ignore this email.</p>`,
    es: `<p>Hola,</p><p>Has solicitado restablecer tu contraseña en ZoneDeGrimpe.</p><p><a href="${resetUrl}" style="background:#5D7052;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block">Restablecer mi contraseña</a></p><p>Este enlace es válido por <strong>15 minutos</strong>.</p><p>Si no solicitaste esto, ignora este correo.</p>`,
  };

  const l = ["fr", "en", "es"].includes(lang) ? lang : "fr";

  await transport.sendMail({
    from: process.env.SMTP_FROM || `"ZoneDeGrimpe" <${process.env.SMTP_USER}>`,
    to,
    subject: subjects[l],
    text: bodies[l],
    html: htmlBodies[l],
  });
}
