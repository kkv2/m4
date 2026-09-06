import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

import { env } from "~/env/server";

/**
 * The LLM providers M4 can talk to. The active model is chosen in the UI, so
 * both clients are constructed lazily and kept behind one union.
 */
export const LLM_PROVIDERS = ["openai", "gemini"] as const;
export type LlmProviderId = (typeof LLM_PROVIDERS)[number];

let openaiClient: OpenAI | undefined;
let geminiClient: GoogleGenAI | undefined;

export function getOpenAI(): OpenAI {
  openaiClient ??= new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return openaiClient;
}

export function getGemini(): GoogleGenAI {
  geminiClient ??= new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  return geminiClient;
}
