import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import hero from "@/assets/hero.jpg";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Ingresar · Método Menú Antiinflamatorio" },
      { name: "description", content: "Ingresá a tu cuenta para organizar tu semana de comidas." },
      { property: "og:title", content: "Ingresar · Método Menú Antiinflamatorio" },
      { property: "og:description", content: "Ingresá a tu cuenta para organizar tu semana de comidas." },
    ],
  }),
  component: AuthPage,
});

type Mode = "login" | "signup" | "forgot";

function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === "SIGNED_IN" && s) navigate({ to: "/" });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { display_name: name } },
        });
        if (error) throw error;
        setSent("Te enviamos un correo para confirmar tu cuenta. Abrilo y después ingresá.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSent("Si el correo está registrado, te llegará un enlace para crear una contraseña nueva.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Algo salió mal";
      toast.error(msg.includes("Invalid login") ? "Correo o contraseña incorrectos" : msg);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error("No pudimos ingresar con Google");
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="relative hidden md:block">
        <img src={hero} alt="Platos saludables" className="absolute inset-0 h-full w-full object-cover" width={1600} height={1008} />
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Método Menú</p>
          <h1 className="mt-1 text-4xl text-primary">
            Antiinflamatorio
          </h1>
          <p className="mt-3 text-muted-foreground">
            {mode === "login" && "Ingresá para organizar tu semana."}
            {mode === "signup" && "Creá tu cuenta con el correo que usaste en la compra."}
            {mode === "forgot" && "Te mandamos un enlace para recuperar el acceso."}
          </p>

          {sent ? (
            <div className="card-soft mt-8 p-5 text-sm">{sent}</div>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-4">
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Tu nombre</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              {mode !== "forgot" && (
                <div className="space-y-1.5">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              )}
              <Button type="submit" className="w-full" size="lg" disabled={busy}>
                {mode === "login" ? "Ingresar" : mode === "signup" ? "Crear cuenta" : "Enviar enlace"}
              </Button>
              {mode !== "forgot" && (
                <Button type="button" variant="outline" className="w-full" size="lg" onClick={google}>
                  Continuar con Google
                </Button>
              )}
            </form>
          )}

          <div className="mt-6 flex flex-col gap-2 text-sm">
            {mode !== "login" && (
              <button className="text-primary underline-offset-4 hover:underline" onClick={() => { setMode("login"); setSent(null); }}>
                Ya tengo cuenta, quiero ingresar
              </button>
            )}
            {mode === "login" && (
              <>
                <button className="text-primary underline-offset-4 hover:underline" onClick={() => setMode("signup")}>
                  Crear una cuenta
                </button>
                <button className="text-muted-foreground underline-offset-4 hover:underline" onClick={() => setMode("forgot")}>
                  Olvidé mi contraseña
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
