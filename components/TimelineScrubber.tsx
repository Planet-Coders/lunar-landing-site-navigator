"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { EphemerisSample } from "@/lib/types";

export default function TimelineScrubber({
  records,
  index,
  onChange,
}: {
  records: EphemerisSample[];
  index: number;
  onChange: (next: number) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const max = Math.max(records.length - 1, 0);
  const current = records[index];
  const indexRef = useRef(index);
  indexRef.current = index;

  useEffect(() => {
    if (!playing || records.length < 2) return;
    const id = window.setInterval(() => {
      onChange((indexRef.current + 1) % records.length);
    }, 220);
    return () => window.clearInterval(id);
  }, [playing, records.length, onChange]);

  useEffect(() => {
    if (records.length === 0) setPlaying(false);
  }, [records.length]);

  return (
    <div className="hud-panel rounded-xl p-3">
      <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-cyan-200/70">
        <span>Ephemeris scrub</span>
        <span className="text-hud-cyan">{current?.date ?? "NO LOCK"}</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setPlaying((v) => !v)}
          disabled={records.length < 2}
          className="rounded-md border border-cyan-300/30 p-2 text-hud-cyan hover:bg-cyan-300/10 disabled:opacity-40"
          aria-label={playing ? "Pause timeline" : "Play timeline"}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <input
          type="range"
          aria-label="Ephemeris timeline"
          aria-valuetext={current?.date ?? "No data"}
          min={0}
          max={max}
          value={Math.min(index, max)}
          onChange={(event) => onChange(Number(event.target.value))}
          disabled={records.length === 0}
          className="w-full"
        />
        <span className="w-16 text-right text-xs text-cyan-100/70">
          {records.length ? `${index + 1}/${records.length}` : "0/0"}
        </span>
      </div>
    </div>
  );
}
