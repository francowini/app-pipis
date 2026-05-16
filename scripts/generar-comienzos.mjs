import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Lee data/palabras-limpias.json, cuenta prefijos de 3 letras y elige los
// "potables" para la ruleta de inicio: ni tan pocos (frustra) ni tan
// abundantes (trivial). Sweet spot empírico: 60–1800 palabras por prefijo.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIN = 60;
const MAX = 1800;

const palabras = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "data", "palabras-limpias.json"),
    "utf-8",
  ),
);

const counts = new Map();
for (const p of palabras) {
  if (p.length < 3) continue;
  const prefijo = p.slice(0, 3);
  // Solo a-z + ñ (el corpus ya viene limpio, pero por las dudas).
  if (!/^[a-zñ]{3}$/.test(prefijo)) continue;
  counts.set(prefijo, (counts.get(prefijo) ?? 0) + 1);
}

const filtrados = [...counts.entries()]
  .filter(([, n]) => n >= MIN && n <= MAX)
  .sort((a, b) => b[1] - a[1])
  .map(([prefijo, count]) => ({ prefijo, count }));

console.log("Prefijos totales:", counts.size);
console.log(`Potables (${MIN}–${MAX}):`, filtrados.length);
console.log("Top 10:");
for (const x of filtrados.slice(0, 10)) {
  console.log(`  ${x.prefijo}  ${x.count}`);
}
console.log("Bottom 10:");
for (const x of filtrados.slice(-10)) {
  console.log(`  ${x.prefijo}  ${x.count}`);
}

const out = path.join(__dirname, "..", "data", "comienzos-potables.json");
fs.writeFileSync(out, JSON.stringify(filtrados));
console.log("\nEscrito en:", out);
console.log("Tamaño:", (fs.statSync(out).size / 1024).toFixed(1), "KB");
