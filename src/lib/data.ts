import { supabase } from "@/integrations/supabase/client";
import type { PlannerPrefs, PlannerRecipe, MealType, CookTime } from "./planner";

export const RECIPE_LIST_FIELDS =
  "id, code, name, description, image_url, prep_minutes, prep_time_note, servings, meal_types, diet_tags, cooking_method, category_id, published, is_demo, ingredients_verified, steps";

export type RecipeRow = {
  id: string;
  code: number | null;
  name: string;
  description: string | null;
  image_url: string | null;
  prep_minutes: number | null;
  prep_time_note: string | null;
  servings: number | null;
  meal_types: string[];
  diet_tags: string[];
  cooking_method: string | null;
  category_id: string | null;
  published: boolean;
  is_demo: boolean;
  ingredients_verified: boolean;
  steps: string[];
};

export async function fetchCategories() {
  const { data, error } = await supabase.from("categories").select("*").order("sort_order");
  if (error) throw error;
  return data;
}

export async function fetchDietOptions() {
  const { data, error } = await supabase.from("diet_options").select("*").order("sort_order");
  if (error) throw error;
  return data;
}

export async function fetchRecipes(): Promise<RecipeRow[]> {
  const all: RecipeRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("recipes")
      .select(RECIPE_LIST_FIELDS)
      .eq("published", true)
      .order("code", { ascending: true, nullsFirst: false })
      .range(from, from + 999);
    if (error) throw error;
    all.push(...(data as RecipeRow[]));
    if (!data || data.length < 1000) break;
  }
  return all;
}

export async function fetchPlannerRecipes(): Promise<PlannerRecipe[]> {
  const recipes = await fetchRecipes();
  const ids = recipes.map((r) => r.id);
  const ingByRecipe = new Map<string, (string | null)[]>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase
      .from("recipe_ingredients")
      .select("recipe_id, ingredient_id")
      .in("recipe_id", ids.slice(i, i + 200));
    if (error) throw error;
    for (const row of data) {
      const arr = ingByRecipe.get(row.recipe_id) ?? [];
      arr.push(row.ingredient_id);
      ingByRecipe.set(row.recipe_id, arr);
    }
  }
  return recipes.map((r) => ({
    id: r.id,
    prep_minutes: r.prep_minutes,
    servings: r.servings,
    meal_types: r.meal_types,
    diet_tags: r.diet_tags,
    ingredients_verified: r.ingredients_verified,
    steps_count: r.steps.length,
    ingredient_ids: ingByRecipe.get(r.id) ?? [],
  }));
}

export async function fetchPrefs(uid: string): Promise<PlannerPrefs & { diet_other: string | null } | null> {
  const { data, error } = await supabase.from("user_preferences").select("*").eq("user_id", uid).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    cook_time: data.cook_time as CookTime,
    diet: data.diet,
    diet_other: data.diet_other,
    meals: data.meals as MealType[],
    avoid_ingredient_ids: data.avoid_ingredient_ids,
  };
}

export async function fetchCurrentPlan(uid: string) {
  const { data, error } = await supabase
    .from("meal_plans")
    .select("id, week_start, created_at, meal_plan_items(id, day_index, meal_type, recipe_id)")
    .eq("user_id", uid)
    .eq("is_current", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchFavoriteIds(uid: string) {
  const { data, error } = await supabase.from("favorites").select("recipe_id").eq("user_id", uid);
  if (error) throw error;
  return new Set(data.map((d) => d.recipe_id));
}

export async function toggleFavorite(uid: string, recipeId: string, isFav: boolean) {
  const q = isFav
    ? supabase.from("favorites").delete().eq("user_id", uid).eq("recipe_id", recipeId)
    : supabase.from("favorites").insert({ user_id: uid, recipe_id: recipeId });
  const { error } = await q;
  if (error) throw error;
}

const signedCache = new Map<string, string>();
/** Las fotos pueden ser URLs externas o rutas dentro del almacenamiento privado. */
export async function resolveImage(path: string | null): Promise<string | null> {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  if (signedCache.has(path)) return signedCache.get(path)!;
  const { data } = await supabase.storage.from("recipe-images").createSignedUrl(path, 60 * 60 * 24);
  if (data?.signedUrl) signedCache.set(path, data.signedUrl);
  return data?.signedUrl ?? null;
}

export function mondayOf(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x.toISOString().slice(0, 10);
}

export const DIET_TAG_LABELS: Record<string, string> = {
  vegetariana: "Vegetariana",
  sin_carne_roja: "Sin carne roja",
};
