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
  Settings,
  Users,
  LogOut
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

type AppRole = 'admin' | 'manager' | 'viewer';

interface MenuItem {
  title: string;
  url: string;
  icon: any;
  requiredRoles?: AppRole[];
}

const menuItems: MenuItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Receita", url: "/receita", icon: DollarSign },
  { title: "Custos", url: "/custos", icon: TrendingDown },
  { title: "Relatórios", url: "/relatorios", icon: FileText },
  { title: "Alertas", url: "/alertas", icon: Bell },
  { title: "Efeito Alavanca", url: "/efeito-alavanca", icon: Zap },
  { title: "Projetos", url: "/projetos", icon: FolderKanban },
  { title: "Crédito", url: "/credito", icon: CreditCard, requiredRoles: ['admin', 'manager'] },
  { title: "Leilão", url: "/leilao", icon: Gavel, requiredRoles: ['admin', 'manager'] },
  { title: "Usuários", url: "/usuarios", icon: Users, requiredRoles: ['admin'] },
  { title: "Configurações", url: "/configuracoes", icon: Settings, requiredRoles: ['admin'] },
];

export function AppSidebar() {
  const { user, role, signOut } = useAuth();

  const getRoleBadgeVariant = (userRole: AppRole | null) => {
    if (userRole === 'admin') return 'default';
    if (userRole === 'manager') return 'secondary';
    return 'outline';
  };

  const getRoleLabel = (userRole: AppRole | null) => {
    if (userRole === 'admin') return 'Admin';
    if (userRole === 'manager') return 'Manager';
    return 'Viewer';
  };

  const filteredMenuItems = menuItems.filter(
    (item) => !item.requiredRoles || (role && item.requiredRoles.includes(role))
  );

  return (
    <div className="w-60 h-screen bg-sidebar border-r border-sidebar-border fixed left-0 top-0 flex flex-col">
      <div className="p-6 border-b border-sidebar-border">
        <h1 className="text-2xl font-bold text-primary">MCF</h1>
        <p className="text-xs text-sidebar-foreground mt-1">Dashboard Executivo</p>
      </div>
      
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-2">
          {filteredMenuItems.map((item) => (
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

      <div className="p-4 border-t border-sidebar-border space-y-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {user?.email?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground truncate">
              {user?.email || 'Usuário'}
            </p>
            <Badge variant={getRoleBadgeVariant(role)} className="text-[10px] px-1.5 py-0 h-4 mt-1">
              {getRoleLabel(role)}
            </Badge>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="sm"
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </div>
    </div>
  );
}
