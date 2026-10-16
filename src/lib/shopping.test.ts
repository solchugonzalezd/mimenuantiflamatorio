import { describe, expect, it } from "vitest";
import { buildShoppingList } from "./shopping";
import { parseIngredientLine } from "./ingredients";

describe("lista de compras", () => {
  it("suma el mismo ingrediente con unidades compatibles (g + kg)", () => {
    const list = buildShoppingList([
      { recipe_id: "a", ingredient_id: "tofu", ingredient_name: "tofu", raw_text: "150 g de tofu", quantity: 150, unit: "g" },
      { recipe_id: "b", ingredient_id: "tofu", ingredient_name: "tofu", raw_text: "1 kg de tofu", quantity: 1, unit: "kg" },
    ]);
    expect(list).toHaveLength(1);
    expect(list[0].quantity).toBe(1150);
  });
  it("mantiene separadas unidades no comparables", () => {
    const list = buildShoppingList([
      { recipe_id: "a", ingredient_id: "avena", ingredient_name: "avena", raw_text: "½ taza", quantity: 0.5, unit: "taza" },
      { recipe_id: "b", ingredient_id: "avena", ingredient_name: "avena", raw_text: "4 cdas", quantity: 4, unit: "cda" },
    ]);
    expect(list).toHaveLength(2);
  });
  it("no combina ingredientes no identificados aunque se parezcan", () => {
    const list = buildShoppingList([
      { recipe_id: "a", ingredient_id: null, ingredient_name: null, raw_text: "Sal y pimienta", quantity: null, unit: null },
      { recipe_id: "b", ingredient_id: null, ingredient_name: null, raw_text: "Sal", quantity: null, unit: null },
    ]);
    expect(list).toHaveLength(2);
  });
});

describe("lectura de ingredientes del ebook", () => {
  it("interpreta '½ taza de avena'", () => {
    expect(parseIngredientLine("½ taza de avena")).toMatchObject({ quantity: 0.5, unit: "taza", name: "avena" });
  });
  it("detecta opcional", () => {
    expect(parseIngredientLine("1 cdta de miel (opcional)")).toMatchObject({ quantity: 1, unit: "cdta", name: "miel", optional: true });
  });
  it("deja cantidad pendiente cuando no la hay", () => {
    expect(parseIngredientLine("Sal y pimienta")).toMatchObject({ quantity: null, unit: null });
  });
});
