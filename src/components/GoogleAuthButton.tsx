"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  LogOut,
  Trophy,
  Award,
  Gamepad2,
  X,
  Loader2,
  Sparkles,
  ShieldCheck,
  User,
  ExternalLink,
} from "lucide-react";

export const GoogleAuthButton: React.FC = () => {
  const { user, isLoggedIn, logout, loginWithCredential } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const googleBtnContainerRef = useRef<HTMLDivElement>(null);
  const userBtnRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when flying modal is open
  useEffect(() => {
    if (showModal) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [showModal]);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  // Track position for logged-in user dropdown
  useEffect(() => {
    if (!showUserDropdown || !userBtnRef.current) return;
    const updatePos = () => {
      if (!userBtnRef.current) return;
      const rect = userBtnRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 8,
        right: Math.max(12, window.innerWidth - rect.right),
      });
    };
    updatePos();
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
    };
  }, [showUserDropdown]);

  // Initialize Google Identity Services (GIS) when modal opens
  useEffect(() => {
    if (!showModal) return;

    let checkTimer: NodeJS.Timeout | null = null;

    const setupGoogle = () => {
      const win = typeof window !== "undefined" ? (window as any) : {};
      const g = win.google;
      if (g?.accounts?.id && clientId && googleBtnContainerRef.current) {
        googleBtnContainerRef.current.innerHTML = "";
        g.accounts.id.initialize({
          client_id: clientId,
          callback: async (response: any) => {
            if (response.credential) {
              setIsSubmitting(true);
              setAuthError(null);
              const ok = await loginWithCredential(response.credential);
              setIsSubmitting(false);
              if (ok) {
                setShowModal(false);
              } else {
                setAuthError("Gagal memverifikasi akun Google ke database. Coba lagi.");
              }
            }
          },
        });

        g.accounts.id.renderButton(googleBtnContainerRef.current, {
          theme: "filled_black",
          size: "large",
          shape: "pill",
          text: "continue_with",
          locale: "id",
          width: 280,
        });
      } else if (!g?.accounts?.id) {
        // Wait briefly if script is still parsing
        checkTimer = setTimeout(setupGoogle, 150);
      }
    };

    const win = typeof window !== "undefined" ? (window as any) : {};
    if (!win.google && !document.getElementById("google-gsi-script")) {
      const script = document.createElement("script");
      script.id = "google-gsi-script";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => setupGoogle();
      document.body.appendChild(script);
    } else {
      setupGoogle();
    }

    return () => {
      if (checkTimer) clearTimeout(checkTimer);
    };
  }, [showModal, clientId, loginWithCredential]);

  // ==============================================================
  // 1. LOGGED IN STATE
  // ==============================================================
  if (isLoggedIn && user) {
    return (
      <div className="relative">
        <button
          ref={userBtnRef}
          onClick={() => setShowUserDropdown(!showUserDropdown)}
          className="flex items-center gap-2 bg-surfaceRaised hover:bg-zinc-800/80 border border-surfaceBorderHover rounded-full py-1.5 pl-1.5 pr-3 text-xs font-medium text-white transition active:scale-95 shadow-sm cursor-pointer"
        >
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatar}
              alt={user.name}
              className="w-6 h-6 rounded-full object-cover border border-surfaceBorder shrink-0"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-accent/20 border border-accent/40 text-accent flex items-center justify-center font-bold text-[10px] shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="max-w-[100px] truncate font-semibold">{user.name}</span>
          <span className="text-[10px] font-mono text-accent font-bold px-1.5 py-0.5 rounded-full bg-accent/10 border border-accent/20">
            {user.total_score}
          </span>
        </button>

        {/* Floating User Stats Dropdown Menu */}
        {showUserDropdown &&
          mounted &&
          dropdownPos &&
          createPortal(
            <>
              {/* Dismiss backdrop */}
              <div
                className="fixed inset-0 z-[80]"
                onClick={() => setShowUserDropdown(false)}
              />
              <div
                className="fixed z-[90] w-72 bg-[#121216] border border-zinc-800 rounded-3xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.85)] flex flex-col gap-3.5 animate-scale-up"
                style={{ top: dropdownPos.top, right: dropdownPos.right }}
              >
                {/* User Info Header */}
                <div className="flex items-center gap-3 pb-3 border-b border-zinc-800/80">
                  {user.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-11 h-11 rounded-2xl object-cover border border-zinc-700 shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-2xl bg-accent/20 border border-accent/40 text-accent flex items-center justify-center font-bold text-lg shrink-0">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-extrabold text-sm text-white truncate">{user.name}</p>
                    <p className="text-[11px] text-zinc-400 truncate font-mono">{user.email}</p>
                  </div>
                </div>

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-zinc-900/90 p-2.5 rounded-2xl border border-zinc-800">
                    <Trophy className="w-3.5 h-3.5 text-accent mx-auto mb-1" />
                    <span className="block text-xs font-black text-white font-mono">{user.total_score}</span>
                    <span className="text-[9px] text-zinc-400 font-mono">Poin</span>
                  </div>

                  <div className="bg-zinc-900/90 p-2.5 rounded-2xl border border-zinc-800">
                    <Gamepad2 className="w-3.5 h-3.5 text-sky-400 mx-auto mb-1" />
                    <span className="block text-xs font-black text-white font-mono">{user.games_played}</span>
                    <span className="text-[9px] text-zinc-400 font-mono">Game</span>
                  </div>

                  <div className="bg-zinc-900/90 p-2.5 rounded-2xl border border-zinc-800">
                    <Award className="w-3.5 h-3.5 text-amber-400 mx-auto mb-1" />
                    <span className="block text-xs font-black text-white font-mono">{user.wins}</span>
                    <span className="text-[9px] text-zinc-400 font-mono">Menang</span>
                  </div>
                </div>

                {/* Action Links */}
                <div className="flex flex-col gap-1.5 pt-1">
                  <Link
                    href="/profile"
                    onClick={() => setShowUserDropdown(false)}
                    className="w-full py-2.5 px-3.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white text-xs font-semibold border border-zinc-800 transition flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-accent" />
                      <span>Profil &amp; Statistik</span>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                  </Link>

                  <button
                    onClick={() => {
                      logout();
                      setShowUserDropdown(false);
                    }}
                    className="w-full py-2.5 px-3.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 text-xs font-semibold border border-rose-500/20 transition flex items-center justify-center gap-2 cursor-pointer mt-1"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Keluar Akun</span>
                  </button>
                </div>
              </div>
            </>,
            document.body
          )}
      </div>
    );
  }

  // ==============================================================
  // 2. LOGGED OUT STATE — CLEAN TRIGGER BUTTON + TRUE FLYING MODAL
  // ==============================================================
  return (
    <>
      <button
        onClick={() => {
          setShowModal(true);
          setAuthError(null);
        }}
        className="flex items-center gap-2 bg-white hover:bg-zinc-100 text-zinc-950 font-bold py-1.5 px-4 rounded-full text-xs shadow-md transition active:scale-95 cursor-pointer hover:shadow-white/20"
      >
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
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
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        <span>Masuk Google</span>
      </button>

      {/* Official Centered Flying Modal (Portalled directly to <body>) */}
      {showModal &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-fade-in"
            onClick={() => setShowModal(false)}
          >
            <div
              className="relative w-full max-w-sm my-auto bg-[#121216] border border-zinc-800 rounded-3xl p-6 sm:p-7 shadow-2xl flex flex-col items-center text-center gap-4 animate-scale-up"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button Top Right */}
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 p-2 rounded-full text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 transition active:scale-95 cursor-pointer"
                aria-label="Tutup modal"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Glowing Icon Badge */}
              <div className="w-14 h-14 rounded-2xl bg-accent/15 border border-accent/30 text-accent flex items-center justify-center shadow-lg shadow-accent/20 mt-1">
                <ShieldCheck className="w-7 h-7" />
              </div>

              {/* Title & Subtitle */}
              <div>
                <h3 className="text-lg font-black text-white tracking-tight">Masuk Akun Resmi</h3>
                <p className="text-xs text-zinc-400 leading-relaxed mt-1 px-2">
                  Simpan rekor skor, kustomisasi avatar &amp; profil, serta raih posisi teratas di{" "}
                  <span className="text-accent font-semibold">Papan Peringkat Nasional</span>!
                </p>
              </div>

              {/* Perks / Benefits Pill List */}
              <div className="w-full bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-3 flex flex-col gap-2 text-left text-[11px] text-zinc-300">
                <div className="flex items-center gap-2">
                  <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Skor tersimpan permanen &amp; tercatat di leaderboard</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span>Kustomisasi foto avatar, bio, dan artis favorit</span>
                </div>
              </div>

              {/* Error Message */}
              {authError && (
                <div className="w-full bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs p-3 rounded-2xl text-left leading-relaxed">
                  {authError}
                </div>
              )}

              {/* Official Google GSI Render Container */}
              <div className="flex flex-col items-center justify-center w-full py-2 min-h-[50px]">
                {isSubmitting ? (
                  <div className="flex items-center gap-2 text-xs font-mono text-accent py-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memverifikasi akun Google...</span>
                  </div>
                ) : clientId ? (
                  <div
                    ref={googleBtnContainerRef}
                    className="min-h-[44px] flex items-center justify-center w-full"
                  />
                ) : (
                  <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col gap-2 text-center text-xs text-zinc-300 w-full">
                    <span className="font-bold text-amber-400 flex items-center justify-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      <span>Google OAuth Setup</span>
                    </span>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Client ID Google belum disetel di environment. Tambahkan{" "}
                      <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code>.
                    </p>
                  </div>
                )}
              </div>

              {/* Divider & Guest CTA */}
              <div className="w-full pt-3 border-t border-zinc-800/80 text-center">
                <button
                  onClick={() => setShowModal(false)}
                  className="text-xs text-zinc-400 hover:text-white transition font-mono hover:underline cursor-pointer"
                >
                  Lanjut sebagai Tamu ➔
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
