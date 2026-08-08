// =====================================================================
// CareLivia — Input / Error Sanitization for AI Routes
// =====================================================================

/** Strips characters commonly used for prompt injection / control chars. */
export function sanitizeText(input: string, maxLen = 2000): string {
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "") // control chars
    .replace(/```/g, "'''") // prevent breaking out of our own code fences
    .trim()
    .slice(0, maxLen);
}

/** Recursively sanitizes all string values in a plain object (shallow depth-limited). */
export function sanitizeObject<T>(obj: T, depth = 0): T {
  if (depth > 5) return obj;
  if (typeof obj === "string") {
    // Base64 data URLs (images sent to vision AI routes — Laboratorium
    // OCR, Nutrigenomic AI) are binary payloads, not natural-language
    // user input. The injection-scrubbing + 2000-char cap in
    // sanitizeText() are meant for text that gets interpolated into an
    // LLM prompt; applied here they were silently truncating every
    // image data URL down to 2000 characters, producing invalid/
    // incomplete base64 and a confusing "Invalid base64 image_url"
    // error from the AI provider regardless of the original image size.
    // Data URLs aren't prompt text (they go into the vision API's
    // image_url field, never interpolated as text), so it's safe to
    // skip sanitization for them entirely.
    if (/^data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,/i.test(obj)) return obj as unknown as T;
    return sanitizeText(obj) as unknown as T;
  }
  if (Array.isArray(obj)) return obj.map((v) => sanitizeObject(v, depth + 1)) as unknown as T;
  if (obj && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[k] = sanitizeObject(v, depth + 1);
    }
    return out as T;
  }
  return obj;
}

/** Never leak internal error details (stack traces, DB errors) to the client. */
export function sanitizeErrorForClient(e: unknown): string {
  if (e instanceof Error) {
    // Known, safe-to-show messages (already user-facing Indonesian text)
    if (/^(AI sedang tidak tersedia|Validasi gagal|Rate limit|Terlalu banyak permintaan)/.test(e.message)) {
      return e.message;
    }
  }
  console.error("[ai] internal error:", e);
  return "Terjadi kesalahan pada layanan AI. Silakan coba lagi.";
}
