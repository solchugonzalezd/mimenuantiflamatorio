import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RecipeImage } from "@/components/recipe-bits";
import { useCategories, useInvalidate } from "@/lib/queries";
import { saveRecipe, MEAL_VALUES, DIET_TAG_VALUES } from "@/lib/recipe-import";
import { parseIngredientLine } from "@/lib/ingredients";
import { MEAL_LABELS, type MealType } from "@/lib/planner";
import { DIET_TAG_LABELS } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/admin/recetas/$id")({
  component: EditRecipe,
});

type Form = {
  code: string; name: string; category_id: string; description: string; cooking_method: string;
  prep_minutes: string; prep_time_note: string; servings: string; meal_types: string[]; diet_tags: string[];
  ingredients_verified: boolean; ingredients: string; steps: string; tip: string; image_url: string; published: boolean; is_demo: boolean;
};
const EMPTY: Form = { code: "", name: "", category_id: "", description: "", cooking_method: "", prep_minutes: "", prep_time_note: "", servings: "", meal_types: [], diet_tags: [], ingredients_verified: false, ingredients: "", steps: "", tip: "", image_url: "", published: false, is_demo: false };

function EditRecipe() {
  const { id } = Route.useParams();
  const isNew = id === "nueva";
  const cats = useCategories();
  const invalidate = useInvalidate();
  const navigate = useNavigate();
  const [f, setF] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["admin_recipe", id],
    enabled: !isNew,
    queryFn: async () => {
      const { data, error } = await supabase.from("recipes").select("*, recipe_ingredients(raw_text, sort_order, ingredient_id, ingredients(name))").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    const r = q.data;
    if (!r) return;
    setF({
      code: r.code?.toString() ?? "", name: r.name, category_id: r.category_id ?? "", description: r.description ?? "",
      cooking_method: r.cooking_method ?? "", prep_minutes: r.prep_minutes?.toString() ?? "", prep_time_note: r.prep_time_note ?? "",
      servings: r.servings?.toString() ?? "", meal_types: r.meal_types, diet_tags: r.diet_tags, ingredients_verified: r.ingredients_verified,
      ingredients: [...r.recipe_ingredients].sort((a, b) => a.sort_order - b.sort_order).map((i) => i.raw_text).join("\n"),
      steps: r.steps.join("\n"), tip: r.tip ?? "", image_url: r.image_url ?? "", published: r.published, is_demo: r.is_demo,
    });
  }, [q.data]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const toggleArr = (k: "meal_types" | "diet_tags", v: string) => set(k, f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v]);
  const parsed = f.ingredients.split("\n").map((l) => l.trim()).filter(Boolean).map(parseIngredientLine);
  const intOrNull = (s: string) => (s.trim() === "" ? null : Number.parseInt(s, 10));

  async function upload(file: File) {
    const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
    const { error } = await supabase.storage.from("recipe-images").upload(path, file);
    if (error) return toast.error("No se pudo subir la foto");
    set("image_url", path);
  }

  async function save() {
    if (!f.name.trim()) return toast.error("El nombre es obligatorio");
    setBusy(true);
    try {
      const slugById = new Map((cats.data ?? []).map((c) => [c.slug, c.id]));
      const slug = cats.data?.find((c) => c.id === f.category_id)?.slug ?? null;
      const newId = await saveRecipe(
        {
          code: intOrNull(f.code), name: f.name.trim(), category_slug: slug, description: f.description || null,
          cooking_method: f.cooking_method || null, prep_minutes: intOrNull(f.prep_minutes), prep_time_note: f.prep_time_note || null,
          servings: intOrNull(f.servings), meal_types: f.meal_types, diet_tags: f.diet_tags, ingredients_verified: f.ingredients_verified,
          ingredients: parsed, steps: f.steps.split("\n").map((s) => s.trim()).filter(Boolean), tip: f.tip || null,
          image_url: f.image_url || null, published: f.published,
        },
        slugById,
        isNew ? undefined : id,
        f.is_demo,
      );
      toast.success("Receta guardada");
      invalidate("admin_recipes", "recipes", "planner_recipes", "admin_recipe", "recipe");
      if (isNew) navigate({ to: "/admin/recetas/$id", params: { id: newId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("¿Eliminar esta receta? Se quitará también de las planificaciones.")) return;
    const { error } = await supabase.from("recipes").delete().eq("id", id);
    if (error) return toast.error("No se pudo eliminar");
    invalidate("admin_recipes", "recipes", "planner_recipes");
    navigate({ to: "/admin" });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="card-soft grid gap-4 p-5 sm:grid-cols-[100px_1fr]">
        <Field label="Número"><Input value={f.code} onChange={(e) => set("code", e.target.value)} inputMode="numeric" /></Field>
        <Field label="Nombre *"><Input value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
          <Field label="Categoría">
            <select className="h-10 w-full rounded-md border bg-card px-3 text-sm" value={f.category_id} onChange={(e) => set("category_id", e.target.value)}>
              <option value="">Sin categoría</option>
              {(cats.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Método de cocción"><Input value={f.cooking_method} onChange={(e) => set("cooking_method", e.target.value)} placeholder="En sartén, Sin cocción…" /></Field>
          <Field label="Tiempo (minutos)"><Input value={f.prep_minutes} onChange={(e) => set("prep_minutes", e.target.value)} inputMode="numeric" placeholder="Pendiente" /></Field>
          <Field label="Nota de tiempo"><Input value={f.prep_time_note} onChange={(e) => set("prep_time_note", e.target.value)} placeholder="+ noche" /></Field>
          <Field label="Porciones"><Input value={f.servings} onChange={(e) => set("servings", e.target.value)} inputMode="numeric" placeholder="Pendiente" /></Field>
        </div>
        <div className="sm:col-span-2"><Field label="Descripción breve"><Textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={2} /></Field></div>
      </div>

      <div className="card-soft space-y-4 p-5">
        <Label>Foto</Label>
        <div className="flex items-center gap-4">
          {f.image_url && <RecipeImage path={f.image_url} alt="" className="h-20 w-28 rounded-lg object-cover" />}
          <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </div>
      </div>

      <div className="card-soft space-y-4 p-5">
        <div>
          <Label>Tipo de comida (para el planificador)</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {MEAL_VALUES.map((m) => (
              <Toggle key={m} on={f.meal_types.includes(m)} onClick={() => toggleArr("meal_types", m)}>{MEAL_LABELS[m as MealType]}</Toggle>
            ))}
          </div>
        </div>
        <div>
          <Label>Características confirmadas</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {DIET_TAG_VALUES.map((m) => (
              <Toggle key={m} on={f.diet_tags.includes(m)} onClick={() => toggleArr("diet_tags", m)}>{DIET_TAG_LABELS[m]}</Toggle>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Marcalas solo si revisaste los ingredientes. Si no, la receta no se ofrece a quien eligió esa preferencia.</p>
        </div>
      </div>

      <div className="card-soft space-y-3 p-5">
        <Field label="Ingredientes (uno por línea, como en el ebook)">
          <Textarea value={f.ingredients} onChange={(e) => set("ingredients", e.target.value)} rows={8} placeholder={"½ taza de avena\n1 huevo"} />
        </Field>
        {parsed.length > 0 && (
          <div className="rounded-xl bg-muted p-3 text-xs">
            <p className="mb-1 font-medium">Así lo interpreta la lista de compras:</p>
            {parsed.map((p, i) => (
              <p key={i}>
                <strong>{p.name}</strong> — {p.quantity !== null ? `${p.quantity} ${p.unit ?? ""}` : "sin cantidad"}{p.optional ? " (opcional)" : ""}
              </p>
            ))}
          </div>
        )}
        <label className="flex items-center gap-3 text-sm">
          <Switch checked={f.ingredients_verified} onCheckedChange={(v) => set("ingredients_verified", v)} />
          Ingredientes verificados (necesario para poder excluir ingredientes que una usuaria evita)
        </label>
      </div>

      <div className="card-soft space-y-3 p-5">
        <Field label="Preparación (un paso por línea)"><Textarea value={f.steps} onChange={(e) => set("steps", e.target.value)} rows={6} /></Field>
        <Field label="Consejo"><Textarea value={f.tip} onChange={(e) => set("tip", e.target.value)} rows={2} /></Field>
      </div>

      <div className="card-soft flex flex-col gap-3 p-5">
        <label className="flex items-center gap-3 text-sm"><Switch checked={f.published} onCheckedChange={(v) => set("published", v)} /> Publicada (visible para las usuarias)</label>
        <label className="flex items-center gap-3 text-sm"><Switch checked={f.is_demo} onCheckedChange={(v) => set("is_demo", v)} /> Marcar como dato de prueba</label>
      </div>

      <div className="flex justify-between gap-2">
        {!isNew ? <Button variant="outline" onClick={remove}>Eliminar</Button> : <span />}
        <Button size="lg" onClick={save} disabled={busy}>Guardar receta</Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-full border px-3.5 py-1.5 text-sm ${on ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>
      {children}
    </button>
  );
}
