import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Gemini client securely server-side
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

app.use(express.json({ limit: "10mb" }));

// API Endpoint to analyze files and emails for clean-up candidates
app.post("/api/gemini/analyze", async (req, res) => {
  try {
    const { driveFiles, emailList } = req.body;

    if (!driveFiles && !emailList) {
      res.status(400).json({ error: "Missing content for analysis (driveFiles or emailList)" });
      return;
    }

    const prompt = `
      Eres un Organizador Personal de Google especializado en limpieza digital y archivado inteligente. 
      Analiza la siguiente lista de metadatos de archivos de Google Drive y/o correos de Gmail para encontrar desorden digital, duplicados, archivos redundantes o correos inútiles (como correos promocionales viejos, newsletters de baja importancia, archivos temporales, copias duplicadas).

      RETORNA TU RESPUESTA EN FORMATO JSON que coincida exactamente con este esquema:
      {
        "overallAssessment": "Un resumen ejecutivo en español de 2 frases sobre la salud del almacenamiento del usuario y áreas críticas de acción.",
        "duplicateCandidates": [
          {
            "id": "identificador_del_archivo_si_se_especifica",
            "name": "nombre del archivo",
            "reason": "Razón en español de por qué es un duplicado o candidato redundante",
            "action": "KEEP (Guardar) o DELETE (Eliminar) o ARCHIVE (Archivar)"
          }
        ],
        "cleanupCandidates": [
          {
            "id": "identificador_de_archivo_o_correo",
            "type": "DRIVE_FILE" o "GMAIL_EMAIL",
            "name": "Nombre de archivo o asunto de correo",
            "reason": "Explicación directa en español de por qué debería eliminarse o archivarse (ej. adjunto gigante innecesario, newsletter desactualizada, etc.)",
            "action": "DELETE" o "ARCHIVE"
          }
        ],
        "organizationTips": [
          "Consejo directo 1 en español para optimizar",
          "Consejo directo 2 en español para optimizar"
        ]
      }

      Aquí está la información del usuario para analizar:
      - Archivos de Drive proporcionados: ${JSON.stringify(driveFiles || [])}
      - Correos de Gmail proporcionados: ${JSON.stringify(emailList || [])}

      Importante:
      1. Si encuentras nombres de archivos idénticos o patrones como "(1)", "copia de", considéralos candidatos.
      2. Si hay correos de un mismo remitente recurrente tipo promocional, newsletter, notificaciones automáticas ("no-reply", "noreply"), sugiérelos como candidatos automáticos de limpieza.
      3. Sé preciso con los IDs proporcionados para que el frontend pueda ayudar al usuario a procesarlos.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["overallAssessment", "duplicateCandidates", "cleanupCandidates", "organizationTips"],
          properties: {
            overallAssessment: {
              type: Type.STRING,
              description: "Resumen ejecutivo en español",
            },
            duplicateCandidates: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["name", "reason", "action"],
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  action: { type: Type.STRING },
                },
              },
            },
            cleanupCandidates: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["type", "name", "reason", "action"],
                properties: {
                  id: { type: Type.STRING },
                  type: { type: Type.STRING },
                  name: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  action: { type: Type.STRING },
                },
              },
            },
            organizationTips: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
        },
      },
    });

    const resultText = response.text || "{}";
    res.json(JSON.parse(resultText));
  } catch (error: any) {
    console.error("Gemini api error:", error);
    res.status(500).json({ error: error.message || "Fallo en el análisis de Gemini" });
  }
});

// Setup Vite Dev Server / Static production build router
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // Serve index.html for unknown SPAs
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

setupServer();
