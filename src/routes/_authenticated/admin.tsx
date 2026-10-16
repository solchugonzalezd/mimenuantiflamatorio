import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administración · Método Menú Antiinflamatorio" },
      { name: "description", content: "Panel privado de administración." },
      { property: "og:title", content: "Administración" },
      { property: "og:description", content: "Panel privado de administración." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLayout,
});

const TABS = [
  { to: "/admin", label: "Recetas" },
  { to: "/admin/importar", label: "Importar" },
  { to: "/admin/categorias", label: "Categorías" },
  { to: "/admin/usuarias", label: "Usuarias" },
] as const;

function AdminLayout() {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <p className="text-muted-foreground">Esta sección es solo para administración.</p>;
  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Administración</h1>
      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {TABS.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            activeOptions={{ exact: t.to === "/admin" }}
            className="whitespace-nowrap rounded-full border bg-card px-4 py-1.5 text-sm"
            activeProps={{ className: "border-primary bg-primary text-primary-foreground" }}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
