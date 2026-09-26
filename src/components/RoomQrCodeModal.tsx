"use client";

import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import { X, Copy, Check, QrCode, Share2, Smartphone } from "lucide-react";

interface RoomQrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
}

export const RoomQrCodeModal: React.FC<RoomQrCodeModalProps> = ({
  isOpen,
  onClose,
  roomCode,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://tebak-lagu-live.fly.dev";
  const joinUrl = `${origin}/multiplayer?room=${roomCode.toUpperCase()}`;

  useEffect(() => {
    if (!isOpen || !roomCode) return;

    QRCode.toDataURL(joinUrl, {
      width: 320,
      margin: 1.5,
      color: {
        dark: "#09090b",
        light: "#ffffff",
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("Error generating QR:", err));
  }, [isOpen, roomCode, joinUrl]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-sm bg-surface border border-surfaceBorder rounded-3xl p-6 text-center shadow-2xl flex flex-col items-center gap-4 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-surfaceRaised border border-surfaceBorder text-muted hover:text-white flex items-center justify-center transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Title */}
        <div className="flex flex-col items-center gap-1">
          <div className="w-10 h-10 rounded-xl bg-accentDim border border-accent/30 flex items-center justify-center text-accent">
            <QrCode className="w-5 h-5" />
          </div>
          <h3 className="font-extrabold text-lg text-white mt-1">Scan untuk Masuk Room</h3>
          <p className="text-xs text-muted">Arahkan kamera HP temanmu ke QR Code di bawah</p>
        </div>

        {/* QR Code Container */}
        <div className="bg-white p-3.5 rounded-2xl shadow-xl border border-zinc-300 flex items-center justify-center">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt={`QR Code Room ${roomCode}`}
              className="w-48 h-48 sm:w-56 sm:h-56 object-contain rounded-lg"
            />
          ) : (
            <div className="w-48 h-48 flex items-center justify-center text-xs text-zinc-600 font-mono">
              Membuat QR Code...
            </div>
          )}
        </div>

        {/* Room Code Badge */}
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[10px] font-mono text-muted uppercase">KODE ROOM:</span>
          <span className="text-2xl font-black font-mono tracking-widest text-accent">
            {roomCode.toUpperCase()}
          </span>
        </div>

        {/* Actions */}
        <div className="w-full flex flex-col gap-2 pt-1">
          <button
            onClick={handleCopyLink}
            className="w-full py-2.5 px-4 rounded-xl bg-accent hover:bg-green-500 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer shadow-md"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? "Link Berhasil Disalin!" : "Salin Link Undangan"}</span>
          </button>

          <a
            href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
              `🎮 Yuk mabar Tebak Lagu bareng aku!\nKlik link ini untuk langsung gabung room:\n👉 ${joinUrl}`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2 px-3 rounded-xl bg-surfaceRaised hover:bg-zinc-800 border border-surfaceBorder text-muted hover:text-white font-medium text-xs flex items-center justify-center gap-1.5 transition"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Kirim via WhatsApp</span>
          </a>
        </div>
      </div>
    </div>
  );
};
