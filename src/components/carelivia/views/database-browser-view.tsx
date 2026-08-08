"use client";

import * as React from "react";
import { Table2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/carelivia/ui-helpers";

const TABLES = [
  { value: "patients", label: "Patients" },
  { value: "foods", label: "Foods" },
  { value: "meal_plans", label: "Meal Plans" },
  { value: "food_records", label: "Food Records" },
  { value: "weight_records", label: "Weight Records" },
  { value: "nutrition_assessments", label: "Nutrition Assessments" },
  { value: "nutrition_presets", label: "Nutrition Presets" },
  { value: "recipes", label: "Recipes" },
  { value: "exercise_plans", label: "Exercise Plans" },
  { value: "saved_meal_plans", label: "Saved Meal Plans" },
  { value: "shopping_lists", label: "Shopping Lists" },
  { value: "audit_logs", label: "Audit Logs" },
];

function fmt(v: any): string {
  if (v == null) return "—";
  if (typeof v === "boolean") return v ? "✓" : "✗";
  if (v instanceof Date) return v.toLocaleDateString("id-ID");
  if (typeof v === "object") {
    if ("name" in v) return String(v.name);
    if ("mrn" in v) return String(v.mrn);
    if ("items" in v) return String(v.items);
    try { return JSON.stringify(v).slice(0, 50); } catch { return "[obj]"; }
  }
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
      try { return new Date(v).toLocaleDateString("id-ID"); } catch { return v.slice(0, 20); }
    }
    return v.length > 40 ? v.slice(0, 40) + "…" : v;
  }
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(1);
  return String(v);
}

export function DatabaseBrowserView() {
  const [table, setTable] = React.useState("patients");
  const [page, setPage] = React.useState(1);
  const [q, setQ] = React.useState("");
  const [result, setResult] = React.useState<{data: any[], pagination: any} | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => { setPage(1); }, [table]);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams({ table, page: String(page), limit: "10" });
    if (q) params.set("q", q);
    fetch(`/api/database-browser?${params}`)
      .then(r => r.json())
      .then(j => { if (active && j.success) setResult(j.data); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [table, page, q]);

  const rows = result?.data || [];
  const pg = result?.pagination;
  const cols = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div>
      <PageHeader title="Database Browser" subtitle="Lihat isi tabel database" icon={Table2} />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <select value={table} onChange={e => setTable(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm">
          {TABLES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <div className="relative flex-1">
          <Input placeholder="Cari..." value={q} onChange={e => setQ(e.target.value)} className="pl-9" />
        </div>
        {pg && <Badge variant="outline">{pg.total} records</Badge>}
      </div>

      {loading && <Skeleton className="h-96 rounded-xl" />}

      {!loading && rows.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm">Tidak ada data di tabel {table}</p>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <Card><CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                {cols.map(c => <TableHead key={c} className="font-mono text-xs whitespace-nowrap">{c}</TableHead>)}
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={r.id || i}>
                    {cols.map(c => <TableCell key={c} className="text-xs whitespace-nowrap">{fmt(r[c])}</TableCell>)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent></Card>
      )}

      {pg && pg.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Hal {pg.page}/{pg.totalPages} · {pg.total} total</p>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={!pg.hasPrev} onClick={() => setPage(p => Math.max(1, p-1))}>‹</Button>
            <Button size="sm" variant="outline" disabled={!pg.hasNext} onClick={() => setPage(p => p+1)}>›</Button>
          </div>
        </div>
      )}
    </div>
  );
}
