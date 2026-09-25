import { NextResponse } from "next/server";

// In-memory cache for audio buffers (instant playback)
const ttsCache = new Map<string, { buffer: Buffer; contentType: string }>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const text = searchParams.get("text")?.trim();
  const speed = searchParams.get("speed") || "1"; // "0.8", "1", "1.2"
  const lang = searchParams.get("lang") === "en" ? "en" : "id";

  if (!text) {
    return new NextResponse("Missing text parameter", { status: 400 });
  }

  // Clean text: strip quotes and weird punctuation
  const cleanText = text
    .replace(/['"“”]/g, "")
    .replace(/\n/g, ". ")
    .slice(0, 200)
    .trim();

  const cacheKey = `${cleanText}::${speed}::${lang}`;
  if (ttsCache.has(cacheKey)) {
    const cached = ttsCache.get(cacheKey)!;
    return new Response(new Uint8Array(cached.buffer), {
      headers: {
        "Content-Type": cached.contentType,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  }

  try {
    // Google Translate TTS (monotone robotic voice with proper accent: tl=id for Indo, tl=en for Western)
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(
      cleanText
    )}`;

    const res = await fetch(ttsUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) {
      return new NextResponse("TTS upstream error", { status: 502 });
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = res.headers.get("content-type") || "audio/mpeg";

    // Cache up to 100 clips in memory
    if (ttsCache.size > 100) {
      const firstKey = ttsCache.keys().next().value;
      if (firstKey) ttsCache.delete(firstKey);
    }
    ttsCache.set(cacheKey, { buffer, contentType });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (err: any) {
    console.error("TTS generation error:", err);
    return new NextResponse("TTS server error", { status: 500 });
  }
}
