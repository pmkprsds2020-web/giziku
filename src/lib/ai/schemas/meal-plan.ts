import { z } from "zod";

// The gram-precise meal plan itself is produced deterministically by the
// Isi Piringku optimizer (src/lib/ai/meal-generator.ts) so the ±2%
// macro accuracy requirement is guaranteed by arithmetic, not by the LLM.
// The LLM's job (this schema) is the clinical narrative layer on top:
// reasoning, alternatives, warnings, and compliance commentary.

export const MealPlanAlternativeSchema = z.object({
  originalFood: z.string(),
  alternativeFood: z.string(),
  reason: z.string(),
});

export const MealPlanReasoningOutputSchema = z.object({
  reasoning: z.string().min(10).max(2000),
  clinical_notes: z.array(z.string()).default([]),
  alternatives: z.array(MealPlanAlternativeSchema).default([]),
  warnings: z.array(z.string()).default([]),
  compliance_commentary: z.string().default(""),
});

export type MealPlanReasoningOutput = z.infer<typeof MealPlanReasoningOutputSchema>;
