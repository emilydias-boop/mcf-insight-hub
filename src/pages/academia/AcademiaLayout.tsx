import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bell, GraduationCap, Moon, Sun } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { adb } from "@/lib/academia";
import { useAcademiaIsAdmin } from "@/hooks/useAcademia";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function useMeusVinculados() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["academia", "vinculados", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await adb.from("academia_perfis").select("*")
        .or(`gestor_id.eq.${user!.id},padrinho_id.eq.${user!.id}`);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export default function AcademiaLayout() {
  const { user } = useAuth();
  const isAdmin = useAcademiaIsAdmin();
  const { data: vinculados = [] } = useMeusVinculados();
  const [claro, setClaro] = useState(() => localStorage.getItem("academia-tema") === "claro");
  const { data: notifs = [], refetch } = useQuery({
    queryKey: ["academia", "notifs", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await adb.from("academia_notifications").select("*").eq("user_id", user!.id).order("criado_em", { ascending: false }).limit(20);
      return data ?? [];
    },
  });
  const naoLidas = notifs.filter((n: { lida: boolean }) => !n.lida).length;
  const validador = isAdmin || vinculados.length > 0;

  const links = [
    { to: "/academia", label: "Minha Trilha", end: true },
    { to: "/academia/estante", label: "Minha Estante" },
    { to: "/academia/biblioteca", label: "Biblioteca" },
    { to: "/academia/combinado-pj", label: "Combinado PJ" },
    ...(validador ? [{ to: "/academia/validacoes", label: "Validações" }, { to: "/academia/equipe", label: "Painel do gestor" }] : []),
    ...(isAdmin ? [{ to: "/academia/admin", label: "Admin RH" }] : []),
  ];

  const marcarLidas = async () => {
    await adb.from("academia_notifications").update({ lida: true }).eq("user_id", user!.id).eq("lida", false);
    refetch();
  };

  return (
    <div className={cn("academia min-h-full -m-4 md:-m-6 p-4 md:p-8 text-[15px]", claro && "academia-light")} style={{ fontSize: "15px" }}>
      <header className="flex flex-wrap items-center gap-4 mb-8">
        <div className="flex items-center gap-3 mr-4">
          <div className="h-10 w-10 rounded-2xl bg-primary text-primary-foreground grid place-items-center"><GraduationCap className="h-5 w-5" /></div>
          <div>
            <div className="ac-eyebrow">Universidade corporativa</div>
            <div className="font-display text-xl">Academia MCF</div>
          </div>
        </div>
        <nav className="flex flex-wrap gap-1">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}
              className={({ isActive }) => cn("px-3 py-2 rounded-xl text-sm font-semibold transition-colors",
                isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent")}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Popover onOpenChange={(o) => { if (!o && naoLidas) marcarLidas(); }}>
            <PopoverTrigger className="relative h-10 w-10 grid place-items-center rounded-xl hover:bg-accent" aria-label="Notificações">
              <Bell className="h-5 w-5" />
              {naoLidas > 0 && <span className="absolute top-1 right-1 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold grid place-items-center">{naoLidas}</span>}
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 max-h-96 overflow-auto">
              {notifs.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma notificação.</p> :
                notifs.map((n: { id: string; titulo: string; corpo: string; lida: boolean }) => (
                  <div key={n.id} className={cn("py-2 border-b last:border-0", !n.lida && "font-semibold")}>
                    <div className="text-sm">{n.titulo}</div>
                    {n.corpo && <div className="text-xs text-muted-foreground">{n.corpo}</div>}
                  </div>))}
            </PopoverContent>
          </Popover>
          <button className="h-10 w-10 grid place-items-center rounded-xl hover:bg-accent" aria-label="Alternar tema"
            onClick={() => { const v = !claro; setClaro(v); localStorage.setItem("academia-tema", v ? "claro" : "escuro"); }}>
            {claro ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
