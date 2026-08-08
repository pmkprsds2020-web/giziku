"use client";

import * as React from "react";
import { History, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { useFoodImportHistory } from "@/hooks/use-carelivia";
import { downloadErrorLog } from "@/lib/food-import";
import { EmptyState } from "@/components/carelivia/ui-helpers";

const STATUS_STYLE: Record<string, string> = {
  COMPLETED: "bg-emerald-500/10 text-emerald-700",
  PARTIAL: "bg-amber-500/10 text-amber-700",
  FAILED: "bg-rose-500/10 text-rose-700",
};

export function FoodImportHistoryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: history, isLoading } = useFoodImportHistory();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Riwayat Import Bahan Makanan</DialogTitle>
          <DialogDescription>Setiap proses import Excel tercatat di sini.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !history || history.length === 0 ? (
          <EmptyState icon={History} title="Belum ada riwayat import" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Nama File</TableHead>
                <TableHead className="text-right">Jumlah</TableHead>
                <TableHead className="text-right">Berhasil</TableHead>
                <TableHead className="text-right">Gagal</TableHead>
                <TableHead>Durasi</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((h: any) => (
                <TableRow key={h.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {new Date(h.createdAt).toLocaleString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate text-xs">{h.fileName}</TableCell>
                  <TableCell className="text-right text-xs">{h.totalRows}</TableCell>
                  <TableCell className="text-right text-xs">{h.successCount + h.updatedCount}</TableCell>
                  <TableCell className="text-right text-xs">{h.failedCount}</TableCell>
                  <TableCell className="text-xs">{(h.durationMs / 1000).toFixed(1)}s</TableCell>
                  <TableCell className="max-w-[120px] truncate text-xs">{h.actor}</TableCell>
                  <TableCell>
                    <Badge className={`${STATUS_STYLE[h.status] || ""} text-[9px] hover:${STATUS_STYLE[h.status] || ""}`}>
                      {h.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {Array.isArray(h.errorLog) && h.errorLog.length > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Download Log Error"
                        onClick={() => downloadErrorLog(h.errorLog)}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
