import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useUid } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin/usuarias")({
  component: UsersPage,
});

function UsersPage() {
  const me = useUid();
  const q = useQuery({
    queryKey: ["admin_users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_users");
      if (error) throw error;
      return data;
    },
  });
  const guests = (q.data ?? []).filter((u) => !u.email);
  const accounts = (q.data ?? []).filter((u) => u.email);

  async function setAdmin(id: string, on: boolean) {
    const { error } = on
      ? await supabase.from("user_roles").insert({ user_id: id, role: "admin" })
      : await supabase.from("user_roles").delete().eq("user_id", id).eq("role", "admin");
    if (error) { toast.error("No se pudo cambiar el permiso"); return; }
    q.refetch();
  }

  return (
    <div className="space-y-4">
      <div className="card-soft p-4">
        <p className="font-display text-3xl text-primary">{guests.length}</p>
        <p className="text-xs text-muted-foreground">Dispositivos que entraron directo (sin cuenta)</p>
      </div>
      <h2 className="text-xl">Cuentas con correo</h2>
      <div className="card-soft divide-y">
        {accounts.map((u) => {
          const isAdmin = u.roles.includes("admin");
          return (
            <div key={u.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium">{u.email}</p>
                <p className="text-xs text-muted-foreground">{isAdmin ? "Administradora" : "Sin permisos de administración"}</p>
              </div>
              {u.id !== me && (
                <Button size="sm" variant="outline" onClick={() => setAdmin(u.id, !isAdmin)}>
                  {isAdmin ? "Quitar admin" : "Hacer admin"}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
