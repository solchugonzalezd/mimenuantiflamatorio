import { createFileRoute, Outlet, redirect, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { loading, hasAccess, session } = useAuth();
  const loc = useLocation();
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Cargando…</div>;
  }
  // El perfil siempre es accesible; el resto del contenido es solo para compradoras habilitadas.
  if (!hasAccess && loc.pathname !== "/perfil") {
    return (
      <AppShell>
        <div className="card-soft mx-auto max-w-lg p-8 text-center">
          <h1 className="text-2xl">Tu cuenta todavía no tiene acceso</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Ingresaste como <strong>{session?.user.email}</strong>. Cuando se confirme tu compra, vas a poder ver las recetas y armar tu semana.
            Si ya compraste, escribinos y lo habilitamos.
          </p>
        </div>
      </AppShell>
    );
  }
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
