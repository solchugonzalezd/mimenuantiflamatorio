// Interpreta líneas de ingredientes tal como aparecen en el ebook, p. ej. "½ taza de avena".
// Si no se puede confirmar cantidad o unidad, se dejan en null (dato pendiente).

const FRACTIONS: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125 };

const UNIT_MAP: Record<string, string> = {
  g: "g", gr: "g", grs: "g", gramo: "g", gramos: "g",
  kg: "kg", kilo: "kg", kilos: "kg",
  ml: "ml", cc: "ml",
  l: "l", litro: "l", litros: "l",
  taza: "taza", tazas: "taza",
  cda: "cda", cdas: "cda", cucharada: "cda", cucharadas: "cda",
  cdta: "cdta", cdtas: "cdta", cucharadita: "cdta", cucharaditas: "cdta",
  "puñado": "puñado", "puñados": "puñado",
  pizca: "pizca", pizcas: "pizca",
  rebanada: "rebanada", rebanadas: "rebanada",
  feta: "feta", fetas: "feta",
  diente: "diente", dientes: "diente",
  lata: "lata", latas: "lata",
  unidad: "u", unidades: "u",
};

export type ParsedIngredient = {
  raw_text: string;
  quantity: number | null;
  unit: string | null;
  name: string;
  optional: boolean;
};

function parseQuantity(tok: string): number | null {
  if (FRACTIONS[tok] !== undefined) return FRACTIONS[tok];
  const mixed = tok.match(/^(\d+)([½¼¾⅓⅔⅛])$/);
  if (mixed) return Number(mixed[1]) + FRACTIONS[mixed[2]];
  const frac = tok.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const num = tok.replace(",", ".");
  if (/^\d+(\.\d+)?$/.test(num)) return Number(num);
  return null;
}

export function parseIngredientLine(line: string): ParsedIngredient {
  const raw = line.trim().replace(/\s+/g, " ");
  let rest = raw;
  let optional = false;
  if (/\(opcional\)/i.test(rest)) {
    optional = true;
    rest = rest.replace(/\s*\(opcional\)/i, "").trim();
  }
  const tokens = rest.split(" ");
  let quantity: number | null = null;
  let i = 0;
  const q1 = tokens[0] ? parseQuantity(tokens[0]) : null;
  if (q1 !== null) {
    quantity = q1;
    i = 1;
    const q2 = tokens[1] ? parseQuantity(tokens[1]) : null;
    if (q2 !== null && q2 < 1) {
      quantity += q2;
      i = 2;
    }
  }
  let unit: string | null = null;
  if (quantity !== null && tokens[i]) {
    const u = UNIT_MAP[tokens[i].toLowerCase()];
    if (u) {
      unit = u;
      i++;
    } else {
      unit = "u";
    }
  }
  if (tokens[i]?.toLowerCase() === "de") i++;
  const name = tokens.slice(i).join(" ").trim() || raw;
  return { raw_text: raw, quantity, unit, name, optional };
}

/** Clave para identificar un ingrediente: minúsculas, sin tildes, sin espacios extra. */
export function ingredientKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatQuantity(q: number | null): string {
  if (q === null) return "";
  const whole = Math.floor(q);
  const frac = q - whole;
  const map: [number, string][] = [[0.25, "¼"], [0.5, "½"], [0.75, "¾"], [1 / 3, "⅓"], [2 / 3, "⅔"]];
  for (const [v, s] of map) {
    if (Math.abs(frac - v) < 0.02) return whole ? `${whole} ${s}` : s;
  }
  return Number.isInteger(q) ? String(q) : q.toFixed(1).replace(".", ",");
}
