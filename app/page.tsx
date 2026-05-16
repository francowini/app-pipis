"use client";

import { useEffect, useRef, useState } from "react";

type Estado = "setup" | "jugando" | "fin";

type PalabraDicha = {
  palabra: string;
  jugador: 0 | 1;
};

const COMBINACIONES_COMUNES = [
  "pol", "car", "mar", "est", "con", "des", "pre", "tra", "ent", "com",
  "par", "per", "por", "san", "sal", "rec", "rep", "res", "dis", "imp",
];

function capitalizar(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function letrasRandom() {
  return COMBINACIONES_COMUNES[
    Math.floor(Math.random() * COMBINACIONES_COMUNES.length)
  ];
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
    const palabra = input.toLowerCase().trim();
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
        setPalabras((prev) => [{ palabra, jugador: turno }, ...prev]);
        setTurno((t) => ((1 - t) as 0 | 1));
        setInput("");
        setError(null);
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

  const palabrasJugador0 = palabras.filter((p) => p.jugador === 0);
  const palabrasJugador1 = palabras.filter((p) => p.jugador === 1);
  const dichas = new Set(palabras.map((p) => p.palabra));
  const faltantes = palabrasPosibles.filter((p) => !dichas.has(p));

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-8 sm:py-14">
      {estado === "setup" && (
        <div className="w-full max-w-xl flex flex-col gap-8">
          <header className="text-center">
            <h1 className="font-[family-name:var(--font-display)] text-5xl sm:text-6xl font-black tracking-tight">
              Palabras Cruzadas
            </h1>
            <p className="mt-3 text-mute">
              Elegí 3 letras y por turnos digan palabras que empiecen con ellas.
              El primero que no pueda, pierde.
            </p>
          </header>

          <section className="flex flex-col gap-4 bg-white border border-line rounded-2xl p-6 shadow-sm">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-mute uppercase tracking-wider">
                Jugador 1
              </span>
              <input
                value={nombre1}
                onChange={(e) => setNombre1(e.target.value)}
                className="border border-line rounded-lg px-4 py-3 text-lg outline-none focus:border-coral"
                placeholder="Jugador 1"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-mute uppercase tracking-wider">
                Jugador 2
              </span>
              <input
                value={nombre2}
                onChange={(e) => setNombre2(e.target.value)}
                className="border border-line rounded-lg px-4 py-3 text-lg outline-none focus:border-coral"
                placeholder="Jugador 2"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-mute uppercase tracking-wider">
                3 letras iniciales
              </span>
              <input
                value={letras.toUpperCase()}
                onChange={(e) => {
                  const v = e.target.value
                    .toLowerCase()
                    .replace(/[^a-zñ]/g, "")
                    .slice(0, 3);
                  setLetras(v);
                }}
                maxLength={3}
                className="border border-line rounded-lg px-4 py-3 text-3xl font-[family-name:var(--font-display)] font-bold tracking-widest text-center uppercase outline-none focus:border-coral"
                placeholder="POL"
              />
              <button
                type="button"
                onClick={() => setLetras(letrasRandom())}
                className="text-sm text-coral font-medium self-start hover:text-coral-dark"
              >
                Letras random
              </button>
            </label>
          </section>

          <button
            onClick={empezar}
            disabled={letras.length !== 3 || cargandoPosibles}
            className="bg-coral hover:bg-coral-dark disabled:bg-line disabled:text-mute disabled:cursor-not-allowed text-white text-lg font-semibold rounded-xl py-4 transition-colors"
          >
            {cargandoPosibles ? "Cargando…" : "Empezar partida"}
          </button>
        </div>
      )}

      {estado === "jugando" && (
        <div className="w-full max-w-3xl flex flex-col gap-8">
          <header className="text-center">
            <p className="text-sm uppercase tracking-widest text-mute mb-2">
              Las letras
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-7xl sm:text-9xl font-black tracking-tight text-coral">
              {letras.toUpperCase()}
            </h1>
            <p className="mt-3 text-mute text-sm">
              <span className="font-semibold text-ink">
                {palabrasPosibles.length.toLocaleString("es-AR")}
              </span>{" "}
              {palabrasPosibles.length === 1
                ? "palabra posible"
                : "palabras posibles"}
            </p>
          </header>

          <div className="text-center">
            <p className="text-sm uppercase tracking-widest text-mute">Turno de</p>
            <p className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-bold mt-1">
              {nombres[turno]}
            </p>
          </div>

          <form onSubmit={enviarPalabra} className="flex flex-col gap-3">
            {error && (
              <div className="bg-coral-soft border border-coral text-coral-dark rounded-lg px-4 py-2 text-center font-medium">
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
              placeholder={`Una palabra que empiece con ${letras.toUpperCase()}…`}
              className={`w-full border-2 border-line rounded-xl px-5 py-4 text-xl outline-none focus:border-coral bg-white ${
                shake ? "animate-shake border-coral" : ""
              }`}
            />
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={enviando}
                className="flex-1 bg-coral hover:bg-coral-dark disabled:opacity-50 text-white text-lg font-semibold rounded-xl py-3 transition-colors"
              >
                Decir palabra
              </button>
              <button
                type="button"
                onClick={rendirse}
                className="sm:w-44 border border-line text-mute hover:text-coral-dark hover:border-coral rounded-xl py-3 font-medium transition-colors"
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
                  className={`bg-white border rounded-2xl p-5 ${
                    turno === j ? "border-coral" : "border-line"
                  }`}
                >
                  <div className="flex items-baseline justify-between mb-3">
                    <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">
                      {nombres[j]}
                    </h2>
                    <span className="text-sm text-mute">
                      {lista.length} {lista.length === 1 ? "palabra" : "palabras"}
                    </span>
                  </div>
                  <ul className="flex flex-col gap-1 max-h-72 overflow-y-auto">
                    {lista.length === 0 && (
                      <li className="text-mute text-sm italic">
                        Todavía no dijo ninguna.
                      </li>
                    )}
                    {lista.map((p, idx) => (
                      <li
                        key={`${p.palabra}-${idx}`}
                        className={`py-1 ${idx === 0 ? "animate-fade-down" : ""}`}
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
        <div className="w-full max-w-2xl flex flex-col gap-8">
          <header className="text-center">
            <p className="text-sm uppercase tracking-widest text-mute mb-2">
              Fin de la partida
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-5xl sm:text-7xl font-black tracking-tight">
              ¡Ganó {nombres[ganador]}!
            </h1>
          </header>

          <section className="bg-white border border-line rounded-2xl p-6 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs uppercase tracking-widest text-mute">
                {nombres[0]}
              </p>
              <p className="font-[family-name:var(--font-display)] text-3xl font-bold mt-1">
                {palabrasJugador0.length}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-mute">Total</p>
              <p className="font-[family-name:var(--font-display)] text-3xl font-bold mt-1 text-coral">
                {palabras.length}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-mute">
                {nombres[1]}
              </p>
              <p className="font-[family-name:var(--font-display)] text-3xl font-bold mt-1">
                {palabrasJugador1.length}
              </p>
            </div>
          </section>

          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([0, 1] as const).map((j) => {
              const lista = j === 0 ? palabrasJugador0 : palabrasJugador1;
              return (
                <div key={j} className="bg-white border border-line rounded-2xl p-5">
                  <h2 className="font-[family-name:var(--font-display)] text-lg font-bold mb-3">
                    {nombres[j]}
                  </h2>
                  <ul className="flex flex-col gap-1 max-h-72 overflow-y-auto">
                    {lista.length === 0 && (
                      <li className="text-mute text-sm italic">
                        No dijo ninguna.
                      </li>
                    )}
                    {lista.map((p, idx) => (
                      <li key={`${p.palabra}-${idx}`}>{capitalizar(p.palabra)}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </section>

          {palabrasPosibles.length > 0 && (
            <section className="bg-white border border-line rounded-2xl p-5">
              <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
                <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">
                  Las que faltaron
                </h2>
                <span className="text-sm text-mute">
                  {faltantes.length.toLocaleString("es-AR")} de{" "}
                  {palabrasPosibles.length.toLocaleString("es-AR")}
                </span>
              </div>
              {faltantes.length === 0 ? (
                <p className="text-mute text-sm italic">
                  No quedó ninguna sin decir.
                </p>
              ) : (
                <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 max-h-80 overflow-y-auto text-sm">
                  {faltantes.map((p) => (
                    <li key={p} className="text-mute">
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
              className="flex-1 bg-coral hover:bg-coral-dark text-white text-lg font-semibold rounded-xl py-4 transition-colors"
            >
              Revancha
            </button>
            <button
              onClick={nuevaPartida}
              className="flex-1 border border-line text-ink hover:border-coral hover:text-coral-dark rounded-xl py-4 font-medium transition-colors"
            >
              Nueva partida
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
