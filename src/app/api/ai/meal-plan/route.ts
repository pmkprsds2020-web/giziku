export const runtime = "nodejs";

// The full meal-plan generation pipeline (deterministic Isi Piringku gram
// optimizer + OpenAI clinical reasoning layer, see
// src/lib/ai/meal-generator.ts and src/lib/ai/prompts/meal-plan.ts) lives
// in src/app/api/meal-plan/route.ts so it can stay colocated with the
// existing patient/preset/rotation-history data access it already used
// before this refactor. This route re-exports it under the /api/ai/*
// namespace required by the production spec, without duplicating logic.
export { GET, POST } from "@/app/api/meal-plan/route";
