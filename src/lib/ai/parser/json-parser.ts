// =====================================================================
// CareLivia — AI JSON Parser
// Extracts a JSON object from raw LLM text, tolerant of markdown code
// fences and minor formatting noise. Throws on failure so callers can
// trigger a schema-aware retry (see validator.ts).
// =====================================================================

export class AIJsonParseError extends Error {
  constructor(message: string, public raw: string) {
    super(message);
    this.name = "AIJsonParseError";
  }
}

export function extractJson(raw: string): unknown {
  if (!raw || !raw.trim()) {
    throw new AIJsonParseError("Respons AI kosong", raw);
  }

  // Strip ```json ... ``` or ``` ... ``` fences if present
  let text = raw.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) text = fenceMatch[1].trim();

  // If there's leading/trailing prose around the JSON, grab the outermost
  // {...} or [...] block.
  const firstBrace = text.indexOf("{");
  const firstBracket = text.indexOf("[");
  let start = -1;
  if (firstBrace === -1) start = firstBracket;
  else if (firstBracket === -1) start = firstBrace;
  else start = Math.min(firstBrace, firstBracket);

  if (start === -1) {
    throw new AIJsonParseError("Tidak ditemukan objek JSON pada respons AI", raw);
  }

  const isArray = text[start] === "[";
  const closeChar = isArray ? "]" : "}";
  const openChar = isArray ? "[" : "{";
  let depth = 0;
  let end = -1;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (end === -1) {
    throw new AIJsonParseError("JSON pada respons AI tidak lengkap/terpotong", raw);
  }

  const candidate = text.slice(start, end + 1);

  try {
    return JSON.parse(candidate);
  } catch (e) {
    throw new AIJsonParseError(
      `Gagal parse JSON: ${e instanceof Error ? e.message : String(e)}`,
      raw,
    );
  }
}
