"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Download, X, Smartphone } from "lucide-react";

/**
 * Slim install prompt. Deliberately logo-free and single-action: on a phone the
 * old card plus a 56px icon ate a third of the viewport before you could even
 * read it.
 */
export const PwaInstallBanner: React.FC<{
  /** "banner" = the floating pill. "inline" = a permanent button you place yourself. */
  variant?: "banner" | "inline";
  className?: string;
  children?: React.ReactNode;
}> = ({ variant = "banner", className = "", children }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const isApp =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isApp) {
      setIsStandalone(true);
      return;
    }

    // Stay hidden for a week after a dismiss, so it never nags twice in a session.
    if (variant === "banner") {
      try {
        const dismissed = localStorage.getItem("tebak_lagu_pwa_dismissed");
        if (dismissed && Date.now() - parseInt(dismissed, 10) < 7 * 24 * 60 * 60 * 1000) {
          return;
        }
      } catch {}
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    if (isIosDevice && variant === "banner") {
      const timer = setTimeout(() => setShowBanner(true), 4000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, [variant]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setShowBanner(false);
      setDeferredPrompt(null);
      return;
    }
    // iOS never fires beforeinstallprompt — walk them through the manual flow.
    if (isIos) setShowIosHelp(true);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    try {
      localStorage.setItem("tebak_lagu_pwa_dismissed", Date.now().toString());
    } catch {}
  };

  if (isStandalone) return null;

  // Inline mode: a permanent, always-available entry point (e.g. inside a menu).
  // Kept icon-only so it never competes with whatever it sits next to.
  if (variant === "inline") {
    return (
      <button
        onClick={handleInstallClick}
        className={className}
        title="Install aplikasi"
        aria-label="Install aplikasi"
      >
        <Download className="h-4 w-4" />
        {children}
      </button>
    );
  }

  if (!showBanner || pathname !== "/") return null;

  return (
    <aside
      aria-label="Install aplikasi"
      className="fixed bottom-3 inset-x-3 z-50 mx-auto max-w-sm animate-slide-up"
    >
      <div className="flex items-center gap-2 rounded-2xl border border-surfaceBorder bg-surface/95 px-2.5 py-2 shadow-lg shadow-black/60 backdrop-blur-xl">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent">
          <Smartphone className="h-3.5 w-3.5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-bold leading-tight text-white">
            {isIos ? "Tambah ke layar utama" : "Install aplikasi"}
          </p>
          <p className="truncate text-[10px] leading-tight text-mutedDark">
            {isIos ? "Bagikan → Add to Home Screen" : "Fullscreen & minim kuota"}
          </p>
        </div>

        {!isIos && deferredPrompt && (
          <button
            onClick={handleInstallClick}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-[11px] font-black text-zinc-950 transition active:scale-95 cursor-pointer"
          >
            <Download className="h-3 w-3" />
            <span>Install</span>
          </button>
        )}

        <button
          onClick={handleDismiss}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-surfaceBorder text-muted transition active:scale-95"
          title="Tutup"
          aria-label="Tutup"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* iOS has no install prompt, so spell the steps out. */}
      {isIos && showIosHelp && (
        <div className="mt-2 rounded-2xl border border-surfaceBorder bg-surface/95 p-3 shadow-lg shadow-black/60 backdrop-blur-xl">
          <ol className="space-y-1.5 text-[11px] leading-tight text-zinc-300">
            <li>1. Tap tombol Bagikan di Safari (kotak dengan panah ke atas)</li>
            <li>2. Pilih &ldquo;Add to Home Screen&rdquo;</li>
            <li>3. Ketuk &ldquo;Add&rdquo; di kanan atas</li>
          </ol>
        </div>
      )}
    </aside>
  );
};
