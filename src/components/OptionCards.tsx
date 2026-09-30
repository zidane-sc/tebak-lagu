"use client";

import React from "react";
import { sfx } from "@/lib/sound-fx";

/**
 * A row of large tap targets instead of a select or a row of small chips.
 *
 * The solo launcher used four text chips and the multiplayer room panel used
 * three, so the same choice looked different on the two screens and neither
 * matched the app's own visual language — a "choose one" control should look the
 * same everywhere. Each option carries a value and a caption so the difference
 * between "3" and "10" is legible without opening anything.
 */
export function OptionCards<T extends string | number = string | number>({
  label,
  options,
  value,
  onChange,
  columns = 3,
  size = "md",
}: {
  label: string;
  options: readonly { value: T; title: string; desc?: string }[];
  value: T;
  onChange: (value: T) => void;
  columns?: 2 | 3 | 4;
  size?: "sm" | "md";
}) {
  const grid = columns === 2 ? "grid-cols-2" : columns === 4 ? "grid-cols-4" : "grid-cols-3";
  const pad = size === "sm" ? "py-2" : "py-2.5";

  return (
    <div>
      <label className="text-[10px] font-mono text-mutedDark font-semibold mb-1.5 block tracking-wider">
        {label}
      </label>
      <div className={`grid ${grid} gap-2`}>
        {options.map((o) => {
          const on = value === o.value;
          return (
            <button
              key={String(o.value)}
              type="button"
              onClick={() => {
                sfx.playClick();
                onChange(o.value);
              }}
              aria-pressed={on}
              className={`${pad} px-1 rounded-xl border-2 text-center transition active:scale-95 cursor-pointer ${
                on
                  ? "border-accent/60 bg-accent/15 text-accent"
                  : "border-surfaceBorder bg-surfaceRaised text-muted hover:text-white"
              }`}
            >
              <span className="block text-base font-black leading-none">{o.title}</span>
              {o.desc && (
                <span className="block text-[9px] opacity-70 leading-tight mt-0.5">{o.desc}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The round counts both modes offer, so the two launchers cannot drift apart. */
export const ROUND_OPTIONS = [
  { value: 3, title: "3", desc: "Cepat" },
  { value: 5, title: "5", desc: "Ideal" },
  { value: 10, title: "10", desc: "Panjang" },
] as const;

export const DIFFICULTY_OPTIONS = [
  { value: "easy", title: "Mudah", desc: "Mega hits" },
  { value: "medium", title: "Sedang", desc: "Populer" },
  { value: "hard", title: "Sulit", desc: "Sepuh" },
] as const;
