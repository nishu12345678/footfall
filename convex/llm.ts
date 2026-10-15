import { ConvexError } from "convex/values";

/**
 * One place for every call to the writing assistant.
 *
 * footfall talks to OpenRouter, not OpenAI directly — one key covers every
 * model, and OpenRouter's chat endpoint is wire-compatible with OpenAI's, so
 * every call site below is unchanged apart from which function it imports.
 *
 * Model ids carry an explicit provider prefix (OpenRouter's convention):
 * "openai/gpt-4o-mini" for text, "openai/gpt-image-1" for images. Swapping
 * either model later is a one-line change, here only.
 */

const CHAT_MODEL = "openai/gpt-4o-mini";
const IMAGE_MODEL = "openai/gpt-image-1";

const CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const IMAGE_URL = "https://openrouter.ai/api/v1/images";

/** OpenRouter asks for these so usage shows up right in their dashboard. */
function openRouterHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://footfall.zone",
    "X-Title": "footfall",
  };
}

export function llmApiKey(): string | null {
  return process.env.OPENROUTER_API_KEY?.trim() || null;
}

/** Throws footfall's own, user-facing message when no key is configured. */
export function requireLlmApiKey(): string {
  const key = llmApiKey();
  if (!key) {
    throw new ConvexError("The writing assistant isn't set up on this server yet.");
  }
  return key;
}

export type ChatMessage = { role: "system" | "user"; content: string };

type ChatOptions = {
  apiKey: string;
  messages: ChatMessage[];
  temperature?: number;
  /** Every call site here wants structured JSON back. */
  json?: boolean;
};

/**
 * One chat-completion call. Returns the raw response so each call site keeps
 * its own error message and parsing — only the transport is shared.
 */
export async function chatCompletion({
  apiKey,
  messages,
  temperature,
  json = true,
}: ChatOptions): Promise<Response> {
  return await fetch(CHAT_URL, {
    method: "POST",
    headers: openRouterHeaders(apiKey),
    body: JSON.stringify({
      model: CHAT_MODEL,
      ...(temperature === undefined ? {} : { temperature }),
      ...(json ? { response_format: { type: "json_object" } } : {}),
      messages,
    }),
  });
}

/** Pulls `choices[0].message.content` out of a successful chat response. */
export async function chatContent(res: Response): Promise<string> {
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "{}";
}

type ImageOptions = {
  apiKey: string;
  prompt: string;
  size: string;
  quality: "low" | "medium" | "high" | "auto";
  outputFormat: "png" | "jpeg" | "webp";
  outputCompression?: number;
};

/** One image-generation call. Mirrors OpenAI's images/generations shape. */
export async function generateImage({
  apiKey,
  prompt,
  size,
  quality,
  outputFormat,
  outputCompression,
}: ImageOptions): Promise<Response> {
  return await fetch(IMAGE_URL, {
    method: "POST",
    headers: openRouterHeaders(apiKey),
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt,
      size,
      quality,
      output_format: outputFormat,
      ...(outputCompression === undefined
        ? {}
        : { output_compression: outputCompression }),
      n: 1,
    }),
  });
}

/** Pulls the first image's base64 payload out of a successful response. */
export function imageBase64(data: unknown): string | undefined {
  const d = data as { data?: { b64_json?: string }[] } | undefined;
  return d?.data?.[0]?.b64_json;
}
