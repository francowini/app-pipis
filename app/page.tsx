"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Atelier from "@/components/Atelier";
import Confetti from "@/components/Confetti";
import { Ruleta, type RuletaHandle } from "@/components/Ruleta";
import { comienzosPotables, sortearComienzo } from "@/lib/comienzos";

type Estado = "setup" | "jugando" | "fin";

type PalabraDicha = {
  palabra: string;
  jugador: 0 | 1;
  flightId: number;
};

type StartViewTransition = (cb: () => void) => {
  finished: Promise<void>;
};

const ACENTO_MAP: Record<string, string> = {
  á: "a",
  é: "e",
  í: "i",
  ó: "o",
  ú: "u",
  ü: "u",
};

function quitarAcentos(s: string) {
  return s.replace(/[áéíóúü]/g, (c) => ACENTO_MAP[c] ?? c);
}

function capitalizar(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
}

function startVT(): StartViewTransition | undefined {
  if (typeof document === "undefined") return undefined;
  return (
    document as Document & { startViewTransition?: StartViewTransition }
  ).startViewTransition;
}

export default function Page() {
  const [estado, setEstado] = useState<Estado>("setup");
  const [nombre1, setNombre1] = useState("Jugador 1");
  const [nombre2, setNombre2] = useState("Jugador 2");
  const [letras, setLetras] = useState(() => sortearComienzo().prefijo);
  const [modoManual, setModoManual] = useState(false);
  const [girando, setGirando] = useState(false);

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
  const [peakLetras, setPeakLetras] = useState(false);
  const [ripple, setRipple] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const ruletaRef = useRef<RuletaHandle | null>(null);
  const sorteadasRef = useRef<Set<string>>(new Set());

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

  const { palabrasJugador0, palabrasJugador1, faltantes, dichasSet } =
    useMemo(() => {
      const j0: PalabraDicha[] = [];
      const j1: PalabraDicha[] = [];
      const dichas = new Set<string>();
      for (const p of palabras) {
        if (p.jugador === 0) j0.push(p);
        else j1.push(p);
        dichas.add(p.palabra);
      }
      const falt = palabrasPosibles.filter((p) => !dichas.has(p));
      return {
        palabrasJugador0: j0,
        palabrasJugador1: j1,
        faltantes: falt,
        dichasSet: dichas,
      };
    }, [palabras, palabrasPosibles]);

  // Qué palabras renderiza el Atelier detrás. Nunca puede revelar las
  // posibles durante `jugando` (eso era spoiler). En `jugando` mostramos los
  // OTROS prefijos potables como textura editorial; en `fin` ya está fair
  // mostrar el corpus porque la sección "Las que faltaron" lo revela igual.
  const atelierPalabras = useMemo(() => {
    if (estado === "setup") return [];
    if (estado === "fin") return palabrasPosibles;
    return comienzosPotables
      .filter((c) => c.prefijo !== letras)
      .map((c) => c.prefijo);
  }, [estado, palabrasPosibles, letras]);

  async function sortearRuleta() {
    if (girando) return;
    setGirando(true);
    const next = sortearComienzo(sorteadasRef.current).prefijo;
    sorteadasRef.current.add(next);
    if (sorteadasRef.current.size > 200) {
      sorteadasRef.current = new Set([next]);
    }
    setLetras(next);
    try {
      await ruletaRef.current?.girar(next);
    } finally {
      setGirando(false);
    }
  }

  async function empezar() {
    if (letras.length !== 3 || cargandoPosibles || girando) return;
    setCargandoPosibles(true);
    let lista: string[] = [];
    try {
      const res = await fetch(
        `/api/palabras?letras=${encodeURIComponent(letras)}`,
      );
      const data: { palabras: string[]; total: number } = await res.json();
      lista = data.palabras ?? [];
    } catch {
      lista = [];
    }
    setCargandoPosibles(false);

    const apply = () => {
      setPalabrasPosibles(lista);
      setPalabras([]);
      setTurno(0);
      setInput("");
      setError(null);
      setPerdedor(null);
      setEstado("jugando");
    };

    const vt = startVT();
    if (vt && !prefersReducedMotion()) {
      vt.call(document, () => flushSync(apply));
    } else {
      apply();
    }
  }

  function revancha() {
    // Revancha = volver al setup con un sorteo nuevo pre-cargado para que la
    // ruleta esté lista. El jugador puede re-sortear o pasar a "Elegir a mano"
    // y después dispara "Empezar partida".
    const next = sortearComienzo(sorteadasRef.current).prefijo;
    sorteadasRef.current.add(next);
    const apply = () => {
      setLetras(next);
      ruletaRef.current?.setLetras(next);
      setPalabras([]);
      setPalabrasPosibles([]);
      setTurno(0);
      setInput("");
      setError(null);
      setPerdedor(null);
      setEstado("setup");
    };
    const vt = startVT();
    if (vt && !prefersReducedMotion()) {
      vt.call(document, () => flushSync(apply));
    } else {
      apply();
    }
  }

  function nuevaPartida() {
    const apply = () => {
      setPalabras([]);
      setTurno(0);
      setInput("");
      setError(null);
      setPerdedor(null);
      setEstado("setup");
    };
    const vt = startVT();
    if (vt && !prefersReducedMotion()) {
      vt.call(document, () => flushSync(apply));
    } else {
      apply();
    }
  }

  function rendirse() {
    const apply = () => {
      setPerdedor(turno);
      setEstado("fin");
    };
    const vt = startVT();
    if (vt && !prefersReducedMotion()) {
      vt.call(document, () => flushSync(apply));
    } else {
      apply();
    }
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
        setRipple(true);
        setTimeout(() => setRipple(false), 900);
        setPeakLetras(true);
        setTimeout(() => setPeakLetras(false), 750);

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

        const vt = startVT();
        if (vt && !prefersReducedMotion()) {
          if (inputRef.current) {
            inputRef.current.style.viewTransitionName = "word-flight";
          }
          const transition = vt.call(document, () => {
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
    <>
      <Atelier
        palabras={atelierPalabras}
        dichas={dichasSet}
        estado={estado}
      />
      <main className="flex-1 flex flex-col items-center px-4 py-8 sm:py-14 relative z-10">
        {estado === "setup" && (
          <div className="w-full max-w-xl flex flex-col gap-8">
            <header className="text-center">
              <p className="text-[11px] uppercase tracking-[0.22em] text-mute-ink mb-3">
                Un juego de palabras
              </p>
              <h1 className="font-[family-name:var(--font-display)] text-5xl sm:text-6xl font-black tracking-tight letras-gigantes">
                Palabras Cruzadas
              </h1>
              <p className="mt-4 text-mute-ink max-w-md mx-auto">
                Por turnos, digan una palabra que empiece con las{" "}
                <span className="text-ink font-medium">3 letras</span> que
                salgan en la ruleta. El primero que no pueda, pierde.
              </p>
            </header>

            <section className="flex flex-col gap-5 bg-white/90 border border-line rounded-3xl p-6 shadow-[0_1px_0_oklch(0.92_0.014_80)] backdrop-blur-[2px]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex flex-col gap-2">
                  <span className="text-[11px] font-medium text-mute-ink uppercase tracking-[0.18em]">
                    Jugador 1
                  </span>
                  <input
                    value={nombre1}
                    onChange={(e) => setNombre1(e.target.value)}
                    className="border border-line rounded-lg px-4 py-3 text-lg outline-none focus:border-coral focus-visible:ring-2 focus-visible:ring-coral-ink focus-visible:ring-offset-2 focus-visible:ring-offset-white bg-white"
                    placeholder="Jugador 1"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-[11px] font-medium text-mute-ink uppercase tracking-[0.18em]">
                    Jugador 2
                  </span>
                  <input
                    value={nombre2}
                    onChange={(e) => setNombre2(e.target.value)}
                    className="border border-line rounded-lg px-4 py-3 text-lg outline-none focus:border-coral focus-visible:ring-2 focus-visible:ring-coral-ink focus-visible:ring-offset-2 focus-visible:ring-offset-white bg-white"
                    placeholder="Jugador 2"
                  />
                </label>
              </div>
            </section>

            <section className="flex flex-col items-center gap-5">
              <p className="text-[11px] font-medium text-mute-ink uppercase tracking-[0.22em]">
                Las 3 letras de hoy
              </p>
              <div style={{ viewTransitionName: "letras-gigantes" }}>
                <Ruleta ref={ruletaRef} letras={letras} busy={girando} />
              </div>

              <div className="flex items-center gap-3 text-sm">
                <button
                  type="button"
                  onClick={sortearRuleta}
                  disabled={girando}
                  aria-busy={girando}
                  className="btn-girar bg-coral-ink hover:bg-coral-dark disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-full px-6 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                >
                  {girando ? "Sorteando…" : "Sortear letras"}
                </button>
                <button
                  type="button"
                  onClick={() => setModoManual((v) => !v)}
                  className="text-mute-ink hover:text-coral-ink underline underline-offset-4 decoration-1 decoration-line transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream rounded"
                  aria-expanded={modoManual}
                >
                  {modoManual ? "Volver al sorteo" : "Elegir a mano"}
                </button>
              </div>

              {modoManual && (
                <label className="flex flex-col items-center gap-2">
                  <span className="text-[11px] font-medium text-mute-ink uppercase tracking-[0.18em]">
                    3 letras
                  </span>
                  <input
                    value={letras.toUpperCase()}
                    onChange={(e) => {
                      const v = quitarAcentos(e.target.value.toLowerCase())
                        .replace(/[^a-zñ]/g, "")
                        .slice(0, 3);
                      setLetras(v);
                      ruletaRef.current?.setLetras(v.padEnd(3, "a"));
                    }}
                    maxLength={3}
                    aria-describedby="letras-hint"
                    className="border border-line rounded-lg px-4 py-3 text-2xl font-[family-name:var(--font-display)] font-bold tracking-[0.4em] text-center uppercase outline-none focus:border-coral focus-visible:ring-2 focus-visible:ring-coral-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream bg-white w-44"
                    placeholder="POL"
                  />
                  <span id="letras-hint" className="text-xs text-mute-ink">
                    Acentos se ignoran.
                  </span>
                </label>
              )}
            </section>

            <button
              onClick={empezar}
              disabled={letras.length !== 3 || cargandoPosibles || girando}
              aria-busy={cargandoPosibles}
              className="bg-coral-ink hover:bg-coral-dark disabled:bg-line disabled:text-mute-ink disabled:cursor-not-allowed text-white text-lg font-semibold rounded-2xl py-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
            >
              {cargandoPosibles ? "Cargando…" : "Empezar partida"}
            </button>
          </div>
        )}

        {estado === "jugando" && (
          <div className="w-full max-w-3xl flex flex-col gap-8">
            <header className="text-center">
              <p className="text-[11px] uppercase tracking-[0.22em] text-mute-ink mb-3">
                Las letras
              </p>
              <h1
                key={letras}
                style={{ viewTransitionName: "letras-gigantes" }}
                className={`font-[family-name:var(--font-display)] text-7xl sm:text-9xl font-black tracking-tight text-coral tinta-prensa select-none letras-gigantes${peakLetras ? " peak" : ""}`}
              >
                {letras.toUpperCase()}
              </h1>
              <p className="mt-4 text-mute-ink text-sm">
                <span className="font-semibold text-ink tabular-nums">
                  {palabrasPosibles.length.toLocaleString("es-AR")}
                </span>{" "}
                {palabrasPosibles.length === 1
                  ? "palabra posible"
                  : "palabras posibles"}
              </p>
            </header>

            <div className="text-center" aria-live="polite" aria-atomic="true">
              <p className="text-[11px] uppercase tracking-[0.22em] text-mute-ink">
                Turno de
              </p>
              <p
                key={turno}
                className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-bold mt-1 animate-turn-settle"
              >
                {nombres[turno]}
              </p>
            </div>

            <form
              onSubmit={enviarPalabra}
              className={`flex flex-col gap-3 input-ripple${ripple ? " fire" : ""}`}
            >
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
                className={`w-full border-2 border-line rounded-xl px-5 py-4 text-xl outline-none focus:border-coral focus-visible:ring-2 focus-visible:ring-coral-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream bg-white relative z-[2] ${
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
                    className={`bg-white/90 backdrop-blur-[2px] border rounded-2xl p-5 transition-colors ${
                      turno === j ? "border-coral" : "border-line"
                    }`}
                  >
                    <div className="flex items-baseline justify-between mb-3">
                      <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">
                        {nombres[j]}
                      </h2>
                      <span className="text-sm text-mute-ink tabular-nums">
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
                          className={`py-1 font-[family-name:var(--font-display)] text-lg ${
                            idx === 0 && p.flightId === flyingId
                              ? "animate-fade-down"
                              : ""
                          }`}
                        >
                          <span className="text-mute tabular-nums text-xs mr-2">
                            {String(lista.length - idx).padStart(2, "0")}
                          </span>
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
          <div className="w-full max-w-2xl flex flex-col gap-8 relative">
            <Confetti
              words={(ganador === 0 ? palabrasJugador0 : palabrasJugador1).map(
                (p) => p.palabra,
              )}
            />
            <header className="text-center">
              <p className="text-[11px] uppercase tracking-[0.22em] text-mute-ink mb-3">
                Fin de la partida
              </p>
              <div className="flex items-center justify-center gap-4 mb-2">
                <span
                  style={{ viewTransitionName: "letras-gigantes" }}
                  className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-black tracking-[0.18em] text-coral-ink letras-gigantes"
                >
                  {letras.toUpperCase()}
                </span>
              </div>
              <h1 className="font-[family-name:var(--font-display)] text-5xl sm:text-7xl font-black tracking-tight animate-ink-stamp">
                ¡Ganó {nombres[ganador]}!
              </h1>
            </header>

            <section className="bg-white/95 border border-line rounded-2xl p-5 sm:p-6 grid grid-cols-3 gap-3 sm:gap-4 text-center">
              <div>
                <p className="text-[10px] sm:text-xs uppercase tracking-[0.22em] text-mute-ink truncate">
                  {nombres[0]}
                </p>
                <p className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-bold mt-1 tabular-nums">
                  {palabrasJugador0.length}
                </p>
              </div>
              <div>
                <p className="text-[10px] sm:text-xs uppercase tracking-[0.22em] text-mute-ink">
                  Total
                </p>
                <p className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-bold mt-1 text-coral-ink tabular-nums">
                  {palabras.length}
                </p>
              </div>
              <div>
                <p className="text-[10px] sm:text-xs uppercase tracking-[0.22em] text-mute-ink truncate">
                  {nombres[1]}
                </p>
                <p className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-bold mt-1 tabular-nums">
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
                    className="bg-white/95 border border-line rounded-2xl p-5"
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
                      {lista.map((p, idx) => (
                        <li
                          key={`${p.palabra}-${p.flightId}`}
                          className="font-[family-name:var(--font-display)] text-base"
                        >
                          <span className="text-mute tabular-nums text-xs mr-2">
                            {String(lista.length - idx).padStart(2, "0")}
                          </span>
                          {capitalizar(p.palabra)}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </section>

            {palabrasPosibles.length > 0 && (
              <section className="bg-white/95 border border-line rounded-2xl p-5">
                <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
                  <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">
                    Las que faltaron
                  </h2>
                  <span className="text-sm text-mute-ink tabular-nums">
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
    </>
  );
}
