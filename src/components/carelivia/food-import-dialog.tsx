"use client";

import * as React from "react";
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  parseFoodExcelFile,
  validateFoodRow,
  downloadErrorLog,
  type ParsedFoodRow,
} from "@/lib/food-import";
import {
  useCheckFoodDuplicates,
  useImportFoodsBatch,
  useRecordFoodImportHistory,
} from "@/hooks/use-carelivia";

const MAX_FILE_MB = 20;
const BATCH_SIZE = 100;

type Strategy = "CREATE" | "UPDATE" | "SKIP";
type Step = "upload" | "preview" | "duplicates" | "importing" | "summary";

type DuplicateMatch = { id: string; code: string | null; name: string };

export function ImportFoodsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [step, setStep] = React.useState<Step>("upload");
  const [dragOver, setDragOver] = React.useState(false);
  const [fileName, setFileName] = React.useState("");
  const [rows, setRows] = React.useState<ParsedFoodRow[]>([]);
  const [duplicates, setDuplicates] = React.useState<Record<number, DuplicateMatch>>({});
  const [strategies, setStrategies] = React.useState<Record<number, Strategy>>({});
  const [progress, setProgress] = React.useState({ done: 0, total: 0 });
  const [summary, setSummary] = React.useState<{
    total: number;
    success: number;
    updated: number;
    skipped: number;
    failed: number;
    durationMs: number;
    errors: { rowIndex: number; name?: string; message: string }[];
  } | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const checkDupMut = useCheckFoodDuplicates();
  const importBatchMut = useImportFoodsBatch();
  const recordHistoryMut = useRecordFoodImportHistory();

  const reset = () => {
    setStep("upload");
    setFileName("");
    setRows([]);
    setDuplicates({});
    setStrategies({});
    setProgress({ done: 0, total: 0 });
    setSummary(null);
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const handleFile = async (file: File) => {
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`Ukuran file maksimum ${MAX_FILE_MB} MB`);
      return;
    }
    const okExt = /\.(xlsx|xls|csv)$/i.test(file.name);
    if (!okExt) {
      toast.error("Format harus .xlsx, .xls, atau .csv");
      return;
    }
    setFileName(file.name);
    try {
      const raw = await parseFoodExcelFile(file);
      if (raw.length === 0) {
        toast.error("File tidak berisi data (sheet kosong)");
        return;
      }
      const parsed = raw.map((r, i) => validateFoodRow(r, i + 2)); // header = row 1
      setRows(parsed);
      setStep("preview");
    } catch (e: any) {
      toast.error(`Gagal membaca file: ${e.message || "format tidak dikenali"}`);
    }
  };

  const validRows = rows.filter((r) => r.errors.length === 0);
  const errorRows = rows.filter((r) => r.errors.length > 0);

  const handleContinueFromPreview = async () => {
    if (validRows.length === 0) {
      toast.error("Tidak ada baris valid untuk diimpor");
      return;
    }
    try {
      const res = await checkDupMut.mutateAsync(
        validRows.map((r) => ({ code: r.normalized.code, name: r.normalized.name })),
      );
      const matches: DuplicateMatch[] = res?.matches || [];
      const dupMap: Record<number, DuplicateMatch> = {};
      const stratMap: Record<number, Strategy> = {};

      for (const r of validRows) {
        const match = matches.find(
          (m) =>
            (r.normalized.code && m.code && m.code === r.normalized.code) ||
            m.name.trim().toLowerCase() === r.normalized.name.trim().toLowerCase(),
        );
        if (match) {
          dupMap[r.rowIndex] = match;
          stratMap[r.rowIndex] = "UPDATE";
        } else {
          stratMap[r.rowIndex] = "CREATE";
        }
      }

      setDuplicates(dupMap);
      setStrategies(stratMap);
      setStep(Object.keys(dupMap).length > 0 ? "duplicates" : "importing");
      if (Object.keys(dupMap).length === 0) {
        runImport(stratMap, dupMap);
      }
    } catch (e: any) {
      toast.error(e.message || "Gagal memeriksa data duplikat");
    }
  };

  const applyToAll = (s: Strategy) => {
    setStrategies((prev) => {
      const next = { ...prev };
      for (const rowIndexStr of Object.keys(duplicates)) {
        next[Number(rowIndexStr)] = s;
      }
      return next;
    });
  };

  const runImport = async (
    stratMap: Record<number, Strategy>,
    dupMap: Record<number, DuplicateMatch>,
  ) => {
    setStep("importing");
    const startedAt = Date.now();

    const payloadRows = validRows.map((r) => {
      const strategy = stratMap[r.rowIndex] ?? "CREATE";
      const dup = dupMap[r.rowIndex];
      return {
        rowIndex: r.rowIndex,
        strategy,
        existingId: strategy === "UPDATE" ? dup?.id ?? null : null,
        code: r.normalized.code,
        name: r.normalized.name,
        categoryName: r.normalized.categoryName,
        subcategoryName: r.normalized.subcategoryName,
        source: r.normalized.source,
        description: r.normalized.description,
        urt: r.normalized.urt,
        urtGram: r.normalized.urtGram,
        bdd: r.normalized.bdd,
        price: r.normalized.price,
        energy: r.normalized.energy,
        protein: r.normalized.protein,
        fat: r.normalized.fat,
        carb: r.normalized.carb,
        fiber: r.normalized.fiber,
        sugar: r.normalized.sugar,
        sodium: r.normalized.sodium,
        potassium: r.normalized.potassium,
        calcium: r.normalized.calcium,
        magnesium: r.normalized.magnesium,
        iron: r.normalized.iron,
        phosphorus: r.normalized.phosphorus,
        zinc: r.normalized.zinc,
        vitA: r.normalized.vitA,
        vitB1: r.normalized.vitB1,
        vitB2: r.normalized.vitB2,
        vitB3: r.normalized.vitB3,
        vitB6: r.normalized.vitB6,
        vitB12: r.normalized.vitB12,
        folate: r.normalized.folate,
        vitC: r.normalized.vitC,
        vitD: r.normalized.vitD,
        vitE: r.normalized.vitE,
        vitK: r.normalized.vitK,
        cholesterol: r.normalized.cholesterol,
        gi: r.normalized.gi,
        glycemicLoad: r.normalized.glycemicLoad,
      };
    });

    const chunks: (typeof payloadRows)[] = [];
    for (let i = 0; i < payloadRows.length; i += BATCH_SIZE) {
      chunks.push(payloadRows.slice(i, i + BATCH_SIZE));
    }

    setProgress({ done: 0, total: payloadRows.length });

    let success = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const errors: { rowIndex: number; name?: string; message: string }[] = [];

    for (const chunk of chunks) {
      try {
        const res = await importBatchMut.mutateAsync(chunk);
        success += res.insertedCount || 0;
        updated += res.updatedCount || 0;
        skipped += res.skippedCount || 0;
        failed += res.failedCount || 0;
        if (Array.isArray(res.errors)) errors.push(...res.errors);
      } catch (e: any) {
        failed += chunk.length;
        errors.push({ rowIndex: chunk[0]?.rowIndex ?? 0, message: e.message || "Batch gagal" });
      }
      setProgress((p) => ({ ...p, done: Math.min(p.total, p.done + chunk.length) }));
    }

    const durationMs = Date.now() - startedAt;
    const finalSummary = {
      total: payloadRows.length,
      success,
      updated,
      skipped,
      failed,
      durationMs,
      errors,
    };
    setSummary(finalSummary);
    setStep("summary");

    recordHistoryMut.mutate({
      fileName,
      totalRows: rows.length,
      successCount: success,
      updatedCount: updated,
      skippedCount: skipped,
      failedCount: failed,
      durationMs,
      status: failed === 0 ? "COMPLETED" : success + updated > 0 ? "PARTIAL" : "FAILED",
      errorLog: errors,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import Database Bahan Makanan (Excel)</DialogTitle>
          <DialogDescription>
            {step === "upload" && "Upload file .xlsx, .xls, atau .csv sesuai Template Database Bahan Makanan."}
            {step === "preview" && `${fileName} — pratinjau sebelum disimpan`}
            {step === "duplicates" && "Beberapa bahan sudah ada di database — pilih tindakan"}
            {step === "importing" && "Mengimpor data ke database…"}
            {step === "summary" && "Import selesai"}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div
            className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-border/60"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Drag & Drop Excel di sini</p>
            <p className="text-xs text-muted-foreground">atau</p>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" /> Pilih File
            </Button>
            <p className="text-[10px] text-muted-foreground">
              .xlsx, .xls, .csv — maksimum {MAX_FILE_MB} MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline">{rows.length} data ditemukan</Badge>
              <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10">
                {validRows.length} valid
              </Badge>
              {errorRows.length > 0 && (
                <Badge className="bg-rose-500/10 text-rose-700 hover:bg-rose-500/10">
                  {errorRows.length} error
                </Badge>
              )}
            </div>
            <ScrollArea className="h-80 rounded-md border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Baris</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.rowIndex} className={r.errors.length > 0 ? "bg-rose-500/5" : ""}>
                      <TableCell className="text-xs">{r.rowIndex}</TableCell>
                      <TableCell className="text-xs">{r.normalized.name || "—"}</TableCell>
                      <TableCell className="text-xs">{r.normalized.categoryName || "—"}</TableCell>
                      <TableCell className="text-xs">
                        {r.errors.length === 0 ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Valid
                          </span>
                        ) : (
                          <span className="inline-flex items-start gap-1 text-rose-700">
                            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span>{r.errors.join(" · ")}</span>
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        {step === "duplicates" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-md bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> {Object.keys(duplicates).length} bahan sudah ada di database
              </span>
              <div className="flex items-center gap-1">
                <span>Terapkan ke semua:</span>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => applyToAll("SKIP")}>
                  Lewati
                </Button>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => applyToAll("UPDATE")}>
                  Update Data Lama
                </Button>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => applyToAll("CREATE")}>
                  Tambah Sebagai Baru
                </Button>
              </div>
            </div>
            <ScrollArea className="h-72 rounded-md border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Baris</TableHead>
                    <TableHead>Nama (Excel)</TableHead>
                    <TableHead>Cocok Dengan</TableHead>
                    <TableHead className="w-48">Tindakan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(Object.entries(duplicates) as [string, DuplicateMatch][]).map(([rowIndexStr, match]) => {
                    const rowIndex = Number(rowIndexStr);
                    const row = validRows.find((r) => r.rowIndex === rowIndex);
                    return (
                      <TableRow key={rowIndex}>
                        <TableCell className="text-xs">{rowIndex}</TableCell>
                        <TableCell className="text-xs">{row?.normalized.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{match.name}</TableCell>
                        <TableCell>
                          <Select
                            value={strategies[rowIndex] || "UPDATE"}
                            onValueChange={(v) => setStrategies((p) => ({ ...p, [rowIndex]: v as Strategy }))}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="SKIP">Lewati</SelectItem>
                              <SelectItem value="UPDATE">Update Data Lama</SelectItem>
                              <SelectItem value="CREATE">Tambah Sebagai Baru</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        {step === "importing" && (
          <div className="space-y-3 py-6">
            <Progress value={progress.total > 0 ? (progress.done / progress.total) * 100 : 0} />
            <p className="text-center text-sm text-muted-foreground">
              Mengimport… {progress.done}/{progress.total} (
              {progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}%)
            </p>
          </div>
        )}

        {step === "summary" && summary && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-md border border-border/60 p-2 text-center">
                <p className="text-lg font-bold text-foreground">{summary.total}</p>
                <p className="text-[10px] text-muted-foreground">dibaca</p>
              </div>
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2 text-center">
                <p className="text-lg font-bold text-emerald-700">{summary.success + summary.updated}</p>
                <p className="text-[10px] text-muted-foreground">berhasil</p>
              </div>
              <div className="rounded-md border border-border/60 p-2 text-center">
                <p className="text-lg font-bold text-foreground">{summary.skipped}</p>
                <p className="text-[10px] text-muted-foreground">dilewati</p>
              </div>
              <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-2 text-center">
                <p className="text-lg font-bold text-rose-700">{summary.failed}</p>
                <p className="text-[10px] text-muted-foreground">gagal</p>
              </div>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Durasi {(summary.durationMs / 1000).toFixed(1)} detik · {summary.success} baru, {summary.updated} diperbarui
            </p>
            {summary.errors.length > 0 && (
              <Button variant="outline" size="sm" className="w-full" onClick={() => downloadErrorLog(summary.errors)}>
                <Download className="mr-1.5 h-3.5 w-3.5" /> Download Log Error
              </Button>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Batal
            </Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={reset}>
                Upload Ulang
              </Button>
              <Button onClick={handleContinueFromPreview} disabled={checkDupMut.isPending || validRows.length === 0}>
                {checkDupMut.isPending ? "Memeriksa duplikat…" : `Lanjutkan (${validRows.length} baris valid)`}
              </Button>
            </>
          )}
          {step === "duplicates" && (
            <Button onClick={() => runImport(strategies, duplicates)}>
              Mulai Import
            </Button>
          )}
          {step === "summary" && (
            <Button onClick={() => handleOpenChange(false)}>Selesai</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
