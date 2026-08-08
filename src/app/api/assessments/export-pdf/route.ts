export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { err } from "@/lib/api-helpers";
import {
  supabaseGetPatient,
  supabaseListAssessments,
  getServerClient,
  resolvePatientId,
} from "@/lib/supabase/data-layer";

const GENDER_LABEL: Record<string, string> = { MALE: "Laki-laki", FEMALE: "Perempuan" };

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

// Builds the row list for one assessment — only instruments actually
// filled in are included, mirroring buildAssessmentBlock() in
// /api/ai/assessment-summary so the PDF and the AI interpretation stay
// consistent with each other.
function assessmentRows(a: any): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  if (a.must) rows.push({ label: "MUST", value: `${a.must} (skor ${a.mustScore ?? "-"})` });
  if (a.nrs2002) rows.push({ label: "NRS-2002", value: `${a.nrs2002} (skor ${a.nrsScore ?? "-"})` });
  if (a.sga) rows.push({ label: "SGA", value: a.sga });
  if (a.mna) rows.push({ label: "MNA Short Form", value: `${a.mna} (skor ${a.mnaScore ?? "-"}/14)` });
  if (a.ecog) rows.push({ label: "ECOG", value: a.ecog });
  if (a.karnofsky != null) rows.push({ label: "Karnofsky", value: String(a.karnofsky) });
  if (a.barthel != null) rows.push({ label: "Barthel Index", value: `${a.barthel}/100` });
  if (a.pps) rows.push({ label: "PPS", value: `${a.pps}%` });
  if (a.frailty) rows.push({ label: "FRAIL Scale", value: `${a.frailty} (skor ${a.frailtyScore ?? "-"}/5)` });
  if (a.cfs != null) rows.push({ label: "Clinical Frailty Scale", value: `${a.cfs}/9` });
  if (a.fallRisk) rows.push({ label: "Morse Fall Scale", value: `${a.fallRisk}${a.morseScore != null ? ` (skor ${a.morseScore})` : ""}` });
  if (a.tugCategory) rows.push({ label: "TUG", value: `${a.tugCategory} detik` });
  if (a.sarcfScore != null) rows.push({ label: "SARC-F", value: `${a.sarcfScore}/10 (${a.sarcfPositive ? "positif" : "negatif"})` });
  if (a.calfCategory) rows.push({ label: "Lingkar Betis", value: a.calfCategory });
  if (a.sarcCalfScore != null) rows.push({ label: "SARC-CalF", value: `${a.sarcCalfScore}/20 (${a.sarcCalfPositive ? "positif" : "negatif"})` });
  if (a.handGrip != null) rows.push({ label: "Hand Grip", value: `${a.handGrip} kg` });
  if (a.activity) rows.push({ label: "Level Aktivitas", value: a.activity });
  if (a.stress) rows.push({ label: "Stress Metabolik", value: a.stress });
  return rows;
}

// GET /api/assessments/export-pdf?patientId=...
// Streams a PDF covering the full assessment history for one patient:
// scores per instrument + (if available) the AI interpretation for each
// visit, plus the guideline references it cited.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const patientIdParam = searchParams.get("patientId");
    if (!patientIdParam) return err("patientId wajib diisi", 400);

    const patientId = await resolvePatientId(patientIdParam);
    const patient = await supabaseGetPatient(patientId);
    if (!patient) return err("Pasien tidak ditemukan", 404);

    const assessments = await supabaseListAssessments(patientId);

    // Batch-fetch the latest AI summary per assessment in one query.
    const summariesByAssessment = new Map<string, any>();
    if (assessments.length > 0) {
      try {
        const { client } = await getServerClient();
        const { data: summaryRows } = await client
          .from("assessment_ai_summaries")
          .select("*")
          .in("assessment_id", assessments.map((a: any) => a.id))
          .order("created_at", { ascending: false });
        for (const row of summaryRows || []) {
          if (!summariesByAssessment.has(row.assessment_id)) {
            summariesByAssessment.set(row.assessment_id, row.payload);
          }
        }
      } catch (e) {
        console.warn("[export-pdf] fetching AI summaries failed (non-fatal):", e);
      }
    }

    // ---- Build the PDF ---------------------------------------------------
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    doc.fontSize(16).font("Helvetica-Bold").text("Riwayat Asesmen Gizi & Fungsional", { align: "left" });
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica").fillColor("#555").text("CareLivia — Clinical Nutrition Assessment");
    doc.fillColor("#000");
    doc.moveDown(0.8);

    // Patient header
    doc.fontSize(11).font("Helvetica-Bold").text(patient.name || "-");
    doc.font("Helvetica").fontSize(9).fillColor("#333");
    const genderLabel = GENDER_LABEL[patient.gender] || patient.gender || "-";
    doc.text(`Jenis kelamin: ${genderLabel}  |  Tanggal lahir: ${fmtDate(patient.birthDate)}`);
    if (patient.height || patient.weight) {
      doc.text(`Tinggi: ${patient.height ?? "-"} cm  |  Berat: ${patient.weight ?? "-"} kg`);
    }
    doc.fillColor("#000");
    doc.moveDown(0.5);
    doc.strokeColor("#ccc").moveTo(doc.x, doc.y).lineTo(547, doc.y).stroke();
    doc.moveDown(0.8);

    if (assessments.length === 0) {
      doc.fontSize(10).text("Belum ada asesmen tercatat untuk pasien ini.");
    }

    for (const a of assessments) {
      if (doc.y > 680) doc.addPage();

      doc.fontSize(12).font("Helvetica-Bold").fillColor("#0f766e");
      doc.text(`Asesmen — ${fmtDate(a.recordedAt)}`);
      doc.fillColor("#000").font("Helvetica").fontSize(9);
      doc.moveDown(0.3);

      const rows = assessmentRows(a);
      for (const row of rows) {
        if (doc.y > 740) doc.addPage();
        doc.font("Helvetica-Bold").text(`${row.label}: `, { continued: true }).font("Helvetica").text(row.value);
      }
      if (rows.length === 0) {
        doc.fillColor("#777").text("(Tidak ada skor tercatat)").fillColor("#000");
      }

      const summary = summariesByAssessment.get(a.id);
      if (summary) {
        if (doc.y > 700) doc.addPage();
        doc.moveDown(0.4);
        doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#0f766e").text("Ringkasan Interpretasi AI");
        doc.font("Helvetica").fontSize(9).fillColor("#000");
        if (summary.ringkasan) doc.text(summary.ringkasan, { align: "justify" });
        if (summary.diagnosis_gizi) {
          doc.moveDown(0.2);
          doc.font("Helvetica-Bold").text("Diagnosis Gizi: ", { continued: true }).font("Helvetica").text(summary.diagnosis_gizi);
        }
        if (Array.isArray(summary.intervensi) && summary.intervensi.length > 0) {
          doc.moveDown(0.2);
          doc.font("Helvetica-Bold").text("Intervensi:");
          doc.font("Helvetica");
          for (const it of summary.intervensi) doc.text(`•  ${it}`);
        }
        if (Array.isArray(summary.monitoring) && summary.monitoring.length > 0) {
          doc.moveDown(0.2);
          doc.font("Helvetica-Bold").text("Monitoring:");
          doc.font("Helvetica");
          for (const it of summary.monitoring) doc.text(`•  ${it}`);
        }
        if (Array.isArray(summary.red_flags) && summary.red_flags.length > 0) {
          doc.moveDown(0.2);
          doc.font("Helvetica-Bold").fillColor("#b91c1c").text("Segera ke dokter jika:");
          doc.font("Helvetica");
          for (const it of summary.red_flags) doc.text(`•  ${it}`);
          doc.fillColor("#000");
        }
        if (Array.isArray(summary.guideline_references) && summary.guideline_references.length > 0) {
          doc.moveDown(0.2);
          doc.fontSize(8).fillColor("#666").text(`Rujukan: ${summary.guideline_references.join(" · ")}`);
          doc.fillColor("#000").fontSize(9);
        }
      }

      if (a.notes) {
        doc.moveDown(0.2);
        doc.font("Helvetica-Oblique").fontSize(8.5).fillColor("#555").text(`Catatan klinisi: ${a.notes}`);
        doc.fillColor("#000").font("Helvetica").fontSize(9);
      }

      doc.moveDown(0.6);
      doc.strokeColor("#eee").moveTo(doc.x, doc.y).lineTo(547, doc.y).stroke();
      doc.moveDown(0.6);
    }

    doc.fontSize(7).fillColor("#999").text(
      `Dokumen dibuat otomatis oleh CareLivia pada ${new Date().toLocaleString("id-ID")}. Bukan pengganti penilaian klinis langsung.`,
      { align: "center" },
    );

    doc.end();
    const buffer = await done;

    const fileName = `asesmen-${(patient.name || "pasien").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (e) {
    console.error("[export-pdf] failed:", e);
    return err(e instanceof Error ? e.message : "Gagal membuat PDF", 500);
  }
}
