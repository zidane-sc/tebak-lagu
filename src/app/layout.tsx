import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  title: "Tebak Lagu · Audio Trivia (TTS & Heardle)",
  description:
    "Game tebak lagu interaktif dengan mode suara robot TTS kaku dan potongan detik bertahap Heardle.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark">
      <body className="antialiased selection:bg-brandCyan selection:text-black">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
