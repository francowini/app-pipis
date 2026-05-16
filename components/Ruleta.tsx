"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";

export type RuletaHandle = {
  girar: (target: string) => Promise<void>;
  setLetras: (target: string) => void;
};

type Props = {
  letras: string;
  busy?: boolean;
};

const ABECEDARIO = "abcdefghijklmnñopqrstuvwxyz";

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function buildStrip(target: string, loops: number) {
  const cells: string[] = [];
  for (let l = 0; l < loops; l++) {
    for (const c of ABECEDARIO) cells.push(c);
  }
  cells.push(target);
  return cells;
}

export const Ruleta = forwardRef<RuletaHandle, Props>(function Ruleta(
  { letras, busy },
  ref,
) {
  const reelRefs = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const stripRefs = useRef<(HTMLDivElement | null)[]>([null, null, null]);

  const initial = (letras || "pol")
    .toLowerCase()
    .slice(0, 3)
    .padEnd(3, "a")
    .split("");

  const [strips, setStrips] = useState<string[][]>(() => [
    [initial[0]],
    [initial[1]],
    [initial[2]],
  ]);
  const [settled, setSettled] = useState<boolean[]>([true, true, true]);

  useImperativeHandle(
    ref,
    () => ({
      async girar(nextLetras: string) {
        const nt = nextLetras
          .toLowerCase()
          .slice(0, 3)
          .padEnd(3, "a")
          .split("");

        const reduced = prefersReducedMotion();
        const loops = reduced ? [0, 0, 0] : [4, 5, 6];
        const durs = reduced ? [120, 160, 200] : [1500, 2100, 2700];

        const next: string[][] = [0, 1, 2].map((i) =>
          reduced ? [nt[i]] : buildStrip(nt[i], loops[i]),
        );
        setStrips(next);
        setSettled([false, false, false]);

        await new Promise((r) => requestAnimationFrame(() => r(null)));

        const animations: Animation[] = [];
        for (let i = 0; i < 3; i++) {
          const reel = reelRefs.current[i];
          const strip = stripRefs.current[i];
          if (!reel || !strip) continue;
          const cellH = reel.clientHeight;
          const cellsCount = next[i].length;
          const finalTranslate = -(cellsCount - 1) * cellH;
          strip.style.transform = "translateY(0px)";
          void strip.offsetHeight;
          const anim = strip.animate(
            [
              { transform: "translateY(0px)" },
              { transform: `translateY(${finalTranslate}px)` },
            ],
            {
              duration: durs[i],
              easing: "cubic-bezier(0.16, 1, 0.3, 1)",
              fill: "forwards",
            },
          );
          animations.push(anim);
        }

        await Promise.all(
          animations.map((a, i) =>
            a.finished
              .catch(() => undefined)
              .then(() => {
                setSettled((s) => {
                  const c = [...s];
                  c[i] = true;
                  return c;
                });
              }),
          ),
        );
      },
      setLetras(nextLetras: string) {
        const nt = nextLetras
          .toLowerCase()
          .slice(0, 3)
          .padEnd(3, "a")
          .split("");
        setStrips([[nt[0]], [nt[1]], [nt[2]]]);
        setSettled([true, true, true]);
        for (let i = 0; i < 3; i++) {
          const strip = stripRefs.current[i];
          if (strip) strip.style.transform = "translateY(0px)";
        }
      },
    }),
    [],
  );

  // El estado interno se sincroniza solo vía la API imperativa (girar /
   // setLetras). El prop `letras` solo siembra el estado inicial; intentar
   // auto-resync via useEffect competía con girar() y dejaba parpadeos.

  return (
    <div
      className="flex items-center justify-center gap-3 sm:gap-5"
      aria-busy={busy}
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="sr-only">
        Letras sorteadas: {letras.toUpperCase().split("").join(" ")}
      </span>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          ref={(el) => {
            reelRefs.current[i] = el;
          }}
          className={`reel${settled[i] ? " settled" : ""}`}
          aria-hidden="true"
        >
          <div className="reel-indicator" />
          <div
            ref={(el) => {
              stripRefs.current[i] = el;
            }}
            className="reel-strip"
          >
            {strips[i].map((c, idx) => (
              <div
                key={idx}
                className={`reel-cell${
                  idx === strips[i].length - 1 ? " is-target" : ""
                }`}
              >
                {c}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
});
