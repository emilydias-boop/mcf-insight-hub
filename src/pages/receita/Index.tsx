import { Outlet, useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { ResourceGuard } from "@/components/auth/ResourceGuard";

export default function Receita() {
  const location = useLocation();
  const isRootPath = location.pathname === '/receita';

  const tabs = [
    { name: "Visão Geral", path: "/receita" },
    { name: "Cursos", path: "/receita/a010" },
    { name: "Transações", path: "/receita/transacoes" },
    { name: "Por Canal", path: "/receita/por-canal" },
    { name: "Importar Hubla", path: "/receita/importar-hubla" },
    { name: "Auditoria", path: "/receita/auditoria" },
  ];

  return (
    <ResourceGuard resource="receita">
      <div className="space-y-6">
        <div className="border-b border-border">
          <nav className="flex gap-6">
            {tabs.map((tab) => (
              <NavLink
                key={tab.path}
                to={tab.path}
                end={tab.path === '/receita'}
                className="pb-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                activeClassName="border-b-2 border-primary text-primary"
              >
                {tab.name}
              </NavLink>
            ))}
          </nav>
        </div>
        <Outlet />
      </div>
    </ResourceGuard>
  );
}
