import { Request, Response } from "express";
import dotenv from "dotenv";

dotenv.config();

export default async function handler(req: Request, res: Response) {
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
}
