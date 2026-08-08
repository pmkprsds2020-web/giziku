"use client";

import * as React from "react";
import {
  Database,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Activity,
  Server,
  Clock,
  Shield,
  Zap,
  HardDrive,
  Wifi,
  Cloud,
  Key,
  Globe,
  Database as DbIcon,
  FlaskConical,
  Upload,
  AlertTriangle,
  User as UserIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { PageHeader, SectionCard } from "@/components/carelivia/ui-helpers";

export function SupabaseMonitorView() {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<any>(null);
  const [writing, setWriting] = React.useState(false);
  const [writeResult, setWriteResult] = React.useState<any>(null);
  const [seeding, setSeeding] = React.useState(false);
  const [seedResult, setSeedResult] = React.useState<any>(null);

  const fetchMonitor = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/supabase-monitor");
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (e: any) {
      toast.error("Gagal memuat status database");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchMonitor();
  }, []);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/supabase-monitor", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setTestResult(json.data);
        if (json.data.status === "connected") {
          toast.success(`Supabase connected — ${json.data.latency}`);
        } else {
          toast.error(`Connection failed: ${json.data.error}`);
        }
      }
    } catch (e: any) {
      setTestResult({ status: "disconnected", error: e.message });
      toast.error("Connection test failed");
    } finally {
      setTesting(false);
    }
  };

  const handleTestWrite = async () => {
    setWriting(true);
    setWriteResult(null);
    try {
      const res = await fetch("/api/supabase-test-write", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setWriteResult(json.data);
        if (json.data.success) {
          toast.success("✅ Write Success — Supabase PostgreSQL accepting writes");
        } else {
          toast.error(`❌ Write Failed: ${json.data.error}`);
        }
      }
    } catch (e: any) {
      setWriteResult({ success: false, error: e.message });
      toast.error("Test write failed");
    } finally {
      setWriting(false);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    setSeedResult(null);
    try {
      const res = await fetch("/api/supabase-seed", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setSeedResult(json.data);
        if (json.data.success) {
          toast.success(`Seeded ${json.data.totalInserted} records to Supabase`);
          fetchMonitor(); // Refresh counts
        } else {
          toast.warning(`Seeded ${json.data.totalInserted} records with ${json.data.totalErrors} errors`);
        }
      } else {
        setSeedResult({ error: json.error });
        toast.error(json.error || "Seed failed — you may need to log in first");
      }
    } catch (e: any) {
      setSeedResult({ error: e.message });
      toast.error("Seed failed");
    } finally {
      setSeeding(false);
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Supabase Monitor" subtitle="Status koneksi & kesehatan database Supabase PostgreSQL" icon={Database} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const conn = data?.connection || {};
  const stats = data?.stats || {};
  const health = data?.health || {};
  const session = data?.session || {};
  const isConnected = conn.status === "connected";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supabase Monitor"
        subtitle="Status koneksi & kesehatan database Supabase PostgreSQL"
        icon={Database}
        actions={
          <Button onClick={fetchMonitor} variant="outline" size="sm">
            <RefreshCw className="mr-1.5 h-4 w-4" /> Refresh
          </Button>
        }
      />

      {/* Authentication Warning */}
      {session.isAuthenticated === false && (
        <Alert className="border-amber-500/40 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-sm">Belum Login — Writes Akan Gagal</AlertTitle>
          <AlertDescription className="text-xs">
            RLS Supabase mengharuskan autentikasi untuk INSERT/UPDATE/DELETE.
            Silakan <a href="/login" className="font-semibold underline">login</a> terlebih dahulu,
            lalu klik "Seed Database" untuk mengisi data ke Supabase PostgreSQL.
          </AlertDescription>
        </Alert>
      )}

      {/* Top Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className={isConnected ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5"}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Connection Status</p>
                <p className="mt-1.5 text-2xl font-bold text-foreground">
                  {isConnected ? "Connected" : "Disconnected"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{conn.latency || "—"}</p>
              </div>
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${isConnected ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"}`}>
                {isConnected ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Database Type</p>
                <p className="mt-1.5 text-2xl font-bold text-foreground">Supabase PostgreSQL</p>
                <p className="mt-1 text-xs text-muted-foreground">{conn.postgresVersion || "v15.x"}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <Cloud className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Latency</p>
                <p className="mt-1.5 text-2xl font-bold text-foreground">{conn.latencyMs || "—"}ms</p>
                <p className="mt-1 text-xs text-muted-foreground">via REST API</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
                <Zap className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Records</p>
                <p className="mt-1.5 text-2xl font-bold text-foreground">{stats.totalRecords ?? 0}</p>
                <p className="mt-1 text-xs text-muted-foreground">{stats.tables?.length ?? 0} tables</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                <HardDrive className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={handleTest} variant="outline" size="sm" disabled={testing}>
          <Wifi className="mr-1.5 h-4 w-4" />
          {testing ? "Testing..." : "Test Connection"}
        </Button>
        <Button onClick={handleTestWrite} variant="outline" size="sm" disabled={writing}>
          <FlaskConical className="mr-1.5 h-4 w-4" />
          {writing ? "Writing..." : "Test Write (INSERT)"}
        </Button>
        <Button onClick={handleSeed} variant="default" size="sm" disabled={seeding}>
          <Upload className="mr-1.5 h-4 w-4" />
          {seeding ? "Seeding..." : "Seed Database"}
        </Button>
      </div>

      {/* Test Connection Result */}
      {testResult && (
        <SectionCard title="Test Connection Result" description="SELECT NOW() query via Supabase REST API">
          <div className="rounded-lg border border-border/60 bg-muted/30 p-4 font-mono text-xs">
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Status:</span>
              <span className={testResult.status === "connected" ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                {testResult.status === "connected" ? "✅ Connected" : "❌ Disconnected"}
              </span>
              <span className="text-muted-foreground">Latency:</span>
              <span className="text-foreground">{testResult.latency || "—"}</span>
              <span className="text-muted-foreground">Database:</span>
              <span className="text-foreground">{testResult.database || "—"}</span>
              <span className="text-muted-foreground">Project ID:</span>
              <span className="text-foreground">{testResult.projectId || "—"}</span>
              <span className="text-muted-foreground">Authenticated:</span>
              <span className="text-foreground">{testResult.authenticated ? "✅ Yes" : "❌ No"}</span>
              {testResult.sessionUser && (
                <>
                  <span className="text-muted-foreground">Session User:</span>
                  <span className="text-foreground">{testResult.sessionUser}</span>
                </>
              )}
              {testResult.error && (
                <>
                  <span className="text-muted-foreground">Error:</span>
                  <span className="text-rose-600">{testResult.error}</span>
                </>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      {/* Test Write Result */}
      {writeResult && (
        <SectionCard title="Test Write Result" description="INSERT into audit_logs + SELECT back">
          <div className={`rounded-lg border p-4 font-mono text-xs ${writeResult.success ? "border-emerald-500/40 bg-emerald-500/5" : "border-rose-500/40 bg-rose-500/5"}`}>
            <div className="mb-2 text-sm font-bold">
              {writeResult.success ? "✅ Write Success" : "❌ Write Failed"}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Table:</span>
              <span className="text-foreground">{writeResult.table}</span>
              <span className="text-muted-foreground">Operation:</span>
              <span className="text-foreground">{writeResult.operation}</span>
              <span className="text-muted-foreground">Timestamp:</span>
              <span className="text-foreground">{writeResult.timestamp}</span>
              {writeResult.error && (
                <>
                  <span className="text-muted-foreground">Error:</span>
                  <span className="text-rose-600">{writeResult.error}</span>
                </>
              )}
              {writeResult.insertedRow && (
                <>
                  <span className="text-muted-foreground">Row ID:</span>
                  <span className="text-foreground">{writeResult.insertedRow.id || "N/A"}</span>
                  <span className="text-muted-foreground">Action:</span>
                  <span className="text-foreground">{writeResult.insertedRow.action || "N/A"}</span>
                  <span className="text-muted-foreground">Created At:</span>
                  <span className="text-foreground">{writeResult.insertedRow.created_at || "N/A"}</span>
                </>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      {/* Seed Result */}
      {seedResult && (
        <SectionCard title="Seed Result" description="Push data from local cache to Supabase PostgreSQL">
          <div className={`rounded-lg border p-4 ${seedResult.success ? "border-emerald-500/40 bg-emerald-500/5" : "border-amber-500/40 bg-amber-500/5"}`}>
            <div className="mb-2 text-sm font-bold">
              {seedResult.success ? "✅ Seed Success" : "⚠️ Seed Partial"}
            </div>
            {seedResult.message && <p className="mb-2 text-sm text-foreground">{seedResult.message}</p>}
            {seedResult.totalInserted !== undefined && (
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded bg-background/60 p-2">
                  <p className="text-muted-foreground">Inserted</p>
                  <p className="text-lg font-bold text-emerald-600">{seedResult.totalInserted}</p>
                </div>
                <div className="rounded bg-background/60 p-2">
                  <p className="text-muted-foreground">Errors</p>
                  <p className="text-lg font-bold text-rose-600">{seedResult.totalErrors}</p>
                </div>
                {seedResult.results && (
                  <div className="rounded bg-background/60 p-2">
                    <p className="text-muted-foreground">Details</p>
                    <div className="text-[10px]">
                      {Object.entries(seedResult.results).map(([k, v]: any) => (
                        <div key={k}>{k}: {v.inserted} inserted, {v.errors.length} errors</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {seedResult.error && (
              <p className="text-sm text-rose-600">{seedResult.error}</p>
            )}
          </div>
        </SectionCard>
      )}

      {/* Database Health */}
      <SectionCard title="Database Health" description="Status layanan Supabase">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <HealthItem icon={Database} label="Database" value={health.database} color={health.database === "healthy" ? "emerald" : "rose"} />
          <HealthItem icon={Shield} label="Auth" value={health.auth} color={health.auth === "configured" ? "emerald" : "amber"} />
          <HealthItem icon={Key} label="RLS" value={health.rls ? "enabled" : "disabled"} color={health.rls ? "emerald" : "rose"} />
          <HealthItem icon={Activity} label="Realtime" value={health.realtime} color={health.realtime === "available" ? "emerald" : "amber"} />
          <HealthItem icon={HardDrive} label="Storage" value={health.storage} color={health.storage === "configured" ? "emerald" : "amber"} />
          <HealthItem icon={UserIcon} label="Session" value={session.isAuthenticated ? "authenticated" : "anonymous"} color={session.isAuthenticated ? "emerald" : "amber"} />
        </div>
      </SectionCard>

      {/* Connection Details */}
      <SectionCard title="Connection Details" description="Informasi koneksi Supabase PostgreSQL">
        <div className="grid gap-3 sm:grid-cols-2">
          <DetailItem icon={Globe} label="Supabase URL" value={conn.supabaseUrl} />
          <DetailItem icon={Server} label="Project ID" value={conn.projectId} />
          <DetailItem icon={Globe} label="Region" value={conn.region} />
          <DetailItem icon={DbIcon} label="Schema" value={conn.schema} />
          <DetailItem icon={Server} label="PostgreSQL Version" value={conn.postgresVersion} />
          <DetailItem icon={Key} label="Anon Key" value={conn.hasAnonKey ? "✅ Configured" : "❌ Missing"} />
          {session.isAuthenticated && (
            <>
              <DetailItem icon={UserIcon} label="Current User" value={session.email} />
              <DetailItem icon={Key} label="User ID" value={session.userId?.substring(0, 8) + "..."} />
            </>
          )}
        </div>
      </SectionCard>

      {/* Table Statistics */}
      <SectionCard title="Table Statistics" description="Jumlah record per tabel di Supabase PostgreSQL">
        <div className="max-h-96 overflow-y-auto rounded-lg border border-border/40">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Table</TableHead>
                <TableHead>Label</TableHead>
                <TableHead className="text-right">Records</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(stats.tables || []).map((t: any) => (
                <TableRow key={t.name}>
                  <TableCell className="font-mono text-xs">{t.name}</TableCell>
                  <TableCell className="text-sm">{t.label}</TableCell>
                  <TableCell className="text-right font-bold">{t.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Today Records</p>
            <p className="text-xl font-bold text-foreground">{stats.todayRecords ?? 0}</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">This Month</p>
            <p className="text-xl font-bold text-foreground">{stats.monthRecords ?? 0}</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Total Records</p>
            <p className="text-xl font-bold text-foreground">{stats.totalRecords ?? 0}</p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function HealthItem({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    amber: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    rose: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
  };
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-gradient-to-br from-background to-muted/20 p-3">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${colorMap[color] || colorMap.amber}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold capitalize text-foreground">{value}</p>
      </div>
    </div>
  );
}

function DetailItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium text-foreground" title={value}>{value || "—"}</p>
      </div>
    </div>
  );
}
