import { describe, expect, it } from "vitest";
import { generatePlan, whyIneligible, type PlannerPrefs, type PlannerRecipe } from "./planner";

const base: PlannerRecipe = {
  id: "x",
  prep_minutes: 15,
  servings: 1,
  meal_types: ["almuerzo"],
  diet_tags: [],
  ingredients_verified: true,
  steps_count: 3,
  ingredient_ids: ["i1"],
};
const prefs: PlannerPrefs = { cook_time: "hasta_20", diet: "variada", meals: ["almuerzo"], avoid_ingredient_ids: [] };

describe("reglas del planificador", () => {
  it("excluye recetas sin tiempo registrado", () => {
    expect(whyIneligible({ ...base, prep_minutes: null }, prefs)).toBe("incompleta");
  });
  it("'Hasta 20 minutos' excluye una receta de 25 minutos", () => {
    expect(whyIneligible({ ...base, prep_minutes: 25 }, prefs)).toBe("tiempo");
  });
  it("'Entre 20 y 40' admite 40 minutos y excluye 41", () => {
    const p = { ...prefs, cook_time: "20_40" as const };
    expect(whyIneligible({ ...base, prep_minutes: 40 }, p)).toBeNull();
    expect(whyIneligible({ ...base, prep_minutes: 41 }, p)).toBe("tiempo");
  });
  it("vegetariana excluye solo recetas etiquetadas como no vegetarianas", () => {
    const p = { ...prefs, diet: "vegetariana" };
    expect(whyIneligible(base, p)).toBeNull();
    expect(whyIneligible({ ...base, diet_tags: ["con_carne"] }, p)).toBe("preferencia");
    expect(whyIneligible({ ...base, diet_tags: ["vegetariana"] }, p)).toBeNull();
  });
  it("con ingredientes a evitar, excluye solo recetas verificadas que los contienen", () => {
    const p = { ...prefs, avoid_ingredient_ids: ["i9"] };
    expect(whyIneligible({ ...base, ingredients_verified: false, ingredient_ids: ["i9"] }, p)).toBeNull();
    expect(whyIneligible({ ...base, ingredient_ids: ["i9"] }, p)).toBe("ingrediente_evitado");
  });
  it("solo planifica las comidas elegidas y no repite si hay 7 o más recetas", () => {
    const recipes = Array.from({ length: 8 }, (_, i) => ({ ...base, id: `r${i}` }));
    const { items, shortages } = generatePlan(recipes, prefs, 1);
    expect(items).toHaveLength(7);
    expect(items.every((i) => i.meal_type === "almuerzo")).toBe(true);
    expect(new Set(items.map((i) => i.recipe_id)).size).toBe(7);
    expect(shortages).toHaveLength(0);
  });
  it("avisa cuando no hay suficientes recetas compatibles", () => {
    const { shortages } = generatePlan([base], prefs, 1);
    expect(shortages).toEqual([{ meal_type: "almuerzo", available: 1 }]);
  });
});
