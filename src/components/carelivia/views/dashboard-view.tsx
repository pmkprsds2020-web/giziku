"use client";

import * as React from "react";
import {
  Users,
  Apple,
  ClipboardList,
  Flame,
  Activity,
  TrendingDown,
  TrendingUp,
  CalendarDays,
  Stethoscope,
  ArrowRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PageHeader,
  StatCard,
  SectionCard,
  LoadingState,
  EmptyState,
} from "@/components/carelivia/ui-helpers";
import { useDashboard } from "@/hooks/use-carelivia";
import { useCareLiviaStore } from "@/store/carelivia";
import { DIAGNOSIS_ADJUSTMENTS } from "@/lib/clinical/constants";
import type { DiagnosisType } from "@prisma/client";

const PIE_COLORS = ["#10b981", "#06b6d4", "#f59e0b", "#8b5cf6", "#ec4899", "#ef4444", "#84cc16"];

export function DashboardView() {
  const { data, isLoading } = useDashboard();
  const { setActiveView, setActivePatient } = useCareLiviaStore();

  if (isLoading) {
    return (
      <div>
        <PageHeader
          title="Dashboard Klinis"
          subtitle="Ringkasan nutrisi pasien & aktivitas sistem"
          icon={Activity}
        />
        <LoadingState count={4} />
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState
        title="Data dashboard belum tersedia"
        description="Tambahkan pasien untuk mulai memantau."
        icon={Activity}
      />
    );
  }

  const diagDist = Object.entries(data.diagnosisDistribution || {}).map(
    ([k, v]) => ({
      name: (DIAGNOSIS_ADJUSTMENTS[k as DiagnosisType]?.label || k).split(" ")[0],
      value: v as number,
      type: k,
    }),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Klinis"
        subtitle="Ringkasan nutrisi pasien & aktivitas sistem CareLivia"
        icon={Activity}
        actions={
          <Button onClick={() => setActiveView("patients")} variant="outline" size="sm">
            <Users className="mr-2 h-4 w-4" /> Kelola Pasien
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Pasien"
          value={data.totalPatients}
          icon={Users}
          color="emerald"
          sublabel="Pasien aktif terdaftar"
        />
        <StatCard
          label="Meal Plan Aktif"
          value={data.activeMealPlans}
          icon={ClipboardList}
          color="teal"
          sublabel="Rencana makan final"
        />
        <StatCard
          label="Database Bahan"
          value={data.totalFoods}
          unit="bahan"
          icon={Apple}
          color="amber"
          sublabel="TKPI / DKBM"
        />
        <StatCard
          label="Asupan Hari Ini"
          value={Math.round(data.todayCalTotal)}
          unit="kcal"
          icon={Flame}
          color="violet"
          sublabel={`${data.todayRecords} catatan asupan`}
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recent meal plans compliance */}
        <SectionCard
          title="Compliance Meal Plan Terbaru"
          description="Target vs aktual kalori per pasien"
          className="lg:col-span-2"
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.recentPlans}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                <XAxis
                  dataKey="patientName"
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={50}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    fontSize: 12,
                    background: "var(--popover)",
                    color: "var(--popover-foreground)",
                  }}
                />
                <Bar dataKey="targetCal" fill="#94a3b8" radius={[4, 4, 0, 0]} name="Target" />
                <Bar dataKey="totalCal" fill="#10b981" radius={[4, 4, 0, 0]} name="Aktual" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        {/* Diagnosis distribution */}
        <SectionCard
          title="Distribusi Diagnosis"
          description="Pasien per jenis diagnosis aktif"
        >
          {diagDist.length === 0 ? (
            <EmptyState title="Belum ada diagnosis" icon={Stethoscope} />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={diagDist}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                  >
                    {diagDist.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Patient monitoring table */}
      <SectionCard
        title="Monitoring Pasien"
        description="Tren berat badan & compliance terbaru"
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveView("patients")}
          >
            Lihat semua <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-3 font-medium">Pasien</th>
                <th className="pb-2 pr-3 font-medium">Usia</th>
                <th className="pb-2 pr-3 font-medium">BMI</th>
                <th className="pb-2 pr-3 font-medium">Diagnosis</th>
                <th className="pb-2 pr-3 font-medium">Tren BB</th>
                <th className="pb-2 pr-3 font-medium">Compliance</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(data.patientSummaries) && data.patientSummaries.slice(0, 6).map((p: any) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-2.5 pr-3">
                    <div className="font-medium text-foreground">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.mrn}</div>
                  </td>
                  <td className="py-2.5 pr-3 text-xs">{p.ageYears ?? "—"} th</td>
                  <td className="py-2.5 pr-3">
                    {p.bmi ? (
                      <Badge
                        variant="outline"
                        className={
                          p.bmi < 18.5
                            ? "border-sky-300 bg-sky-50 text-sky-700 dark:bg-sky-950"
                            : p.bmi < 23
                              ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950"
                              : p.bmi < 25
                                ? "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950"
                                : "border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950"
                        }
                      >
                        {p.bmi}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3">
                    <div className="flex flex-wrap gap-1">
                      {Array.isArray(p.diagnoses) && p.diagnoses.slice(0, 2).map((raw: any, i: number) => {
                        const d: string = typeof raw === "string" ? raw : (raw?.type ?? "");
                        if (!d) return null;
                        return (
                          <Badge key={`${d}-${i}`} variant="secondary" className="text-[10px]">
                            {d}
                          </Badge>
                        );
                      })}
                    </div>
                  </td>
                  <td className="py-2.5 pr-3">
                    <div className="flex h-8 w-24 items-end gap-0.5">
                      {Array.isArray(p.weightTrend) && p.weightTrend.slice(-8).map((w: any, i: number) => {
                        const h = Math.min(100, Math.max(20, ((w.weight - 40) / 60) * 100));
                        return (
                          <div
                            key={i}
                            className="flex-1 rounded-sm bg-primary/60"
                            style={{ height: `${h}%` }}
                            title={`${w.weight} kg`}
                          />
                        );
                      })}
                    </div>
                  </td>
                  <td className="py-2.5 pr-3">
                    {p.latestCompliance != null ? (
                      <div className="w-20">
                        <div className="mb-1 flex justify-between text-[10px]">
                          <span className="font-medium">{p.latestCompliance}%</span>
                        </div>
                        <Progress
                          value={p.latestCompliance}
                          className="h-1.5"
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setActivePatient(p.id);
                        setActiveView("patients");
                      }}
                    >
                      Detail
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
