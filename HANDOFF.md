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
│   ├── api/validar/route.ts   # POST endpoint que valida cada palabra
│   ├── api/palabras/route.ts  # GET ?letras=xxx → todas las palabras del diccionario con ese prefijo
│   ├── globals.css            # Tailwind v4 + @theme tokens + animaciones
│   ├── layout.tsx             # Fraunces (display) + Space Grotesk (sans)
│   └── page.tsx               # Juego completo: client component con 3 estados
├── data/
│   └── palabras-limpias.json  # Diccionario pre-filtrado (~288k palabras)
├── lib/
│   └── diccionario.ts         # Carga el JSON anterior en un Set<string>
├── scripts/
│   └── limpiar-diccionario.mjs # Regenera data/palabras-limpias.json a partir del paquete npm
├── AGENTS.md                  # Aviso: Next 16 != tu training data
├── CLAUDE.md                  # Punto de entrada (incluye este doc)
├── HANDOFF.md                 # Este archivo
└── README.md                  # Para humanos en GitHub
```

`an-array-of-spanish-words` quedó como **devDependency** porque solo lo usa el script de regeneración; producción carga el JSON.

### Diseño / paleta

- Fondo crema, acentos coral, texto casi negro — todos los tokens en **OKLCH** (no hex) en `globals.css @theme`.
- Texto sobre crema usa `text-coral-ink` (más oscuro, AA-safe a 4.5:1); el coral brillante queda para fondos de CTA, bordes, letras gigantes y selección.
- Tipografía display: **Fraunces** (números grandes, letras iniciales, títulos).
- Tipografía sans: **Space Grotesk** (todo lo demás).
- Animaciones (en `globals.css`): `shake` (input inválido), `fade-down` (palabras nuevas), `ink-stamp` (entrada de las letras gigantes), `turn-settle` (cambio de turno).
- Capa "Tinta y prensa" (overdrive): SVG filter `#tinta-prensa` definido en `layout.tsx` (turbulence + displacementMap suave), aplicado a las 3 letras gigantes vía la clase `.tinta-prensa`. View Transitions API morfea el texto del input hacia la columna del jugador cuando se valida una palabra (`view-transition-name: word-flight`). Confeti tipográfico en `fin`: canvas 2D con física (gravedad/aire/asentamiento) donde cada partícula es una palabra dicha por el ganador en Fraunces.
- Todas las animaciones nuevas respetan `prefers-reduced-motion: reduce` (fallback estático + filter desactivado + confeti se omite).
- **Sin emojis en la UI** — decisión deliberada del diseño original.
- Responsive: mobile pasa las dos columnas de palabras a una sola; stats de fin usan `grid-cols-3` con texto reducido en mobile.

### Accesibilidad

- Mensaje de error tiene `role="alert"` — los lectores de pantalla lo anuncian al fallar una palabra.
- Cambio de turno está en un contenedor `aria-live="polite"` — "Turno de X" se anuncia al cambiar.
- Inputs y botones tienen `focus-visible:ring-2 focus-visible:ring-coral-ink focus-visible:ring-offset-2`, así el foco sigue siendo visible en High Contrast Mode.
- Botón de "Empezar partida" / "Decir palabra" usan `aria-busy` mientras envían.
- El input principal de palabra tiene `aria-label="Palabra"` (el placeholder no cuenta como label).
- El input de letras acepta acentos (se quitan antes de guardar): se evita pérdida silenciosa de tipeo. Hint visible `Acentos se ignoran.` con `aria-describedby`.

### Estados del juego (`app/page.tsx`)

Un único `useState<Estado>` controla qué se renderiza:

1. **`setup`** — inputs de nombres + 3 letras + botón "Letras random" (elige de `COMBINACIONES_COMUNES`) + "Empezar partida".
2. **`jugando`** — header con las 3 letras gigantes en coral + contador "N palabras posibles" debajo, "Turno de [nombre]", input con autofocus, mensaje de error en rojo si la palabra es inválida (NO termina la partida — el jugador puede reintentar), botón "Me rindo", y dos columnas con las palabras dichas por cada jugador.
3. **`fin`** — "¡Ganó [nombre]!", stats (palabras de cada jugador y total), lista completa, sección "Las que faltaron" en grilla scrolleable (diferencia entre `palabrasPosibles` y las dichas), botones "Revancha" (mantiene letras, nombres y `palabrasPosibles`, vacía palabras dichas) y "Nueva partida" (vuelve a `setup`).

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
- Sugerir letras random sesgadas por estadísticas reales del diccionario en lugar de la lista hardcodeada `COMBINACIONES_COMUNES`.
- Animaciones más ricas (confetti al ganar, transiciones entre pantallas). ✅ *Capa "Tinta y prensa" agregada en la 2da sesión: view-transition word-flight, ink-stamp en letras, turn-settle, y confeti tipográfico en `fin`.*
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

## Comandos útiles

```bash
npm run dev                  # dev server
npm run build                # build producción (Turbopack)
npm run start                # corre la build
npx tsc --noEmit             # type check sin emitir
npm run limpiar-diccionario  # regenera data/palabras-limpias.json
```

## Referencias rápidas

- Repo: https://github.com/francowini/app-pipis
- Docs locales de Next 16: `node_modules/next/dist/docs/01-app/`
- Guía de upgrade v15→v16: `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`
