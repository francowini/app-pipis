"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

type Estado = "setup" | "jugando" | "fin";

type PalabraDicha = {
  palabra: string;
  jugador: 0 | 1;
  flightId: number;
};

type StartViewTransition = (cb: () => void) => {
  finished: Promise<void>;
};

const COMBINACIONES_COMUNES = [
  "pol", "car", "mar", "est", "con", "des", "pre", "tra", "ent", "com",
  "par", "per", "por", "san", "sal", "rec", "rep", "res", "dis", "imp",
];

const ACENTO_MAP: Record<string, string> = {
  á: "a", é: "e", í: "i", ó: "o", ú: "u", ü: "u",
};

function quitarAcentos(s: string) {
  return s.replace(/[áéíóúü]/g, (c) => ACENTO_MAP[c] ?? c);
}

function capitalizar(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function letrasRandom() {
  return COMBINACIONES_COMUNES[
    Math.floor(Math.random() * COMBINACIONES_COMUNES.length)
  ];
}

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export default function Page() {
  const [estado, setEstado] = useState<Estado>("setup");
  const [nombre1, setNombre1] = useState("Jugador 1");
  const [nombre2, setNombre2] = useState("Jugador 2");
  const [letras, setLetras] = useState("");

  const [palabras, setPalabras] = useState<PalabraDicha[]>([]);
  const [turno, setTurno] = useState<0 | 1>(0);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [perdedor, setPerdedor] = useState<0 | 1 | null>(null);
  const [palabrasPosibles, setPalabrasPosibles] = useState<string[]>([]);
  const [cargandoPosibles, setCargandoPosibles] = useState(false);
  const [flyingId, setFlyingId] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (estado === "jugando") {
      inputRef.current?.focus();
    }
  }, [estado, turno]);

  const nombres: [string, string] = [
    nombre1.trim() || "Jugador 1",
    nombre2.trim() || "Jugador 2",
  ];
  const ganador = perdedor === null ? null : ((1 - perdedor) as 0 | 1);

  const { palabrasJugador0, palabrasJugador1, faltantes } = useMemo(() => {
    const j0: PalabraDicha[] = [];
    const j1: PalabraDicha[] = [];
    const dichas = new Set<string>();
    for (const p of palabras) {
      if (p.jugador === 0) j0.push(p);
      else j1.push(p);
      dichas.add(p.palabra);
    }
    const falt = palabrasPosibles.filter((p) => !dichas.has(p));
    return { palabrasJugador0: j0, palabrasJugador1: j1, faltantes: falt };
  }, [palabras, palabrasPosibles]);

  async function empezar() {
    if (letras.length !== 3 || cargandoPosibles) return;
    setCargandoPosibles(true);
    try {
      const res = await fetch(
        `/api/palabras?letras=${encodeURIComponent(letras)}`
      );
      const data: { palabras: string[]; total: number } = await res.json();
      setPalabrasPosibles(data.palabras ?? []);
    } catch {
      setPalabrasPosibles([]);
    } finally {
      setCargandoPosibles(false);
    }
    setPalabras([]);
    setTurno(0);
    setInput("");
    setError(null);
    setPerdedor(null);
    setEstado("jugando");
  }

  function revancha() {
    setPalabras([]);
    setTurno(0);
    setInput("");
    setError(null);
    setPerdedor(null);
    setEstado("jugando");
  }

  function nuevaPartida() {
    setPalabras([]);
    setTurno(0);
    setInput("");
    setError(null);
    setPerdedor(null);
    setEstado("setup");
  }

  function rendirse() {
    setPerdedor(turno);
    setEstado("fin");
  }

  async function enviarPalabra(e?: React.FormEvent) {
    e?.preventDefault();
    if (enviando) return;
    const palabra = quitarAcentos(input.toLowerCase().trim());
    if (!palabra) return;

    setEnviando(true);
    try {
      const res = await fetch("/api/validar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          palabra,
          letras,
          palabrasUsadas: palabras.map((p) => p.palabra),
        }),
      });
      const data: { valida: boolean; motivo: string } = await res.json();

      if (data.valida) {
        const id = Date.now();
        const apply = () => {
          setPalabras((prev) => [
            { palabra, jugador: turno, flightId: id },
            ...prev,
          ]);
          setTurno((t) => ((1 - t) as 0 | 1));
          setInput("");
          setError(null);
          setFlyingId(id);
        };

        const startVT =
          typeof document !== "undefined"
            ? (document as Document & {
                startViewTransition?: StartViewTransition;
              }).startViewTransition
            : undefined;

        if (startVT && !prefersReducedMotion()) {
          if (inputRef.current) {
            inputRef.current.style.viewTransitionName = "word-flight";
          }
          const transition = startVT.call(document, () => {
            if (inputRef.current) {
              inputRef.current.style.viewTransitionName = "";
            }
            flushSync(apply);
          });
          transition.finished
            .catch(() => undefined)
            .finally(() => {
              setFlyingId(null);
            });
        } else {
          apply();
          setTimeout(() => setFlyingId(null), 350);
        }
      } else {
        setError(data.motivo);
        setShake(true);
        setTimeout(() => setShake(false), 400);
      }
    } catch {
      setError("Error de red, probá de nuevo");
      setShake(true);
      setTimeout(() => setShake(false), 400);
    } finally {
      setEnviando(false);
      inputRef.current?.focus();
    }
  }

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-8 sm:py-14 relative">
      {estado === "setup" && (
        <div className="w-full max-w-xl flex flex-col gap-8">
          <header className="text-center">
            <h1 className="font-[family-name:var(--font-display)] text-5xl sm:text-6xl font-black tracking-tight">
              Palabras Cruzadas
            </h1>
            <p className="mt-3 text-mute-ink">
              Elegí 3 letras y por turnos digan palabras que empiecen con ellas.
              El primero que no pueda, pierde.
            </p>
          </header>

          <section className="flex flex-col gap-4 bg-white border border-line rounded-2xl p-6 shadow-sm">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-mute-ink uppercase tracking-wider">
                Jugador 1
              </span>
              <input
                value={nombre1}
                onChange={(e) => setNombre1(e.target.value)}
                className="border border-line rounded-lg px-4 py-3 text-lg outline-none focus:border-coral focus-visible:ring-2 focus-visible:ring-coral-ink focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                placeholder="Jugador 1"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-mute-ink uppercase tracking-wider">
                Jugador 2
              </span>
              <input
                value={nombre2}
                onChange={(e) => setNombre2(e.target.value)}
                className="border border-line rounded-lg px-4 py-3 text-lg outline-none focus:border-coral focus-visible:ring-2 focus-visible:ring-coral-ink focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                placeholder="Jugador 2"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-mute-ink uppercase tracking-wider">
                3 letras iniciales
              </span>
              <input
                value={letras.toUpperCase()}
                onChange={(e) => {
                  const v = quitarAcentos(e.target.value.toLowerCase())
                    .replace(/[^a-zñ]/g, "")
                    .slice(0, 3);
                  setLetras(v);
                }}
                maxLength={3}
                aria-describedby="letras-hint"
                className="border border-line rounded-lg px-4 py-3 text-3xl font-[family-name:var(--font-display)] font-bold tracking-widest text-center uppercase outline-none focus:border-coral focus-visible:ring-2 focus-visible:ring-coral-ink focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                placeholder="POL"
              />
              <div className="flex items-center justify-between gap-3">
                <span id="letras-hint" className="text-xs text-mute-ink">
                  Acentos se ignoran.
                </span>
                <button
                  type="button"
                  onClick={() => setLetras(letrasRandom())}
                  className="text-sm text-coral-ink font-medium hover:text-coral-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-ink focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded"
                >
                  Letras random
                </button>
              </div>
            </label>
          </section>

          <button
            onClick={empezar}
            disabled={letras.length !== 3 || cargandoPosibles}
            aria-busy={cargandoPosibles}
            className="bg-coral-ink hover:bg-coral-dark disabled:bg-line disabled:text-mute-ink disabled:cursor-not-allowed text-white text-lg font-semibold rounded-xl py-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
          >
            {cargandoPosibles ? "Cargando…" : "Empezar partida"}
          </button>
        </div>
      )}

      {estado === "jugando" && (
        <div className="w-full max-w-3xl flex flex-col gap-8">
          <header className="text-center">
            <p className="text-sm uppercase tracking-widest text-mute-ink mb-2">
              Las letras
            </p>
            <h1
              key={letras}
              className="font-[family-name:var(--font-display)] text-7xl sm:text-9xl font-black tracking-tight text-coral animate-ink-stamp tinta-prensa select-none"
            >
              {letras.toUpperCase()}
            </h1>
            <p className="mt-3 text-mute-ink text-sm">
              <span className="font-semibold text-ink">
                {palabrasPosibles.length.toLocaleString("es-AR")}
              </span>{" "}
              {palabrasPosibles.length === 1
                ? "palabra posible"
                : "palabras posibles"}
            </p>
          </header>

          <div className="text-center" aria-live="polite" aria-atomic="true">
            <p className="text-sm uppercase tracking-widest text-mute-ink">
              Turno de
            </p>
            <p
              key={turno}
              className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-bold mt-1 animate-turn-settle"
            >
              {nombres[turno]}
            </p>
          </div>

          <form onSubmit={enviarPalabra} className="flex flex-col gap-3">
            {error && (
              <div
                role="alert"
                className="bg-coral-soft border border-coral text-coral-ink rounded-lg px-4 py-2 text-center font-medium"
              >
                {error}
              </div>
            )}
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              aria-label="Palabra"
              placeholder={`Una palabra que empiece con ${letras.toUpperCase()}…`}
              className={`w-full border-2 border-line rounded-xl px-5 py-4 text-xl outline-none focus:border-coral focus-visible:ring-2 focus-visible:ring-coral-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream bg-white ${
                shake ? "animate-shake border-coral" : ""
              }`}
            />
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={enviando}
                aria-busy={enviando}
                className="flex-1 bg-coral-ink hover:bg-coral-dark disabled:opacity-50 text-white text-lg font-semibold rounded-xl py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
              >
                Decir palabra
              </button>
              <button
                type="button"
                onClick={rendirse}
                className="sm:w-44 border border-line text-mute-ink hover:text-coral-ink hover:border-coral rounded-xl py-3 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
              >
                Me rindo
              </button>
            </div>
          </form>

          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([0, 1] as const).map((j) => {
              const lista = j === 0 ? palabrasJugador0 : palabrasJugador1;
              return (
                <div
                  key={j}
                  className={`bg-white border rounded-2xl p-5 transition-colors ${
                    turno === j ? "border-coral" : "border-line"
                  }`}
                >
                  <div className="flex items-baseline justify-between mb-3">
                    <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">
                      {nombres[j]}
                    </h2>
                    <span className="text-sm text-mute-ink">
                      {lista.length}{" "}
                      {lista.length === 1 ? "palabra" : "palabras"}
                    </span>
                  </div>
                  <ul className="flex flex-col gap-1 max-h-72 overflow-y-auto">
                    {lista.length === 0 && (
                      <li className="text-mute-ink text-sm italic">
                        Todavía no dijo ninguna.
                      </li>
                    )}
                    {lista.map((p, idx) => (
                      <li
                        key={`${p.palabra}-${p.flightId}`}
                        style={
                          p.flightId === flyingId
                            ? { viewTransitionName: "word-flight" }
                            : undefined
                        }
                        className={`py-1 ${
                          idx === 0 && p.flightId === flyingId
                            ? "animate-fade-down"
                            : ""
                        }`}
                      >
                        {capitalizar(p.palabra)}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </section>
        </div>
      )}

      {estado === "fin" && ganador !== null && (
        <div className="w-full max-w-2xl flex flex-col gap-8 relative z-10">
          <Confetti
            words={(ganador === 0 ? palabrasJugador0 : palabrasJugador1).map(
              (p) => p.palabra
            )}
          />
          <header className="text-center">
            <p className="text-sm uppercase tracking-widest text-mute-ink mb-2">
              Fin de la partida
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-5xl sm:text-7xl font-black tracking-tight">
              ¡Ganó {nombres[ganador]}!
            </h1>
          </header>

          <section className="bg-white/95 backdrop-blur-sm border border-line rounded-2xl p-5 sm:p-6 grid grid-cols-3 gap-3 sm:gap-4 text-center">
            <div>
              <p className="text-[10px] sm:text-xs uppercase tracking-widest text-mute-ink truncate">
                {nombres[0]}
              </p>
              <p className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-bold mt-1">
                {palabrasJugador0.length}
              </p>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs uppercase tracking-widest text-mute-ink">
                Total
              </p>
              <p className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-bold mt-1 text-coral-ink">
                {palabras.length}
              </p>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs uppercase tracking-widest text-mute-ink truncate">
                {nombres[1]}
              </p>
              <p className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-bold mt-1">
                {palabrasJugador1.length}
              </p>
            </div>
          </section>

          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([0, 1] as const).map((j) => {
              const lista = j === 0 ? palabrasJugador0 : palabrasJugador1;
              return (
                <div
                  key={j}
                  className="bg-white/95 backdrop-blur-sm border border-line rounded-2xl p-5"
                >
                  <h2 className="font-[family-name:var(--font-display)] text-lg font-bold mb-3">
                    {nombres[j]}
                  </h2>
                  <ul className="flex flex-col gap-1 max-h-72 overflow-y-auto">
                    {lista.length === 0 && (
                      <li className="text-mute-ink text-sm italic">
                        No dijo ninguna.
                      </li>
                    )}
                    {lista.map((p) => (
                      <li key={`${p.palabra}-${p.flightId}`}>
                        {capitalizar(p.palabra)}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </section>

          {palabrasPosibles.length > 0 && (
            <section className="bg-white/95 backdrop-blur-sm border border-line rounded-2xl p-5">
              <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
                <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">
                  Las que faltaron
                </h2>
                <span className="text-sm text-mute-ink">
                  {faltantes.length.toLocaleString("es-AR")} de{" "}
                  {palabrasPosibles.length.toLocaleString("es-AR")}
                </span>
              </div>
              {faltantes.length === 0 ? (
                <p className="text-mute-ink text-sm italic">
                  No quedó ninguna sin decir.
                </p>
              ) : (
                <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 max-h-80 overflow-y-auto text-sm">
                  {faltantes.map((p) => (
                    <li key={p} className="text-mute-ink">
                      {capitalizar(p)}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={revancha}
              className="flex-1 bg-coral-ink hover:bg-coral-dark text-white text-lg font-semibold rounded-xl py-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
            >
              Revancha
            </button>
            <button
              onClick={nuevaPartida}
              className="flex-1 border border-line text-ink hover:border-coral hover:text-coral-ink rounded-xl py-4 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
            >
              Nueva partida
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function Confetti({ words }: { words: string[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
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
