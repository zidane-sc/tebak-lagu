import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tebak Lagu · 4 Mode Seru (TTS, Humming, Musik, Heardle)",
  description:
    "Game tebak lagu interaktif dengan mode suara robot TTS kaku, gumaman humming, instrumen minus-one, dan potongan detik bertahap.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark">
      <body className="antialiased selection:bg-brandCyan selection:text-black">
        {children}
      </body>
    </html>
  );
}
