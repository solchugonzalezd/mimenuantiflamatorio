import { createFileRoute, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

// Acceso directo: si no hay sesión, se crea una entrada automática para este dispositivo.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) await supabase.auth.signInAnonymously();
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { loading } = useAuth();
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Cargando…</div>;
  }
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
