export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { z } from "zod";
import { err } from "@/lib/api-helpers";
import { streamOpenAI } from "@/lib/ai/client";
import { CHAT_SYSTEM_PROMPT, buildChatContextPreamble } from "@/lib/ai/prompts/chat";
import { AI_MODELS } from "@/lib/ai/models";
import { logAIUsage } from "@/lib/ai/logging";
import { sanitizeText } from "@/lib/ai/sanitize";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/ai/rate-limit";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const RequestSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(50),
  patientContext: z.string().max(4000).optional(),
  patientId: z.string().optional(),
});

// POST /api/ai/chat
// Streams AI chat responses as Server-Sent-Events-style text chunks.
// The API key is used server-side only inside streamOpenAI().
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(clientKeyFromRequest(req, "chat"), { limit: 30, windowMs: 60_000 });
  if (!rl.allowed) return err("Terlalu banyak permintaan. Coba lagi sebentar.", 429);

  let input: z.infer<typeof RequestSchema>;
  try {
    const body = await req.json();
    input = RequestSchema.parse(body);
  } catch (e) {
    return err("Payload tidak valid", 422, e instanceof z.ZodError ? e.issues : undefined);
  }

  const sanitizedMessages = input.messages.map((m) => ({
    role: m.role,
    content: sanitizeText(m.content, 4000),
  }));

  const system = buildChatContextPreamble(input.patientContext) + CHAT_SYSTEM_PROMPT;
  const start = Date.now();

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      try {
        const gen = streamOpenAI({
          model: AI_MODELS.chat,
          system,
          messages: sanitizedMessages,
        });

        let usage = { promptTokens: 0, completionTokens: 0 };
        while (true) {
          const { value, done } = await gen.next();
          if (done) {
            usage = value ?? usage;
            break;
          }
          full += value;
          controller.enqueue(encoder.encode(value));
        }

        await logAIUsage({
          feature: "chat",
          model: AI_MODELS.chat,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          responseTimeMs: Date.now() - start,
          success: true,
          patientId: input.patientId ?? null,
        });
      } catch (e) {
        console.error("[ai/chat] stream error:", e);
        const message = full
          ? "\n\n[AI sedang tidak tersedia — respons mungkin tidak lengkap. Silakan coba lagi.]"
          : "AI sedang tidak tersedia. Silakan coba beberapa saat lagi.";
        controller.enqueue(encoder.encode(message));
        await logAIUsage({
          feature: "chat",
          model: AI_MODELS.chat,
          promptTokens: 0,
          completionTokens: 0,
          responseTimeMs: Date.now() - start,
          success: false,
          errorMessage: e instanceof Error ? e.message : String(e),
          patientId: input.patientId ?? null,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
