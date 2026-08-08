// CareLivia — UI Navigation Store (Zustand)
"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ViewKey =
  | "dashboard"
  | "patients"
  | "calorie"
  | "nutrigenomic"
  | "foods"
  | "recipes"
  | "meal-plan"
  | "meal-plan-history"
  | "exercise"
  | "bouchard"
  | "food-record"
  | "shopping"
  | "saved-menus"
  | "price-management"
  | "supabase-monitor"
  | "database-browser"
  | "report";

interface CareLiviaState {
  activeView: ViewKey;
  activePatientId: string | null;
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  theme: "light" | "dark";
  setActiveView: (v: ViewKey) => void;
  setActivePatient: (id: string | null) => void;
  setSidebarOpen: (o: boolean) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (c: boolean) => void;
  toggleSidebarCollapsed: () => void;
}

export const useCareLiviaStore = create<CareLiviaState>()(
  persist(
    (set) => ({
      activeView: "dashboard",
      activePatientId: null,
      sidebarOpen: false,
      sidebarCollapsed: false,
      theme: "light",
      setActiveView: (v) => set({ activeView: v, sidebarOpen: false }),
      setActivePatient: (id) => set({ activePatientId: id }),
      setSidebarOpen: (o) => set({ sidebarOpen: o }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarCollapsed: (c) => set({ sidebarCollapsed: c }),
      toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    { name: "carelivia-ui" },
  ),
);
