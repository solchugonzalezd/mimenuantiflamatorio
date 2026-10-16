import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { CalendarDays, BookOpen, ShoppingBasket, Heart, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useCurrentPlan, usePrefs, useRecipes } from "@/lib/queries";
import { DAY_LABELS, MEAL_LABELS, MEAL_ORDER, type MealType } from "@/lib/planner";
import hero from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Método Menú Antiinflamatorio · Organizá tu semana" },
      { name: "description", content: "Recetas antiinflamatorias, planificación semanal según tu tiempo y lista de compras automática." },
      { property: "og:title", content: "Método Menú Antiinflamatorio" },
      { property: "og:description", content: "Recetas antiinflamatorias, planificación semanal y lista de compras." },
    ],
  }),
  component: Index,
});

function Index() {
  const { session, loading } = useAuth();
  useEffect(() => {
    if (!loading && !session) supabase.auth.signInAnonymously();
  }, [loading, session]);
  if (loading || !session) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Cargando…</div>;
  return (
    <AppShell>
      <Home />
    </AppShell>
  );
}

function Home() {
  const plan = useCurrentPlan();
  const prefs = usePrefs();
  const recipes = useRecipes();
  const todayIdx = (new Date().getDay() + 6) % 7;
  const byId = new Map((recipes.data ?? []).map((r) => [r.id, r]));
  const todayItems = (plan.data?.meal_plan_items ?? [])
    .filter((i) => i.day_index === todayIdx)
    .sort((a, b) => MEAL_ORDER.indexOf(a.meal_type as MealType) - MEAL_ORDER.indexOf(b.meal_type as MealType));

  return (
    <div className="space-y-8">
      <section className="card-soft overflow-hidden md:grid md:grid-cols-[1.2fr_1fr]">
        <img src={hero} alt="Platos antiinflamatorios" className="h-44 w-full object-cover md:hidden" width={1600} height={1008} />
        <div className="p-6 md:p-10">
          <p className="text-sm text-muted-foreground">¡Hola! Bienvenida</p>
          <h1 className="mt-1 text-3xl md:text-4xl">¿Qué comemos esta semana?</h1>
          <p className="mt-3 text-muted-foreground">Elegimos recetas según tu tiempo y tus preferencias. Vos solo cocinás.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="hero" size="lg">
              <Link to="/plan">Organizar mi semana</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/recetas">Explorar recetas</Link>
            </Button>
          </div>
          {!prefs.isLoading && !prefs.data && (
            <Link to="/perfil" className="mt-5 inline-flex items-center gap-2 text-sm text-primary underline-offset-4 hover:underline">
              <Settings2 className="h-4 w-4" /> Primero contanos tus preferencias
            </Link>
          )}
        </div>
        <img src={hero} alt="" className="hidden h-full w-full object-cover md:block" width={1600} height={1008} />
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <QuickLink to="/plan" icon={CalendarDays} label="Mi semana" />
        <QuickLink to="/recetas" icon={BookOpen} label="Recetas" />
        <QuickLink to="/compras" icon={ShoppingBasket} label="Lista de compras" />
        <QuickLink to="/favoritos" icon={Heart} label="Favoritos" />
      </section>

      {plan.data && (
        <section>
          <h2 className="text-2xl">Hoy, {DAY_LABELS[todayIdx]!.toLowerCase()}</h2>
          {todayItems.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No hay comidas planificadas para hoy.</p>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {todayItems.map((i) => {
                const r = i.recipe_id ? byId.get(i.recipe_id) : undefined;
                return (
                  <div key={i.id} className="card-soft flex items-center justify-between p-4">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">{MEAL_LABELS[i.meal_type as MealType]}</p>
                      <p className="mt-1 font-medium">{r?.name ?? "Sin receta asignada"}</p>
                    </div>
                    {r && (
                      <Button asChild size="sm" variant="secondary">
                        <Link to="/recetas/$id" params={{ id: r.id }}>Ver</Link>
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function QuickLink({ to, icon: Icon, label }: { to: "/plan" | "/recetas" | "/compras" | "/favoritos"; icon: typeof Heart; label: string }) {
  return (
    <Link to={to} className="card-soft flex flex-col items-start gap-3 p-4 transition-colors hover:bg-accent">
      <span className="rounded-full bg-secondary p-2.5 text-secondary-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <span className="font-medium">{label}</span>
    </Link>
  );
}
