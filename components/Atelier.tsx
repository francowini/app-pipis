"use client";

import { useEffect, useMemo, useRef } from "react";

type Props = {
  palabras: string[];
  dichas: Set<string>;
  estado: "setup" | "jugando" | "fin";
};

const SLOTS = 78;

type Slot = {
  word: string;
  left: number;
  top: number;
  size: number;
  driftX: number;
  driftY: number;
  driftDur: number;
  driftDelay: number;
  rotate: number;
};

function seededRng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromCorpus(corpus: string[]) {
  if (corpus.length === 0) return 1;
  const head = corpus[0] ?? "";
  let s = corpus.length;
  for (let i = 0; i < head.length; i++) s = (s * 31 + head.charCodeAt(i)) >>> 0;
  return s;
}

function buildSlots(corpus: string[], n: number): Slot[] {
  if (!corpus.length) return [];
  const r = seededRng(seedFromCorpus(corpus));
  const slots: Slot[] = [];
  const used = new Set<number>();
  let attempts = 0;
  while (slots.length < n && attempts < n * 12) {
    attempts++;
    const idx = Math.floor(r() * corpus.length);
    if (used.has(idx)) continue;
    const left = r() * 100;
    const top = r() * 100;
    // Evitar la columna central donde vive la UI.
    if (left > 30 && left < 70 && top > 20 && top < 80) continue;
    used.add(idx);
    slots.push({
      word: corpus[idx],
      left,
      top,
      size: 0.85 + r() * 1.6,
      driftX: (r() - 0.5) * 22,
      driftY: (r() - 0.5) * 22,
      driftDur: 22 + r() * 20,
      driftDelay: -r() * 28,
      rotate: (r() - 0.5) * 4,
    });
  }
  return slots;
}

export default function Atelier({ palabras, dichas, estado }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    let raf = 0;
    let running = true;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const W = () => canvas.width / dpr;
    const H = () => canvas.height / dpr;

    const DOTS = 240;
    type Dot = {
      x: number;
      y: number;
      r: number;
      a: number;
      vx: number;
      vy: number;
    };
    const dots: Dot[] = Array.from({ length: DOTS }, () => ({
      x: Math.random() * W(),
      y: Math.random() * H(),
      r: 0.35 + Math.random() * 1.05,
      a: 0.06 + Math.random() * 0.13,
      vx: (Math.random() - 0.5) * 0.05,
      vy: (Math.random() - 0.5) * 0.05,
    }));

    const drawStatic = () => {
      ctx.clearRect(0, 0, W(), H());
      for (const d of dots) {
        ctx.beginPath();
        ctx.fillStyle = `oklch(0.46 0.155 33 / ${d.a})`;
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    if (reduced) {
      drawStatic();
      const onResize = () => {
        resize();
        drawStatic();
      };
      window.removeEventListener("resize", resize);
      window.addEventListener("resize", onResize);
      return () => {
        window.removeEventListener("resize", onResize);
      };
    }

    const frame = () => {
      if (!running) return;
      const w = W();
      const h = H();
      ctx.clearRect(0, 0, w, h);
      for (const d of dots) {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < -2) d.x = w + 2;
        if (d.x > w + 2) d.x = -2;
        if (d.y < -2) d.y = h + 2;
        if (d.y > h + 2) d.y = -2;
        ctx.beginPath();
        ctx.fillStyle = `oklch(0.46 0.155 33 / ${d.a})`;
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const slots = useMemo(() => buildSlots(palabras, SLOTS), [palabras]);
  const showCorpus = estado !== "setup" && palabras.length > 0;

  return (
    <div className="atelier" aria-hidden="true">
      <canvas ref={canvasRef} className="atelier-canvas" />
      {showCorpus && (
        <div className="atelier-corpus">
          {slots.map((s, i) => (
            <span
              key={`${s.word}-${i}`}
              className={`corpus-word${dichas.has(s.word) ? " dicha" : ""}`}
              style={
                {
                  left: `${s.left}%`,
                  top: `${s.top}%`,
                  fontSize: `${s.size}rem`,
                  rotate: `${s.rotate}deg`,
                  "--drift-x": `${s.driftX}px`,
                  "--drift-y": `${s.driftY}px`,
                  "--drift-dur": `${s.driftDur}s`,
                  "--drift-delay": `${s.driftDelay}s`,
                } as React.CSSProperties
              }
            >
              {s.word}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
