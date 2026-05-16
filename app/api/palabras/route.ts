import { diccionario } from "@/lib/diccionario";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const letras = (url.searchParams.get("letras") ?? "")
    .toLowerCase()
    .trim();

  if (!letras || letras.length !== 3) {
    return Response.json({ palabras: [], total: 0 });
  }

  const palabras: string[] = [];
  for (const palabra of diccionario) {
    if (palabra.startsWith(letras)) {
      palabras.push(palabra);
    }
  }
  palabras.sort((a, b) => a.localeCompare(b, "es"));

  return Response.json({ palabras, total: palabras.length });
}
