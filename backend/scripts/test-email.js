// backend/scripts/test-email.js
// Usage: RESEND_API_KEY=re_xxx node scripts/test-email.js --to=email@example.com

import { Resend } from "resend";
import dotenv from "dotenv";
dotenv.config();

const apiKey = process.env.RESEND_API_KEY;
const to = process.argv.find((a) => a.startsWith("--to="))?.slice(5) || process.env.SMTP_TEST_TO;

if (!apiKey) {
  console.error("❌  RESEND_API_KEY manquant");
  process.exit(1);
}
if (!to) {
  console.error("❌  Usage: RESEND_API_KEY=re_xxx node scripts/test-email.js --to=email@example.com");
  process.exit(1);
}

console.log(`📬  Envoi vers : ${to}`);
const client = new Resend(apiKey);

const { data, error } = await client.emails.send({
  from: process.env.EMAIL_FROM || "ZoneDeGrimpe <onboarding@resend.dev>",
  to,
  subject: "Test email ZoneDeGrimpe",
  text: "Si tu reçois ce message, l'envoi d'emails fonctionne correctement.",
});

if (error) {
  console.error("❌  Erreur :", error.message);
  process.exit(1);
}
console.log("✅  Email envoyé. Id :", data?.id);
