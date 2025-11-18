import { 
  LayoutDashboard, 
  DollarSign, 
  TrendingDown, 
  FileText, 
  Bell, 
  Zap, 
  FolderKanban, 
  CreditCard, 
  Gavel, 
  Settings 
} from "lucide-react";
import { NavLink } from "@/components/NavLink";

const menuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Receita", url: "/receita", icon: DollarSign },
  { title: "Custos", url: "/custos", icon: TrendingDown },
  { title: "Relatórios", url: "/relatorios", icon: FileText },
  { title: "Alertas", url: "/alertas", icon: Bell },
  { title: "Efeito Alavanca", url: "/efeito-alavanca", icon: Zap },
  { title: "Projetos", url: "/projetos", icon: FolderKanban },
  { title: "Crédito", url: "/credito", icon: CreditCard },
  { title: "Leilão", url: "/leilao", icon: Gavel },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function AppSidebar() {
  return (
    <div className="w-60 h-screen bg-sidebar border-r border-sidebar-border fixed left-0 top-0 flex flex-col">
      <div className="p-6 border-b border-sidebar-border">
        <h1 className="text-2xl font-bold text-primary">MCF</h1>
        <p className="text-xs text-sidebar-foreground mt-1">Dashboard Executivo</p>
      </div>
      
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.url}>
              <NavLink
                to={item.url}
                end={item.url === "/"}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                activeClassName="bg-primary/10 text-primary font-medium"
              >
                <item.icon className="h-5 w-5" />
                <span>{item.title}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <p className="text-xs text-sidebar-foreground text-center">
          © 2024 MCF. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
