import express from "express";
import path from "path";
import multer from "multer";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

// Import modular API handlers from /api directory (Vercel-compatible structure)
import configHandler from "./api/config";
import chatHandler from "./api/chat";
import cloneVoiceHandler from "./api/clone-voice";
import ttsHandler from "./api/tts";
import recordsHandler from "./api/records";

dotenv.config();

const PORT = 3000;

async function startServer() {
  const app = express();

  // Serve physical records folder as static files
  app.use("/records", express.static(path.join(process.cwd(), "records")));

  // Multer in-memory storage for handling audio uploads
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  });

  // Parse JSON and URL-encoded bodies
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ----------------------------------------------------
  // API ROUTES MOUNTED FROM MODULAR API FOLDER
  // ----------------------------------------------------
  app.get("/api/config", configHandler);
  app.post("/api/chat", chatHandler);
  app.post("/api/clone-voice", upload.single("voice_sample"), cloneVoiceHandler);
  app.post("/api/tts", ttsHandler);
  
  // Physical records folder endpoints
  app.get("/api/records", recordsHandler);
  app.post("/api/records", upload.single("audio_file"), recordsHandler);

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
