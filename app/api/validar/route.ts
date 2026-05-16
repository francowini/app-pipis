import { diccionario } from "@/lib/diccionario";

type Body = {
  palabra: string;
  letras: string;
  palabrasUsadas: string[];
};

export async function POST(req: Request) {
  const { palabra, letras, palabrasUsadas } = (await req.json()) as Body;

  const p = (palabra ?? "").toLowerCase().trim();
  const l = (letras ?? "").toLowerCase().trim();

  if (!p) {
    return Response.json({ valida: false, motivo: "Escribí una palabra" });
  }
  if (!l || l.length !== 3) {
    return Response.json({ valida: false, motivo: "Letras iniciales inválidas" });
  }
  if (!p.startsWith(l)) {
    return Response.json({
      valida: false,
      motivo: `No empieza con "${l.toUpperCase()}"`,
    });
  }
  if (palabrasUsadas?.includes(p)) {
    return Response.json({ valida: false, motivo: "Esa palabra ya se dijo" });
  }
  if (!diccionario.has(p)) {
    return Response.json({ valida: false, motivo: "No está en el diccionario" });
  }

  return Response.json({ valida: true, motivo: "¡Válida!" });
}
