import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { useInvalidate, usePrefs, useUid } from "@/lib/queries";
import { MEAL_LABELS, MEAL_ORDER, type CookTime, type MealType } from "@/lib/planner";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Mis preferencias · Método Menú Antiinflamatorio" },
      { name: "description", content: "Configurá tu tiempo, preferencias y comidas a planificar." },
      { property: "og:title", content: "Mis preferencias · Método Menú Antiinflamatorio" },
      { property: "og:description", content: "Configurá tu tiempo y preferencias." },
    ],
  }),
  component: Perfil,
});

const TIMES: { v: CookTime; l: string; d: string }[] = [
  { v: "hasta_20", l: "Hasta 20 min", d: "Comidas rápidas para el día a día" },
  { v: "20_40", l: "Entre 20 y 40 min", d: "Un poco más de tiempo" },
  { v: "mas_40", l: "Más de 40 min", d: "Me gusta cocinar con calma" },
];

function Option({ active, onClick, title, desc }: { active: boolean; onClick: () => void; title: string; desc?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition-colors ${active ? "border-primary bg-accent" : "bg-card hover:bg-muted"}`}
    >
      <p className="font-medium">{title}</p>
      {desc && <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>}
    </button>
  );
}

function Perfil() {
  const uid = useUid();
  const { hasAccess, session } = useAuth();
  const prefs = usePrefs();
  const invalidate = useInvalidate();
  const navigate = useNavigate();
  const [cookTime, setCookTime] = useState<CookTime>("hasta_20");
  const [meals, setMeals] = useState<MealType[]>(["almuerzo", "cena"]);
  const [avoid, setAvoid] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const ingredients = useQuery({
    queryKey: ["ingredients"],
    enabled: hasAccess,
    queryFn: async () => {
      const { data, error } = await supabase.from("ingredients").select("id, name").order("name").limit(5000);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (prefs.data) {
      setCookTime(prefs.data.cook_time);
      setMeals(prefs.data.meals);
      setAvoid(prefs.data.avoid_ingredient_ids);
    }
  }, [prefs.data]);

  const ingName = new Map((ingredients.data ?? []).map((i) => [i.id, i.name]));
  const matches = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return [];
    return (ingredients.data ?? []).filter((i) => i.name.toLowerCase().includes(t) && !avoid.includes(i.id)).slice(0, 8);
  }, [search, ingredients.data, avoid]);

  async function save() {
    if (meals.length === 0) { toast.error("Elegí al menos una comida para planificar"); return; }
    const { error } = await supabase.from("user_preferences").upsert({
      user_id: uid!,
      cook_time: cookTime,
      diet: prefs.data?.diet ?? "variada",
      diet_other: prefs.data?.diet_other ?? null,
      meals,
      avoid_ingredient_ids: avoid,
      updated_at: new Date().toISOString(),
    });
    if (error) { toast.error("No pudimos guardar tus preferencias"); return; }
    toast.success("Preferencias guardadas");
    invalidate("prefs");
    if (hasAccess) navigate({ to: "/plan" });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl md:text-4xl">Mis preferencias</h1>
        <p className="mt-1 text-muted-foreground">Con esto armamos tu semana. Podés cambiarlo cuando quieras.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl">¿Cuánto tiempo tenés para cocinar?</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {TIMES.map((t) => (
            <Option key={t.v} active={cookTime === t.v} onClick={() => setCookTime(t.v)} title={t.l} desc={t.d} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl">¿Qué comidas querés organizar?</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {MEAL_ORDER.map((m) => (
            <Option
              key={m}
              active={meals.includes(m)}
              onClick={() => setMeals((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]))}
              title={MEAL_LABELS[m]}
            />
          ))}
        </div>
      </section>

      {hasAccess && (
        <section className="space-y-3">
          <h2 className="text-xl">Ingredientes que preferís evitar</h2>
          <p className="text-sm text-muted-foreground">
            Vamos a evitar las recetas que sabemos que los llevan.
          </p>
          <div className="flex flex-wrap gap-2">
            {avoid.map((id) => (
              <span key={id} className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground">
                {ingName.get(id) ?? "…"}
                <button onClick={() => setAvoid((a) => a.filter((x) => x !== id))} aria-label="Quitar"><X className="h-3.5 w-3.5" /></button>
              </span>
            ))}
          </div>
          <Input placeholder="Buscá un ingrediente (ej. huevo)" value={search} onChange={(e) => setSearch(e.target.value)} />
          {matches.length > 0 && (
            <div className="card-soft divide-y">
              {matches.map((m) => (
                <button key={m.id} className="block w-full px-4 py-2.5 text-left text-sm hover:bg-muted" onClick={() => { setAvoid((a) => [...a, m.id]); setSearch(""); }}>
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      <Button size="lg" variant="hero" className="w-full" onClick={save}>Guardar preferencias</Button>
      <p className="text-center text-xs text-muted-foreground">
        Tus datos se guardan en este dispositivo. {session?.user.is_anonymous && <Link to="/auth" className="underline">Acceso administración</Link>}
      </p>
    </div>
  );
}
