"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar: string;
  total_score: number;
  games_played: number;
  wins: number;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  loginWithCredential: (credential: string) => Promise<boolean>;
  loginManual: (userData: { email: string; name: string; avatar?: string }) => Promise<boolean>;
  logout: () => void;
  syncScore: (pointsGained: number, isWin?: boolean) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoggedIn: false,
  isLoading: true,
  loginWithCredential: async () => false,
  loginManual: async () => false,
  logout: () => {},
  syncScore: async () => {},
  refreshProfile: async () => {},
});

const AUTH_STORAGE_KEY = "tebak_lagu_user_auth";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Load initial user from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setUser(parsed);

        // Fetch fresh stats from DB
        fetch(`/api/auth/me?userId=${parsed.id}`)
          .then((r) => r.json())
          .then((data) => {
            if (data.user) {
              setUser(data.user);
              localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data.user));
            }
          })
          .catch(() => {});
      }
    } catch (e) {
      console.error("Auth load error:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 2. Google OAuth JWT Credential Login
  const loginWithCredential = async (credential: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });

      const data = await res.json();
      if (res.ok && data.user) {
        setUser(data.user);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data.user));
        return true;
      }
    } catch (e) {
      console.error("Login credential error:", e);
    }
    return false;
  };

  // 3. Manual / Fallback Login
  const loginManual = async (userData: { email: string; name: string; avatar?: string }): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userInfo: userData }),
      });

      const data = await res.json();
      if (res.ok && data.user) {
        setUser(data.user);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data.user));
        return true;
      }
    } catch (e) {
      console.error("Login manual error:", e);
    }
    return false;
  };

  // 4. Logout
  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {}
  };

  // 5. Sync Score to DB
  const syncScore = async (pointsGained: number, isWin: boolean = false) => {
    if (!user) return;
    try {
      const res = await fetch("/api/auth/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          pointsGained,
          isWin,
        }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setUser(data.user);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data.user));
      }
    } catch (e) {
      console.error("Sync score error:", e);
    }
  };

  // 6. Refresh Profile
  const refreshProfile = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/auth/me?userId=${user.id}`);
      const data = await res.json();
      if (res.ok && data.user) {
        setUser(data.user);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data.user));
      }
    } catch {}
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        isLoading,
        loginWithCredential,
        loginManual,
        logout,
        syncScore,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
