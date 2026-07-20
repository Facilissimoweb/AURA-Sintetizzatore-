import { Request, Response } from "express";
import dotenv from "dotenv";

dotenv.config();

export default async function handler(req: Request, res: Response) {
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
      res.status(200).json({
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
    res.status(200).json({ voice_id: data.voice_id, isDemo: false });
  } catch (error: any) {
    console.error("Voice Clone Error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
}
