"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar: string;
  bio: string;
  favorite_artist: string;
  total_score: number;
  games_played: number;
  wins: number;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  loginWithCredential: (credential: string) => Promise<boolean>;
  logout: () => void;
  syncScore: (pointsGained: number, isWin?: boolean) => Promise<void>;
  refreshProfile: () => Promise<void>;
  saveProfile: (fields: { name?: string; bio?: string; favoriteArtist?: string; avatar?: string }) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoggedIn: false,
  isLoading: true,
  loginWithCredential: async () => false,
  logout: () => {},
  syncScore: async () => {},
  refreshProfile: async () => {},
  saveProfile: async () => false,
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
        fetch(`/api/auth/me`)
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

  // 3. Logout — the session row is deleted server-side too, otherwise a copied
  //    cookie would still authenticate after "log out".
  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {}
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  };

  // 4. Sync Score to DB
  const syncScore = async (pointsGained: number, isWin: boolean = false) => {
    if (!user) return;
    try {
      const res = await fetch("/api/auth/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pointsGained, isWin }),
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

  // 5. Refresh Profile
  const refreshProfile = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/auth/me`);
      const data = await res.json();
      if (res.ok && data.user) {
        setUser(data.user);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data.user));
      }
    } catch {}
  };

  // 6. Save profile fields the player owns
  const saveProfile = async (fields: { name?: string; bio?: string; favoriteArtist?: string; avatar?: string }) => {
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setUser(data.user);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data.user));
        return true;
      }
    } catch (e) {
      console.error("Save profile error:", e);
    }
    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        isLoading,
        loginWithCredential,
        logout,
        syncScore,
        refreshProfile,
        saveProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
