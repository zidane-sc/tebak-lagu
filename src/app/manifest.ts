import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tebak Lagu · Audio Trivia",
    short_name: "Tebak Lagu",
    description:
      "Game tebak lagu interaktif dengan mode Heardle audio bertahap, robot speech TTS, dan buzzer multiplayer real-time.",
    start_url: "/",
    id: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#080a0f",
    theme_color: "#080a0f",
    categories: ["games", "music", "entertainment"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Multiplayer Room",
        short_name: "Multiplayer",
        url: "/multiplayer",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Papan Peringkat",
        short_name: "Leaderboard",
        url: "/leaderboard",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
