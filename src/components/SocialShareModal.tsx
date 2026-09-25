"use client";

import React, { useState } from "react";
import { Share2, Check, Copy, X, Sparkles, MessageCircle, Send } from "lucide-react";

interface SocialShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  score?: number;
  rank?: number;
  modeTitle?: string;
  shareUrl?: string;
}

export const SocialShareModal: React.FC<SocialShareModalProps> = ({
  isOpen,
  onClose,
  title,
  score,
  rank,
  modeTitle = "Tebak Lagu",
  shareUrl = "https://tebak-lagu-live.fly.dev/",
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const scoreText = score !== undefined ? `Skorku: ${score} Pts 🔥` : "Coba tebak lagunya!";
  const rankText = rank ? `Peringkat #${rank} Nasional 🏆` : "";
  const shareMessage = `🎵 Tebak Lagu · Audio Trivia\n${modeTitle} ${scoreText} ${rankText}\n\nBerani adu telinga dewa tebak lagu bareng aku? Cek link-nya sekarang:\n👉 ${shareUrl}`;

  // 1. WhatsApp Direct Share
  const handleWhatsAppShare = () => {
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareMessage)}`;
    window.open(waUrl, "_blank");
  };

  // 2. Native Mobile Web Share (Opens Instagram, TikTok, WA, etc.)
  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Tebak Lagu · Audio Trivia",
          text: shareMessage,
          url: shareUrl,
        });
        return;
      } catch (e) {}
    }
    handleCopy();
  };

  // 3. Copy Caption for Instagram / TikTok
  const handleCopy = () => {
    navigator.clipboard.writeText(shareMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in select-none">
      <div className="bg-surface border border-surfaceBorder rounded-3xl p-6 sm:p-7 max-w-sm w-full flex flex-col gap-4 shadow-2xl relative text-center">
        {/* Header */}
        <div className="w-full flex items-center justify-between pb-1 border-b border-surfaceBorder/60">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-accent" />
            <h3 className="font-bold text-white text-base">Bagikan ke Teman</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-white bg-surfaceRaised border border-surfaceBorder transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preview Card */}
        <div className="bg-surfaceRaised border border-surfaceBorder rounded-2xl p-4 text-left flex flex-col gap-2">
          <span className="text-[10px] font-mono text-muted uppercase">Preview Pesan:</span>
          <p className="text-xs text-zinc-200 leading-relaxed font-mono whitespace-pre-line bg-black/30 p-2.5 rounded-xl border border-surfaceBorder/60">
            {shareMessage}
          </p>
        </div>

        {/* Share Buttons Grid */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          {/* WhatsApp Button */}
          <button
            onClick={handleWhatsAppShare}
            className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition active:scale-95 cursor-pointer"
          >
            <MessageCircle className="w-4 h-4 fill-current" />
            <span>WhatsApp</span>
          </button>

          {/* Native Web Share (Instagram, TikTok, dll) */}
          <button
            onClick={handleNativeShare}
            className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:opacity-95 text-white font-bold text-xs shadow-md transition active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Instagram / TikTok</span>
          </button>
        </div>

        {/* Salin Teks Card */}
        <button
          onClick={handleCopy}
          className="w-full py-2.5 px-4 rounded-xl bg-surfaceRaised hover:bg-zinc-800 text-muted hover:text-white border border-surfaceBorder text-xs font-mono font-medium flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-accent" />
              <span className="text-accent font-bold">Pesan Tersalin ke Clipboard!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 text-mutedDark" />
              <span>Salin Teks Lengkap</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
