import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Square } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { generateRecipeImage } from "@/lib/recipe-images.functions";

export function AiPhotosPanel() {
  const qc = useQueryClient();
  const gen = useServerFn(generateRecipeImage);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const stop = useRef(false);
  const missing = useQuery({
    queryKey: ["recipes_without_photo"],
    queryFn: async () => {
      const { data, error } = await supabase.from("recipes").select("id, name").is("image_url", null).order("code").limit(1000);
      if (error) throw error;
      return data;
    },
  });
  const list = missing.data ?? [];

  async function run() {
    stop.current = false;
    setRunning(true);
    setDone(0);
    for (const r of list) {
      if (stop.current) break;
      try {
        const res = await gen({ data: { recipeId: r.id } });
        if (!res.ok) {
          toast.error(res.status === 402 ? "Se agotaron los créditos de IA. Recargá para seguir." : `No se pudo generar: ${r.name}`);
          if (res.status === 402 || res.status === 403) break;
          await new Promise((s) => setTimeout(s, 3000));
          continue;
        }
        setDone((d) => d + 1);
      } catch {
        toast.error(`Error con ${r.name}`);
      }
    }
    setRunning(false);
    qc.invalidateQueries({ queryKey: ["recipes_without_photo"] });
    qc.invalidateQueries({ queryKey: ["recipes"] });
  }

  return (
    <div className="card-soft flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium">Fotos de recetas</p>
        <p className="text-sm text-muted-foreground">
          {missing.isLoading ? "Contando…" : running ? `Generando… ${done} de ${list.length}` : `${list.length} recetas sin foto. Las fotos se crean con IA (ilustrativas).`}
        </p>
      </div>
      {running ? (
        <Button variant="outline" onClick={() => (stop.current = true)}><Square /> Detener</Button>
      ) : (
        <Button onClick={run} disabled={!list.length}><Sparkles /> Generar fotos faltantes</Button>
      )}
    </div>
  );
}
