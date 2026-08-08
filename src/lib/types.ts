// CareLivia — Shared API Types
import type {
  Gender,
  ActivityLevel,
  StressLevel,
  DiagnosisType,
  MealSlot,
} from "@prisma/client";

export interface PatientListItem {
  id: string;
  mrn: string;
  name: string;
  gender: Gender;
  birthDate: string;
  height: number | null;
  weight: number | null;
  bmi: number | null;
  ageYears: number;
  diagnoses: DiagnosisType[];
  phone: string | null;
}

export interface FoodSearchResult {
  id: string;
  name: string;
  category: string;
  energy: number;
  protein: number;
  fat: number;
  carb: number;
  fiber: number;
  sodium: number;
  potassium: number;
  gi: number;
  price: number;
  urt: string | null;
  urtGram: number | null;
  tags: string;
}

export interface CalorieRequest {
  gender: Gender;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  stress: StressLevel;
  diagnoses: DiagnosisType[];
  isPregnant?: boolean;
  pregnancyTrimester?: number;
  isLactating?: boolean;
}

export interface MealPlanItemDto {
  id: string;
  slot: MealSlot;
  foodId: string;
  foodName: string;
  amount: number;
  cal: number;
  protein: number;
  fat: number;
  carb: number;
  fiber: number;
  sodium: number;
}

export interface MealPlanDto {
  id: string;
  patientId: string;
  patientName: string;
  date: string;
  targetCal: number;
  targetProtein: number;
  targetFat: number;
  targetCarb: number;
  targetFiber: number;
  targetSodium: number;
  totalCal: number;
  totalProtein: number;
  totalFat: number;
  totalCarb: number;
  totalFiber: number;
  totalSodium: number;
  compliance: number;
  status: string;
  aiModel: string | null;
  aiReasoning: string | null;
  items: MealPlanItemDto[];
}
