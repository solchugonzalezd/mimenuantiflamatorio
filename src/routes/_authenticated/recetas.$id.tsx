import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Clock, Heart, Users, CookingPot, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { RecipeImage, CATEGORY_IMAGES, timeLabel, servingsLabel } from "@/components/recipe-bits";
import { useCategories, useCurrentPlan, useFavorites, useInvalidate, usePrefs, useUid } from "@/lib/queries";
import { toggleFavorite, DIET_TAG_LABELS } from "@/lib/data";
import { DAY_LABELS, MEAL_LABELS, type MealType } from "@/lib/planner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/recetas/$id")({
  head: () => ({
    meta: [
      { title: "Receta · Método Menú Antiinflamatorio" },
      { name: "description", content: "Ingredientes y preparación paso a paso." },
      { property: "og:title", content: "Receta · Método Menú Antiinflamatorio" },
      { property: "og:description", content: "Ingredientes y preparación paso a paso." },
    ],
  }),
  component: RecipeDetail,
});

function RecipeDetail() {
  const { id } = Route.useParams();
  const uid = useUid();
  const cats = useCategories();
  const favs = useFavorites();
  const plan = useCurrentPlan();
  const prefs = usePrefs();
  const invalidate = useInvalidate();
  const q = useQuery({
    queryKey: ["recipe", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipes")
        .select("*, recipe_ingredients(id, raw_text, optional, sort_order)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [slot, setSlot] = useState<string>("");

  if (q.isLoading) return <p className="text-muted-foreground">Cargando…</p>;
  const r = q.data;
  if (!r) return <p>No encontramos esta receta.</p>;
  const cat = cats.data?.find((c) => c.id === r.category_id);
  const isFav = favs.data?.has(r.id) ?? false;
  const ings = [...(r.recipe_ingredients ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const possibleMeals = (prefs.data?.meals ?? []).filter((m) => r.meal_types.includes(m));

  async function addToPlan() {
    if (!plan.data || !slot) return;
    const [day, meal] = slot.split("|");
    const { error } = await supabase
      .from("meal_plan_items")
      .upsert({ plan_id: plan.data.id, day_index: Number(day), meal_type: meal, recipe_id: r!.id }, { onConflict: "plan_id,day_index,meal_type" });
    if (error) return toast.error("No pudimos agregarla");
    toast.success("Agregada a tu semana");
    invalidate("plan");
  }

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <Link to="/recetas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Recetas
      </Link>
      <div className="overflow-hidden rounded-3xl bg-muted">
        <RecipeImage path={r.image_url} fallback={cat ? CATEGORY_IMAGES[cat.slug] : undefined} alt={r.name} className="aspect-[16/10] w-full object-cover" />
      </div>
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {r.code !== null && <span>Receta {String(r.code).padStart(3, "0")}</span>}
          {cat && <span>· {cat.name}</span>}
          {r.is_demo && <span className="rounded-full bg-warning px-2 py-0.5 text-xs text-warning-foreground">Dato de prueba</span>}
        </div>
        <h1 className="text-3xl md:text-4xl">{r.name}</h1>
        {r.description && <p className="text-muted-foreground">{r.description}</p>}
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-secondary-foreground"><Clock className="h-4 w-4" /> {timeLabel(r)}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-secondary-foreground"><Users className="h-4 w-4" /> {servingsLabel(r.servings)}</span>
          {r.cooking_method && <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-secondary-foreground"><CookingPot className="h-4 w-4" /> {r.cooking_method}</span>}
          {r.diet_tags.map((t) => (
            <span key={t} className="rounded-full border px-3 py-1.5">{DIET_TAG_LABELS[t] ?? t}</span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            variant={isFav ? "default" : "outline"}
            onClick={async () => {
              try {
                await toggleFavorite(uid!, r.id, isFav);
                invalidate("favorites");
              } catch {
                toast.error("No pudimos guardar el favorito");
              }
            }}
          >
            <Heart className={isFav ? "fill-current" : ""} /> {isFav ? "En favoritos" : "Agregar a favoritos"}
          </Button>
        </div>
        {plan.data && possibleMeals.length > 0 && (
          <div className="card-soft flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
            <span className="text-sm">Sumarla a mi semana:</span>
            <Select value={slot} onValueChange={setSlot}>
              <SelectTrigger className="sm:w-60"><SelectValue placeholder="Elegí día y comida" /></SelectTrigger>
              <SelectContent>
                {DAY_LABELS.flatMap((d, di) =>
                  possibleMeals.map((m) => (
                    <SelectItem key={`${di}|${m}`} value={`${di}|${m}`}>{d} · {MEAL_LABELS[m as MealType]}</SelectItem>
                  )),
                )}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={addToPlan} disabled={!slot}>Agregar</Button>
          </div>
        )}
      </header>

      <section className="card-soft p-6">
        <h2 className="text-2xl">Ingredientes</h2>
        {ings.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Ingredientes pendientes de cargar.</p>
        ) : (
          <ul className="mt-4 space-y-2.5 text-lg">
            {ings.map((i) => (
              <li key={i.id} className="flex gap-3">
                <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{i.raw_text}{i.optional && <span className="text-muted-foreground"> (opcional)</span>}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card-soft p-6">
        <h2 className="text-2xl">Preparación</h2>
        {r.steps.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Preparación pendiente de cargar.</p>
        ) : (
          <ol className="mt-4 space-y-5">
            {r.steps.map((s, i) => (
              <li key={i} className="flex gap-4 text-lg leading-relaxed">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {r.tip && (
        <aside className="flex gap-3 rounded-2xl bg-accent p-5 text-accent-foreground">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0" />
          <p>{r.tip}</p>
        </aside>
      )}
    </article>
  );
}
