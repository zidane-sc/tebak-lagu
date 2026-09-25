"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { LogOut, Trophy, Award, Gamepad2, X, Loader2, Sparkles, ShieldCheck } from "lucide-react";

export const GoogleAuthButton: React.FC = () => {
  const { user, isLoggedIn, logout, loginWithCredential } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  // Initialize Google Identity Services (GIS)
  useEffect(() => {
    if (!showModal) return;

    const win = typeof window !== "undefined" ? (window as any) : {};

    // Load Google GSI Script if not loaded
    if (!win.google && !document.getElementById("google-gsi-script")) {
      const script = document.createElement("script");
      script.id = "google-gsi-script";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);

      script.onload = () => {
        setupGoogleButton();
      };
    } else {
      setupGoogleButton();
    }

    function setupGoogleButton() {
      const g = typeof window !== "undefined" ? (window as any).google : undefined;
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
      }
    }
  }, [showModal, clientId, loginWithCredential]);

  // LOGGED IN STATE
  if (isLoggedIn && user) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 bg-surfaceRaised hover:bg-zinc-800 border border-surfaceBorder rounded-full py-1 pl-1.5 pr-3 text-xs font-medium text-white transition active:scale-95 shadow-sm"
        >
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatar}
              alt={user.name}
              className="w-6 h-6 rounded-full object-cover border border-surfaceBorder"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-accent/20 border border-accent/40 text-accent flex items-center justify-center font-bold text-[10px]">
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="max-w-[110px] truncate font-semibold">{user.name}</span>
          <span className="text-[10px] font-mono text-accent font-bold">
            {user.total_score} pts
          </span>
        </button>

        {/* User Stats Dropdown */}
        {showDropdown && (
          <div className="absolute right-0 top-full mt-2 w-64 bg-surface border border-surfaceBorder rounded-2xl p-4 shadow-2xl z-50 animate-fade-in flex flex-col gap-3">
            <div className="flex items-center gap-2.5 pb-3 border-b border-surfaceBorder">
              {user.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-10 h-10 rounded-full object-cover border border-surfaceBorder shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-accent/20 border border-accent/40 text-accent flex items-center justify-center font-bold text-base shrink-0">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-bold text-sm text-white truncate">{user.name}</p>
                <p className="text-[10px] text-muted truncate font-mono">{user.email}</p>
              </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-surfaceRaised p-2 rounded-xl border border-surfaceBorder">
                <Trophy className="w-3.5 h-3.5 text-accent mx-auto mb-1" />
                <span className="block text-xs font-bold text-white font-mono">{user.total_score}</span>
                <span className="text-[9px] text-muted font-mono">Poin</span>
              </div>

              <div className="bg-surfaceRaised p-2 rounded-xl border border-surfaceBorder">
                <Gamepad2 className="w-3.5 h-3.5 text-sky-400 mx-auto mb-1" />
                <span className="block text-xs font-bold text-white font-mono">{user.games_played}</span>
                <span className="text-[9px] text-muted font-mono">Game</span>
              </div>

              <div className="bg-surfaceRaised p-2 rounded-xl border border-surfaceBorder">
                <Award className="w-3.5 h-3.5 text-amber-400 mx-auto mb-1" />
                <span className="block text-xs font-bold text-white font-mono">{user.wins}</span>
                <span className="text-[9px] text-muted font-mono">Menang</span>
              </div>
            </div>

            <button
              onClick={() => {
                logout();
                setShowDropdown(false);
              }}
              className="w-full mt-1 py-2 px-3 rounded-xl bg-surfaceRaised hover:bg-red-500/20 text-muted hover:text-red-400 text-xs font-medium border border-surfaceBorder transition flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar Akun</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // LOGGED OUT BUTTON
  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2 bg-white hover:bg-zinc-100 text-zinc-950 font-bold py-1.5 px-3.5 rounded-full text-xs shadow-sm transition active:scale-95 cursor-pointer"
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

      {/* Official Google Auth Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface border border-surfaceBorder rounded-3xl p-6 sm:p-7 max-w-sm w-full flex flex-col items-center text-center gap-4 shadow-2xl relative">
            <div className="w-full flex items-center justify-between pb-1 border-b border-surfaceBorder/60">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-accent" />
                <h3 className="font-bold text-white text-base">Masuk Akun Resmi</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-muted hover:text-white bg-surfaceRaised border border-surfaceBorder transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Masuk aman dengan akun Google. Poin dan rekormu akan tersimpan permanen di database serta tampil di Papan Peringkat Nasional!
            </p>

            {authError && (
              <div className="w-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-2.5 rounded-xl">
                {authError}
              </div>
            )}

            {/* Official Google GSI Container */}
            <div className="flex flex-col items-center justify-center w-full py-3 min-h-[50px]">
              {isSubmitting ? (
                <div className="flex items-center gap-2 text-xs font-mono text-accent">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memverifikasi akun Google...</span>
                </div>
              ) : clientId ? (
                <div ref={googleBtnContainerRef} className="min-h-[44px] flex items-center justify-center" />
              ) : (
                <div className="bg-surfaceRaised border border-surfaceBorder p-4 rounded-2xl flex flex-col gap-2 text-center text-xs text-zinc-300">
                  <span className="font-bold text-amber-400 flex items-center justify-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    <span>Google OAuth Setup</span>
                  </span>
                  <p className="text-[11px] text-muted leading-relaxed">
                    Client ID Google belum disetel di environment. Tambahkan <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> di Google Cloud Console.
                  </p>
                  <p className="text-[10px] text-accent font-mono pt-1">
                    Kamu tetap bisa langsung bermain seru sebagai Tamu tanpa login!
                  </p>
                </div>
              )}
            </div>

            <div className="w-full pt-2 border-t border-surfaceBorder text-center">
              <button
                onClick={() => setShowModal(false)}
                className="text-xs text-muted hover:text-white transition font-mono"
              >
                Lanjut Bermain Sebagai Tamu ➔
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
