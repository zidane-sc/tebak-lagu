"use client";

import React, { useState, useEffect } from "react";
import { Download, X, Smartphone, Sparkles } from "lucide-react";

export const PwaInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already running in standalone PWA mode
    const isApp =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isApp) {
      setIsStandalone(true);
      return;
    }

    // Check if dismissed recently (within 3 days)
    try {
      const dismissed = localStorage.getItem("tebak_lagu_pwa_dismissed");
      if (dismissed && Date.now() - parseInt(dismissed, 10) < 3 * 24 * 60 * 60 * 1000) {
        return;
      }
    } catch {}

    // Android / Chrome / Samsung Internet beforeinstallprompt event
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // iOS Detection
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    if (isIosDevice && !isApp) {
      // Delay showing on iOS so it doesn't annoy user immediately
      const timer = setTimeout(() => setShowBanner(true), 2500);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowBanner(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    try {
      localStorage.setItem("tebak_lagu_pwa_dismissed", Date.now().toString());
    } catch {}
  };

  if (!showBanner || isStandalone) return null;

  return (
    <aside
      aria-label="PWA Install Banner"
      className="fixed bottom-4 left-4 right-4 max-w-md mx-auto z-50 animate-bounce-short"
    >
      <div className="bg-surface/95 backdrop-blur-xl border-2 border-accent/40 rounded-3xl p-4 shadow-2xl shadow-black/80 flex items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-3 min-w-0">
          {/* App Icon */}
          <div className="w-12 h-12 rounded-2xl bg-zinc-950 border border-surfaceBorder overflow-hidden shrink-0 shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/icon-192.png"
              alt="Logo Tebak Lagu"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="text-xs sm:text-sm font-black text-white truncate">
                Install Tebak Lagu
              </h4>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-accent/20 border border-accent/30 text-accent font-bold">
                APP
              </span>
            </div>
            <p className="text-[11px] text-zinc-300 leading-tight mt-0.5">
              {isIos
                ? 'Ketuk Bagikan ➔ "Add to Home Screen"'
                : "Fullscreen murni & minim kuota di layar utama!"}
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {!isIos && deferredPrompt && (
            <button
              onClick={handleInstallClick}
              className="py-2 px-3.5 rounded-xl bg-accent hover:bg-green-500 text-zinc-950 font-black text-xs shadow-md transition active:scale-95 cursor-pointer flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install</span>
            </button>
          )}

          <button
            onClick={handleDismiss}
            className="w-8 h-8 rounded-full bg-surfaceRaised/80 hover:bg-zinc-800 border border-surfaceBorder text-muted hover:text-white flex items-center justify-center transition"
            title="Tutup banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
