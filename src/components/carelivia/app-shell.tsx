"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Moon,
  Sun,
  Menu,
  X,
  HeartPulse,
  ChefHat,
  DollarSign,
  Database,
  User as UserIcon,
  LogOut,
  Settings,
  History,
  ChevronsLeft,
  ChevronsRight,
  Dna,
  Activity,
  LayoutDashboard,
  UsersRound,
  Calculator,
  Sparkles,
  ClipboardList,
  ShoppingCart,
  FileText,
  Footprints,
  BookMarked,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCareLiviaStore, type ViewKey } from "@/store/carelivia";
import { useAuth } from "@/lib/supabase/auth-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";

interface NavItem {
  key: ViewKey;
  label: string;
  short: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
  group: "utama" | "penilaian" | "perencanaan" | "data" | "output";
}

const NAV_ITEMS: NavItem[] = [
  // UTAMA
  { key: "dashboard", label: "Dashboard", short: "Home", icon: LayoutDashboard, desc: "Ringkasan klinis & tren pasien", group: "utama" },
  { key: "patients", label: "Manajemen Pasien", short: "Pasien", icon: UsersRound, desc: "Data pasien & asesmen gizi", group: "utama" },

  // PENILAIAN KLINIS
  { key: "calorie", label: "Kalkulator Kalori", short: "Kalori", icon: Calculator, desc: "Formula CareLivia 11 langkah", group: "penilaian" },
  { key: "nutrigenomic", label: "Nutrigenomic AI", short: "Nutrigenomic", icon: Dna, desc: "Interpretasi genetik & precision nutrition", group: "penilaian" },
  { key: "bouchard", label: "Bouchard Activity Record", short: "BAR", icon: Footprints, desc: "Physical activity log 3 hari — Energy Expenditure, MET & PAL", group: "penilaian" },

  // PERENCANAAN
  { key: "meal-plan", label: "AI Meal Plan", short: "Meal Plan", icon: Sparkles, desc: "Generator rencana makan AI", group: "perencanaan" },
  { key: "exercise", label: "Exercise Plan", short: "Olahraga", icon: Activity, desc: "Rencana latihan terpersonalisasi", group: "perencanaan" },
  { key: "food-record", label: "Catatan Asupan", short: "Asupan", icon: ClipboardList, desc: "Food record harian", group: "perencanaan" },
  { key: "saved-menus", label: "Saved Meal Library", short: "Menu Tersimpan", icon: BookMarked, desc: "Template menu & perbandingan", group: "perencanaan" },

  // DATA & DATABASE
  { key: "foods", label: "Database Bahan Makanan", short: "Bahan Makanan", icon: Database, desc: "TKPI/DKBM 73 bahan", group: "data" },
  { key: "recipes", label: "Resep & Menu", short: "Resep", icon: ChefHat, desc: "Manajemen resep & komposisi", group: "data" },
  { key: "price-management", label: "Manajemen Harga", short: "Harga", icon: DollarSign, desc: "Kelola harga bahan makanan", group: "data" },

  // LAPORAN & OUTPUT (Database Browser dihapus — bersifat debugging/developer)
  { key: "meal-plan-history", label: "Riwayat Meal Plan", short: "Riwayat", icon: History, desc: "Snapshot meal plan tersimpan — lihat/gunakan/hapus", group: "output" },
  { key: "shopping", label: "Shopping Planner", short: "Belanja", icon: ShoppingCart, desc: "Daftar belanja & estimasi harga", group: "output" },
  { key: "supabase-monitor", label: "Database Monitor", short: "Monitor", icon: Activity, desc: "Status koneksi & kesehatan database", group: "output" },
  { key: "report", label: "Laporan Klinis PDF", short: "Laporan", icon: FileText, desc: "Laporan nutrisi profesional", group: "output" },
];

const GROUP_LABELS: Record<NavItem["group"], string> = {
  utama: "Utama",
  penilaian: "Penilaian Klinis",
  perencanaan: "Perencanaan",
  data: "Data & Database",
  output: "Laporan & Output",
};

function NavButton({ item, collapsed = false }: { item: NavItem; collapsed?: boolean }) {
  const { activeView, setActiveView } = useCareLiviaStore();
  const Icon = item.icon;
  const active = activeView === item.key;

  const button = (
    <button
      onClick={() => setActiveView(item.key)}
      className={cn(
        "group relative flex h-10 w-full items-center gap-3 rounded-[10px] px-3 text-left text-[13px] font-medium leading-none transition-colors duration-150 ease-out",
        collapsed && "h-11 w-11 justify-center px-0",
        active
          ? "bg-primary/[0.08] font-semibold text-primary"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
      )}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-primary"
        />
      )}
      <Icon
        className={cn(
          "h-[18px] w-[18px] shrink-0 stroke-[1.8]",
          active ? "text-primary" : "text-sidebar-foreground/55 group-hover:text-sidebar-foreground",
        )}
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </button>
  );

  if (!collapsed) return button;

  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right" className="flex flex-col gap-0.5">
        <span className="font-medium">{item.label}</span>
        <span className="text-[11px] text-primary-foreground/70">{item.desc}</span>
      </TooltipContent>
    </Tooltip>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { sidebarOpen, toggleSidebar, setSidebarOpen, sidebarCollapsed, toggleSidebarCollapsed } =
    useCareLiviaStore();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const groups: NavItem["group"][] = ["utama", "penilaian", "perencanaan", "data", "output"];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Sidebar — desktop */}
      <TooltipProvider>
        <aside
          className={cn(
            "relative hidden shrink-0 border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex lg:flex-col",
            sidebarCollapsed ? "w-[72px]" : "w-[260px]",
          )}
        >
          <SidebarContent groups={groups} collapsed={sidebarCollapsed} />
          <button
            onClick={toggleSidebarCollapsed}
            aria-label={sidebarCollapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
            className="absolute -right-3 top-16 hidden h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-background text-muted-foreground shadow-sm transition-colors duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:flex"
          >
            {sidebarCollapsed ? (
              <ChevronsRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronsLeft className="h-3.5 w-3.5" />
            )}
          </button>
        </aside>
      </TooltipProvider>

      {/* Sidebar — mobile drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col border-r border-sidebar-border bg-sidebar shadow-xl">
            <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-3">
              <Brand />
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <SidebarContent groups={groups} />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          onMenu={toggleSidebar}
          theme={theme}
          toggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
          mounted={mounted}
        />
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-gradient-to-b from-background to-muted/30">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}

function SidebarContent({
  groups,
  collapsed = false,
}: {
  groups: NavItem["group"][];
  collapsed?: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "hidden border-b border-sidebar-border py-4 lg:block",
          collapsed ? "px-3" : "px-5",
        )}
      >
        <Brand collapsed={collapsed} />
      </div>
      {/* space-y-6 separates the five clinical-workflow menu groups */}
      <nav
        className={cn(
          "sidebar-scroll flex-1 space-y-6 overflow-y-auto py-4",
          collapsed ? "px-2" : "px-3",
        )}
      >
        {groups.map((g) => (
          <div key={g} className="space-y-1">
            {!collapsed && (
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
                {GROUP_LABELS[g]}
              </p>
            )}
            {collapsed && (
              <div className="mx-auto mb-1 h-px w-6 bg-sidebar-border" aria-hidden="true" />
            )}
            {NAV_ITEMS.filter((i) => i.group === g).map((item) => (
              <NavButton key={item.key} item={item} collapsed={collapsed} />
            ))}
          </div>
        ))}
      </nav>
      <div className={cn("border-t border-sidebar-border py-3", collapsed ? "px-2" : "px-4")}>
        {collapsed ? (
          <div className="flex justify-center" title="Sistem Online">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-[11px] font-medium text-sidebar-foreground/70">
                Sistem Online
              </span>
              <span className="truncate text-[10px] text-muted-foreground">
                CareLivia CNMS v1.0
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5", collapsed && "justify-center")}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-chart-2 text-primary-foreground shadow-sm">
        <HeartPulse className="h-5 w-5" />
      </div>
      {!collapsed && (
        <div className="flex flex-col leading-tight">
          <span className="text-base font-bold tracking-tight text-sidebar-foreground">
            CareLivia
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Clinical Nutrition
          </span>
        </div>
      )}
    </Link>
  );
}

function Header({
  onMenu,
  theme,
  toggleTheme,
  mounted,
}: {
  onMenu: () => void;
  theme: string | undefined;
  toggleTheme: () => void;
  mounted: boolean;
}) {
  const { activeView } = useCareLiviaStore();
  const current = NAV_ITEMS.find((i) => i.key === activeView);
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenu}
          aria-label="Buka menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2 lg:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-chart-2 text-primary-foreground">
            <HeartPulse className="h-4 w-4" />
          </div>
        </div>
        <div className="hidden flex-col leading-tight sm:flex">
          <h1 className="text-sm font-semibold text-foreground sm:text-base">
            {current?.label ?? "Dashboard"}
          </h1>
          <p className="text-[11px] text-muted-foreground">
            {current?.desc ?? "Sistem Nutrisi Klinis"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="hidden gap-1 text-xs sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Sistem Aktif
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label="Ganti tema"
          className="h-9 w-9"
        >
          {mounted && theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>
        <UserMenu />
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-background px-4 py-4 sm:px-6">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
        <p>
          © {new Date().getFullYear()} CareLivia CNMS — Clinical Nutrition
          Decision Support System
        </p>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <HeartPulse className="h-3 w-3 text-primary" />
            Powered by CareLivia Engine
          </span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">
            PERKENI · ESPEN · ASPEN · KDIGO · WHO
          </span>
        </div>
      </div>
    </footer>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);

  const handleLogout = async () => {
    try {
      await signOut();
      // Clear all React Query cache
      qc.clear();
      // Clear localStorage and sessionStorage
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {}
      // Redirect to login
      router.push("/login");
      router.refresh();
    } catch (e) {
      console.error("Logout error:", e);
      router.push("/login");
    }
  };

  // If not logged in, show login link
  if (!user) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => router.push("/login")}
        className="h-9 gap-1.5"
      >
        <UserIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Login</span>
      </Button>
    );
  }

  const email = user.email || "";
  const displayName = user.user_metadata?.name || email.split("@")[0] || "User";
  const initials = displayName.substring(0, 2).toUpperCase();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-9 gap-2 px-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-chart-2 text-xs font-bold text-primary-foreground">
              {initials}
            </div>
            <span className="hidden text-sm font-medium sm:inline">{displayName}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{displayName}</p>
              <p className="text-xs leading-none text-muted-foreground">{email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push("/login")}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Pengaturan</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setShowLogoutConfirm(true)}
            className="text-rose-600 focus:text-rose-700"
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Logout</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Keluar dari Akun?</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin keluar? Anda perlu login kembali untuk mengakses aplikasi.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowLogoutConfirm(false)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              <LogOut className="mr-1.5 h-4 w-4" />
              Logout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
