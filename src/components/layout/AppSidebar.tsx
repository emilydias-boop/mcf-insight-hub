import { useState } from "react";
import { 
  LayoutDashboard, 
  DollarSign, 
  FileText, 
  Bell, 
  Handshake, 
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
  FolderOpen,
  BookOpen,
  Building2,
  Calendar,
  Receipt,
  ChevronUp,
  Package
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocation, useNavigate } from "react-router-dom";
import { ResourceType } from "@/types/user-management";

type AppRole = 'admin' | 'manager' | 'viewer' | 'sdr' | 'closer' | 'coordenador' | 'rh' | 'financeiro';

interface MenuItem {
  title: string;
  url?: string;
  icon: any;
  requiredRoles?: AppRole[];
  resource?: ResourceType;
  items?: { title: string; url: string; requiredRoles?: AppRole[]; }[];
}

// Menu reorganizado e consolidado
const menuItems: MenuItem[] = [
  { 
    title: "Dashboard", 
    icon: LayoutDashboard, 
    resource: "dashboard",
    items: [
      { title: "Visão Geral", url: "/" },
      { title: "Semanas", url: "/dashboard/semanas", requiredRoles: ['admin', 'manager', 'coordenador'] },
    ]
  },
  
  // Financeiro consolidado (Receita + Custos + Fechamento SDR + Financeiro operacional)
  { 
    title: "Financeiro", 
    icon: DollarSign,
    resource: "financeiro",
    items: [
      { title: "Receita", url: "/receita" },
      { title: "Transações", url: "/receita/transacoes" },
      { title: "Custos", url: "/custos" },
      { title: "Despesas", url: "/custos/despesas" },
      { title: "Fechamento SDR", url: "/fechamento-sdr", requiredRoles: ['admin', 'coordenador'] },
      { title: "Pagamentos", url: "/financeiro", requiredRoles: ['admin', 'financeiro'] },
    ]
  },
  
  // Relatórios
  { 
    title: "Relatórios", 
    icon: FileText,
    resource: "relatorios",
    items: [
      { title: "Visão Geral", url: "/relatorios" },
      { title: "Leads sem Tag", url: "/relatorios/leads-sem-tag" },
    ]
  },
  
  // CRM e reuniões
  { title: "CRM", url: "/crm", icon: UserCircle, resource: "crm", requiredRoles: ['admin', 'manager', 'sdr', 'closer', 'coordenador'] },
  { title: "Minhas Reuniões", url: "/sdr/minhas-reunioes", icon: Calendar, resource: "crm", requiredRoles: ['sdr'] },
  { title: "Reuniões da Equipe", url: "/crm/reunioes-equipe", icon: Users, resource: "crm", requiredRoles: ['admin', 'manager', 'coordenador'] },
  
  // TV SDR
  { title: "TV SDR", url: "/tv-sdr", icon: Tv, resource: "tv_sdr", requiredRoles: ['admin', 'manager', 'sdr', 'closer', 'coordenador'] },
  
  // Produtos (Master view)
  { title: "Produtos", url: "/produtos", icon: Package, requiredRoles: ['admin', 'manager', 'coordenador'] },
  
  // RH (para admin/rh)
  { title: "RH", url: "/rh/colaboradores", icon: Building2, resource: "rh" as any, requiredRoles: ['admin', 'rh'] },
  
  // Produtos separados
  { title: "Consórcio", url: "/consorcio", icon: Handshake, requiredRoles: ['admin', 'manager', 'sdr', 'closer', 'coordenador'] },
  { title: "Projetos", url: "/projetos", icon: FolderKanban, resource: "projetos" },
  { title: "Crédito", url: "/credito", icon: CreditCard, resource: "credito", requiredRoles: ['admin', 'manager'] },
  { title: "Leilão", url: "/leilao", icon: Gavel, resource: "leilao", requiredRoles: ['admin', 'manager'] },
  
  // Configurações pessoais (todos os usuários)
  { 
    title: "Configurações", 
    url: "/configuracoes",
    icon: Settings, 
  },
  
  // Administração (apenas admin)
  { 
    title: "Administração", 
    icon: Users, 
    requiredRoles: ['admin'],
    items: [
      { title: "Usuários", url: "/usuarios" },
      { title: "Closers", url: "/crm/configurar-closers" },
    ]
  },
];

// Itens pessoais do usuário (movidos para o menu do footer)
interface PersonalMenuItem {
  title: string;
  url: string;
  icon: any;
  requiredRoles?: AppRole[];
}

const personalMenuItems: PersonalMenuItem[] = [
  { title: "Meu RH", url: "/meu-rh", icon: UserCircle },
  { title: "Meu Playbook", url: "/playbook", icon: BookOpen },
  { title: "Meu Fechamento", url: "/meu-fechamento", icon: Receipt, requiredRoles: ['sdr'] },
  { title: "Alertas", url: "/alertas", icon: Bell },
];

export function AppSidebar() {
  const { user, role, signOut } = useAuth();
  const { canAccessResource, isAdmin } = useMyPermissions();
  const { state, toggleSidebar } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
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
    if (userRole === 'rh') return 'RH';
    if (userRole === 'financeiro') return 'Financeiro';
    return 'Viewer';
  };

  // Filtragem de menu items
  const filteredMenuItems = menuItems.filter((item) => {
    if (item.requiredRoles && role && !item.requiredRoles.includes(role)) {
      return false;
    }
    if (isAdmin) return true;
    if (item.resource && !canAccessResource(item.resource)) {
      return false;
    }
    return true;
  });

  // Filtragem de sub-items baseado em roles
  const getFilteredSubItems = (items: { title: string; url: string; requiredRoles?: AppRole[]; }[]) => {
    return items.filter(subItem => {
      if (!subItem.requiredRoles) return true;
      if (isAdmin) return true;
      return role && subItem.requiredRoles.includes(role);
    });
  };

  // Filtragem de itens pessoais
  const filteredPersonalItems = personalMenuItems.filter((item) => {
    if (!item.requiredRoles) return true;
    if (isAdmin) return true;
    return role && item.requiredRoles.includes(role);
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

  const isPersonalRouteActive = () => {
    return personalMenuItems.some(item => location.pathname === item.url);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent>
        {/* Toggle button always visible */}
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
                  const filteredSubItems = getFilteredSubItems(item.items);
                  
                  // Se não há sub-items após filtro, não mostra o grupo
                  if (filteredSubItems.length === 0) return null;
                  
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
                            {filteredSubItems.map((subItem) => (
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

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={`w-full justify-start gap-2 h-auto py-2 px-2 hover:bg-sidebar-accent ${isPersonalRouteActive() ? 'bg-sidebar-accent' : ''}`}
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {user?.email?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-xs font-medium text-sidebar-foreground truncate">
                      {user?.email || 'Usuário'}
                    </p>
                    <Badge variant={getRoleBadgeVariant(role)} className="text-[10px] px-1.5 py-0 h-4 mt-0.5">
                      {getRoleLabel(role)}
                    </Badge>
                  </div>
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            side="top" 
            align="start"
            className="w-56 bg-popover border border-border shadow-lg"
          >
            {filteredPersonalItems.map((item) => (
              <DropdownMenuItem 
                key={item.url}
                onClick={() => navigate(item.url)}
                className={`cursor-pointer ${location.pathname === item.url ? 'bg-accent' : ''}`}
              >
                <item.icon className="mr-2 h-4 w-4" />
                <span>{item.title}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => setMyFilesOpen(true)}
              className="cursor-pointer"
            >
              <FolderOpen className="mr-2 h-4 w-4" />
              <span>Meus Arquivos</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={signOut}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
