# Palabras Cruzadas

Juego web para 2 jugadores. Se eligen 3 letras iniciales (por ejemplo `POL`) y, por turnos, cada jugador dice una palabra que empiece con esas letras (`polilla`, `policía`, `política`...). El primero que no pueda decir una palabra válida pierde.

## Reglas

- La palabra debe empezar exactamente con las 3 letras elegidas.
- Tiene que existir en el diccionario español.
- No se pueden repetir palabras.
- Los nombres propios no valen (el diccionario no los incluye).

## Stack

- **Next.js 16** con App Router
- **TypeScript** + **Tailwind CSS v4**
- **`an-array-of-spanish-words`** (~636.000 palabras, validación local)
- Sin base de datos, sin APIs externas. El estado vive en React.

## Cómo correrlo

```bash
npm install
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).

## Estructura

- `app/page.tsx` — el juego (setup → jugando → fin)
- `app/api/validar/route.ts` — endpoint POST que valida cada palabra
- `lib/diccionario.ts` — carga el diccionario en memoria una sola vez
