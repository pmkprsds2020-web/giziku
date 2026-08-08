export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { err } from "@/lib/api-helpers";
import { supabaseGetMealPlanHistoryComparison } from "@/lib/supabase/data-layer";

const SLOT_LABELS: Record<string, string> = {
  BREAKFAST: "Sarapan",
  MORNING_SNACK: "Snack Pagi",
  LUNCH: "Makan Siang",
  AFTERNOON_SNACK: "Snack Sore",
  DINNER: "Makan Malam",
  EVENING_SNACK: "Snack Malam",
};

const INDICATOR_DOT: Record<string, string> = {
  GREEN: "🟢",
  YELLOW: "🟡",
  RED: "🔴",
};

function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// GET /api/meal-plan-history/[id]/export-pdf
// Streams a single-snapshot PDF: Meal Plan detail, Food Record for that
// day, Meal Plan vs Food Record comparison table, and AI Evaluation —
// the "Download PDF" button on the Meal History detail view.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const detail = await supabaseGetMealPlanHistoryComparison(id);
    if (!detail) return err("Riwayat meal plan tidak ditemukan", 404);

    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    doc.fontSize(16).font("Helvetica-Bold").text(detail.name || "Detail Meal Plan", { align: "left" });
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica").fillColor("#555").text("CareLivia — Meal Plan vs Food Record");
    doc.fillColor("#000");
    doc.moveDown(0.6);

    if (detail.patient) {
      doc.fontSize(11).font("Helvetica-Bold").text(detail.patient.name || "-");
      doc.font("Helvetica").fontSize(9).fillColor("#333");
      doc.text(`MRN: ${detail.patient.mrn || "-"}  |  Tanggal: ${fmtDateTime(detail.createdAt)}`);
      doc.fillColor("#000");
    }
    doc.moveDown(0.5);
    doc.strokeColor("#ccc").moveTo(doc.x, doc.y).lineTo(547, doc.y).stroke();
    doc.moveDown(0.7);

    // A. Target
    if (detail.targets) {
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#0f766e").text("Target Meal Plan");
      doc.fillColor("#000").font("Helvetica").fontSize(9);
      doc.text(
        `Kalori: ${Math.round(detail.targets.targetCal)} kcal   Protein: ${Math.round(detail.targets.targetProtein)} g   ` +
          `Lemak: ${Math.round(detail.targets.targetFat)} g   Karbohidrat: ${Math.round(detail.targets.targetCarb)} g`,
      );
      doc.moveDown(0.6);
    }

    // B. Meal Plan detail
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#0f766e").text("Detail Meal Plan");
    doc.fillColor("#000").font("Helvetica").fontSize(9);
    const bySlot: Record<string, any[]> = {};
    for (const item of detail.items || []) {
      (bySlot[item.slot] ||= []).push(item);
    }
    if ((detail.items || []).length === 0) {
      doc.fillColor("#777").text("(Tidak ada item)").fillColor("#000");
    }
    for (const slot of Object.keys(SLOT_LABELS)) {
      const slotItems = bySlot[slot];
      if (!slotItems || slotItems.length === 0) continue;
      if (doc.y > 720) doc.addPage();
      doc.font("Helvetica-Bold").text(SLOT_LABELS[slot]);
      doc.font("Helvetica");
      for (const it of slotItems) {
        doc.text(`  •  ${it.foodName} — ${it.amount}g — ${Math.round(it.cal)} kcal`);
      }
    }
    doc.moveDown(0.6);

    // C. Food Record
    if (doc.y > 650) doc.addPage();
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#0f766e").text("Food Record (Konsumsi Aktual)");
    doc.fillColor("#000").font("Helvetica").fontSize(9);
    if ((detail.foodRecords || []).length === 0) {
      doc.fillColor("#777").text("(Tidak ada Food Record pada tanggal ini)").fillColor("#000");
    } else {
      for (const r of detail.foodRecords) {
        if (doc.y > 740) doc.addPage();
        doc.text(
          `  •  [${SLOT_LABELS[r.slot] || r.slot}] ${r.foodName} — ${r.amount}g (${r.consumed}% dikonsumsi) — ${Math.round(r.cal)} kcal`,
        );
      }
    }
    doc.moveDown(0.6);

    // D. Comparison table
    if (doc.y > 620) doc.addPage();
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#0f766e").text("Analisis Perbandingan: Meal Plan vs Food Record");
    doc.fillColor("#000").font("Helvetica").fontSize(9);
    doc.moveDown(0.2);
    const colX = [doc.x, doc.x + 140, doc.x + 240, doc.x + 340, doc.x + 430];
    doc.font("Helvetica-Bold");
    doc.text("Komponen", colX[0], doc.y, { continued: false });
    let rowY = doc.y - doc.currentLineHeight();
    doc.text("Meal Plan", colX[1], rowY);
    doc.text("Food Record", colX[2], rowY);
    doc.text("Selisih", colX[3], rowY);
    doc.text("Status", colX[4], rowY);
    doc.moveDown(0.3);
    doc.font("Helvetica");
    for (const row of detail.comparison || []) {
      if (doc.y > 740) doc.addPage();
      const y = doc.y;
      doc.text(row.label, colX[0], y);
      doc.text(`${Math.round(row.plan)} ${row.unit}`, colX[1], y);
      doc.text(`${Math.round(row.actual)} ${row.unit}`, colX[2], y);
      doc.text(`${row.diff >= 0 ? "+" : ""}${Math.round(row.diff)} ${row.unit}`, colX[3], y);
      doc.text(`${INDICATOR_DOT[row.indicator] || ""} ${row.indicator}`, colX[4], y);
      doc.moveDown(0.35);
    }
    doc.fontSize(8).fillColor("#777").text(detail.sugarNote);
    doc.fillColor("#000").fontSize(9);
    doc.moveDown(0.6);

    // F. AI Evaluation
    if (doc.y > 680) doc.addPage();
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#0f766e").text("AI Evaluation");
    doc.fillColor("#000").font("Helvetica").fontSize(9);
    doc.text(`Kepatuhan terhadap Meal Plan: ${Math.round(detail.compliance)}%`, { continued: false });
    doc.moveDown(0.2);
    doc.text(detail.aiEvaluation, { align: "justify" });

    doc.moveDown(1);
    doc.fontSize(7).fillColor("#999").text(
      `Dokumen dibuat otomatis oleh CareLivia pada ${new Date().toLocaleString("id-ID")}. Bukan pengganti penilaian klinis langsung.`,
      { align: "center" },
    );

    doc.end();
    const buffer = await done;

    const fileName = `meal-plan-history-${(detail.patient?.name || "pasien").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${detail.compareDate}.pdf`;
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (e) {
    console.error("[meal-plan-history export-pdf] failed:", e);
    return err(e instanceof Error ? e.message : "Gagal membuat PDF", 500);
  }
}
