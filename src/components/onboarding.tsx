import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useInvalidate, useUid } from "@/lib/queries";
import { fetchPlannerRecipes, mondayOf } from "@/lib/data";
import { generatePlan, MEAL_LABELS, MEAL_ORDER, type CookTime, type MealType } from "@/lib/planner";

const TIMES: { v: CookTime; l: string; d: string }[] = [
  { v: "hasta_20", l: "Hasta 20 min", d: "Comidas rápidas" },
  { v: "20_40", l: "Entre 20 y 40 min", d: "Un poco más de tiempo" },
  { v: "mas_40", l: "Más de 40 min", d: "Cocino con calma" },
];

function Opt({ active, onClick, title, desc }: { active: boolean; onClick: () => void; title: string; desc?: string }) {
  return (
    <button type="button" onClick={onClick} className={`w-full rounded-2xl border p-4 text-left transition-colors ${active ? "border-primary bg-accent" : "bg-card hover:bg-muted"}`}>
      <p className="font-medium">{title}</p>
      {desc && <p className="text-sm text-muted-foreground">{desc}</p>}
    </button>
  );
}

export function Onboarding({ onClose }: { onClose?: () => void }) {
  const uid = useUid();
  const invalidate = useInvalidate();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [cookTime, setCookTime] = useState<CookTime>("hasta_20");
  const [meals, setMeals] = useState<MealType[]>(["almuerzo", "cena"]);
  const [busy, setBusy] = useState(false);

  async function finish() {
    if (!uid) return;
    if (meals.length === 0) { toast.error("Elegí al menos una comida"); return; }
    setBusy(true);
    try {
      const prefs = { user_id: uid, cook_time: cookTime, diet: "variada", diet_other: null, meals, avoid_ingredient_ids: [] as string[], updated_at: new Date().toISOString() };
      const { error } = await supabase.from("user_preferences").upsert(prefs);
      if (error) throw error;
      const recipes = await fetchPlannerRecipes();
      const result = generatePlan(recipes, { cook_time: cookTime, diet: "variada", meals, avoid_ingredient_ids: [] });
      await supabase.from("meal_plans").update({ is_current: false }).eq("user_id", uid).eq("is_current", true);
      const { data: plan, error: e1 } = await supabase.from("meal_plans").insert({ user_id: uid, week_start: mondayOf(), is_current: true }).select("id").single();
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("meal_plan_items").insert(result.items.map((i) => ({ ...i, plan_id: plan.id })));
      if (e2) throw e2;
      invalidate("prefs", "plan");
      toast.success("¡Tu semana está lista!");
      navigate({ to: "/plan" });
    } catch {
      toast.error("No pudimos armar tu semana. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto [&>button]:hidden" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Paso {step + 1} de 2</p>
          <DialogTitle className="text-2xl">
            {step === 0 ? "¿Cuánto tiempo tenés para cocinar?" : "¿Qué comidas querés organizar?"}
          </DialogTitle>
          <DialogDescription>Con esto armamos tu semana. Lo podés cambiar cuando quieras.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {step === 0 && TIMES.map((t) => <Opt key={t.v} active={cookTime === t.v} onClick={() => setCookTime(t.v)} title={t.l} desc={t.d} />)}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-2">
              {MEAL_ORDER.map((m) => (
                <Opt key={m} active={meals.includes(m)} onClick={() => setMeals((c) => (c.includes(m) ? c.filter((x) => x !== m) : [...c, m]))} title={MEAL_LABELS[m]} />
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-between gap-2 pt-2">
          {step === 0 && onClose ? (
            <Button variant="ghost" onClick={onClose}>Más tarde</Button>
          ) : (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0 || busy}>Atrás</Button>
          )}
          {step < 1 ? (
            <Button onClick={() => setStep((s) => s + 1)}>Siguiente</Button>
          ) : (
            <Button variant="hero" onClick={finish} disabled={busy}>{busy ? "Armando tu semana…" : "Armar mi semana"}</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
