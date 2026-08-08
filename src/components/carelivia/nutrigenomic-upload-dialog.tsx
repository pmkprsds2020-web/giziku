"use client";

import * as React from "react";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  Loader2,
  AlertTriangle,
  Trash2,
  Sparkles,
  CheckCircle2,
  Dna,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { useExtractGenomicReport, useSaveGenomicReport } from "@/hooks/use-nutrigenomic";

const MAX_PAGES = 8;

interface DraftFinding {
  id: string;
  geneSymbol: string;
  rsId: string;
  genotype: string;
  reportedCall: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  include: boolean;
}

// Renders every page of a PDF (up to MAX_PAGES) to JPEG data URLs using
// pdfjs-dist. Dynamically imported so it never touches the module graph
// during SSR — same approach as lab-ocr-dialog.tsx.
//
// JPEG (not PNG) + scale 1.8 deliberately keeps payload size well under
// typical serverless body limits: PNG renders of dense multi-page
// documents at scale 2 could reach several MB per page, which in
// practice has caused the OpenAI vision endpoint to reject the request
// with "Invalid base64 image_url" (payload corrupted/truncated somewhere
// in transit) rather than a clean size-limit error. JPEG at quality 0.85
// is still sharp enough for OCR while cutting payload size dramatically
// — this matters even more here than in Laboratorium OCR since
// nutrigenomic reports allow up to MAX_PAGES=8.
async function renderPdfToImages(file: File): Promise<string[]> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pageCount = Math.min(pdf.numPages, MAX_PAGES);
  const images: string[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.8 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas tidak tersedia di browser ini");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    if (!isValidImageDataUrl(dataUrl)) {
      throw new Error(`Gagal merender halaman ${pageNum} — data gambar tidak valid. Coba unggah ulang.`);
    }
    images.push(dataUrl);
  }

  return images;
}

// Sanity check before sending to the AI route — catches a corrupted/
// truncated data URL client-side with a clear message, instead of
// forwarding it and getting an opaque "Invalid base64 image_url" back
// from the OpenAI API several seconds later.
function isValidImageDataUrl(dataUrl: string): boolean {
  const match = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/]+=*)$/.exec(dataUrl);
  return !!match && match[2].length > 100;
}

// Phone camera photos are frequently the largest payload of all (often
// 3-8MB straight off the camera) — downscale to a max dimension and
// re-encode as JPEG, same rationale as renderPdfToImages above.
const MAX_PHOTO_DIMENSION = 2000;
function fileToImageDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, MAX_PHOTO_DIMENSION / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas tidak tersedia di browser ini"));
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => reject(new Error("Gagal memuat gambar"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("Gagal membaca file gambar"));
    reader.readAsDataURL(file);
  });
}

export function NutrigenomicUploadDialog({
  patientId,
  open,
  onOpenChange,
  onSaved,
}: {
  patientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (reportId: string) => void;
}) {
  const extract = useExtractGenomicReport();
  const saveReport = useSaveGenomicReport();

  const [file, setFile] = React.useState<File | null>(null);
  const [images, setImages] = React.useState<string[]>([]);
  const [preparing, setPreparing] = React.useState(false);
  const [extractionNotes, setExtractionNotes] = React.useState("");
  const [examDate, setExamDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [laboratoryName, setLaboratoryName] = React.useState("");
  const [examType, setExamType] = React.useState("");
  const [rows, setRows] = React.useState<DraftFinding[]>([]);
  const [aiModel, setAiModel] = React.useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setImages([]);
    setExtractionNotes("");
    setExamDate(new Date().toISOString().slice(0, 10));
    setLaboratoryName("");
    setExamType("");
    setRows([]);
    setAiModel(null);
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setRows([]);
    setPreparing(true);
    try {
      if (f.type === "application/pdf") {
        const imgs = await renderPdfToImages(f);
        setImages(imgs);
        if (imgs.length === 0) toast.error("PDF tidak memiliki halaman yang bisa dibaca");
      } else if (f.type.startsWith("image/")) {
        const img = await fileToImageDataUrl(f);
        setImages([img]);
      } else {
        toast.error("Format file tidak didukung — gunakan PDF, JPG, atau PNG");
        setFile(null);
      }
    } catch (err: any) {
      console.error("[nutrigenomic] file prep failed:", err);
      toast.error(
        err?.message?.includes("Canvas")
          ? "Gagal merender PDF di browser ini. Coba unggah sebagai foto/gambar (JPG/PNG) sebagai alternatif."
          : "Gagal memproses file. Coba unggah ulang atau gunakan format gambar (JPG/PNG).",
      );
      setFile(null);
      setImages([]);
    } finally {
      setPreparing(false);
    }
  };

  const handleExtract = async () => {
    if (images.length === 0) {
      toast.error("Unggah dokumen terlebih dahulu");
      return;
    }
    try {
      const data = await extract.mutateAsync({ patientId, images });
      setExtractionNotes(data.extractionNotes || "");
      if (data.examDate) setExamDate(String(data.examDate).slice(0, 10));
      if (data.laboratoryName) setLaboratoryName(data.laboratoryName);
      if (data.examType) setExamType(data.examType);
      setAiModel(data.aiModel || null);

      const draftRows: DraftFinding[] = (data.findings || []).map((f: any, i: number) => ({
        id: `${i}-${f.geneSymbol}`,
        geneSymbol: f.geneSymbol,
        rsId: f.rsId || "",
        genotype: f.genotype || "",
        reportedCall: f.reportedCall || "",
        confidence: f.confidence || "MEDIUM",
        include: true,
      }));
      setRows(draftRows);

      if (draftRows.length === 0) {
        toast.warning("AI tidak menemukan data gen/SNP pada dokumen ini");
      } else {
        toast.success(`${draftRows.length} gen terbaca — periksa sebelum menyimpan`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Gagal membaca dokumen");
    }
  };

  const updateRow = (id: string, patch: Partial<DraftFinding>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));

  const handleSaveAll = async () => {
    const included = rows.filter((r) => r.include && r.geneSymbol.trim());
    if (included.length === 0) {
      toast.error("Pilih minimal satu temuan untuk disimpan");
      return;
    }
    try {
      const { reportId } = await saveReport.mutateAsync({
        patientId,
        laboratoryName: laboratoryName || null,
        examDate: examDate || null,
        examType: examType || null,
        fileName: file?.name || null,
        extractionNotes: extractionNotes || null,
        aiModel,
        findings: included.map((r) => ({
          geneSymbol: r.geneSymbol.trim().toUpperCase(),
          rsId: r.rsId || null,
          genotype: r.genotype || null,
          reportedCall: r.reportedCall || null,
          confidence: r.confidence,
        })),
      });
      toast.success(`Laporan nutrigenomik tersimpan — ${included.length} gen dikonfirmasi`);
      onSaved?.(reportId);
      handleClose(false);
    } catch (err: any) {
      toast.error(err?.message || "Gagal menyimpan laporan");
    }
  };

  const lowConfidenceCount = rows.filter((r) => r.confidence === "LOW").length;
  const reading = extract.isPending;
  const saving = saveReport.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dna className="h-5 w-5 text-teal-600" /> Upload Hasil Nutrigenomik
          </DialogTitle>
          <DialogDescription>
            Unggah PDF/foto laporan nutrigenomik (CircleDNA, Nutrigenomix, 23andMe, laboratorium lokal, dll) — AI akan
            membaca dan mengekstrak gen/SNP. Anda tetap perlu memeriksa dan mengonfirmasi sebelum data tersimpan; AI
            tidak akan mengarang gen yang tidak benar-benar tercetak pada dokumen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {rows.length === 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-border/60 p-6">
                <label className="flex cursor-pointer flex-col items-center gap-2 text-center">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    {file ? file.name : "Klik untuk pilih file"}
                  </span>
                  <span className="text-xs text-muted-foreground">PDF, JPG, atau PNG — maks {MAX_PAGES} halaman, 30MB</span>
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={preparing || reading}
                  />
                </label>
              </div>

              {preparing && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memproses dokumen…
                </p>
              )}

              {images.length > 0 && !preparing && (
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {file?.type === "application/pdf" ? <FileText className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
                    {images.length} halaman siap dibaca
                  </p>
                  <div className="flex gap-2 overflow-x-auto">
                    {images.map((img, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={img} alt={`Halaman ${i + 1}`} className="h-24 w-auto rounded border border-border" />
                    ))}
                  </div>
                  <Button onClick={handleExtract} disabled={reading} className="w-full gap-1.5">
                    {reading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Membaca dokumen dengan AI…
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" /> Baca dengan AI
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          {rows.length > 0 && (
            <div className="space-y-3">
              {extractionNotes && (
                <Alert className="border-amber-500/30 bg-amber-500/5">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-sm">Catatan dari AI</AlertTitle>
                  <AlertDescription className="text-xs">{extractionNotes}</AlertDescription>
                </Alert>
              )}
              {lowConfidenceCount > 0 && (
                <Alert className="border-rose-500/30 bg-rose-500/5">
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                  <AlertDescription className="text-xs">
                    {lowConfidenceCount} baris ditandai keyakinan rendah (⚠️) — periksa ulang terhadap dokumen asli
                    sebelum menyimpan.
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Tanggal Pemeriksaan</Label>
                  <Input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Laboratorium</Label>
                  <Input value={laboratoryName} onChange={(e) => setLaboratoryName(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Jenis Pemeriksaan</Label>
                  <Input value={examType} onChange={(e) => setExamType(e.target.value)} className="mt-1" placeholder="mis. Nutrigenomic Panel" />
                </div>
              </div>

              <div className="overflow-x-auto rounded-md border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Gen</TableHead>
                      <TableHead>rsID</TableHead>
                      <TableHead>Genotipe</TableHead>
                      <TableHead>Hasil pada Laporan</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id} className={r.confidence === "LOW" ? "bg-rose-50 dark:bg-rose-950/20" : ""}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={r.include}
                            onChange={(e) => updateRow(r.id, { include: e.target.checked })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input value={r.geneSymbol} onChange={(e) => updateRow(r.id, { geneSymbol: e.target.value })} className="h-8 text-sm font-mono" />
                          {r.confidence === "LOW" && <span className="text-[10px] text-rose-600">⚠️ Periksa kembali</span>}
                        </TableCell>
                        <TableCell>
                          <Input value={r.rsId} onChange={(e) => updateRow(r.id, { rsId: e.target.value })} className="h-8 text-sm font-mono" />
                        </TableCell>
                        <TableCell>
                          <Input value={r.genotype} onChange={(e) => updateRow(r.id, { genotype: e.target.value })} className="h-8 text-sm" />
                        </TableCell>
                        <TableCell>
                          <Input value={r.reportedCall} onChange={(e) => updateRow(r.id, { reportedCall: e.target.value })} className="h-8 text-sm" />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-600" onClick={() => removeRow(r.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>Batal</Button>
          {rows.length > 0 && (
            <Button onClick={handleSaveAll} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {saving ? "Menyimpan…" : `Simpan ${rows.filter((r) => r.include).length} Gen`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
