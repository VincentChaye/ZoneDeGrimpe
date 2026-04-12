// backend/scripts/test-email.js
// Usage: SMTP_HOST=smtp.gmail.com SMTP_PORT=587 SMTP_USER=xxx@gmail.com SMTP_PASS=xxx node scripts/test-email.js

import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const host   = process.env.SMTP_HOST;
const port   = parseInt(process.env.SMTP_PORT || "587");
const secure = process.env.SMTP_SECURE === "true";
const user   = process.env.SMTP_USER;
const pass   = process.env.SMTP_PASS;
const to     = process.env.SMTP_TEST_TO || user;

if (!host || !user || !pass) {
  console.error("❌  Variables manquantes. Exemple :");
  console.error("    SMTP_HOST=smtp.gmail.com SMTP_USER=ton@gmail.com SMTP_PASS=xxxx node scripts/test-email.js");
  process.exit(1);
}

console.log(`🔧  Config : host=${host} port=${port} secure=${secure} user=${user}`);
console.log(`📬  Envoi vers : ${to}`);

const transport = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });

try {
  await transport.verify();
  console.log("✅  Connexion SMTP OK");
} catch (err) {
  console.error("❌  Connexion SMTP échouée :", err.message);
  process.exit(1);
}

try {
  const info = await transport.sendMail({
    from: `"ZoneDeGrimpe Test" <${user}>`,
    to,
    subject: "Test email ZoneDeGrimpe",
    text: "Si tu reçois ce message, l'envoi d'emails fonctionne correctement.",
  });
  console.log("✅  Email envoyé. MessageId :", info.messageId);
} catch (err) {
  console.error("❌  Envoi échoué :", err.message);
  process.exit(1);
}
