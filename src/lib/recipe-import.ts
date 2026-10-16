import { supabase } from "@/integrations/supabase/client";
import { ingredientKey, parseIngredientLine, type ParsedIngredient } from "./ingredients";

export const CSV_COLUMNS = [
  "codigo",
  "nombre",
  "categoria",
  "descripcion",
  "metodo_coccion",
  "tiempo_minutos",
  "tiempo_nota",
  "porciones",
  "tipos_comida",
  "caracteristicas",
  "ingredientes_verificados",
  "ingredientes",
  "pasos",
  "consejo",
  "foto_url",
  "publicada",
] as const;

export const CSV_HELP: Record<(typeof CSV_COLUMNS)[number], string> = {
  codigo: "Número de la receta en el ebook (ej. 1). Si ya existe, se actualiza.",
  nombre: "Obligatorio.",
  categoria: "desayunos, almuerzos, cenas, ensaladas-tazones, colaciones, postres o salsas-aderezos.",
  descripcion: "Opcional.",
  metodo_coccion: "Ej. En sartén, En olla, Sin cocción, Microondas, De heladera, Licuadora, Al horno.",
  tiempo_minutos: "Número entero. Vacío = pendiente (no entra al planificador).",
  tiempo_nota: "Ej. '+ noche' para recetas de heladera.",
  porciones: "Número entero. Vacío = pendiente.",
  tipos_comida: "Separados por |: desayuno|almuerzo|merienda|cena. Vacío = no se planifica.",
  caracteristicas: "Separadas por |: vegetariana|sin_carne_roja. Solo si está confirmado.",
  ingredientes_verificados: "si / no. 'si' solo si cada ingrediente está bien identificado (necesario para excluir ingredientes).",
  ingredientes: "Uno por línea o separados por |, tal como en el ebook: ½ taza de avena | 1 huevo",
  pasos: "Separados por |, en orden.",
  consejo: "Opcional (el tip al pie de la receta).",
  foto_url: "Opcional. Dirección web de la foto.",
  publicada: "si / no. Las recetas no publicadas no las ven las usuarias.",
};

export const MEAL_VALUES = ["desayuno", "almuerzo", "merienda", "cena"];
export const DIET_TAG_VALUES = ["vegetariana", "sin_carne_roja"];

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQ = false;
  const t = text.replace(/^\uFEFF/, "");
  const delim = (t.split("\n")[0].match(/;/g)?.length ?? 0) > (t.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inQ) {
      if (c === '"' && t[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

const csvEscape = (v: string) => (/[",\n;|]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
export function toCsv(rows: string[][]) {
  return rows.map((r) => r.map(csvEscape).join(",")).join("\n");
}

export type RecipeDraft = {
  code: number | null;
  name: string;
  category_slug: string | null;
  description: string | null;
  cooking_method: string | null;
  prep_minutes: number | null;
  prep_time_note: string | null;
  servings: number | null;
  meal_types: string[];
  diet_tags: string[];
  ingredients_verified: boolean;
  ingredients: ParsedIngredient[];
  steps: string[];
  tip: string | null;
  image_url: string | null;
  published: boolean;
};

export type RowCheck = { row: number; draft: RecipeDraft | null; errors: string[]; missing: string[] };

const split = (v: string) => v.split(/\s*[|\n]\s*/).map((x) => x.trim()).filter(Boolean);
const yes = (v: string) => ["si", "sí", "s", "yes", "true", "1", "x"].includes(v.trim().toLowerCase());

export function validateRows(rows: string[][], categorySlugs: string[]): { header: string[]; checks: RowCheck[]; headerErrors: string[] } {
  const header = (rows[0] ?? []).map((h) => h.trim().toLowerCase());
  const headerErrors: string[] = [];
  if (!header.includes("nombre")) headerErrors.push("Falta la columna obligatoria 'nombre'.");
  const unknown = header.filter((h) => h && !(CSV_COLUMNS as readonly string[]).includes(h));
  if (unknown.length) headerErrors.push(`Columnas desconocidas (se ignoran): ${unknown.join(", ")}`);
  const get = (r: string[], k: string) => (header.indexOf(k) >= 0 ? (r[header.indexOf(k)] ?? "").trim() : "");
  const seenCodes = new Set<number>();

  const checks = rows.slice(1).map((r, idx): RowCheck => {
    const errors: string[] = [];
    const missing: string[] = [];
    const name = get(r, "nombre");
    if (!name) errors.push("Falta el nombre");
    const codeRaw = get(r, "codigo");
    const code = codeRaw ? Number(codeRaw) : null;
    if (codeRaw && (!Number.isInteger(code) || code! < 0)) errors.push(`Código inválido: "${codeRaw}"`);
    if (code !== null && seenCodes.has(code)) errors.push(`Código ${code} repetido en el archivo`);
    if (code !== null) seenCodes.add(code);
    const cat = get(r, "categoria").toLowerCase() || null;
    if (cat && !categorySlugs.includes(cat)) errors.push(`Categoría desconocida: "${cat}"`);
    if (!cat) missing.push("categoría");
    const intField = (k: string, label: string) => {
      const v = get(r, k);
      if (!v) { missing.push(label); return null; }
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0) { errors.push(`${label} inválido: "${v}"`); return null; }
      return n;
    };
    const prep = intField("tiempo_minutos", "tiempo");
    const servings = intField("porciones", "porciones");
    const meals = split(get(r, "tipos_comida").toLowerCase());
    const badMeals = meals.filter((m) => !MEAL_VALUES.includes(m));
    if (badMeals.length) errors.push(`Tipo de comida desconocido: ${badMeals.join(", ")}`);
    if (!meals.length) missing.push("tipo de comida");
    const tags = split(get(r, "caracteristicas").toLowerCase());
    const badTags = tags.filter((m) => !DIET_TAG_VALUES.includes(m));
    if (badTags.length) errors.push(`Característica desconocida: ${badTags.join(", ")}`);
    const ings = split(get(r, "ingredientes")).map(parseIngredientLine);
    if (!ings.length) missing.push("ingredientes");
    const steps = split(get(r, "pasos"));
    if (!steps.length) missing.push("pasos");
    if (errors.length) return { row: idx + 2, draft: null, errors, missing };
    return {
      row: idx + 2,
      errors,
      missing,
      draft: {
        code,
        name,
        category_slug: cat,
        description: get(r, "descripcion") || null,
        cooking_method: get(r, "metodo_coccion") || null,
        prep_minutes: prep,
        prep_time_note: get(r, "tiempo_nota") || null,
        servings,
        meal_types: meals,
        diet_tags: tags,
        ingredients_verified: yes(get(r, "ingredientes_verificados")),
        ingredients: ings,
        steps,
        tip: get(r, "consejo") || null,
        image_url: get(r, "foto_url") || null,
        published: yes(get(r, "publicada")),
      },
    };
  });
  return { header, checks, headerErrors };
}

/** Crea o reutiliza ingredientes por nombre normalizado. Devuelve nombre_key -> id */
export async function ensureIngredients(names: string[]) {
  const unique = new Map<string, string>();
  names.forEach((n) => {
    const k = ingredientKey(n);
    if (k && !unique.has(k)) unique.set(k, n);
  });
  const keys = [...unique.keys()];
  const map = new Map<string, string>();
  for (let i = 0; i < keys.length; i += 300) {
    const chunk = keys.slice(i, i + 300);
    const { data, error } = await supabase
      .from("ingredients")
      .upsert(chunk.map((k) => ({ name_key: k, name: unique.get(k)! })), { onConflict: "name_key", ignoreDuplicates: false })
      .select("id, name_key");
    if (error) throw error;
    data.forEach((d) => map.set(d.name_key, d.id));
  }
  return map;
}

export async function saveRecipe(draft: RecipeDraft, categoryIdBySlug: Map<string, string>, existingId?: string, isDemo = false) {
  const payload = {
    code: draft.code,
    name: draft.name,
    category_id: draft.category_slug ? categoryIdBySlug.get(draft.category_slug) ?? null : null,
    description: draft.description,
    cooking_method: draft.cooking_method,
    prep_minutes: draft.prep_minutes,
    prep_time_note: draft.prep_time_note,
    servings: draft.servings,
    meal_types: draft.meal_types,
    diet_tags: draft.diet_tags,
    ingredients_verified: draft.ingredients_verified,
    steps: draft.steps,
    tip: draft.tip,
    image_url: draft.image_url,
    published: draft.published,
    is_demo: isDemo,
    updated_at: new Date().toISOString(),
  };
  let id = existingId;
  if (!id && draft.code !== null) {
    const { data } = await supabase.from("recipes").select("id").eq("code", draft.code).maybeSingle();
    id = data?.id;
  }
  if (id) {
    const { error } = await supabase.from("recipes").update(payload).eq("id", id);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from("recipes").insert(payload).select("id").single();
    if (error) throw error;
    id = data.id;
  }
  const ingMap = await ensureIngredients(draft.ingredients.map((i) => i.name));
  await supabase.from("recipe_ingredients").delete().eq("recipe_id", id);
  if (draft.ingredients.length) {
    const { error } = await supabase.from("recipe_ingredients").insert(
      draft.ingredients.map((i, idx) => ({
        recipe_id: id!,
        ingredient_id: ingMap.get(ingredientKey(i.name)) ?? null,
        raw_text: i.raw_text,
        quantity: i.quantity,
        unit: i.unit,
        optional: i.optional,
        sort_order: idx,
      })),
    );
    if (error) throw error;
  }
  return id!;
}

export function templateCsv() {
  return toCsv([
    [...CSV_COLUMNS],
    [
      "1",
      "Avena cremosa de manzana y canela",
      "desayunos",
      "",
      "En olla",
      "10",
      "",
      "1",
      "desayuno|merienda",
      "vegetariana",
      "si",
      "½ taza de avena | 1 taza de leche o bebida vegetal | ½ manzana rallada | ½ cdta de canela | 1 cda de nueces picadas | 1 cdta de miel (opcional)",
      "Cociná la avena con la leche a fuego medio durante 5 minutos, revolviendo. | Sumá la manzana y la canela y cociná 2 minutos más. | Serví con las nueces y, si querés, un hilo de miel.",
      "Si la dejás preparada la noche anterior, a la mañana solo la calentás.",
      "",
      "si",
    ],
  ]);
}

export function downloadText(filename: string, text: string) {
  const blob = new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
