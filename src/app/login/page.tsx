"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  HeartPulse,
  Mail,
  Lock,
  User,
  Loader2,
  Eye,
  EyeOff,
  ShieldCheck,
  Brain,
  Activity,
  Apple,
  Dumbbell,
  Stethoscope,
  LineChart,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

// ---------------------------------------------------------------------
// Floating icon data for hero section
// ---------------------------------------------------------------------
const FLOATING_ICONS = [
  { Icon: Apple, className: "top-[15%] left-[10%]", delay: 0, color: "text-rose-300" },
  { Icon: Activity, className: "top-[25%] right-[12%]", delay: 0.5, color: "text-cyan-200" },
  { Icon: Brain, className: "top-[55%] left-[8%]", delay: 1.0, color: "text-violet-200" },
  { Icon: Dumbbell, className: "top-[70%] right-[10%]", delay: 1.5, color: "text-amber-200" },
  { Icon: Stethoscope, className: "top-[40%] right-[6%]", delay: 2.0, color: "text-emerald-200" },
  { Icon: LineChart, className: "top-[80%] left-[15%]", delay: 2.5, color: "text-sky-200" },
];

const COMPLIANCE_BADGES = [
  "AI Powered",
  "Evidence Based",
  "ESPEN",
  "ASPEN",
  "WHO",
  "PERKENI",
];

// ---------------------------------------------------------------------
// Error message mapping (Indonesian)
// ---------------------------------------------------------------------
function mapAuthError(message: string): { title: string; desc: string } {
  const msg = message.toLowerCase();
  if (msg.includes("invalid login credentials") || msg.includes("invalid credentials")) {
    return { title: "Login Gagal", desc: "Email atau password salah. Periksa kembali kredensial Anda." };
  }
  if (msg.includes("email not confirmed")) {
    return { title: "Akun Belum Aktif", desc: "Email belum dikonfirmasi. Cek inbox Anda untuk link verifikasi." };
  }
  if (msg.includes("user not found")) {
    return { title: "Email Tidak Ditemukan", desc: "Belum ada akun terdaftar dengan email ini." };
  }
  if (msg.includes("rate limit") || msg.includes("too many")) {
    return { title: "Terlalu Banyak Percobaan", desc: "Tunggu beberapa menit sebelum mencoba lagi." };
  }
  if (msg.includes("network") || msg.includes("fetch")) {
    return { title: "Koneksi Gagal", desc: "Tidak dapat terhubung ke server. Periksa koneksi internet Anda." };
  }
  if (msg.includes("password")) {
    return { title: "Password Salah", desc: "Password yang Anda masukkan tidak sesuai." };
  }
  return { title: "Login Gagal", desc: message };
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [authError, setAuthError] = React.useState<{ title: string; desc: string } | null>(null);
  const [success, setSuccess] = React.useState(false);

  // Real-time email validation
  const validateEmail = (value: string): string | null => {
    if (!value) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) return "Format email tidak valid";
    return null;
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setEmailError(validateEmail(value));
    setAuthError(null);
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (value && value.length < 6) {
      setPasswordError("Password minimal 6 karakter");
    } else {
      setPasswordError(null);
    }
    setAuthError(null);
  };

  // Sign in with email + password
  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError(null);

    const emailErr = validateEmail(email);
    if (emailErr) {
      setEmailError(emailErr);
      return;
    }
    if (!password) {
      setPasswordError("Password wajib diisi");
      return;
    }

    setLoading(true);
    try {
      console.log("[auth] Attempting login with email:", email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        console.error("[auth] signInWithPassword error:", error.code, error.message);
        throw error;
      }

      console.log("[auth] Login successful, session established for:", data.user?.email);
      setSuccess(true);
      toast.success("Login berhasil", {
        description: "Mengalihkan ke dashboard...",
      });

      // Brief delay for animation
      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 800);
    } catch (e: any) {
      console.error("[auth] Login failed:", e.code || "unknown", e.message);
      const mapped = mapAuthError(e.message || "");
      setAuthError(mapped);
      toast.error(mapped.title, { description: mapped.desc });
    } finally {
      setLoading(false);
    }
  };

  // Sign up with email + password
  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError(null);
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const signUpEmail = formData.get("email") as string;
    const signUpPassword = formData.get("password") as string;

    if (!name || !signUpEmail || !signUpPassword) {
      toast.error("Semua field wajib diisi");
      return;
    }

    const emailErr = validateEmail(signUpEmail);
    if (emailErr) {
      toast.error(emailErr);
      return;
    }
    if (signUpPassword.length < 8) {
      toast.error("Password minimal 8 karakter");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: signUpEmail,
        password: signUpPassword,
        options: {
          data: { name, role: "nutritionist" },
        },
      });
      if (error) throw error;

      if (data.session) {
        setSuccess(true);
        toast.success("Akun dibuat", { description: "Login berhasil, mengalihkan..." });
        setTimeout(() => {
          router.push("/");
          router.refresh();
        }, 800);
      } else {
        toast.success("Akun dibuat", {
          description: "Cek email Anda untuk konfirmasi pendaftaran.",
        });
      }
    } catch (e: any) {
      const mapped = mapAuthError(e.message || "");
      setAuthError(mapped);
      toast.error(mapped.title, { description: mapped.desc });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* ============================================================ */}
      {/* LEFT — HERO SECTION (hidden on mobile)                       */}
      {/* ============================================================ */}
      <div className="relative hidden overflow-hidden lg:flex lg:w-1/2 xl:w-[55%]">
        {/* Gradient background */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, #0F766E 0%, #14B8A6 50%, #0891B2 100%)",
          }}
        />

        {/* Blurred decorative circles */}
        <motion.div
          className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-cyan-300/20 blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-32 -right-20 h-[28rem] w-[28rem] rounded-full bg-emerald-300/20 blur-3xl"
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        <motion.div
          className="absolute left-1/2 top-1/3 h-64 w-64 rounded-full bg-teal-200/10 blur-3xl"
          animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />

        {/* DNA / molecule pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cg fill='none' stroke='white' stroke-width='1'%3E%3Ccircle cx='30' cy='30' r='4'/%3E%3Ccircle cx='10' cy='10' r='2'/%3E%3Ccircle cx='50' cy='50' r='2'/%3E%3Ccircle cx='50' cy='10' r='2'/%3E%3Ccircle cx='10' cy='50' r='2'/%3E%3Cpath d='M10 10 L30 30 L50 50'/%3E%3Cpath d='M50 10 L30 30 L10 50'/%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        {/* Floating nutrition/medical icons */}
        {FLOATING_ICONS.map(({ Icon, className, delay, color }, i) => (
          <motion.div
            key={i}
            className={`absolute ${className} ${color}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{
              opacity: [0, 0.8, 0.8, 0],
              y: [20, -10, 0, -20],
              x: [0, 5, -5, 0],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              delay,
              ease: "easeInOut",
            }}
          >
            <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-sm ring-1 ring-white/20">
              <Icon className="h-6 w-6" />
            </div>
          </motion.div>
        ))}

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-10 xl:p-16 w-full">
          {/* Logo + Title */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="flex items-center gap-3"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md ring-1 ring-white/30">
                <HeartPulse className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white">
                CareLivia
              </span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-12 xl:mt-20"
            >
              <h1 className="text-4xl font-bold leading-tight text-white xl:text-5xl">
                Clinical Nutrition
                <br />
                Management System
              </h1>
              <p className="mt-4 text-lg text-teal-50/90 xl:text-xl">
                Smart Clinical Nutrition Decision Support System untuk praktik
                gizi profesional.
              </p>
            </motion.div>

            {/* Compliance Badges */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-8 flex flex-wrap gap-2"
            >
              {COMPLIANCE_BADGES.map((badge, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="bg-white/10 text-white ring-1 ring-white/20 backdrop-blur-sm hover:bg-white/15"
                >
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  {badge}
                </Badge>
              ))}
            </motion.div>
          </div>

          {/* Floating glass card — feature highlight */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-12"
          >
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Sparkles, label: "AI Meal Plan", desc: "Isi Piringku Kemenkes RI" },
                { icon: Activity, label: "Clinical Engine", desc: "11-step CareLivia formula" },
                { icon: Brain, label: "AI Reasoning", desc: "Evaluasi klinis otomatis" },
                { icon: ShieldCheck, label: "Supabase Secure", desc: "RLS + PostgreSQL" },
              ].map((feat, i) => (
                <motion.div
                  key={i}
                  whileHover={{ y: -4 }}
                  className="flex items-start gap-3 rounded-2xl bg-white/10 p-4 backdrop-blur-md ring-1 ring-white/20"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
                    <feat.icon className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{feat.label}</p>
                    <p className="text-[11px] text-teal-50/80">{feat.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Footer */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="mt-8 text-xs text-teal-50/70"
          >
            © 2026 CareLivia CNMS · Powered by CareLivia AI Engine
          </motion.p>
        </div>
      </div>

      {/* ============================================================ */}
      {/* RIGHT — LOGIN CARD                                           */}
      {/* ============================================================ */}
      <div className="relative flex w-full items-center justify-center overflow-hidden bg-background p-4 lg:w-1/2 xl:w-[45%]">
        {/* Subtle background pattern for right side */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Cg fill='%230F766E' fill-opacity='1'%3E%3Cpath d='M0 0h1v1H0z'/%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        </div>

        {/* Floating gradient orbs */}
        <motion.div
          className="pointer-events-none absolute -right-20 top-10 h-64 w-64 rounded-full bg-teal-500/5 blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div
          className="pointer-events-none absolute -left-20 bottom-10 h-72 w-72 rounded-full bg-cyan-500/5 blur-3xl"
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 10, repeat: Infinity, delay: 1 }}
        />

        {/* Mobile header (visible only on mobile) */}
        <div className="absolute left-0 top-0 flex w-full items-center justify-center gap-2 p-6 lg:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-cyan-600 text-white shadow-lg">
            <HeartPulse className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight">CareLivia</span>
        </div>

        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 w-full max-w-md"
        >
          <div className="rounded-3xl border border-border/60 bg-card p-8 shadow-2xl sm:p-10">
            {/* Logo for desktop */}
            <div className="mb-6 hidden lg:block">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-600 to-cyan-600 text-white shadow-lg">
                <HeartPulse className="h-6 w-6" />
              </div>
            </div>

            {/* Header */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Welcome Back
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Sign in to continue your clinical nutrition workflow.
              </p>
            </div>

            {/* Auth Error Alert */}
            <AnimatePresence>
              {authError && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                    <div>
                      <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">
                        {authError.title}
                      </p>
                      <p className="text-xs text-rose-600/80 dark:text-rose-400/80">
                        {authError.desc}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Success Overlay */}
            <AnimatePresence>
              {success && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 flex items-center justify-center rounded-3xl bg-card/95 backdrop-blur-sm"
                >
                  <div className="text-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 15 }}
                      className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10"
                    >
                      <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                    </motion.div>
                    <p className="text-lg font-semibold text-foreground">
                      Login Berhasil
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Mengalihkan ke dashboard...
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tabs: Sign In / Sign Up */}
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Masuk</TabsTrigger>
                <TabsTrigger value="signup">Daftar</TabsTrigger>
              </TabsList>

              {/* ===== SIGN IN ===== */}
              <TabsContent value="signin" className="mt-6">
                <form onSubmit={handleSignIn} className="space-y-4">
                  {/* Email */}
                  <div className="space-y-1.5">
                    <Label htmlFor="signin-email" className="text-xs font-medium">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail
                        className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors ${
                          emailError ? "text-rose-500" : "text-muted-foreground"
                        }`}
                      />
                      <Input
                        id="signin-email"
                        type="email"
                        name="email"
                        placeholder="Enter your email"
                        aria-label="Email address"
                        aria-invalid={!!emailError}
                        autoComplete="email"
                        value={email}
                        onChange={(e) => handleEmailChange(e.target.value)}
                        className={`h-11 pl-10 transition-all focus-visible:ring-2 focus-visible:ring-teal-500/40 ${
                          emailError
                            ? "border-rose-500/50 focus-visible:ring-rose-500/30"
                            : ""
                        }`}
                        required
                      />
                    </div>
                    <AnimatePresence>
                      {emailError && (
                        <motion.p
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="text-xs text-rose-600"
                        >
                          {emailError}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="signin-password" className="text-xs font-medium">
                      Password
                    </Label>
                    <div className="relative">
                      <Lock
                        className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors ${
                          passwordError ? "text-rose-500" : "text-muted-foreground"
                        }`}
                      />
                      <Input
                        id="signin-password"
                        type={showPassword ? "text" : "password"}
                        name="password"
                        placeholder="Enter your password"
                        aria-label="Password"
                        aria-invalid={!!passwordError}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => handlePasswordChange(e.target.value)}
                        className={`h-11 pl-10 pr-10 transition-all focus-visible:ring-2 focus-visible:ring-teal-500/40 ${
                          passwordError
                            ? "border-rose-500/50 focus-visible:ring-rose-500/30"
                            : ""
                        }`}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <AnimatePresence>
                      {passwordError && (
                        <motion.p
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="text-xs text-rose-600"
                        >
                          {passwordError}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Remember + Forgot */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox id="remember" />
                      <Label
                        htmlFor="remember"
                        className="cursor-pointer text-xs text-muted-foreground"
                      >
                        Remember Me
                      </Label>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        toast.info("Fitur reset password", {
                          description: "Hubungi administrator untuk reset password.",
                        })
                      }
                      className="text-xs font-medium text-teal-600 transition-colors hover:text-teal-700 dark:text-teal-400"
                    >
                      Forgot Password?
                    </button>
                  </div>

                  {/* Login Button */}
                  <Button
                    type="submit"
                    disabled={loading}
                    className="relative h-[52px] w-full overflow-hidden rounded-xl text-base font-semibold text-white shadow-lg transition-all hover:shadow-xl disabled:opacity-70"
                    style={{
                      background:
                        "linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)",
                    }}
                  >
                    {loading ? (
                      <motion.span
                        className="flex items-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </motion.span>
                    ) : (
                      <motion.span
                        className="flex items-center"
                        whileHover={{ x: 2 }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        Sign In
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </motion.span>
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* ===== SIGN UP ===== */}
              <TabsContent value="signup" className="mt-6">
                <form onSubmit={handleSignUp} className="space-y-4">
                  {/* Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-name" className="text-xs font-medium">
                      Nama Lengkap
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="signup-name"
                        type="text"
                        name="name"
                        placeholder="dr. Andi Wijaya, Sp.GK"
                        aria-label="Full name"
                        autoComplete="name"
                        className="h-11 pl-10 transition-all focus-visible:ring-2 focus-visible:ring-teal-500/40"
                        required
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-email" className="text-xs font-medium">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        name="email"
                        placeholder="dokter@carelivia.id"
                        aria-label="Email address"
                        autoComplete="email"
                        className="h-11 pl-10 transition-all focus-visible:ring-2 focus-visible:ring-teal-500/40"
                        required
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-password" className="text-xs font-medium">
                      Password (min. 8 karakter)
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type={showSignUpPassword ? "text" : "password"}
                        name="password"
                        placeholder="••••••••"
                        aria-label="Password"
                        autoComplete="new-password"
                        minLength={8}
                        className="h-11 pl-10 pr-10 transition-all focus-visible:ring-2 focus-visible:ring-teal-500/40"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                        aria-label={
                          showSignUpPassword ? "Hide password" : "Show password"
                        }
                      >
                        {showSignUpPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Sign Up Button */}
                  <Button
                    type="submit"
                    disabled={loading}
                    className="relative h-[52px] w-full overflow-hidden rounded-xl text-base font-semibold text-white shadow-lg transition-all hover:shadow-xl disabled:opacity-70"
                    style={{
                      background:
                        "linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)",
                    }}
                  >
                    {loading ? (
                      <motion.span
                        className="flex items-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                      </motion.span>
                    ) : (
                      <motion.span
                        className="flex items-center"
                        whileHover={{ x: 2 }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        Create Account
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </motion.span>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {/* Divider */}
            <div className="my-6 flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs font-medium text-muted-foreground">
                OR
              </span>
              <Separator className="flex-1" />
            </div>

            {/* OAuth Providers */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl border-border/60 transition-all hover:bg-muted/40"
                onClick={() =>
                  toast.info("Google OAuth", {
                    description: "Integrasi OAuth akan segera tersedia.",
                  })
                }
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span className="text-sm">Google</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl border-border/60 transition-all hover:bg-muted/40"
                onClick={() =>
                  toast.info("Microsoft OAuth", {
                    description: "Integrasi OAuth akan segera tersedia.",
                  })
                }
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 23 23">
                  <path fill="#F25022" d="M1 1h10v10H1z" />
                  <path fill="#00A4EF" d="M1 12h10v10H1z" />
                  <path fill="#7FBA00" d="M12 1h10v10H12z" />
                  <path fill="#FFB900" d="M12 12h10v10H12z" />
                </svg>
                <span className="text-sm">Microsoft</span>
              </Button>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-[11px] text-muted-foreground">
              © 2026 CareLivia CNMS · Powered by CareLivia AI Engine
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground/70">
              ESPEN · ASPEN · WHO · PERKENI · KDIGO
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
