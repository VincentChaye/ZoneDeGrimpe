// scripts/check-models.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function list() {
  try {
    const models = await genAI.getGenerativeModel({ model: "gemini-pro" }).apiKey; // Juste pour init
    // Appel direct à l'API pour lister
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const data = await response.json();
    
    console.log("=== MODÈLES DISPONIBLES POUR TA CLÉ ===");
    if (data.models) {
        data.models.forEach(m => {
            if (m.supportedGenerationMethods.includes("generateContent")) {
                console.log(`- ${m.name.replace("models/", "")}`);
            }
        });
    } else {
        console.log("Erreur :", data);
    }
  } catch (e) {
    console.error(e);
  }
}

list();