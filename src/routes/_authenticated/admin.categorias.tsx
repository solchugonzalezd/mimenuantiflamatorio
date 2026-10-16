import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCategories, useInvalidate } from "@/lib/queries";
import { ingredientKey } from "@/lib/ingredients";

export const Route = createFileRoute("/_authenticated/admin/categorias")({
  component: CatsPage,
});

function CatsPage() {
  const cats = useCategories();
  const invalidate = useInvalidate();
  const [name, setName] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});

  async function add() {
    if (!name.trim()) return;
    const slug = ingredientKey(name).replace(/ /g, "-");
    const { error } = await supabase.from("categories").insert({ name: name.trim(), slug, sort_order: (cats.data?.length ?? 0) + 1 });
    if (error) { toast.error("No se pudo crear (¿ya existe?)"); return; }
    setName("");
    invalidate("categories");
  }
  async function rename(id: string) {
    const { error } = await supabase.from("categories").update({ name: edits[id] }).eq("id", id);
    if (error) { toast.error("No se pudo guardar"); return; }
    toast.success("Guardado");
    invalidate("categories");
  }
  async function remove(id: string) {
    if (!confirm("¿Eliminar la categoría? Sus recetas quedan sin categoría.")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) { toast.error("No se pudo eliminar"); return; }
    invalidate("categories");
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Para asignar recetas a una categoría, editá la receta o usá la columna “categoria” al importar (con el código que se muestra acá).</p>
      <div className="card-soft divide-y">
        {(cats.data ?? []).map((c) => (
          <div key={c.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
            <Input value={edits[c.id] ?? c.name} onChange={(e) => setEdits((x) => ({ ...x, [c.id]: e.target.value }))} />
            <span className="font-mono text-xs text-muted-foreground sm:w-48">{c.slug}</span>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => rename(c.id)} disabled={!edits[c.id] || edits[c.id] === c.name}>Guardar</Button>
              <Button size="sm" variant="outline" onClick={() => remove(c.id)}>Eliminar</Button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input placeholder="Nueva categoría" value={name} onChange={(e) => setName(e.target.value)} />
        <Button onClick={add}>Crear</Button>
      </div>
    </div>
  );
}
