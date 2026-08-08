import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/lib/supabase/auth-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CareLivia CNMS — Clinical Nutrition Management System",
  description:
    "Sistem Manajemen Nutrisi Klinis terpadu untuk dokter & ahli gizi. Calculator kalori CareLivia, meal plan AI, exercise plan, food database TKPI/DKBM, dan laporan klinis PDF.",
  keywords: [
    "CareLivia",
    "Clinical Nutrition",
    "CNDSS",
    "Kalkulator Kalori",
    "Meal Plan AI",
    "TKPI",
    "DKBM",
    "PERKENI",
    "ESPEN",
  ],
  authors: [{ name: "CareLivia Team" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            {children}
          </AuthProvider>
          <Toaster />
          <SonnerToaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
