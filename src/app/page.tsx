"use client";

import * as React from "react";
import { AppShell } from "@/components/carelivia/app-shell";
import { QueryProvider } from "@/components/query-provider";
import { useCareLiviaStore } from "@/store/carelivia";
import { DashboardView } from "@/components/carelivia/views/dashboard-view";
import { PatientsView } from "@/components/carelivia/views/patients-view";
import { CalorieView } from "@/components/carelivia/views/calorie-view";
import { NutrigenomicView } from "@/components/carelivia/views/nutrigenomic-view";
import { FoodsView } from "@/components/carelivia/views/foods-view";
import { RecipesView } from "@/components/carelivia/views/recipes-view";
import { MealPlanView } from "@/components/carelivia/views/meal-plan-view";
import { MealPlanHistoryView } from "@/components/carelivia/views/history-view";
import { ExerciseView } from "@/components/carelivia/views/exercise-view";
import { BouchardView } from "@/components/carelivia/views/bouchard-view";
import { FoodRecordView } from "@/components/carelivia/views/food-record-view";
import { ShoppingView } from "@/components/carelivia/views/shopping-view";
import { SavedMenusView } from "@/components/carelivia/views/saved-menus-view";
import { PriceManagementView } from "@/components/carelivia/views/price-management-view";
import { SupabaseMonitorView } from "@/components/carelivia/views/supabase-monitor-view";
import { DatabaseBrowserView } from "@/components/carelivia/views/database-browser-view";
import { ReportView } from "@/components/carelivia/views/report-view";

function ViewRouter() {
  const { activeView } = useCareLiviaStore();
  switch (activeView) {
    case "dashboard":
      return <DashboardView />;
    case "patients":
      return <PatientsView />;
    case "calorie":
      return <CalorieView />;
    case "nutrigenomic":
      return <NutrigenomicView />;
    case "foods":
      return <FoodsView />;
    case "recipes":
      return <RecipesView />;
    case "meal-plan":
      return <MealPlanView />;
    case "meal-plan-history":
      return <MealPlanHistoryView />;
    case "exercise":
      return <ExerciseView />;
    case "bouchard":
      return <BouchardView />;
    case "food-record":
      return <FoodRecordView />;
    case "shopping":
      return <ShoppingView />;
    case "saved-menus":
      return <SavedMenusView />;
    case "price-management":
      return <PriceManagementView />;
    case "supabase-monitor":
      return <SupabaseMonitorView />;
    case "database-browser":
      return <DatabaseBrowserView />;
    case "report":
      return <ReportView />;
    default:
      return <DashboardView />;
  }
}

export default function Home() {
  return (
    <QueryProvider>
      <AppShell>
        <ViewRouter />
      </AppShell>
    </QueryProvider>
  );
}
