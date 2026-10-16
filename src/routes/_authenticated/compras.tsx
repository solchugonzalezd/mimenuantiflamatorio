import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/recipe-bits";
import { useCurrentPlan, useUid } from "@/lib/queries";
import { buildShoppingList, formatAmount, type ShoppingSourceLine } from "@/lib/shopping";

export const Route = createFileRoute("/_authenticated/compras")({
  head: () => ({
    meta: [
      { title: "Lista de compras · Método Menú Antiinflamatorio" },
      { name: "description", content: "Lista de compras de tu semana." },
      { property: "og:title", content: "Lista de compras · Método Menú Antiinflamatorio" },
      { property: "og:description", content: "Lista de compras de tu semana." },
    ],
  }),
  component: ComprasPage,
});

function ComprasPage() {
  const uid = useUid();
  const plan = useCurrentPlan();
  const planId = plan.data?.id;
  const recipeIds = [...new Set((plan.data?.meal_plan_items ?? []).map((i) => i.recipe_id).filter(Boolean) as string[])];
  // Una receta puede aparecer varias veces en la semana: se compra para cada vez.
  const counts = new Map<string, number>();
  (plan.data?.meal_plan_items ?? []).forEach((i) => i.recipe_id && counts.set(i.recipe_id, (counts.get(i.recipe_id) ?? 0) + 1));

  const lines = useQuery({
    queryKey: ["shopping_lines", planId, recipeIds.join(",")],
    enabled: !!planId,
    queryFn: async () => {
      if (recipeIds.length === 0) return [];
      const { data, error } = await supabase
        .from("recipe_ingredients")
        .select("recipe_id, ingredient_id, raw_text, quantity, unit, optional, ingredients(name)")
        .in("recipe_id", recipeIds);
      if (error) throw error;
      return data;
    },
  });
  const checks = useQuery({
    queryKey: ["shopping_checks", planId],
    enabled: !!planId,
    queryFn: async () => {
      const { data, error } = await supabase.from("shopping_checks").select("item_key").eq("plan_id", planId!);
      if (error) throw error;
      return new Set(data.map((d) => d.item_key));
    },
  });

  if (plan.isLoading) return <p className="text-muted-foreground">Cargando…</p>;
  if (!plan.data) {
    return (
      <EmptyState title="Todavía no tenés una semana planificada">
        Generá tu planificación y armamos la lista sola.
        <div className="mt-4"><Button asChild><Link to="/plan">Organizar mi semana</Link></Button></div>
      </EmptyState>
    );
  }

  const source: ShoppingSourceLine[] = [];
  for (const l of lines.data ?? []) {
    if (l.optional) continue;
    const times = counts.get(l.recipe_id) ?? 1;
    for (let t = 0; t < times; t++) {
      source.push({
        recipe_id: l.recipe_id,
        ingredient_id: l.ingredient_id,
        ingredient_name: (l.ingredients as { name: string } | null)?.name ?? null,
        raw_text: l.raw_text,
        quantity: l.quantity,
        unit: l.unit,
      });
    }
  }
  const items = buildShoppingList(source);
  const checked = checks.data ?? new Set<string>();
  const pending = items.filter((i) => !checked.has(i.key));
  const done = items.filter((i) => checked.has(i.key));

  async function toggle(key: string) {
    const isChecked = checked.has(key);
    const { error } = isChecked
      ? await supabase.from("shopping_checks").delete().eq("plan_id", planId!).eq("item_key", key)
      : await supabase.from("shopping_checks").insert({ plan_id: planId!, item_key: key, user_id: uid! });
    if (error) return toast.error("No pudimos guardar el cambio");
    checks.refetch();
  }

  const Row = ({ i }: { i: (typeof items)[number] }) => {
    const isChecked = checked.has(i.key);
    return (
      <button onClick={() => toggle(i.key)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted">
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${isChecked ? "border-primary bg-primary text-primary-foreground" : "border-input"}`}>
          {isChecked && <Check className="h-3.5 w-3.5" />}
        </span>
        <span className={`flex-1 ${isChecked ? "text-muted-foreground line-through" : ""}`}>
          <span className="first-letter:uppercase">{i.name}</span>
          {i.quantity !== null && <span className="text-muted-foreground"> · {formatAmount(i.quantity, i.unit)}</span>}
          {i.notes.length > 0 && <span className="block text-xs text-muted-foreground">{i.notes.join(" · ")}</span>}
        </span>
      </button>
    );
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl">Lista de compras</h1>
        <p className="mt-1 text-muted-foreground">
          {pending.length} pendientes · {done.length} comprados. Las cantidades son las de cada receta, sin ajustar porciones.
        </p>
      </div>
      {items.length === 0 ? (
        <EmptyState title="Sin ingredientes">Las recetas de tu semana todavía no tienen ingredientes cargados.</EmptyState>
      ) : (
        <>
          <div className="card-soft divide-y overflow-hidden">{pending.map((i) => <Row key={i.key} i={i} />)}</div>
          {done.length > 0 && (
            <div>
              <h2 className="mb-2 text-lg">Ya compraste</h2>
              <div className="card-soft divide-y overflow-hidden">{done.map((i) => <Row key={i.key} i={i} />)}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
