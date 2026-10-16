import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { RecipeCard, EmptyState } from "@/components/recipe-bits";
import { Button } from "@/components/ui/button";
import { useCategories, useFavorites, useInvalidate, useRecipes, useUid } from "@/lib/queries";
import { toggleFavorite } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/favoritos")({
  head: () => ({
    meta: [
      { title: "Favoritos · Método Menú Antiinflamatorio" },
      { name: "description", content: "Tus recetas guardadas." },
      { property: "og:title", content: "Favoritos · Método Menú Antiinflamatorio" },
      { property: "og:description", content: "Tus recetas guardadas." },
    ],
  }),
  component: FavPage,
});

function FavPage() {
  const recipes = useRecipes();
  const favs = useFavorites();
  const cats = useCategories();
  const uid = useUid();
  const invalidate = useInvalidate();
  const catSlug = new Map((cats.data ?? []).map((c) => [c.id, c.slug]));
  const list = (recipes.data ?? []).filter((r) => favs.data?.has(r.id));
  return (
    <div className="space-y-6">
      <h1 className="text-3xl md:text-4xl">Mis favoritas</h1>
      {list.length === 0 ? (
        <EmptyState title="Todavía no guardaste recetas">
          Tocá el corazón en cualquier receta para tenerla a mano.
          <div className="mt-4"><Button asChild><Link to="/recetas">Explorar recetas</Link></Button></div>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((r) => (
            <RecipeCard
              key={r.id}
              recipe={r}
              categorySlug={r.category_id ? catSlug.get(r.category_id) : undefined}
              isFav
              onToggleFav={async () => {
                try {
                  await toggleFavorite(uid!, r.id, true);
                  invalidate("favorites");
                } catch {
                  toast.error("No pudimos quitarla");
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
