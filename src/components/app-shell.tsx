import { Link, useNavigate } from "@tanstack/react-router";
import { Home, BookOpen, CalendarDays, ShoppingBasket, Heart, User, Shield, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

const NAV = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/recetas", label: "Recetas", icon: BookOpen },
  { to: "/plan", label: "Mi semana", icon: CalendarDays },
  { to: "/compras", label: "Compras", icon: ShoppingBasket },
  { to: "/favoritos", label: "Favoritos", icon: Heart },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen pb-24 md:pb-0">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="font-display text-lg leading-tight text-primary">
            Método Menú <span className="italic">Antiinflamatorio</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: n.to === "/" }}
                className="rounded-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                activeProps={{ className: "bg-accent text-accent-foreground" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            {isAdmin && (
              <Link to="/admin" className="rounded-full p-2 text-muted-foreground hover:bg-accent" aria-label="Administración">
                <Shield className="h-5 w-5" />
              </Link>
            )}
            <Link to="/perfil" className="rounded-full p-2 text-muted-foreground hover:bg-accent" aria-label="Mi perfil">
              <User className="h-5 w-5" />
            </Link>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth" });
              }}
              className="rounded-full p-2 text-muted-foreground hover:bg-accent"
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 md:py-10">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-5">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              className="flex flex-col items-center gap-1 py-2.5 text-[11px] text-muted-foreground"
              activeProps={{ className: "text-primary font-medium" }}
            >
              <n.icon className="h-5 w-5" />
              {n.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
