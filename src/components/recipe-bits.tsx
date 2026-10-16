import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Clock, Heart, Users } from "lucide-react";
import { resolveImage, type RecipeRow } from "@/lib/data";
import desayunos from "@/assets/cat-desayunos.jpg";
import almuerzos from "@/assets/cat-almuerzos.jpg";
import cenas from "@/assets/cat-cenas.jpg";
import ensaladas from "@/assets/cat-ensaladas.jpg";
import colaciones from "@/assets/cat-colaciones.jpg";
import postres from "@/assets/cat-postres.jpg";
import salsas from "@/assets/cat-salsas.jpg";

export const CATEGORY_IMAGES: Record<string, string> = {
  desayunos,
  almuerzos,
  cenas,
  "ensaladas-tazones": ensaladas,
  colaciones,
  postres,
  "salsas-aderezos": salsas,
};

export function RecipeImage({ path, fallback, alt, className }: { path: string | null; fallback?: string; alt: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    resolveImage(path).then((u) => alive && setSrc(u));
    return () => {
      alive = false;
    };
  }, [path]);
  const final = src ?? fallback ?? ensaladas;
  return <img src={final} alt={alt} loading="lazy" className={className} />;
}

export function timeLabel(r: Pick<RecipeRow, "prep_minutes" | "prep_time_note">) {
  if (r.prep_minutes === null) return "Tiempo pendiente";
  return `${r.prep_minutes} min${r.prep_time_note ? ` ${r.prep_time_note}` : ""}`;
}

export function servingsLabel(s: number | null) {
  if (s === null) return "Porciones pendientes";
  return `${s} ${s === 1 ? "porción" : "porciones"}`;
}

export function RecipeCard({
  recipe,
  categorySlug,
  isFav,
  onToggleFav,
}: {
  recipe: RecipeRow;
  categorySlug?: string;
  isFav?: boolean;
  onToggleFav?: () => void;
}) {
  return (
    <div className="card-soft group relative overflow-hidden">
      <Link to="/recetas/$id" params={{ id: recipe.id }} className="block">
        <div className="aspect-[4/3] overflow-hidden bg-muted">
          <RecipeImage
            path={recipe.image_url}
            fallback={categorySlug ? CATEGORY_IMAGES[categorySlug] : undefined}
            alt={recipe.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
        <div className="space-y-2 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {recipe.code !== null && <span>Receta {String(recipe.code).padStart(3, "0")}</span>}
            {recipe.is_demo && <span className="rounded-full bg-warning px-2 py-0.5 text-warning-foreground">Prueba</span>}
          </div>
          <h3 className="text-lg leading-snug">{recipe.name}</h3>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> {timeLabel(recipe)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {servingsLabel(recipe.servings)}
            </span>
          </div>
        </div>
      </Link>
      {onToggleFav && (
        <button
          onClick={onToggleFav}
          aria-label={isFav ? "Quitar de favoritos" : "Agregar a favoritos"}
          className="absolute right-3 top-3 rounded-full bg-card/90 p-2 text-primary shadow-soft"
        >
          <Heart className={`h-4 w-4 ${isFav ? "fill-primary" : ""}`} />
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card-soft p-8 text-center">
      <h3 className="text-xl">{title}</h3>
      {children && <div className="mt-2 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}
