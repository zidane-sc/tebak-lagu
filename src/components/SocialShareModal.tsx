"use client";

import React, { useState, useRef } from "react";
import {
  Share2,
  Check,
  Copy,
  X,
  Sparkles,
  MessageCircle,
  Camera,
  Download,
  Flame,
  Music,
} from "lucide-react";

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
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [storySuccess, setStorySuccess] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  if (!isOpen) return null;

  const scoreText = score !== undefined ? `Skorku: ${score} Pts 🔥` : "Coba tebak lagunya!";
  const rankText = rank ? `Peringkat #${rank} Nasional 🏆` : "";
  const shareMessage = `🎵 Tebak Lagu · Audio Trivia\n${modeTitle} ${scoreText} ${rankText}\n\nBerani adu telinga dewa tebak lagu bareng aku? Cek link-nya sekarang:\n👉 ${shareUrl}`;

  // 1. WhatsApp Direct Share
  const handleWhatsAppShare = () => {
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareMessage)}`;
    window.open(waUrl, "_blank");
  };

  // 2. Generate Instagram Story Image (9:16 Canvas) & Native Share / Download
  const handleInstagramStory = async () => {
    setIsGeneratingStory(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        // Deep Obsidian Radial Background
        const bgGrad = ctx.createRadialGradient(540, 600, 100, 540, 960, 1200);
        bgGrad.addColorStop(0, "#1a1230");
        bgGrad.addColorStop(0.5, "#0b0c14");
        bgGrad.addColorStop(1, "#050608");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 1080, 1920);

        // Ambient Mesh Neon Glows
        const drawGlow = (x: number, y: number, r: number, color: string) => {
          const g = ctx.createRadialGradient(x, y, 10, x, y, r);
          g.addColorStop(0, color);
          g.addColorStop(1, "transparent");
          ctx.fillStyle = g;
          ctx.fillRect(x - r, y - r, r * 2, r * 2);
        };
        drawGlow(300, 450, 450, "rgba(34, 197, 94, 0.25)"); // Emerald Glow
        drawGlow(780, 750, 500, "rgba(168, 85, 247, 0.28)"); // Violet Glow
        drawGlow(540, 1400, 600, "rgba(245, 158, 11, 0.18)"); // Amber Glow

        // Card Container Frame (Frosted Glass simulation)
        ctx.save();
        ctx.fillStyle = "rgba(22, 24, 38, 0.85)";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 4;
        ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
        ctx.shadowBlur = 60;
        ctx.beginPath();
        ctx.roundRect(100, 320, 880, 1280, [60]);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Brand Pill
        ctx.fillStyle = "rgba(34, 197, 94, 0.15)";
        ctx.strokeStyle = "rgba(34, 197, 94, 0.4)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(340, 400, 400, 75, [37]);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#22c55e";
        ctx.font = "bold 34px -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("🎧 JUKEBOX TRIVIA", 540, 450);

        // App Big Title
        ctx.fillStyle = "#ffffff";
        ctx.font = "900 82px -apple-system, sans-serif";
        ctx.fillText("TEBAK LAGU", 540, 570);

        // Vinyl Record Graphic (Centerpiece)
        const centerX = 540;
        const centerY = 830;
        const radius = 210;

        // Vinyl Outer Ring
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fillStyle = "#0c0d12";
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 40;
        ctx.fill();

        // Vinyl Grooves
        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        ctx.lineWidth = 2;
        for (let r = 80; r < radius - 15; r += 16) {
          ctx.beginPath();
          ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Vinyl Label Center
        const centerGrad = ctx.createLinearGradient(centerX - 70, centerY - 70, centerX + 70, centerY + 70);
        centerGrad.addColorStop(0, "#22c55e");
        centerGrad.addColorStop(1, "#8b5cf6");
        ctx.beginPath();
        ctx.arc(centerX, centerY, 70, 0, Math.PI * 2);
        ctx.fillStyle = centerGrad;
        ctx.fill();

        // Vinyl Spindle hole
        ctx.beginPath();
        ctx.arc(centerX, centerY, 18, 0, Math.PI * 2);
        ctx.fillStyle = "#050608";
        ctx.fill();
        ctx.restore();

        // Mode Title
        ctx.fillStyle = "#a1a1aa";
        ctx.font = "bold 38px -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(modeTitle.toUpperCase(), 540, 1130);

        // Big Score Showcase
        if (score !== undefined) {
          ctx.fillStyle = "#facc15";
          ctx.font = "900 110px -apple-system, sans-serif";
          ctx.fillText(`${score} PTS`, 540, 1260);

          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 44px -apple-system, sans-serif";
          ctx.fillText("🏆 TELINGA DEWA!", 540, 1340);
        } else {
          ctx.fillStyle = "#ffffff";
          ctx.font = "900 76px -apple-system, sans-serif";
          ctx.fillText("ADU TELINGA DEWA!", 540, 1280);
        }

        // Subtitle Challenge
        ctx.fillStyle = "#94a3b8";
        ctx.font = "500 36px -apple-system, sans-serif";
        ctx.fillText("Berani tanding tebak lagu bareng aku?", 540, 1430);

        // Bottom CTA Button on Card
        ctx.fillStyle = "#22c55e";
        ctx.beginPath();
        ctx.roundRect(240, 1490, 600, 90, [45]);
        ctx.fill();

        ctx.fillStyle = "#09090b";
        ctx.font = "900 38px -apple-system, sans-serif";
        ctx.fillText("PLAY NOW ➔", 540, 1550);

        // Footer URL at bottom of Story
        ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        ctx.font = "bold 32px -apple-system, sans-serif";
        ctx.fillText("tebak-lagu-live.fly.dev", 540, 1780);

        // Convert to Blob & Share
        canvas.toBlob(async (blob) => {
          if (!blob) return;
          const file = new File([blob], "tebak-lagu-story.png", { type: "image/png" });

          // If navigator.canShare files is available (mobile browser)
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({
                title: "Tebak Lagu Story",
                text: "Adu telinga dewa tebak lagu! 🎧",
                files: [file],
              });
              setStorySuccess(true);
              setIsGeneratingStory(false);
              return;
            } catch (err) {
              // User canceled share
            }
          }

          // Fallback: Download the high-res PNG for IG Story upload
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "tebak-lagu-story.png";
          a.click();
          URL.revokeObjectURL(url);
          setStorySuccess(true);
          setIsGeneratingStory(false);
        }, "image/png");
      }
    } catch (e) {
      console.error("Error creating IG story card:", e);
      setIsGeneratingStory(false);
    }
  };

  // 3. Copy Caption for WhatsApp / Instagram / TikTok
  const handleCopy = () => {
    navigator.clipboard.writeText(shareMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in select-none">
      <div className="bg-surface border border-surfaceBorder rounded-3xl p-6 sm:p-7 max-w-sm w-full flex flex-col gap-4 shadow-2xl relative text-center">
        {/* Header */}
        <div className="w-full flex items-center justify-between pb-1 border-b border-surfaceBorder/60">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-accent" />
            <h3 className="font-bold text-white text-base">Bagikan ke Teman</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full text-muted hover:text-white bg-surfaceRaised border border-surfaceBorder flex items-center justify-center transition"
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

        {/* Share Buttons Grid: 2 Primary Channels */}
        <div className="flex flex-col gap-2 pt-1">
          {/* Instagram Story Card Generator (9:16 Canvas) */}
          <button
            onClick={handleInstagramStory}
            disabled={isGeneratingStory}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:opacity-95 text-white font-black text-xs sm:text-sm shadow-lg shadow-purple-500/25 transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <Camera className="w-4 h-4" />
            <span>
              {isGeneratingStory
                ? "Menyiapkan IG Story..."
                : storySuccess
                ? "Story Siap! Buka Instagram 📸"
                : "Bagikan ke Instagram Story 📸"}
            </span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            {/* WhatsApp Button */}
            <button
              onClick={handleWhatsAppShare}
              className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition active:scale-95 cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 fill-current" />
              <span>WhatsApp</span>
            </button>

            {/* Salin Teks Card */}
            <button
              onClick={handleCopy}
              className="py-3 px-3 rounded-xl bg-surfaceRaised hover:bg-zinc-800 text-muted hover:text-white border border-surfaceBorder text-xs font-mono font-medium flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-accent" />
                  <span className="text-accent font-bold">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-mutedDark" />
                  <span>Salin Teks</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
