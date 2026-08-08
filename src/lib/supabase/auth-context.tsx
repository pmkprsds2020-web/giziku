"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  const supabase = React.useMemo(() => {
    try {
      return createClient();
    } catch {
      return null;
    }
  }, []);

  React.useEffect(() => {
    let mounted = true;

    if (!supabase) {
      console.error("[auth] Supabase client not available — env vars may be missing");
      setUser(null);
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!mounted) return;

      if (error) {
        console.error("[auth] getSession error:", error.message);
        setUser(null);
        setLoading(false);
        return;
      }

      if (session?.user) {
        console.log("[auth] Session valid, user:", session.user.email);
        setUser(session.user);
      } else {
        console.log("[auth] No active session — user not logged in");
        setUser(null);
      }
      setLoading(false);
    }).catch((e) => {
      console.error("[auth] getSession failed:", e);
      if (mounted) {
        setUser(null);
        setLoading(false);
      }
    });

    // Listen for auth changes (login, logout, token refresh, token expired)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      console.log("[auth] Auth state changed:", event, session?.user?.email || "no user");

      if (event === "SIGNED_OUT" || event === "TOKEN_REFRESH_FAILED") {
        console.warn("[auth] Session expired or signed out — redirecting to login");
        setUser(null);
        setLoading(false);
        // Only redirect if we're not already on the login page
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
          window.location.href = "/login";
        }
      } else {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = async () => {
    if (!supabase) {
      window.location.href = "/login";
      return;
    }
    try {
      await supabase.auth.signOut();
      console.log("[auth] Signed out successfully");
    } catch (e) {
      console.error("[auth] Sign out error:", e);
    }
    setUser(null);
    // Clear all storage
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return React.useContext(AuthContext);
}
