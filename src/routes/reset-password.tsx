import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nueva contraseña · Método Menú Antiinflamatorio" },
      { name: "description", content: "Creá una contraseña nueva para tu cuenta." },
      { property: "og:title", content: "Nueva contraseña · Método Menú Antiinflamatorio" },
      { property: "og:description", content: "Creá una contraseña nueva para tu cuenta." },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error("El enlace venció o no es válido. Pedí uno nuevo.");
    toast.success("Contraseña actualizada");
    navigate({ to: "/" });
  }
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <form onSubmit={submit} className="card-soft w-full max-w-sm space-y-4 p-6">
        <h1 className="text-2xl">Creá tu nueva contraseña</h1>
        <div className="space-y-1.5">
          <Label htmlFor="pw">Contraseña nueva</Label>
          <Input id="pw" type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>Guardar</Button>
      </form>
    </div>
  );
}
