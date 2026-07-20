import { Request, Response } from "express";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Lazy initializer for Gemini fallback
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

export default async function handler(req: Request, res: Response) {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: "Missing or invalid messages array" });
      return;
    }

    const groqApiKey = process.env.VOCAL_GROQ_API_KEY;
    const systemInstruction = `Sei l'assistente vocale personale dell'utente. Rispondi in modo cordiale, chiaro e conciso in italiano (o nella lingua del messaggio dell'utente). Mantieni i messaggi relativamente brevi e adatti ad essere letti ad alta voce (evita elenchi troppo lunghi, codice sorgente complesso o formule matematiche se non espressamente richiesto).`;

    if (groqApiKey) {
      console.log("Using Groq API for chat completion...");
      
      // Map messages and prepend system instruction for Groq
      const groqMessages = [
        { role: "system", content: systemInstruction },
        ...messages.map((m: any) => ({
          role: m.role === "model" ? "assistant" : m.role,
          content: m.content,
        })),
      ];

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: groqMessages,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Groq API error response:", errorText);
        throw new Error(`Groq API Error: ${errorText}`);
      }

      const data: any = await response.json();
      const text = data?.choices?.[0]?.message?.content || "";
      res.status(200).json({ response: text });
      return;
    } else if (process.env.GEMINI_API_KEY) {
      console.log("Groq API key not found. Falling back to Gemini...");
      const ai = getGemini();

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
        },
      });

      res.status(200).json({ response: response.text || "" });
      return;
    } else {
      res.status(400).json({
        error: "NO_API_KEY",
        response: "Ciao! Configura la tua chiave VOCAL_GROQ_API_KEY o GEMINI_API_KEY nel file .env per iniziare a chattare con me!",
      });
    }
  } catch (error: any) {
    console.error("Chat API Error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
}
