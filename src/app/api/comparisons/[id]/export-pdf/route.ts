export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { err } from "@/lib/api-helpers";
import { supabaseGetComparisonById } from "@/lib/supabase/data-layer";

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// GET /api/comparisons/[id]/export-pdf
// Streams a PDF snapshot of a single saved "Meal Plan vs Food Record"
// comparison — the "Export PDF" button on the Riwayat Perbandingan
// "View" modal. Reads straight from the stored comparison_json
// (comparison_history.results); nothing is recomputed.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const detail = await supabaseGetComparisonById(id);
    if (!detail) return err("Riwayat perbandingan tidak ditemukan", 404);

    const r = detail.results || {};
    const planName = r.planName || detail.savedMenuName || "Meal Plan";
    const nutrientComparison: any[] = r.nutrientComparison || [];
    const foodComparison = r.foodComparison || { matched: [], replaced: [], removed: [], added: [] };

    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    doc.fontSize(16).font("Helvetica-Bold").text("Bandingkan Meal Plan vs Food Record");
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica").fillColor("#555").text("CareLivia — Hasil Perbandingan Tersimpan");
    doc.fillColor("#000");
    doc.moveDown(0.6);

    if (detail.patient) {
      doc.fontSize(11).font("Helvetica-Bold").text(detail.patient.name || "-");
      doc.font("Helvetica").fontSize(9).fillColor("#333");
      doc.text(`MRN: ${detail.patient.mrn || "-"}`);
      doc.fillColor("#000");
      doc.moveDown(0.3);
    }
    doc.font("Helvetica").fontSize(9).fillColor("#333");
    doc.text(`Meal Plan: ${planName}`);
    doc.text(`Tanggal Compare: ${fmtDate(detail.createdAt)}`);
    doc.text(`Tanggal Food Record: ${fmtDate(detail.foodRecordDate)}`);
    doc.fillColor("#000");
    doc.moveDown(0.5);
    doc.strokeColor("#ccc").moveTo(doc.x, doc.y).lineTo(547, doc.y).stroke();
    doc.moveDown(0.7);

    // Skor kesesuaian
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#0f766e").text("Skor Kesesuaian");
    doc.fillColor("#000").font("Helvetica-Bold").fontSize(20);
    doc.text(`${Math.round(detail.complianceScore)}%`);
    doc.moveDown(0.5);

    // Nutrient comparison
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#0f766e").text("Perbandingan Nutrisi: Target vs Aktual");
    doc.fillColor("#000").font("Helvetica").fontSize(9);
    doc.moveDown(0.2);
    for (const n of nutrientComparison) {
      if (doc.y > 740) doc.addPage();
      doc.text(
        `${n.label}: ${Math.round(n.actual)} / ${Math.round(n.target)} ${n.unit}  (${n.pct}%, selisih ${n.diff >= 0 ? "+" : ""}${Math.round(n.diff)})`,
      );
    }
    doc.moveDown(0.6);

    // Food comparison summary
    if (doc.y > 700) doc.addPage();
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#0f766e").text("Ringkasan Makanan");
    doc.fillColor("#000").font("Helvetica").fontSize(9);
    doc.text(
      `Cocok: ${foodComparison.matched?.length ?? 0}   Diganti: ${foodComparison.replaced?.length ?? 0}   Dihapus: ${foodComparison.removed?.length ?? 0}   Tambahan: ${foodComparison.added?.length ?? 0}`,
    );
    doc.moveDown(0.3);

    if ((foodComparison.replaced || []).length > 0) {
      doc.font("Helvetica-Bold").text("Penggantian:");
      doc.font("Helvetica");
      for (const rep of foodComparison.replaced) {
        if (doc.y > 740) doc.addPage();
        doc.text(`  •  ${rep.planFood} → ${rep.recordFood}`);
      }
      doc.moveDown(0.3);
    }
    if ((foodComparison.removed || []).length > 0) {
      if (doc.y > 700) doc.addPage();
      doc.font("Helvetica-Bold").text("Dihapus:");
      doc.font("Helvetica");
      for (const item of foodComparison.removed) {
        if (doc.y > 740) doc.addPage();
        doc.text(`  •  ${item.foodName} (${item.amount}g)`);
      }
      doc.moveDown(0.3);
    }
    if ((foodComparison.added || []).length > 0) {
      if (doc.y > 700) doc.addPage();
      doc.font("Helvetica-Bold").text("Tambahan:");
      doc.font("Helvetica");
      for (const item of foodComparison.added) {
        if (doc.y > 740) doc.addPage();
        doc.text(`  •  ${item.foodName} (${item.amount}g)`);
      }
      doc.moveDown(0.3);
    }
    doc.moveDown(0.3);

    // AI Insight
    if (detail.aiInsight) {
      if (doc.y > 660) doc.addPage();
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#0f766e").text("AI Insight CareLivia");
      doc.fillColor("#000").font("Helvetica").fontSize(9);
      doc.text(detail.aiInsight, { align: "justify" });
    }

    doc.moveDown(1);
    doc.fontSize(7).fillColor("#999").text(
      `Dokumen dibuat otomatis oleh CareLivia pada ${new Date().toLocaleString("id-ID")}. Bukan pengganti penilaian klinis langsung.`,
      { align: "center" },
    );

    doc.end();
    const buffer = await done;

    const fileName = `perbandingan-${(detail.patient?.name || "pasien").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${fmtDate(detail.foodRecordDate).replace(/\s+/g, "-")}.pdf`;
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (e) {
    console.error("[comparisons export-pdf] failed:", e);
    return err(e instanceof Error ? e.message : "Gagal membuat PDF", 500);
  }
}
