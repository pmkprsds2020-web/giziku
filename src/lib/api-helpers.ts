// CareLivia — API Response Helpers
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function err(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    { success: false, error: message, details },
    { status },
  );
}

export function handleZod(e: unknown) {
  if (e instanceof ZodError) {
    return err("Validasi gagal", 422, e.issues);
  }
  if (e instanceof Error) {
    console.error("[CareLivia API]", e.message);
    return err(e.message, 500);
  }
  console.error("[CareLivia API] Unknown error", e);
  return err("Terjadi kesalahan tak terduga", 500);
}

export function safeParse<T>(schema: z.ZodSchema<T>, body: unknown) {
  return schema.safeParse(body);
}

export function ageFromBirth(birth: Date | string): number {
  const birthDate = typeof birth === "string" ? new Date(birth) : birth;
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age--;
  return age;
}
