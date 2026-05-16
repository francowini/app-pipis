import comienzos from "@/data/comienzos-potables.json";

// Prefijos de 3 letras que tienen entre 60 y 1800 palabras en el corpus
// post-limpieza. Generado por `scripts/generar-comienzos.mjs`. La ruleta del
// setup sortea sobre este pool para garantizar partidas viables.
export type Comienzo = { prefijo: string; count: number };

export const comienzosPotables: Comienzo[] = comienzos as Comienzo[];

export function sortearComienzo(excluir: Set<string> = new Set()): Comienzo {
  const pool = comienzosPotables.filter((c) => !excluir.has(c.prefijo));
  const base = pool.length > 0 ? pool : comienzosPotables;
  return base[Math.floor(Math.random() * base.length)];
}
