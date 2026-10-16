import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL = "openai/gpt-image-2.5-sunburst";

export const generateRecipeImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ recipeId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Solo administración");

    const { data: r, error } = await sb
      .from("recipes")
      .select("id, name, description, recipe_ingredients(raw_text)")
      .eq("id", data.recipeId)
      .single();
    if (error || !r) throw new Error("Receta no encontrada");
    const ings = ((r.recipe_ingredients ?? []) as { raw_text: string | null }[])
      .map((i) => i.raw_text)
      .filter(Boolean)
      .slice(0, 10)
      .join(", ");

    const prompt = `Fotografía gastronómica realista, vista cenital 3/4, luz natural suave, de un plato casero saludable: "${r.name}". ${ings ? `Ingredientes visibles: ${ings}.` : ""} Vajilla rústica de cerámica, mantel de lino crema, fondo beige cálido, algunas hierbas frescas. Sin texto, sin personas, sin marcas.`;

    const apiKey = process.env['LOVABLE_API_KEY'];
    if (!apiKey) throw new Error("Falta configuración de IA");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, prompt, size: "1024x768", quality: "low" }),
    });
    if (!res.ok) {
      const t = await res.text();
      return { ok: false as const, status: res.status, message: t.slice(0, 300) };
    }
    const json = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) return { ok: false as const, status: 200, message: "La IA no devolvió imagen" };
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const path = `ai/${r.id}-${Date.now()}.png`;
    const up = await sb.storage.from("recipe-images").upload(path, bin, { contentType: "image/png", upsert: true });
    if (up.error) throw new Error(up.error.message);
    const { error: e2 } = await sb.from("recipes").update({ image_url: path }).eq("id", r.id);
    if (e2) throw new Error(e2.message);
    return { ok: true as const, path };
  });
