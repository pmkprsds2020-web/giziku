"use client";

/**
 * Client-side "Unduh PDF" generator for the CareLivia clinical report.
 *
 * Why this exists instead of relying only on window.print():
 * - window.print() depends on the browser's print pipeline and the user
 *   manually picking "Simpan sebagai PDF" — it's kept as a separate
 *   "Cetak" action, but it is no longer the only way to get a PDF.
 * - This generator rasterizes the actual `.cl-report` DOM node (so it
 *   always matches what's on screen) at high resolution, slices it into
 *   A4 pages, and stamps a repeating header/footer + page numbers with
 *   vector text (crisp at any zoom, unlike a single flattened screenshot).
 *
 * Pagination strategy: naive fixed-height slicing would happily cut a
 * table row or a paragraph in half. Instead, near each ideal page break we
 * scan a short vertical window of the rendered canvas for a mostly-blank
 * row (the visual gutter between report sections/cards) and break there
 * instead. If pixel inspection isn't possible (e.g. a tainted canvas from
 * a cross-origin image), we fall back to the fixed-height slice so export
 * still succeeds.
 */

export interface ClinicalReportPdfMeta {
  documentNumber: string;
  patientName: string;
  patientMrn: string;
  doctorName?: string | null;
  fileName: string;
}

const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const MARGIN_X_MM = 12;
const HEADER_HEIGHT_MM = 20;
const FOOTER_HEIGHT_MM = 12;
const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - MARGIN_X_MM * 2;
const CONTENT_HEIGHT_MM = PAGE_HEIGHT_MM - HEADER_HEIGHT_MM - FOOTER_HEIGHT_MM;

export async function exportClinicalReportPdf(
  element: HTMLElement,
  meta: ClinicalReportPdfMeta,
): Promise<void> {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
  ]);

  // Render the report at 2x for crisp text/tables in the exported PDF.
  const sourceCanvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
    onclone: (doc) => {
      // Strip anything marked no-print (toasts, tooltips, the patient
      // selector, action buttons) and make sure nothing inside the report
      // itself is clipped by a leftover max-height/overflow rule.
      doc.querySelectorAll(".no-print").forEach((n) => n.parentNode?.removeChild(n));
      doc.querySelectorAll<HTMLElement>(".cl-report, .cl-report *").forEach((n) => {
        n.style.overflow = "visible";
        n.style.maxHeight = "none";
      });
    },
  });

  const pxPerMm = sourceCanvas.width / CONTENT_WIDTH_MM;
  const pageHeightPx = Math.floor(CONTENT_HEIGHT_MM * pxPerMm);
  const totalHeightPx = sourceCanvas.height;

  // Try to read pixels for safe-break detection; fall back gracefully.
  let readCtx: CanvasRenderingContext2D | null = null;
  try {
    readCtx = sourceCanvas.getContext("2d");
    // Touch getImageData once so a tainted-canvas SecurityError surfaces
    // now, before we're mid-pagination.
    readCtx?.getImageData(0, 0, 1, 1);
  } catch {
    readCtx = null;
  }

  const breaks = computePageBreaks(readCtx, sourceCanvas.width, totalHeightPx, pageHeightPx);

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const sliceCanvas = document.createElement("canvas");
  sliceCanvas.width = sourceCanvas.width;
  const sliceCtx = sliceCanvas.getContext("2d")!;

  for (let i = 0; i < breaks.length - 1; i++) {
    const sy = breaks[i];
    const sh = breaks[i + 1] - sy;
    if (sh <= 0) continue;

    sliceCanvas.height = sh;
    sliceCtx.clearRect(0, 0, sliceCanvas.width, sh);
    sliceCtx.fillStyle = "#ffffff";
    sliceCtx.fillRect(0, 0, sliceCanvas.width, sh);
    sliceCtx.drawImage(sourceCanvas, 0, sy, sourceCanvas.width, sh, 0, 0, sourceCanvas.width, sh);

    if (i > 0) pdf.addPage();

    const pageNumber = i + 1;
    const totalPages = breaks.length - 1;

    drawHeader(pdf, meta, pageNumber, totalPages);

    const sliceHeightMm = sh / pxPerMm;
    pdf.addImage(
      sliceCanvas.toDataURL("image/png", 1.0),
      "PNG",
      MARGIN_X_MM,
      HEADER_HEIGHT_MM,
      CONTENT_WIDTH_MM,
      sliceHeightMm,
      undefined,
      "FAST",
    );

    drawFooter(pdf, pageNumber, totalPages);
  }

  pdf.save(meta.fileName);
}

/** Fixed-interval break points, nudged onto blank rows when possible. */
function computePageBreaks(
  ctx: CanvasRenderingContext2D | null,
  width: number,
  totalHeightPx: number,
  pageHeightPx: number,
): number[] {
  const breaks: number[] = [0];
  let cursor = 0;

  while (cursor + pageHeightPx < totalHeightPx) {
    const ideal = cursor + pageHeightPx;
    const safe = ctx ? findSafeBreak(ctx, width, ideal, cursor) : ideal;
    breaks.push(safe);
    cursor = safe;
  }

  breaks.push(totalHeightPx);
  return breaks;
}

/**
 * Scans upward from `idealY` (bounded by `floorY`) for a row that's
 * mostly background/blank, so we don't slice through a table row, chart,
 * or line of text. Falls back to `idealY` if nothing suitable is found
 * within the search window.
 */
function findSafeBreak(
  ctx: CanvasRenderingContext2D,
  width: number,
  idealY: number,
  floorY: number,
): number {
  const SEARCH_WINDOW_PX = 140; // ~ a couple of card gaps' worth, at 2x scale
  const lowestY = Math.max(floorY + 20, idealY - SEARCH_WINDOW_PX);

  try {
    const band = ctx.getImageData(0, lowestY, width, idealY - lowestY);
    const { data } = band;
    const rows = idealY - lowestY;

    for (let y = rows - 1; y >= 0; y--) {
      if (isRowBlank(data, width, y)) {
        return lowestY + y;
      }
    }
  } catch {
    // tainted canvas or out-of-bounds read — just use the ideal cut
  }

  return idealY;
}

function isRowBlank(data: Uint8ClampedArray, width: number, y: number): boolean {
  const rowStart = y * width * 4;
  const threshold = 245; // near-white counts as background
  for (let x = 0; x < width; x += 6) {
    const i = rowStart + x * 4;
    if (data[i] < threshold || data[i + 1] < threshold || data[i + 2] < threshold) {
      return false;
    }
  }
  return true;
}

function drawHeader(
  pdf: import("jspdf").jsPDF,
  meta: ClinicalReportPdfMeta,
  page: number,
  totalPages: number,
): void {
  pdf.setFontSize(9);
  pdf.setTextColor(15, 118, 110); // matches cl-gradient-primary teal
  pdf.text("CareLivia CNMS — Laporan Nutrisi Klinis", MARGIN_X_MM, 9);

  pdf.setFontSize(7.5);
  pdf.setTextColor(110);
  pdf.text(`No. Dok: ${meta.documentNumber}`, PAGE_WIDTH_MM - MARGIN_X_MM, 9, { align: "right" });

  pdf.setDrawColor(200);
  pdf.setLineWidth(0.2);
  pdf.line(MARGIN_X_MM, 12, PAGE_WIDTH_MM - MARGIN_X_MM, 12);

  pdf.setFontSize(7.5);
  pdf.setTextColor(70);
  const doctorPart = meta.doctorName ? `  ·  Dokter: ${meta.doctorName}` : "";
  pdf.text(
    `Pasien: ${meta.patientName}  ·  No. RM: ${meta.patientMrn}${doctorPart}`,
    MARGIN_X_MM,
    17,
  );
  pdf.text(`Hal. ${page}/${totalPages}`, PAGE_WIDTH_MM - MARGIN_X_MM, 17, { align: "right" });
}

function drawFooter(pdf: import("jspdf").jsPDF, page: number, totalPages: number): void {
  const lineY = PAGE_HEIGHT_MM - FOOTER_HEIGHT_MM + 2;
  const textY = lineY + 5;

  pdf.setDrawColor(200);
  pdf.setLineWidth(0.2);
  pdf.line(MARGIN_X_MM, lineY, PAGE_WIDTH_MM - MARGIN_X_MM, lineY);

  pdf.setFontSize(7);
  pdf.setTextColor(130);
  pdf.text(
    `Dicetak ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`,
    MARGIN_X_MM,
    textY,
  );
  pdf.text(`Halaman ${page} dari ${totalPages}`, PAGE_WIDTH_MM / 2, textY, { align: "center" });
  pdf.text("CareLivia CNMS", PAGE_WIDTH_MM - MARGIN_X_MM, textY, { align: "right" });
}
