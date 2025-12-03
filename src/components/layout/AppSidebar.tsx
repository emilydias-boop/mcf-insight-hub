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
  LogOut,
  ChevronDown,
  UserCircle,
  Tv,
  Calculator,
  Receipt
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useLocation } from "react-router-dom";

type AppRole = 'admin' | 'manager' | 'viewer' | 'sdr' | 'closer' | 'coordenador';

interface MenuItem {
  title: string;
  url?: string;
  icon: any;
  requiredRoles?: AppRole[];
  items?: { title: string; url: string; }[];
}

const menuItems: MenuItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { 
    title: "Receita", 
    icon: DollarSign,
    items: [
      { title: "Overview", url: "/receita" },
      { title: "Transações", url: "/receita/transacoes" },
      { title: "Por Canal", url: "/receita/por-canal" },
    ]
  },
  { 
    title: "Custos", 
    icon: TrendingDown,
    items: [
      { title: "Overview", url: "/custos" },
      { title: "Despesas", url: "/custos/despesas" },
      { title: "Por Categoria", url: "/custos/por-categoria" },
    ]
  },
  { 
    title: "Relatórios", 
    icon: FileText,
    items: [
      { title: "Visão Geral", url: "/relatorios" },
      { title: "Leads sem Tag", url: "/relatorios/leads-sem-tag" },
    ]
  },
  { title: "Alertas", url: "/alertas", icon: Bell },
  { title: "Efeito Alavanca", url: "/efeito-alavanca", icon: Zap },
  { title: "Projetos", url: "/projetos", icon: FolderKanban },
  { title: "Crédito", url: "/credito", icon: CreditCard, requiredRoles: ['admin', 'manager'] },
  { title: "Leilão", url: "/leilao", icon: Gavel, requiredRoles: ['admin', 'manager'] },
  { title: "TV SDR", url: "/tv-sdr", icon: Tv, requiredRoles: ['admin', 'manager', 'sdr', 'closer', 'coordenador'] },
  { 
    title: "CRM", 
    icon: UserCircle, 
    requiredRoles: ['admin', 'manager', 'sdr', 'closer', 'coordenador'],
    items: [
      { title: "Visão Geral", url: "/crm" },
      { title: "Contatos", url: "/crm/contatos" },
      { title: "Negócios", url: "/crm/negocios" },
      { title: "Origens", url: "/crm/origens" },
      { title: "Grupos", url: "/crm/grupos" },
      { title: "Tags", url: "/crm/tags" },
      { title: "Importar Histórico", url: "/crm/importar-historico" },
      { title: "Configurações", url: "/crm/configuracoes" },
    ]
  },
  { title: "Fechamento SDR", url: "/fechamento-sdr", icon: Calculator, requiredRoles: ['admin', 'manager'] },
  { title: "Meu Fechamento", url: "/meu-fechamento", icon: Receipt, requiredRoles: ['sdr'] },
  { title: "Usuários", url: "/usuarios", icon: Users, requiredRoles: ['admin'] },
  { title: "Configurações", url: "/configuracoes", icon: Settings, requiredRoles: ['admin'] },
];

export function AppSidebar() {
  const { user, role, signOut } = useAuth();
  const { state } = useSidebar();
  const location = useLocation();
  const isCollapsed = state === "collapsed";

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

  const isRouteActive = (item: MenuItem) => {
    if (item.url) return location.pathname === item.url;
    if (item.items) {
      return item.items.some(sub => 
        location.pathname === sub.url || 
        (sub.url !== '/' && location.pathname.startsWith(sub.url + '/'))
      );
    }
    return false;
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 py-4">
            <span className="text-xl font-bold text-primary">MCF</span>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredMenuItems.map((item) => {
                const isActive = isRouteActive(item);
                
                if (item.items) {
                  return (
                    <Collapsible
                      key={item.title}
                      asChild
                      defaultOpen={isActive}
                      className="group/collapsible"
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            tooltip={item.title}
                            className={isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""}
                          >
                            <item.icon className="h-5 w-5" />
                            {!isCollapsed && (
                              <>
                                <span>{item.title}</span>
                                <ChevronDown className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                              </>
                            )}
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.items.map((subItem) => (
                              <SidebarMenuSubItem key={subItem.url}>
                                <SidebarMenuSubButton asChild>
                                  <NavLink
                                    to={subItem.url}
                                    className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                    activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                                  >
                                    <span>{subItem.title}</span>
                                  </NavLink>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }

                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <NavLink
                        to={item.url!}
                        end={item.url === "/"}
                        className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      >
                        <item.icon className="h-5 w-5" />
                        {!isCollapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="space-y-3">
          {!isCollapsed && (
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
          )}
          <Button 
            variant="ghost" 
            size={isCollapsed ? "icon" : "sm"}
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={signOut}
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
            {!isCollapsed && <span className="ml-2">Sair</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
