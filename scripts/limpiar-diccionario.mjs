import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const wordsPath = path.join(
  __dirname,
  "..",
  "node_modules",
  "an-array-of-spanish-words",
  "index.json",
);
const words = JSON.parse(fs.readFileSync(wordsPath, "utf-8"));

const dict = new Set(words.map((w) => w.toLowerCase().trim()));

// Sufijos conjugados inequívocos. Cada par = [sufijo, terminación del infinitivo].
// Si una palabra termina en `sufijo` Y el infinitivo correspondiente
// (raíz + terminación) existe en el diccionario, la palabra es una conjugación.
// Se omiten a propósito formas presentes/cortas (-a, -as, -an, -o, -e, -es, -en,
// -amos, -emos, -imos, -ais, -eis, -is) porque colisionan demasiado con
// sustantivos y adjetivos comunes. También se conservan participios (-ado/-ido y
// sus variantes) porque también funcionan como adjetivos.

// Sufijos -ar inequívocos: si una palabra termina así y existe el infinitivo
// raíz+ar, es una conjugación.
const SUF_AR = [
  // imperfecto
  "abamos", "abais", "aban", "abas", "aba",
  // pretérito
  "asteis", "aste", "aron",
  // subj. -ra
  "aramos", "arais", "aran", "aras", "ara",
  // subj. -se
  "asemos", "aseis", "asen", "ases", "ase",
  // subj. fut. / fut. ind.
  "aremos", "areis", "aren", "ares", "are",
  // condicional
  "ariamos", "ariais", "arian", "arias", "aria",
  // imperativo plural (gerundios -ando/-iendo se mantienen como palabras válidas)
  "ad",
  // presente: usamos solo formas plurales (1pl, 2pl, 3pl ind.) que casi nunca
  // colisionan con sustantivos. Singulares (-o, -a, -as) chocan con sustantivos.
  "amos", "ais", "an",
  // subjuntivo presente plural (e/es/en/emos/eis para -ar): "chie", "chies",
  // "chien", "chiemos", "chieis". Sufijos cortos -e/-es/-en pueden eliminar
  // sustantivos válidos (pase, base, ...), así que solo los plurales.
  "emos", "eis", "en",
];

const SUF_ER = [
  // imperfecto
  "iamos", "iais", "ian", "ias", "ia",
  // pretérito
  "isteis", "iste", "ieron",
  // subj. -ra
  "ieramos", "ierais", "ieran", "ieras", "iera",
  // subj. -se
  "iesemos", "ieseis", "iesen", "ieses", "iese",
  // subj. fut.
  "ieremos", "iereis", "ieren", "ieres", "iere",
  // condicional
  "eriamos", "eriais", "erian", "erias", "eria",
  // imperativo plural (gerundio -iendo se mantiene como palabra válida)
  "ed",
  // presente plural -er
  "emos", "eis", "en",
  // subjuntivo presente plural -er (-amos, -ais, -an)
  "amos", "ais", "an",
];

const SUF_IR = [
  // imperfecto
  "iamos", "iais", "ian", "ias", "ia",
  // pretérito
  "isteis", "iste", "ieron",
  // subj. -ra
  "ieramos", "ierais", "ieran", "ieras", "iera",
  // subj. -se
  "iesemos", "ieseis", "iesen", "ieses", "iese",
  // subj. fut.
  "ieremos", "iereis", "ieren", "ieres", "iere",
  // condicional
  "iriamos", "iriais", "irian", "irias", "iria",
  // imperativo plural (gerundio -iendo se mantiene como palabra válida)
  "id",
  // presente plural -ir (irregular: -imos, -is, -en)
  "imos", "is", "en",
  // subjuntivo presente plural -ir (-amos, -ais, -an)
  "amos", "ais", "an",
];

const REGLAS = [];
for (const s of SUF_AR) REGLAS.push([s, "ar"]);
for (const s of SUF_ER) REGLAS.push([s, "er"]);
for (const s of SUF_IR) REGLAS.push([s, "ir"]);
// dedup
const visto = new Set();
const REGLAS_DEDUP = REGLAS.filter(([s, t]) => {
  const k = s + "|" + t;
  if (visto.has(k)) return false;
  visto.add(k);
  return true;
});
REGLAS.length = 0;
REGLAS.push(...REGLAS_DEDUP);
// ordenar por longitud desc para que "abamos" gane a "amos" (si lo hubiera) y "ase".
REGLAS.sort((a, b) => b[0].length - a[0].length);

// Una palabra terminada en -ar/-er/-ir puede ser un sustantivo (afer, mar, sur,
// etc.) y no un infinitivo. Para distinguir, exigimos que existan al menos
// otras dos formas conjugadas características del supuesto verbo. Cacheamos
// el resultado por infinitivo.
const verboCache = new Map();
function esVerbo(infinitivo) {
  if (verboCache.has(infinitivo)) return verboCache.get(infinitivo);
  const tipo = infinitivo.slice(-2);
  const raiz = infinitivo.slice(0, -2);
  let formas = [];
  if (tipo === "ar") {
    formas = [
      raiz + "ando",
      raiz + "ado",
      raiz + "aba",
      raiz + "ara",
      raiz + "aria",
      raiz + "aron",
    ];
  } else if (tipo === "er" || tipo === "ir") {
    formas = [
      raiz + "iendo",
      raiz + "ido",
      raiz + "ia",
      raiz + "iera",
      raiz + (tipo === "er" ? "eria" : "iria"),
      raiz + "ieron",
    ];
  }
  // contar cuántas formas características existen
  let n = 0;
  for (const f of formas) if (dict.has(f)) n++;
  const r = n >= 2;
  verboCache.set(infinitivo, r);
  return r;
}

const aEliminar = new Set();
const palabras = [...dict];

for (const palabra of palabras) {
  if (palabra.length < 4) continue;
  for (const [suf, infSuf] of REGLAS) {
    if (palabra.length > suf.length + 1 && palabra.endsWith(suf)) {
      const raiz = palabra.slice(0, -suf.length);
      const infinitivo = raiz + infSuf;
      if (
        infinitivo !== palabra &&
        dict.has(infinitivo) &&
        esVerbo(infinitivo)
      ) {
        aEliminar.add(palabra);
        break;
      }
    }
  }
}

const filtrado = palabras.filter((w) => !aEliminar.has(w)).sort();

console.log("Original:", dict.size);
console.log("Eliminadas (conjugaciones):", aEliminar.size);
console.log("Filtrado:", filtrado.length);
console.log(
  "Reducción:",
  ((aEliminar.size / dict.size) * 100).toFixed(1) + "%",
);

// muestreo chi*
const chiOrig = [...dict].filter((w) => w.startsWith("chi")).length;
const chiFinal = filtrado.filter((w) => w.startsWith("chi")).length;
console.log(`\nMuestreo 'chi*': ${chiOrig} -> ${chiFinal}`);

const out = path.join(__dirname, "..", "data", "palabras-limpias.json");
fs.writeFileSync(out, JSON.stringify(filtrado));
console.log("\nEscrito en:", out);
console.log("Tamaño:", (fs.statSync(out).size / 1024 / 1024).toFixed(2), "MB");
