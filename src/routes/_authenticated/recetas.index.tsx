import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { RecipeCard, EmptyState } from "@/components/recipe-bits";
import { useCategories, useFavorites, useInvalidate, useRecipes, useUid } from "@/lib/queries";
import { toggleFavorite, DIET_TAG_LABELS } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/recetas/")({
  head: () => ({
    meta: [
      { title: "Recetas · Método Menú Antiinflamatorio" },
      { name: "description", content: "Biblioteca de recetas antiinflamatorias con buscador y filtros." },
      { property: "og:title", content: "Recetas · Método Menú Antiinflamatorio" },
      { property: "og:description", content: "Biblioteca de recetas antiinflamatorias." },
    ],
  }),
  component: RecipesPage,
});

const TIME_FILTERS = [
  { v: "all", l: "Cualquier tiempo" },
  { v: "20", l: "Hasta 20 min" },
  { v: "40", l: "Hasta 40 min" },
];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent"}`}
    >
      {children}
    </button>
  );
}

function RecipesPage() {
  const recipes = useRecipes();
  const cats = useCategories();
  const favs = useFavorites();
  const uid = useUid();
  const invalidate = useInvalidate();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [time, setTime] = useState("all");
  const [tag, setTag] = useState<string>("all");

  const catSlug = new Map((cats.data ?? []).map((c) => [c.id, c.slug]));
  const list = useMemo(() => {
    const term = q.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return (recipes.data ?? []).filter((r) => {
      if (cat !== "all" && r.category_id !== cat) return false;
      if (time !== "all" && (r.prep_minutes === null || r.prep_minutes > Number(time))) return false;
      if (tag !== "all" && !r.diet_tags.includes(tag)) return false;
      if (term) {
        const n = r.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (!n.includes(term) && String(r.code ?? "").padStart(3, "0") !== term) return false;
      }
      return true;
    });
  }, [recipes.data, q, cat, time, tag]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl">Recetas</h1>
        <p className="mt-1 text-muted-foreground">{recipes.data?.length ?? 0} recetas disponibles</p>
      </div>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscá por nombre o número" value={q} onChange={(e) => setQ(e.target.value)} className="h-12 rounded-full bg-card pl-11" />
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <Chip active={cat === "all"} onClick={() => setCat("all")}>Todas</Chip>
        {(cats.data ?? []).map((c) => (
          <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>{c.name}</Chip>
        ))}
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {TIME_FILTERS.map((t) => (
          <Chip key={t.v} active={time === t.v} onClick={() => setTime(t.v)}>{t.l}</Chip>
        ))}
        <Chip active={tag === "all"} onClick={() => setTag("all")}>Todas las características</Chip>
        {Object.entries(DIET_TAG_LABELS).map(([k, l]) => (
          <Chip key={k} active={tag === k} onClick={() => setTag(k)}>{l}</Chip>
        ))}
      </div>
      {recipes.isLoading ? (
        <p className="text-muted-foreground">Cargando recetas…</p>
      ) : list.length === 0 ? (
        <EmptyState title="No encontramos recetas">Probá con otra búsqueda o quitá algún filtro.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((r) => {
            const isFav = favs.data?.has(r.id) ?? false;
            return (
              <RecipeCard
                key={r.id}
                recipe={r}
                categorySlug={r.category_id ? catSlug.get(r.category_id) : undefined}
                isFav={isFav}
                onToggleFav={async () => {
                  try {
                    await toggleFavorite(uid!, r.id, isFav);
                    invalidate("favorites");
                  } catch {
                    toast.error("No pudimos guardar el favorito");
                  }
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
