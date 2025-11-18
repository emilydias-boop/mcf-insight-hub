import { Outlet } from "react-router-dom";
import { NavLink } from "@/components/NavLink";

export default function Custos() {
  const tabs = [
    { name: "Visão Geral", path: "/custos" },
    { name: "Despesas", path: "/custos/despesas" },
    { name: "Por Categoria", path: "/custos/por-categoria" },
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-border">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              end={tab.path === '/custos'}
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
  );
}
