import words from "an-array-of-spanish-words";

export const diccionario: Set<string> = new Set(
  (words as string[]).map((w) => w.toLowerCase().trim())
);
