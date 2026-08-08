"use client";

import * as React from "react";
import { PlateGroup } from "@/lib/clinical/isi-piringku";

// ---------------------------------------------------------------------
// IsiPiringkuPlate — SVG visualization of the Kemenkes RI "Isi Piringku"
//
// Visual layout:
//   ┌──────────────┬──────────────┐
//   │  STAPLE 2/3  │  VEG 2/3     │  ← top-left half / top-right half
//   │              │              │
//   │ ───────────  │ ───────────  │
//   │ PROTEIN 1/3  │ FRUIT 1/3    │  ← bottom-left / bottom-right
//   └──────────────┴──────────────┘
//
// Each quadrant is sized by its proportion (2/3 vs 1/3) and colored by group.
// Empty quadrants are shown faded with a "+" hint.
// ---------------------------------------------------------------------

export interface PlateItem {
  group: PlateGroup;
  foodName: string;
  grams: number;
  cal: number;
}

export interface IsiPiringkuPlateProps {
  items: PlateItem[];
  idealShare?: Partial<Record<PlateGroup, number>>;
  size?: number; // px
  showLabels?: boolean;
  showLegend?: boolean;
  className?: string;
}

const GROUP_COLOR: Record<PlateGroup, string> = {
  STAPLE: "#f59e0b",
  PROTEIN: "#f43f5e",
  VEGETABLE: "#10b981",
  FRUIT: "#a855f7",
  OTHER: "#64748b",
};

const GROUP_LABEL: Record<PlateGroup, string> = {
  STAPLE: "Makanan Pokok",
  PROTEIN: "Lauk Pauk",
  VEGETABLE: "Sayuran",
  FRUIT: "Buah",
  OTHER: "Lainnya",
};

const GROUP_ICON: Record<PlateGroup, string> = {
  STAPLE: "🍚",
  PROTEIN: "🍗",
  VEGETABLE: "🥦",
  FRUIT: "🍎",
  OTHER: "🥤",
};

// Ideal plate: 2/3 of each half is the larger quadrant
// Left half: STAPLE (top, 2/3) + PROTEIN (bottom, 1/3)
// Right half: VEGETABLE (top, 2/3) + FRUIT (bottom, 1/3)

export function IsiPiringkuPlate({
  items,
  size = 280,
  showLabels = true,
  showLegend = true,
  className,
}: IsiPiringkuPlateProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;

  // Find each group's item
  const findItem = (g: PlateGroup) => items.find((i) => i.group === g);

  const staple = findItem(PlateGroup.STAPLE);
  const protein = findItem(PlateGroup.PROTEIN);
  const vegetable = findItem(PlateGroup.VEGETABLE);
  const fruit = findItem(PlateGroup.FRUIT);

  // SVG paths for plate quadrants.
  // Full circle split into 2 halves (vertical line) and each half split
  // horizontally at 2/3 from top.
  //
  // We use 4 paths:
  //   - Top-left (STAPLE, 2/3 height of left half)
  //   - Bottom-left (PROTEIN, 1/3 height of left half)
  //   - Top-right (VEGETABLE, 2/3 height of right half)
  //   - Bottom-right (FRUIT, 1/3 height of right half)

  // For simplicity, draw a circle with clip-path, then 4 rects with rounded corners clipped to circle.
  // We'll use SVG mask to clip rectangles to the circle.

  const splitY = cy - r * (1 / 3); // y-coordinate of horizontal split (2/3 above, 1/3 below)

  return (
    <div className={className} style={{ width: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <clipPath id="plate-clip">
            <circle cx={cx} cy={cy} r={r} />
          </clipPath>
        </defs>

        {/* Plate background (outer ring) */}
        <circle
          cx={cx}
          cy={cy}
          r={r + 3}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={3}
        />

        {/* Clipped quadrants */}
        <g clipPath="url(#plate-clip)">
          {/* Top-left: STAPLE (2/3 of left half) */}
          <rect
            x={cx - r}
            y={cy - r}
            width={r}
            height={r * (2 / 3)}
            fill={staple ? GROUP_COLOR.STAPLE : "#fef3c7"}
            opacity={staple ? 0.9 : 0.45}
          />
          {/* Bottom-left: PROTEIN (1/3 of left half) */}
          <rect
            x={cx - r}
            y={splitY}
            width={r}
            height={r * (1 / 3)}
            fill={protein ? GROUP_COLOR.PROTEIN : "#ffe4e6"}
            opacity={protein ? 0.9 : 0.45}
          />
          {/* Top-right: VEGETABLE (2/3 of right half) */}
          <rect
            x={cx}
            y={cy - r}
            width={r}
            height={r * (2 / 3)}
            fill={vegetable ? GROUP_COLOR.VEGETABLE : "#d1fae5"}
            opacity={vegetable ? 0.9 : 0.45}
          />
          {/* Bottom-right: FRUIT (1/3 of right half) */}
          <rect
            x={cx}
            y={splitY}
            width={r}
            height={r * (1 / 3)}
            fill={fruit ? GROUP_COLOR.FRUIT : "#f3e8ff"}
            opacity={fruit ? 0.9 : 0.45}
          />

          {/* Vertical divider line */}
          <line
            x1={cx}
            y1={cy - r}
            x2={cx}
            y2={cy + r}
            stroke="white"
            strokeWidth={2}
            strokeDasharray="4 3"
          />
          {/* Horizontal divider line */}
          <line
            x1={cx - r}
            y1={splitY}
            x2={cx + r}
            y2={splitY}
            stroke="white"
            strokeWidth={2}
            strokeDasharray="4 3"
          />
        </g>

        {/* Plate inner ring */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#cbd5e1"
          strokeWidth={1.5}
        />

        {/* Center labels for each quadrant */}
        {showLabels && (
          <>
            <QuadrantLabel
              x={cx - r / 2}
              y={cy - r / 3}
              icon={GROUP_ICON.STAPLE}
              label="Makanan Pokok"
              sub={staple ? `${staple.foodName} ${staple.grams}g` : "—"}
              detail={staple ? `${staple.cal} kkal` : ""}
              filled={!!staple}
            />
            <QuadrantLabel
              x={cx - r / 2}
              y={cy + r / 6}
              icon={GROUP_ICON.PROTEIN}
              label="Lauk Pauk"
              sub={protein ? `${protein.foodName} ${protein.grams}g` : "—"}
              detail={protein ? `${protein.cal} kkal` : ""}
              filled={!!protein}
            />
            <QuadrantLabel
              x={cx + r / 2}
              y={cy - r / 3}
              icon={GROUP_ICON.VEGETABLE}
              label="Sayuran"
              sub={vegetable ? `${vegetable.foodName} ${vegetable.grams}g` : "—"}
              detail={vegetable ? `${vegetable.cal} kkal` : ""}
              filled={!!vegetable}
            />
            <QuadrantLabel
              x={cx + r / 2}
              y={cy + r / 6}
              icon={GROUP_ICON.FRUIT}
              label="Buah"
              sub={fruit ? `${fruit.foodName} ${fruit.grams}g` : "—"}
              detail={fruit ? `${fruit.cal} kkal` : ""}
              filled={!!fruit}
            />
          </>
        )}

        {/* Proportion indicators (2/3 vs 1/3) */}
        <text
          x={cx - r / 2}
          y={cy - r + 12}
          textAnchor="middle"
          fontSize={9}
          fill="#92400e"
          fontWeight="600"
        >
          2/3 piring
        </text>
        <text
          x={cx - r / 2}
          y={cy + r - 4}
          textAnchor="middle"
          fontSize={9}
          fill="#9f1239"
          fontWeight="600"
        >
          1/3 piring
        </text>
        <text
          x={cx + r / 2}
          y={cy - r + 12}
          textAnchor="middle"
          fontSize={9}
          fill="#065f46"
          fontWeight="600"
        >
          2/3 piring
        </text>
        <text
          x={cx + r / 2}
          y={cy + r - 4}
          textAnchor="middle"
          fontSize={9}
          fill="#6b21a8"
          fontWeight="600"
        >
          1/3 piring
        </text>
      </svg>

      {showLegend && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <LegendItem color={GROUP_COLOR.STAPLE} label="Makanan Pokok" icon="🍚" />
          <LegendItem color={GROUP_COLOR.PROTEIN} label="Lauk Pauk" icon="🍗" />
          <LegendItem color={GROUP_COLOR.VEGETABLE} label="Sayuran" icon="🥦" />
          <LegendItem color={GROUP_COLOR.FRUIT} label="Buah" icon="🍎" />
        </div>
      )}
    </div>
  );
}

function QuadrantLabel({
  x,
  y,
  icon,
  label,
  sub,
  detail,
  filled,
}: {
  x: number;
  y: number;
  icon: string;
  label: string;
  sub: string;
  detail: string;
  filled: boolean;
}) {
  return (
    <g>
      <text x={x} y={y - 6} textAnchor="middle" fontSize={14}>
        {icon}
      </text>
      <text
        x={x}
        y={y + 8}
        textAnchor="middle"
        fontSize={9}
        fontWeight={700}
        fill="#0f172a"
        opacity={filled ? 1 : 0.4}
      >
        {label}
      </text>
      <text
        x={x}
        y={y + 20}
        textAnchor="middle"
        fontSize={8}
        fill="#334155"
        opacity={filled ? 0.9 : 0.4}
      >
        {sub.length > 18 ? sub.slice(0, 17) + "…" : sub}
      </text>
      {detail && (
        <text x={x} y={y + 30} textAnchor="middle" fontSize={7.5} fill="#64748b">
          {detail}
        </text>
      )}
    </g>
  );
}

function LegendItem({ color, label, icon }: { color: string; label: string; icon: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1.5">
      <span className="text-sm">{icon}</span>
      <span className="h-3 w-3 rounded-full" style={{ background: color }} />
      <span className="text-slate-700 font-medium">{label}</span>
    </div>
  );
}
