import express from "express";
import path from "path";
import multer from "multer";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const PORT = 3000;

// Lazy initializer for Gemini
let aiInstance: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment variables.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

async function startServer() {
  const app = express();

  // Multer in-memory storage for handling audio uploads
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  });

  // Parse JSON and URL-encoded bodies
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ----------------------------------------------------
  // API ROUTES FIRST
  // ----------------------------------------------------

  // 1. Health & Config endpoint
  app.get("/api/config", (req, res) => {
    res.json({
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      hasElevenLabsKey: !!process.env.ELEVENLABS_API_KEY,
    });
  });

  // 2. Chat with Gemini
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages } = req.body;
      if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ error: "Missing or invalid messages array" });
        return;
      }

      const ai = getGemini();
      
      const systemInstruction = `Sei l'assistente vocale personale dell'utente. Rispondi in modo cordiale, chiaro e conciso in italiano (o nella lingua del messaggio dell'utente). Mantieni i messaggi relativamente brevi e adatti ad essere letti ad alta voce (evita elenchi troppo lunghi, codice sorgente complesso o formule matematiche se non espressamente richiesto).`;

      const formattedContents = messages.map((m: any) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      }));

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: formattedContents,
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      res.json({ response: response.text || "" });
    } catch (error: any) {
      console.error("Gemini Chat API Error:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // 3. Voice Clone (ElevenLabs Voice Add)
  app.post("/api/clone-voice", upload.single("voice_sample"), async (req, res) => {
    try {
      const file = req.file;
      const voiceName = req.body.voice_name || `AURA Clone ${Date.now()}`;

      if (!file) {
        res.status(400).json({ error: "No voice sample file uploaded" });
        return;
      }

      const xiApiKey = process.env.ELEVENLABS_API_KEY;
      if (!xiApiKey) {
        console.log("ElevenLabs API Key not found. Returning Demo Voice ID.");
        res.json({
          voice_id: "demo_clone_voice_id",
          isDemo: true,
          message: "ElevenLabs API Key not configured. Using high-fidelity local browser fallback for synthesis.",
        });
        return;
      }

      console.log(`Cloning voice "${voiceName}" with file size ${file.size} bytes...`);

      const formData = new FormData();
      formData.append("name", voiceName);
      
      const fileBlob = new Blob([file.buffer], { type: file.mimetype || "audio/webm" });
      formData.append("files", fileBlob, "voice_sample.webm");

      const response = await fetch("https://api.elevenlabs.io/v1/voices/add", {
        method: "POST",
        headers: {
          "xi-api-key": xiApiKey,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("ElevenLabs Add Voice failed:", errorText);
        res.status(response.status).json({ error: `ElevenLabs Error: ${errorText}` });
        return;
      }

      const data: any = await response.json();
      console.log("ElevenLabs Voice cloned successfully. Voice ID:", data.voice_id);
      res.json({ voice_id: data.voice_id, isDemo: false });
    } catch (error: any) {
      console.error("Voice Clone Error:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // 4. Custom Voice TTS (ElevenLabs Text-to-Speech)
  app.post("/api/tts", async (req, res) => {
    try {
      const { text, voice_id } = req.body;
      if (!text || !voice_id) {
        res.status(400).json({ error: "Missing text or voice_id" });
        return;
      }

      const xiApiKey = process.env.ELEVENLABS_API_KEY;
      if (!xiApiKey || voice_id === "demo_clone_voice_id") {
        res.status(400).json({
          error: "ELEVENLABS_API_KEY_MISSING",
          message: "API Key for ElevenLabs missing. Falling back to local synthesis.",
        });
        return;
      }

      console.log(`Generating TTS for Voice: ${voice_id}, text length: ${text.length}`);

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
        method: "POST",
        headers: {
          "xi-api-key": xiApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("ElevenLabs TTS failed:", errorText);
        res.status(response.status).json({ error: `ElevenLabs TTS Error: ${errorText}` });
        return;
      }

      res.setHeader("Content-Type", "audio/mpeg");
      
      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (error: any) {
      console.error("TTS API Error:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // ----------------------------------------------------
  // VITE OR STATIC FILE SERVING
  // ----------------------------------------------------
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Start listening
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Full-stack server booting on http://0.0.0.0:${PORT}`);
  });
}

startServer();
