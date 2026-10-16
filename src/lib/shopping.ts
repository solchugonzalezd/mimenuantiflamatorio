// Lista de compras derivada de la planificación.
// Solo se suman cantidades del mismo ingrediente (identificado en la base) con unidades comparables.

export type ShoppingSourceLine = {
  recipe_id: string;
  ingredient_id: string | null;
  ingredient_name: string | null;
  raw_text: string;
  quantity: number | null;
  unit: string | null;
};

export type ShoppingItem = {
  key: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  /** Líneas que no se pudieron sumar (texto original). */
  notes: string[];
  recipe_ids: string[];
};

// Unidades convertibles a una base común.
const BASE: Record<string, { base: string; factor: number }> = {
  g: { base: "g", factor: 1 },
  kg: { base: "g", factor: 1000 },
  ml: { base: "ml", factor: 1 },
  l: { base: "ml", factor: 1000 },
};

function normUnit(unit: string) {
  return BASE[unit] ?? { base: unit, factor: 1 };
}

export function buildShoppingList(lines: ShoppingSourceLine[]): ShoppingItem[] {
  const map = new Map<string, ShoppingItem>();
  for (const l of lines) {
    let key: string;
    let name: string;
    let qty: number | null = null;
    let unit: string | null = null;
    if (l.ingredient_id && l.quantity !== null && l.unit) {
      const n = normUnit(l.unit);
      key = `${l.ingredient_id}|${n.base}`;
      name = l.ingredient_name ?? l.raw_text;
      qty = l.quantity * n.factor;
      unit = n.base;
    } else if (l.ingredient_id) {
      key = `${l.ingredient_id}|sin-cantidad`;
      name = l.ingredient_name ?? l.raw_text;
    } else {
      // Sin ingrediente identificado: no se combina con otros.
      key = `texto|${l.raw_text.toLowerCase()}`;
      name = l.raw_text;
    }
    const existing = map.get(key);
    if (existing) {
      if (qty !== null && existing.quantity !== null) existing.quantity += qty;
      if (qty === null && l.ingredient_id && l.raw_text !== name) existing.notes.push(l.raw_text);
      if (!existing.recipe_ids.includes(l.recipe_id)) existing.recipe_ids.push(l.recipe_id);
    } else {
      map.set(key, {
        key,
        name,
        quantity: qty,
        unit,
        notes: qty === null && l.ingredient_id && l.raw_text !== name ? [l.raw_text] : [],
        recipe_ids: [l.recipe_id],
      });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export function formatAmount(q: number | null, unit: string | null): string {
  if (q === null) return "";
  if (unit === "g" && q >= 1000) return `${(q / 1000).toString().replace(".", ",")} kg`;
  if (unit === "ml" && q >= 1000) return `${(q / 1000).toString().replace(".", ",")} l`;
  const n = Number.isInteger(q) ? String(q) : q.toFixed(2).replace(/\.?0+$/, "").replace(".", ",");
  return unit && unit !== "u" ? `${n} ${unit}` : n;
}
