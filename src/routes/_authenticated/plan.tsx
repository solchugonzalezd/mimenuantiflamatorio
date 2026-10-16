import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Shuffle, AlertTriangle, ShoppingBasket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, timeLabel } from "@/components/recipe-bits";
import { useCurrentPlan, useInvalidate, usePlannerRecipes, usePrefs, useRecipes, useUid } from "@/lib/queries";
import { DAY_LABELS, MEAL_LABELS, MEAL_ORDER, generatePlan, replacementOptions, compatibleFor, MIN_RECIPES_PER_MEAL, type MealType, type PlanItem } from "@/lib/planner";
import { mondayOf } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/plan")({
  head: () => ({
    meta: [
      { title: "Mi semana · Método Menú Antiinflamatorio" },
      { name: "description", content: "Tu planificación semanal de comidas." },
      { property: "og:title", content: "Mi semana · Método Menú Antiinflamatorio" },
      { property: "og:description", content: "Tu planificación semanal de comidas." },
    ],
  }),
  component: PlanPage,
});

function PlanPage() {
  const uid = useUid();
  const prefs = usePrefs();
  const plan = useCurrentPlan();
  const pRecipes = usePlannerRecipes();
  const recipes = useRecipes();
  const invalidate = useInvalidate();
  const [busy, setBusy] = useState(false);
  const [replacing, setReplacing] = useState<{ id: string; meal: MealType; day: number } | null>(null);

  if (prefs.isLoading || plan.isLoading) return <p className="text-muted-foreground">Cargando…</p>;
  if (!prefs.data) {
    return (
      <EmptyState title="Primero, tus preferencias">
        Contanos cuánto tiempo tenés y qué comidas querés organizar.
        <div className="mt-4"><Button asChild><Link to="/perfil">Configurar preferencias</Link></Button></div>
      </EmptyState>
    );
  }
  const p = prefs.data;
  const byId = new Map((recipes.data ?? []).map((r) => [r.id, r]));
  const items = (plan.data?.meal_plan_items ?? []) as (PlanItem & { id: string })[];
  const meals = MEAL_ORDER.filter((m) => p.meals.includes(m));
  const shortages = meals
    .map((m) => ({ meal: m, available: compatibleFor(pRecipes.data ?? [], p, m).length }))
    .filter((s) => s.available < MIN_RECIPES_PER_MEAL);

  async function generate() {
    if (!pRecipes.data) return;
    setBusy(true);
    try {
      const result = generatePlan(pRecipes.data, p);
      await supabase.from("meal_plans").update({ is_current: false }).eq("user_id", uid!).eq("is_current", true);
      const { data: newPlan, error } = await supabase
        .from("meal_plans")
        .insert({ user_id: uid!, week_start: mondayOf(), is_current: true })
        .select("id")
        .single();
      if (error) throw error;
      const rows = result.items.map((i) => ({ ...i, plan_id: newPlan.id }));
      const { error: e2 } = await supabase.from("meal_plan_items").insert(rows);
      if (e2) throw e2;
      invalidate("plan");
      toast.success("¡Tu semana está lista!");
    } catch {
      toast.error("No pudimos generar la planificación");
    } finally {
      setBusy(false);
    }
  }

  async function replaceWith(recipeId: string) {
    if (!replacing) return;
    const { error } = await supabase.from("meal_plan_items").update({ recipe_id: recipeId }).eq("id", replacing.id);
    if (error) return toast.error("No pudimos reemplazarla");
    setReplacing(null);
    invalidate("plan");
  }

  const options = replacing ? replacementOptions(pRecipes.data ?? [], p, replacing.meal, items) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl">Mi semana</h1>
          <p className="mt-1 text-muted-foreground">
            {plan.data ? `Semana del ${new Date(plan.data.week_start + "T12:00").toLocaleDateString("es-UY", { day: "numeric", month: "long" })}` : "Todavía no generaste tu planificación."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={plan.data ? "outline" : "hero"} size="lg" onClick={generate} disabled={busy || pRecipes.isLoading}>
            <RefreshCw className={busy ? "animate-spin" : ""} /> {plan.data ? "Generar otra semana" : "Organizar mi semana"}
          </Button>
          {plan.data && (
            <Button asChild size="lg">
              <Link to="/compras"><ShoppingBasket /> Lista de compras</Link>
            </Button>
          )}
        </div>
      </div>

      {shortages.length > 0 && (
        <div className="flex gap-3 rounded-2xl bg-warning p-4 text-sm text-warning-foreground">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">No hay suficientes recetas compatibles con tus preferencias.</p>
            <ul className="mt-1 list-disc pl-5">
              {shortages.map((s) => (
                <li key={s.meal}>{MEAL_LABELS[s.meal]}: {s.available === 0 ? "ninguna receta disponible" : `solo ${s.available} (algunas se van a repetir)`}</li>
              ))}
            </ul>
            <p className="mt-2">
              Podés <Link to="/perfil" className="underline">ajustar tus preferencias</Link> (por ejemplo, más tiempo o menos ingredientes a evitar).
            </p>
          </div>
        </div>
      )}

      {plan.data && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {DAY_LABELS.map((d, di) => (
            <div key={d} className="card-soft p-5">
              <h2 className="text-xl">{d}</h2>
              <div className="mt-3 space-y-3">
                {meals.map((m) => {
                  const it = items.find((i) => i.day_index === di && i.meal_type === m);
                  const r = it?.recipe_id ? byId.get(it.recipe_id) : undefined;
                  return (
                    <div key={m} className="rounded-xl bg-muted p-3">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">{MEAL_LABELS[m]}</p>
                      {r ? (
                        <div className="mt-1 flex items-start justify-between gap-2">
                          <Link to="/recetas/$id" params={{ id: r.id }} className="font-medium hover:underline">{r.name}</Link>
                          {it && (
                            <button onClick={() => setReplacing({ id: it.id, meal: m, day: di })} className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-card" aria-label="Reemplazar receta">
                              <Shuffle className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">
                          Sin receta compatible
                          {it && <button className="ml-2 underline" onClick={() => setReplacing({ id: it.id, meal: m, day: di })}>elegir</button>}
                        </p>
                      )}
                      {r && <p className="mt-0.5 text-xs text-muted-foreground">{timeLabel(r)}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!replacing} onOpenChange={(o) => !o && setReplacing(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Reemplazar {replacing ? `${MEAL_LABELS[replacing.meal].toLowerCase()} del ${DAY_LABELS[replacing.day].toLowerCase()}` : ""}
            </DialogTitle>
          </DialogHeader>
          {options.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay otras recetas compatibles con tus preferencias para esta comida.</p>
          ) : (
            <div className="space-y-2">
              {options.map((o) => {
                const r = byId.get(o.id);
                if (!r) return null;
                return (
                  <button key={o.id} onClick={() => replaceWith(o.id)} className="block w-full rounded-xl border p-3 text-left hover:bg-accent">
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{timeLabel(r)}</p>
                  </button>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
