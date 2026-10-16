import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCategories } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminRecipes,
});

export function missingFields(r: { prep_minutes: number | null; servings: number | null; meal_types: string[]; steps: string[]; ingredient_count: number }) {
  const m: string[] = [];
  if (r.prep_minutes === null) m.push("tiempo");
  if (r.servings === null) m.push("porciones");
  if (!r.meal_types.length) m.push("tipo de comida");
  if (!r.ingredient_count) m.push("ingredientes");
  if (!r.steps.length) m.push("pasos");
  return m;
}

function AdminRecipes() {
  const cats = useCategories();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "draft" | "incomplete" | "unverified">("all");
  const list = useQuery({
    queryKey: ["admin_recipes"],
    queryFn: async () => {
      const all = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("recipes")
          .select("id, code, name, category_id, prep_minutes, servings, meal_types, steps, published, is_demo, ingredients_verified, diet_tags, recipe_ingredients(count)")
          .order("code", { nullsFirst: false })
          .range(from, from + 999);
        if (error) throw error;
        all.push(...data);
        if (data.length < 1000) break;
      }
      return all.map((r) => ({ ...r, ingredient_count: (r.recipe_ingredients as unknown as { count: number }[])[0]?.count ?? 0 }));
    },
  });
  const catName = new Map((cats.data ?? []).map((c) => [c.id, c.name]));
  const rows = (list.data ?? []).filter((r) => {
    if (q && !r.name.toLowerCase().includes(q.toLowerCase()) && String(r.code) !== q) return false;
    if (filter === "draft") return !r.published;
    if (filter === "incomplete") return missingFields(r).length > 0;
    if (filter === "unverified") return !r.ingredients_verified;
    return true;
  });
  const total = list.data?.length ?? 0;
  const published = list.data?.filter((r) => r.published).length ?? 0;
  const ready = list.data?.filter((r) => r.published && missingFields(r).length === 0).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat n={total} l="Recetas cargadas" />
        <Stat n={published} l="Publicadas" />
        <Stat n={ready} l="Listas para el planificador" />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input placeholder="Buscar por nombre o número" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="h-10 rounded-md border bg-card px-3 text-sm">
          <option value="all">Todas</option>
          <option value="draft">Sin publicar</option>
          <option value="incomplete">Con datos pendientes</option>
          <option value="unverified">Ingredientes sin verificar</option>
        </select>
        <Button asChild>
          <Link to="/admin/recetas/$id" params={{ id: "nueva" }}><Plus /> Nueva receta</Link>
        </Button>
      </div>
      <div className="card-soft divide-y overflow-hidden">
        {rows.length === 0 && <p className="p-6 text-sm text-muted-foreground">No hay recetas. Usá “Importar” para cargarlas desde un archivo.</p>}
        {rows.map((r) => {
          const miss = missingFields(r);
          return (
            <Link key={r.id} to="/admin/recetas/$id" params={{ id: r.id }} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {r.code !== null && <span className="text-muted-foreground">{String(r.code).padStart(3, "0")} · </span>}
                  {r.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.category_id ? catName.get(r.category_id) : "Sin categoría"}
                  {miss.length > 0 && <span className="text-destructive"> · Falta: {miss.join(", ")}</span>}
                  {!r.ingredients_verified && <span> · Ingredientes sin verificar</span>}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5 text-xs">
                {r.is_demo && <span className="rounded-full bg-warning px-2 py-0.5 text-warning-foreground">Prueba</span>}
                <span className={`rounded-full px-2 py-0.5 ${r.published ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {r.published ? "Publicada" : "Borrador"}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ n, l }: { n: number; l: string }) {
  return (
    <div className="card-soft p-4">
      <p className="font-display text-3xl text-primary">{n}</p>
      <p className="text-xs text-muted-foreground">{l}</p>
    </div>
  );
}
