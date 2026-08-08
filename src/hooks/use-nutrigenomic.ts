"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  supabaseFetchGenomicReports,
  supabaseFetchGenomicReportDetail,
  supabaseCreateGenomicReport,
  supabaseDeleteGenomicReport,
  supabaseFetchLatestGenomicFindings,
  supabaseFetchGeneReference,
} from "@/lib/supabase/frontend-data";

// ---------------- Queries ----------------

export function useGenomicReports(patientId: string | null) {
  return useQuery({
    queryKey: ["genomic-reports", patientId],
    queryFn: () => supabaseFetchGenomicReports(patientId!),
    enabled: !!patientId,
  });
}

export function useGenomicReportDetail(reportId: string | null) {
  return useQuery({
    queryKey: ["genomic-report-detail", reportId],
    queryFn: () => supabaseFetchGenomicReportDetail(reportId!),
    enabled: !!reportId,
  });
}

export function useLatestGenomicFindings(patientId: string | null) {
  return useQuery({
    queryKey: ["genomic-findings-latest", patientId],
    queryFn: () => supabaseFetchLatestGenomicFindings(patientId!),
    enabled: !!patientId,
  });
}

// Reference table — clinical constants, safe to cache long.
export function useGeneReference() {
  return useQuery({
    queryKey: ["gene-reference"],
    queryFn: () => supabaseFetchGeneReference(),
    staleTime: 60 * 60 * 1000,
  });
}

// ---------------- Mutations ----------------

// Step 1: send rendered page images to the AI, get back candidate
// findings. Nothing is saved here — the dialog shows a review table.
export function useExtractGenomicReport() {
  return useMutation({
    mutationFn: async (input: { patientId: string; images: string[] }) => {
      const res = await fetch("/api/ai/nutrigenomic-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await res.json();
      if (!body.success) {
        console.error("[nutrigenomic-extract] failed:", body.error, body.details);
        throw new Error(body.error || "Gagal membaca dokumen nutrigenomik");
      }
      return body.data;
    },
  });
}

// Step 2: persist the clinician-confirmed report + findings directly to
// Supabase (same pattern as useAddLabResult).
export function useSaveGenomicReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof supabaseCreateGenomicReport>[0]) =>
      supabaseCreateGenomicReport(input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["genomic-reports", variables.patientId] });
    },
  });
}

// Step 3: ask the AI to produce the full clinical interpretation for a
// report that already has confirmed findings.
export function useInterpretGenomicReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { patientId: string; reportId: string }) => {
      const res = await fetch("/api/ai/nutrigenomic-interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await res.json();
      if (!body.success) {
        console.error("[nutrigenomic-interpret] failed:", body.error, body.details);
        throw new Error(body.error || "Gagal membuat interpretasi klinis");
      }
      return body.data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["genomic-report-detail", variables.reportId] });
      qc.invalidateQueries({ queryKey: ["genomic-reports", variables.patientId] });
      qc.invalidateQueries({ queryKey: ["genomic-findings-latest", variables.patientId] });
    },
  });
}

export function useDeleteGenomicReport(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => supabaseDeleteGenomicReport(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["genomic-reports", patientId] }),
  });
}
