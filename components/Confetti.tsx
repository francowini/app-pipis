"use client";

import { useEffect, useRef } from "react";

function capitalizar(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function Confetti({ words }: { words: string[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    if (!words.length) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let running = true;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const palette = [
      "oklch(0.708 0.180 33)",
      "oklch(0.622 0.193 33)",
      "oklch(0.460 0.155 33)",
      "oklch(0.205 0.008 60)",
    ];

    const COUNT = Math.min(Math.max(words.length * 2, 24), 80);
    const W = window.innerWidth;
    const H = window.innerHeight;

    type Particle = {
      word: string;
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      vr: number;
      size: number;
      color: string;
      alpha: number;
      mass: number;
      settled: boolean;
    };

    const particles: Particle[] = Array.from({ length: COUNT }, (_, i) => ({
      word: words[i % words.length],
      x: W * (0.05 + 0.9 * Math.random()),
      y: -40 - Math.random() * 220,
      vx: (Math.random() - 0.5) * 1.6,
      vy: 0.8 + Math.random() * 1.2,
      r: (Math.random() - 0.5) * 0.6,
      vr: (Math.random() - 0.5) * 0.05,
      size: 14 + Math.random() * 20,
      color: palette[Math.floor(Math.random() * palette.length)],
      alpha: 1,
      mass: 0.45 + Math.random() * 0.55,
      settled: false,
    }));

    const start = performance.now();
    const frame = (now: number) => {
      if (!running) return;
      const elapsed = (now - start) / 1000;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        if (!p.settled) {
          p.vy += 0.085 * p.mass;
          p.vx *= 0.992;
          p.x += p.vx;
          p.y += p.vy;
          p.r += p.vr;
          const floor = H - 30 - p.mass * 20;
          if (p.y >= floor) {
            p.y = floor;
            p.settled = true;
            p.vx = 0;
            p.vy = 0;
            p.vr = 0;
          }
        }
        if (elapsed > 4.5) {
          p.alpha = Math.max(0, p.alpha - 0.012);
        }
        if (p.alpha <= 0) continue;

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.font = `700 ${p.size}px Fraunces, "Times New Roman", serif`;
        ctx.fillStyle = p.color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(capitalizar(p.word), 0, 0);
        ctx.restore();
      }

      if (particles.every((p) => p.alpha <= 0)) {
        running = false;
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [words]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
    />
  );
}
