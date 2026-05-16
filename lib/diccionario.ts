import palabras from "@/data/palabras-limpias.json";

// Diccionario pre-filtrado: parte del paquete `an-array-of-spanish-words`
// (~636k entradas) y se le sacaron las conjugaciones verbales obvias
// (imperfecto, pretérito, subjuntivos, condicional, futuro, presentes plurales
// y el imperativo plural). Se conservan infinitivo, participio, gerundio y
// formas presentes singulares. Generado por `scripts/limpiar-diccionario.mjs`.
export const diccionario: Set<string> = new Set(
  (palabras as string[]).map((w) => w.toLowerCase().trim()),
);
