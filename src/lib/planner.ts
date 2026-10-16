// Planificador semanal basado en reglas (sin IA).

export type MealType = "desayuno" | "almuerzo" | "merienda" | "cena";
export type CookTime = "hasta_20" | "20_40" | "mas_40";

export const MEAL_LABELS: Record<MealType, string> = {
  desayuno: "Desayuno",
  almuerzo: "Almuerzo",
  merienda: "Merienda",
  cena: "Cena",
};
export const MEAL_ORDER: MealType[] = ["desayuno", "almuerzo", "merienda", "cena"];
export const DAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export type PlannerRecipe = {
  id: string;
  prep_minutes: number | null;
  servings: number | null;
  meal_types: string[];
  diet_tags: string[];
  ingredients_verified: boolean;
  steps_count: number;
  ingredient_ids: (string | null)[];
};

export type PlannerPrefs = {
  cook_time: CookTime;
  diet: string;
  meals: MealType[];
  avoid_ingredient_ids: string[];
};

export type PlanItem = { day_index: number; meal_type: MealType; recipe_id: string | null };
export type Shortage = { meal_type: MealType; available: number };

export const TIME_LIMIT: Record<CookTime, number | null> = { hasta_20: 20, "20_40": 40, mas_40: null };

export type Ineligibility =
  | "incompleta"
  | "tiempo"
  | "preferencia"
  | "ingredientes_sin_verificar"
  | "ingrediente_evitado";

/** Devuelve null si la receta es compatible, o el motivo por el que no lo es. */
export function whyIneligible(r: PlannerRecipe, p: PlannerPrefs): Ineligibility | null {
  if (r.prep_minutes === null || r.servings === null || r.steps_count === 0 || r.ingredient_ids.length === 0 || r.meal_types.length === 0) {
    return "incompleta";
  }
  const limit = TIME_LIMIT[p.cook_time];
  if (limit !== null && r.prep_minutes > limit) return "tiempo";
  if (p.diet === "vegetariana" && !r.diet_tags.includes("vegetariana")) return "preferencia";
  if (p.diet === "sin_carne_roja" && !r.diet_tags.includes("sin_carne_roja") && !r.diet_tags.includes("vegetariana")) {
    return "preferencia";
  }
  if (p.avoid_ingredient_ids.length > 0) {
    if (!r.ingredients_verified || r.ingredient_ids.some((id) => id === null)) return "ingredientes_sin_verificar";
    if (r.ingredient_ids.some((id) => id && p.avoid_ingredient_ids.includes(id))) return "ingrediente_evitado";
  }
  return null;
}

export function compatibleFor(recipes: PlannerRecipe[], p: PlannerPrefs, meal: MealType) {
  return recipes.filter((r) => r.meal_types.includes(meal) && whyIneligible(r, p) === null);
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function overlap(a: PlannerRecipe, b: PlannerRecipe | undefined) {
  if (!b) return 0;
  const s = new Set(b.ingredient_ids.filter(Boolean));
  return a.ingredient_ids.filter((x) => x && s.has(x)).length;
}

export const MIN_RECIPES_PER_MEAL = 7;

export function generatePlan(recipes: PlannerRecipe[], prefs: PlannerPrefs, seed = Date.now()) {
  const rand = rng(seed);
  const items: PlanItem[] = [];
  const shortages: Shortage[] = [];
  const usedThisWeek = new Set<string>();
  const byId = new Map(recipes.map((r) => [r.id, r]));

  for (const meal of MEAL_ORDER.filter((m) => prefs.meals.includes(m))) {
    const pool = shuffle(compatibleFor(recipes, prefs, meal), rand);
    if (pool.length < MIN_RECIPES_PER_MEAL) shortages.push({ meal_type: meal, available: pool.length });
    let queue: PlannerRecipe[] = [];
    let prev: PlannerRecipe | undefined;
    for (let day = 0; day < 7; day++) {
      if (pool.length === 0) {
        items.push({ day_index: day, meal_type: meal, recipe_id: null });
        continue;
      }
      if (queue.length === 0) {
        // Primero recetas que no se usaron esta semana en otra comida; se repite solo si no alcanza.
        const fresh = pool.filter((r) => !usedThisWeek.has(r.id));
        queue = fresh.length ? fresh : [...pool];
      }
      // Variedad: elegir la que menos ingredientes comparte con la del día anterior.
      queue.sort((a, b) => overlap(a, prev) - overlap(b, prev));
      const pick = queue.shift()!;
      usedThisWeek.add(pick.id);
      prev = byId.get(pick.id);
      items.push({ day_index: day, meal_type: meal, recipe_id: pick.id });
    }
  }
  return { items, shortages };
}

/** Recetas compatibles para reemplazar una comida, sin repetir las ya elegidas para ese tipo de comida. */
export function replacementOptions(recipes: PlannerRecipe[], prefs: PlannerPrefs, meal: MealType, items: PlanItem[]) {
  const used = new Set(items.filter((i) => i.meal_type === meal).map((i) => i.recipe_id));
  return compatibleFor(recipes, prefs, meal).filter((r) => !used.has(r.id));
}
