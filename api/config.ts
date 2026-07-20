import { Request, Response } from "express";

export default function handler(req: Request, res: Response) {
  res.status(200).json({
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    hasElevenLabsKey: !!process.env.ELEVENLABS_API_KEY,
    hasGroqKey: !!process.env.VOCAL_GROQ_API_KEY,
  });
}
