# Handoff — Palabras Cruzadas

Documento para que la próxima sesión de Claude Code arranque sabiendo de dónde venimos. Resumen de lo construido, decisiones tomadas y estado actual al cierre de la primera sesión.

## Qué es el juego

App web para 2 jugadores (sin red, todo local en una pantalla compartida):

- Se eligen **3 letras iniciales** (por ejemplo `POL`).
- Por turnos, cada jugador dice una palabra que **empiece exactamente** con esas 3 letras (`polilla`, `policía`, `polenta`...).
- La palabra debe existir en el diccionario español (`an-array-of-spanish-words`, ~636k palabras).
- No se puede repetir palabras en la misma partida.
- Nombres propios no valen — se resuelve solo porque el diccionario no los incluye.
- El primero que no puede decir una palabra válida (o aprieta "Me rindo") **pierde**.

## Stack y decisiones clave

| Área | Elección | Por qué |
|---|---|---|
| Framework | **Next.js 16.2.6** (App Router, Turbopack default) | Lo que instala `create-next-app@latest`. Ojo: NO es Next 15 — leer cambios en `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` antes de tocar APIs request-time. Ver [`AGENTS.md`](./AGENTS.md). |
| Lenguaje | **TypeScript 5** estricto | Ya viene del scaffold. |
| Estilos | **Tailwind CSS v4** (no v3) | Config nueva: tokens en `@theme {}` dentro de `globals.css`, no hay `tailwind.config.ts`. |
| React | **19.2** + React Compiler estable (`babel-plugin-react-compiler` ya en deps) | Default en Next 16. |
| Diccionario | **`data/palabras-limpias.json`** (~288k palabras, ~3.4 MB), derivado de `an-array-of-spanish-words` v2.0.0 | El paquete trae ~636k entradas incluyendo cada conjugación regular, lo que llenaba el panel "Las que faltaron" de formas verbales que nadie diría. El script `scripts/limpiar-diccionario.mjs` pre-filtra las conjugaciones inequívocas (imperfecto, pretérito, subjuntivos, condicional, futuro, presentes plurales, imperativo plural) cuando existe el infinitivo correspondiente y al menos dos formas características confirman que se trata de un verbo. Conserva infinitivo, participio, gerundio, plurales, femeninos y presentes singulares. Se carga una vez a nivel módulo en `lib/diccionario.ts` (Set en memoria) para que el serverless function lo cachee. |
| Estado | `useState` en un único client component | Sin DB, sin auth, sin persistencia entre sesiones. Cerrar la pestaña pierde la partida — es intencional. |
| Validación | Endpoint **POST `/api/validar`** | El cliente manda `{ palabra, letras, palabrasUsadas }`, el servidor responde `{ valida: boolean, motivo: string }`. La lista de palabras usadas vive en el cliente y viaja en cada request — el servidor es stateless. |
| Conteo y listado | Endpoint **GET `/api/palabras?letras=xxx`** | Devuelve `{ palabras: string[], total: number }` con todas las palabras del diccionario que arrancan con esas 3 letras. Se fetchea **una vez** al apretar "Empezar partida" y queda en estado para mostrar el total durante el juego y las faltantes en el fin. |

## Estructura de archivos

```
palabras-cruzadas/
├── app/
│   ├── api/validar/route.ts    # POST endpoint que valida cada palabra
│   ├── api/palabras/route.ts   # GET ?letras=xxx → todas las palabras del diccionario con ese prefijo
│   ├── globals.css             # Tailwind v4 + @theme tokens + @property + animaciones
│   ├── layout.tsx              # Fraunces (variable, axes opsz/SOFT/WONK) + Space Grotesk
│   └── page.tsx                # Juego completo: client component con 3 estados (setup/jugando/fin)
├── components/
│   ├── Atelier.tsx             # Background: canvas 2D papel + corpus tenue (palabras flotando)
│   ├── Confetti.tsx            # Confeti tipográfico del ganador en `fin`
│   └── Ruleta.tsx              # 3 reels Fraunces con WAAPI deceleration
├── data/
│   ├── palabras-limpias.json   # Diccionario pre-filtrado (~288k palabras, 3.4 MB)
│   └── comienzos-potables.json # Prefijos de 3 letras con 60–1800 palabras (824 entradas, 24 KB)
├── lib/
│   ├── diccionario.ts          # Carga `palabras-limpias.json` en un Set<string>
│   └── comienzos.ts            # `sortearComienzo(excluir)` para la ruleta
├── scripts/
│   ├── limpiar-diccionario.mjs # Regenera `data/palabras-limpias.json`
│   └── generar-comienzos.mjs   # Regenera `data/comienzos-potables.json`
├── AGENTS.md                   # Aviso: Next 16 != tu training data
├── CLAUDE.md                   # Punto de entrada (incluye este doc)
├── HANDOFF.md                  # Este archivo
└── README.md                   # Para humanos en GitHub
```

`an-array-of-spanish-words` quedó como **devDependency** porque solo lo usa el script de regeneración; producción carga el JSON.

### Diseño / paleta

- Fondo crema, acentos coral, texto casi negro — todos los tokens en **OKLCH** (no hex) en `globals.css @theme`.
- Texto sobre crema usa `text-coral-ink` (más oscuro, AA-safe a 4.5:1); el coral brillante queda para fondos de CTA, bordes, letras gigantes y selección.
- Tipografía display: **Fraunces** variable (axes habilitados: `opsz`, `SOFT`, `WONK`).
- Tipografía sans: **Space Grotesk** (todo lo demás).
- Animaciones (en `globals.css`): `shake` (input inválido), `fade-down` (palabras nuevas), `ink-stamp`, `turn-settle`, `respiracion` (axes Fraunces variando lento), `peak-axes` (peak al validar), `ink-press` (final de reel), `corpus-drift` (palabras tenues del Atelier), `ripple-out` (onda al validar), `bloom-in`/`dim-out` (View Transitions).
- Capa "Tinta y prensa": SVG filter `#tinta-prensa` en `layout.tsx`, aplicado a las 3 letras gigantes.
- Todas las animaciones respetan `prefers-reduced-motion: reduce` con fallbacks que igual se ven editoriales (axes en valores medios fijos, sin drift, sin ripple).
- **Sin emojis en la UI** — decisión deliberada.
- Responsive: mobile pasa columnas a una sola; stats de fin usan `grid-cols-3` con texto reducido.

### Overdrive "Atelier Vivo" (3era sesión)

Capa visual completa que reemplazó la "Tinta y prensa" sutil de la 2da sesión. Más rica y vívida punta-a-punta:

- **Ruleta tipográfica** (`components/Ruleta.tsx`) reemplaza el input manual de 3 letras como entrada principal en `setup`. Tres reels con cells Fraunces que giran via Web Animations API (`cubic-bezier(0.16, 1, 0.3, 1)`, durs `1.5s / 2.1s / 2.7s` en cascada) y al detenerse cada cell hace `ink-press` (axes WONK 0→1→0.2, SOFT 30→100→50, color ink→coral→coral-ink). El target sale de `lib/comienzos.ts` que samplea `data/comienzos-potables.json` (824 prefijos con 60–1800 palabras cada uno, generados por `scripts/generar-comienzos.mjs`). "Elegir a mano" sigue disponible como disclosure secundaria.
- **Atelier background** (`components/Atelier.tsx`) renderiza siempre detrás del juego: un canvas 2D con ~240 puntos de tinta drifteando lentamente (papel respirando) y, durante `jugando`/`fin`, ~78 palabras del corpus actual flotando muy tenues alrededor de la UI (evita la columna central). Cuando una palabra se dice, el `<span>` correspondiente cambia a clase `dicha` y el corpus tenue la enciende: opacity 0.06 → 0.42, color coral-ink → coral, axes WONK 0 → 1 (todo con transition de 1.2s ease-out-expo). En `fin` el constelado queda visible como pieza de cierre.
- **Axes Fraunces animados** via `@property --wonk` y `@property --soft` (registrados en `globals.css`). Permiten que `@keyframes` interpole las variables y las pase a `font-variation-settings`, así el tipo realmente cambia de forma (no solo escala/color). La clase `.letras-gigantes` tiene `respiracion 9s infinite alternate` por defecto y al validar una palabra se le agrega `peak` que dispara `peak-axes` 0.7s. La ruleta también respira por el mismo sistema.
- **Ripple del input**: al validar una palabra, el contenedor `.input-ripple` recibe la clase `fire` que dispara `ripple-out` (un círculo coral que crece de 0.4× a 38× con fade) saliendo del input. Es la onda visible del Atelier.
- **View Transitions encadenadas**: la ruleta (en setup), el header `P O L` gigante (en jugando) y un `P O L` chiquito al lado del título de fin comparten `view-transition-name: letras-gigantes`, así el viaje setup → jugando → fin es UNA pieza tipográfica que muta de tamaño y rol. Cualquier cambio de estado se envuelve en `startViewTransition(() => flushSync(apply))` para que el navegador haga el morph. `word-flight` sigue siendo el morph del input → fila de la columna del jugador al validar (intacto de la 2da sesión).
- **Confeti tipográfico** en `fin` (`components/Confetti.tsx`): canvas 2D con física, cada partícula es una palabra del ganador en Fraunces. Idéntico a la 2da sesión, ahora coexiste con el corpus tenue iluminado.

### Accesibilidad

- Mensaje de error tiene `role="alert"` — los lectores de pantalla lo anuncian al fallar una palabra.
- Cambio de turno está en un contenedor `aria-live="polite"` — "Turno de X" se anuncia al cambiar.
- Inputs y botones tienen `focus-visible:ring-2 focus-visible:ring-coral-ink focus-visible:ring-offset-2`, así el foco sigue siendo visible en High Contrast Mode.
- Botón de "Empezar partida" / "Decir palabra" usan `aria-busy` mientras envían.
- El input principal de palabra tiene `aria-label="Palabra"` (el placeholder no cuenta como label).
- El input de letras acepta acentos (se quitan antes de guardar): se evita pérdida silenciosa de tipeo. Hint visible `Acentos se ignoran.` con `aria-describedby`.

### Estados del juego (`app/page.tsx`)

Un único `useState<Estado>` controla qué se renderiza:

1. **`setup`** — inputs de nombres + ruleta tipográfica con CTA "Sortear letras" y disclosure "Elegir a mano" (input manual de 3 caracteres) + "Empezar partida". Al cargar, la ruleta ya muestra un sorteo inicial para que no esté vacía.
2. **`jugando`** — header con las 3 letras gigantes en coral (axes Fraunces respirando, peak al validar) + contador "N palabras posibles", "Turno de [nombre]", input con autofocus y ripple al validar, mensaje de error en rojo si la palabra es inválida (NO termina la partida), botón "Me rindo", dos columnas con las palabras dichas por cada jugador (numeradas con tabular-nums en Fraunces).
3. **`fin`** — `P O L` chiquito + "¡Ganó [nombre]!" con `ink-stamp`, stats (palabras de cada jugador y total), lista completa, "Las que faltaron" en grilla, "Revancha" (mantiene letras y `palabrasPosibles`, vacía palabras dichas) y "Nueva partida" (vuelve a `setup`). El Atelier sigue activo con el corpus iluminado en las palabras dichas + Confetti tipográfico encima.

El input mantiene foco después de cada intento (válido o no) vía `inputRef` + `useEffect` que se reactiva en cada cambio de `turno`.

## Estado al cierre de la primera sesión

- ✅ Repo en **`git@github.com:francowini/app-pipis.git`**, rama `main` con todo el juego funcionando.
- ✅ PR #1 ya mergeado (era el README, hecho como demo del flow de GitHub).
- ✅ Conectado a Vercel — cada push a `main` deploya solo.
- ✅ Validador testeado con curl: palabras válidas, prefijo equivocado, repetidas — todo OK.
- ⚠️ Hay un warning del workspace root de Next 16 al correr `npm run dev` por un `package-lock.json` que existe en `/Users/francowini/Documents/`. Si molesta, agregar `turbopack: { root: __dirname }` a `next.config.ts` o borrar el lockfile huérfano.
- ⚠️ El package tiene 2 vulnerabilidades moderadas reportadas por `npm audit` que son del scaffold de create-next-app. No son críticas.

## Cómo correrlo localmente

```bash
cd palabras-cruzadas
npm install   # solo la primera vez
npm run dev   # http://localhost:3000
```

Cold start del primer hit a `/api/validar` puede tardar ~1s (carga el diccionario). Después es instantáneo.

## Cómo deployar

Push a `main` → Vercel deploya solo. No hay env vars, no hay DB. El JSON del diccionario pesa ~3.4 MB; el bundle de la función queda muy por debajo del límite de 250 MB del plan free.

## Ideas / features pendientes (no implementadas)

Lo que charlamos pero no hicimos todavía. Si el usuario pide alguna, ya está pensada:

- Timer por turno (configurable en setup, ej. 10s/20s/30s).
- Modo difícil: prohibir palabras de menos de N letras o que terminen en plural.
- Filtrar regionalismos (chiapaneco, chibcha, chibola, chibuqui, chicano, chilango…). El paquete base no marca origen, así que requiere o cambiar a un lemario más chico, o scrapear las marcas `Méx.`/`Arg.`/etc. del DLE. Quedó fuera de la primera pasada por costo/beneficio.
- Sugerir letras random sesgadas por estadísticas reales del diccionario en lugar de la lista hardcodeada `COMBINACIONES_COMUNES`. ✅ *3era sesión: `data/comienzos-potables.json` con 824 prefijos jugables, sampleados por la ruleta vía `lib/comienzos.ts`.*
- Animaciones más ricas. ✅ *2da sesión: "Tinta y prensa" sutil (view-transition word-flight, ink-stamp, turn-settle, confeti). 3era sesión: "Atelier Vivo" — ruleta tipográfica, axes Fraunces animados, Atelier background con corpus tenue iluminándose, ripple del input, view transitions encadenadas setup→jugando→fin.*
- Modo oscuro respetando la paleta.
- Soporte para más de 2 jugadores.
- Persistencia opcional con `localStorage` para sobrevivir a un refresh accidental.
- Refactor: partir `page.tsx` (~370 líneas) en `<Setup/>`, `<Jugando/>`, `<Fin/>` separados.

Si se agregan features, **actualizar este archivo** con lo nuevo.

## Cosas a NO romper

- La carga del diccionario debe quedarse a nivel módulo (`const diccionario = ...`), no dentro del handler. Si se mueve adentro, cada request paga ~1s de cold start.
- El validador chequea en este orden: vacía → prefijo → ya usada → en diccionario. Si se cambia el orden, los mensajes de error van a quedar inconsistentes con la intención original.
- El cliente envía `palabrasUsadas` en cada request — el servidor es stateless. No agregar estado del lado server sin pensar bien por qué.
- `letras` viaja siempre en lowercase desde el cliente; la UI las muestra uppercase.
- No editar `data/palabras-limpias.json` a mano. Cualquier cambio en el corpus pasa por `scripts/limpiar-diccionario.mjs` + `npm run limpiar-diccionario` para que el script siga siendo la fuente de verdad.
- No editar `data/comienzos-potables.json` a mano. Si cambia el umbral (60–1800), actualizar `scripts/generar-comienzos.mjs` y correr `npm run generar-comienzos`. La ruleta depende de que cada prefijo tenga partida viable.
- Los axes WONK/SOFT/opsz se animan via `@property`. Si se quita la registración o se renombra `--wonk`/`--soft`, las animaciones `respiracion`, `peak-axes`, `ink-press`, `fade-down` y `turn-settle` dejan de variar el tipo (siguen funcionando, pero pierden el efecto del Atelier).
- `axes: ["opsz", "SOFT", "WONK"]` en `next/font/google` Fraunces. Sin esto el navegador descarga solo el axis `wght` y `font-variation-settings` con SOFT/WONK no hace nada.
- El Atelier corpus tenue evita el rectángulo central (`left 30–70%, top 20–80%`) para no estorbar la UI. Si se mueve el layout principal, ajustar el filtro en `components/Atelier.tsx`.

## Comandos útiles

```bash
npm run dev                  # dev server
npm run build                # build producción (Turbopack)
npm run start                # corre la build
npx tsc --noEmit             # type check sin emitir
npm run limpiar-diccionario  # regenera data/palabras-limpias.json
npm run generar-comienzos    # regenera data/comienzos-potables.json para la ruleta
```

## Referencias rápidas

- Repo: https://github.com/francowini/app-pipis
- Docs locales de Next 16: `node_modules/next/dist/docs/01-app/`
- Guía de upgrade v15→v16: `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`
