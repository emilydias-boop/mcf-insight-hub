import { useState } from "react";
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
  ChevronLeft,
  ChevronRight,
  UserCircle,
  Tv,
  Calculator,
  Receipt,
  FolderOpen,
  BookOpen,
  Building2,
  Calendar
} from "lucide-react";
import { DrawerArquivosUsuario } from "@/components/user-management/DrawerArquivosUsuario";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useMyPermissions } from "@/hooks/useMyPermissions";
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
import { ResourceType } from "@/types/user-management";

type AppRole = 'admin' | 'manager' | 'viewer' | 'sdr' | 'closer' | 'coordenador' | 'rh' | 'financeiro';

interface MenuItem {
  title: string;
  url?: string;
  icon: any;
  requiredRoles?: AppRole[];
  resource?: ResourceType; // Mapeamento para permissão de recurso
  items?: { title: string; url: string; }[];
}

// Mapeamento de menu item para resource type
const menuItems: MenuItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, resource: "dashboard" },
  { 
    title: "Receita", 
    icon: DollarSign,
    resource: "receita",
    items: [
      { title: "Overview", url: "/receita" },
      { title: "Transações", url: "/receita/transacoes" },
      { title: "Por Canal", url: "/receita/por-canal" },
    ]
  },
  { 
    title: "Custos", 
    icon: TrendingDown,
    resource: "custos",
    items: [
      { title: "Overview", url: "/custos" },
      { title: "Despesas", url: "/custos/despesas" },
      { title: "Por Categoria", url: "/custos/por-categoria" },
    ]
  },
  { 
    title: "Relatórios", 
    icon: FileText,
    resource: "relatorios",
    items: [
      { title: "Visão Geral", url: "/relatorios" },
      { title: "Leads sem Tag", url: "/relatorios/leads-sem-tag" },
    ]
  },
  { title: "Alertas", url: "/alertas", icon: Bell, resource: "alertas" },
  { title: "Efeito Alavanca", url: "/efeito-alavanca", icon: Zap, resource: "efeito_alavanca" },
  { title: "Projetos", url: "/projetos", icon: FolderKanban, resource: "projetos" },
  { title: "Crédito", url: "/credito", icon: CreditCard, resource: "credito", requiredRoles: ['admin', 'manager'] },
  { title: "Leilão", url: "/leilao", icon: Gavel, resource: "leilao", requiredRoles: ['admin', 'manager'] },
  { title: "TV SDR", url: "/tv-sdr", icon: Tv, resource: "tv_sdr", requiredRoles: ['admin', 'manager', 'sdr', 'closer', 'coordenador'] },
  { title: "Minhas Reuniões", url: "/sdr/minhas-reunioes", icon: Calendar, resource: "crm", requiredRoles: ['sdr'] },
  { title: "Reuniões da Equipe", url: "/crm/reunioes-equipe", icon: Users, resource: "crm", requiredRoles: ['admin', 'manager', 'coordenador'] },
  { title: "CRM", url: "/crm", icon: UserCircle, resource: "crm", requiredRoles: ['admin', 'manager', 'sdr', 'closer', 'coordenador'] },
  { 
    title: "Fechamento SDR", 
    icon: Calculator, 
    resource: "fechamento_sdr",
    requiredRoles: ['admin', 'coordenador'],
    items: [
      { title: "Lista de Fechamentos", url: "/fechamento-sdr" },
      { title: "Configurações", url: "/fechamento-sdr/configuracoes" },
    ]
  },
  { title: "Meu Fechamento", url: "/meu-fechamento", icon: Receipt, resource: "fechamento_sdr", requiredRoles: ['sdr'] },
  { title: "Meu Playbook", url: "/playbook", icon: BookOpen },
  { title: "Meu RH", url: "/meu-rh", icon: UserCircle },
  { title: "RH", url: "/rh/colaboradores", icon: Building2, resource: "rh" as any, requiredRoles: ['admin', 'rh'] },
  { title: "Financeiro", url: "/financeiro", icon: Receipt, resource: "financeiro" as any, requiredRoles: ['admin', 'financeiro'] },
  { title: "Usuários", url: "/usuarios", icon: Users, resource: "usuarios", requiredRoles: ['admin'] },
  { title: "Configurações", url: "/configuracoes", icon: Settings, resource: "configuracoes", requiredRoles: ['admin'] },
];

// CRM now goes directly to /crm without sub-items in sidebar

export function AppSidebar() {
  const { user, role, signOut } = useAuth();
  const { canAccessResource, isAdmin } = useMyPermissions();
  const { state, toggleSidebar } = useSidebar();
  const location = useLocation();
  const isCollapsed = state === "collapsed";
  const [myFilesOpen, setMyFilesOpen] = useState(false);

  const getRoleBadgeVariant = (userRole: AppRole | null) => {
    if (userRole === 'admin') return 'default';
    if (userRole === 'manager') return 'secondary';
    return 'outline';
  };

  const getRoleLabel = (userRole: AppRole | null) => {
    if (userRole === 'admin') return 'Admin';
    if (userRole === 'manager') return 'Manager';
    if (userRole === 'coordenador') return 'Coordenador';
    if (userRole === 'sdr') return 'SDR';
    if (userRole === 'closer') return 'Closer';
    return 'Viewer';
  };

  // Filtragem combinada: requiredRoles (role-based) + resource permissions
  const filteredMenuItems = menuItems.filter((item) => {
    // Se tem requiredRoles, verifica primeiro a role
    if (item.requiredRoles && role && !item.requiredRoles.includes(role)) {
      return false;
    }
    
    // Admin sempre vê tudo
    if (isAdmin) return true;
    
    // Se tem resource mapeado, verifica permissão
    if (item.resource && !canAccessResource(item.resource)) {
      return false;
    }
    
    return true;
  });

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
        {/* Toggle button always visible - outside SidebarGroupLabel */}
        <div className="flex items-center justify-center px-2 py-3 border-b border-sidebar-border">
          {isCollapsed ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-9 w-9 hover:bg-sidebar-accent"
              title="Expandir sidebar"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          ) : (
            <div className="flex items-center justify-between w-full">
              <span className="text-xl font-bold text-primary">MCF</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="h-7 w-7 flex-shrink-0 hover:bg-sidebar-accent"
                title="Colapsar sidebar"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        
        <SidebarGroup>
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
                            onClick={() => {
                              if (isCollapsed) {
                                toggleSidebar();
                              }
                            }}
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
        <div className="space-y-2">
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
            onClick={() => setMyFilesOpen(true)}
            title="Meus arquivos"
          >
            <FolderOpen className="h-4 w-4" />
            {!isCollapsed && <span className="ml-2">Meus arquivos</span>}
          </Button>
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

      {/* Drawer de Meus Arquivos */}
      <DrawerArquivosUsuario
        open={myFilesOpen}
        onOpenChange={setMyFilesOpen}
        mode="pessoal"
      />
    </Sidebar>
  );
}
