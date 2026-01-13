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
  FolderOpen,
  BookOpen,
  Building2,
  Calendar,
  Receipt,
  ChevronUp,
  Shield,
  BarChart3,
  Calculator,
  Users2,
  ShoppingCart,
} from "lucide-react";
import { DrawerArquivosUsuario } from "@/components/user-management/DrawerArquivosUsuario";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useMyPermissions } from "@/hooks/useMyPermissions";
import { useMyProducts } from "@/hooks/useMyProducts";
import { useMyBU, BusinessUnit } from "@/hooks/useMyBU";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocation, useNavigate } from "react-router-dom";
import { ResourceType } from "@/types/user-management";

type AppRole = "admin" | "manager" | "viewer" | "sdr" | "closer" | "coordenador" | "rh" | "financeiro";

// Sub-sub-item (3º nível)
interface SubSubItem {
  title: string;
  url: string;
  requiredRoles?: AppRole[];
}

// Sub-item (2º nível) - pode ter URL direta ou sub-subitens
interface SubMenuItem {
  title: string;
  url?: string;
  requiredRoles?: AppRole[];
  items?: SubSubItem[];
}

// Menu item principal (1º nível)
interface MenuItem {
  title: string;
  url?: string;
  icon: any;
  requiredRoles?: AppRole[];
  requiredProducts?: string[];
  requiredBU?: BusinessUnit[];
  resource?: ResourceType;
  items?: SubMenuItem[];
  separator?: boolean;
}

// ============================
// ESTRUTURA REORGANIZADA POR BUs
// ============================

const menuItems: MenuItem[] = [
  // ===== DASHBOARD =====
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    resource: "dashboard",
    items: [
      { title: "Visão Geral", url: "/" },
      { title: "Semanas", url: "/dashboard/semanas", requiredRoles: ["admin", "manager", "coordenador"] },
    ],
  },

  // ===== BUSINESS UNITS =====

  // BU - INCORPORADOR MCF
  {
    title: "BU - Incorporador MCF",
    icon: Building2,
    requiredRoles: ["admin", "manager", "coordenador"],
    separator: true,
    items: [
      { title: "Painel SDR", url: "/crm/reunioes-equipe" },
      { title: "Fechamento Equipe", url: "/fechamento-sdr" },
      { title: "Vendas", url: "/bu-incorporador/transacoes" },
      { title: "Relatório SDR", url: "/bu-incorporador/relatorio-sdr" },
      { title: "CRM", url: "/crm" },
    ],
  },

  // BU - CONSÓRCIO (com submenus Inside e Life)
  {
    title: "BU - Consórcio",
    icon: Handshake,
    requiredRoles: ["admin", "manager", "coordenador"],
    requiredProducts: ["consorcio"],
    items: [
      {
        title: "Inside Consórcio",
        items: [
          { title: "Controle de Cartas", url: "/consorcio/inside/controle-cartas" },
          { title: "Fechamento", url: "/consorcio/inside/fechamento" },
          { title: "Relatório", url: "/consorcio/inside/relatorio" },
          { title: "CRM", url: "/consorcio/inside/crm" },
          { title: "Painel Equipe", url: "/consorcio/inside/painel-equipe" },
          { title: "Vendas", url: "/consorcio/inside/vendas" },
        ],
      },
      {
        title: "Life Consórcio",
        items: [
          { title: "Controle de Cartas", url: "/consorcio/life/controle-cartas" },
          { title: "Fechamento", url: "/consorcio/life/fechamento" },
          { title: "Relatório", url: "/consorcio/life/relatorio" },
          { title: "CRM", url: "/consorcio/life/crm" },
          { title: "Painel Equipe", url: "/consorcio/life/painel-equipe" },
          { title: "Vendas", url: "/consorcio/life/vendas" },
        ],
      },
      { title: "Controle Consorcio", url: "/consorcio" },
      { title: "Importar", url: "/consorcio/importar" },
    ],
  },

  // BU - CRÉDITO
  {
    title: "BU - Crédito",
    icon: CreditCard,
    resource: "credito",
    requiredRoles: ["admin", "manager"],
    items: [
      { title: "Overview", url: "/bu-credito" },
      { title: "Negócios", url: "/bu-credito/deals" },
      { title: "Sócios", url: "/bu-credito/socios" },
      { title: "Clientes", url: "/bu-credito/clientes" },
      { title: "Gestão Legado", url: "/credito" },
    ],
  },

  // BU - PROJETOS
  {
    title: "BU - Projetos",
    icon: FolderKanban,
    resource: "projetos",
    items: [{ title: "Gestão de Projetos", url: "/projetos" }],
  },

  // LEILÃO
  {
    title: "Leilão",
    icon: Gavel,
    resource: "leilao",
    requiredRoles: ["admin", "manager"],
    items: [{ title: "Leilões Imobiliários", url: "/leilao" }],
  },

  // ===== OPERACIONAL =====

  // FINANCEIRO
  {
    title: "Financeiro",
    icon: DollarSign,
    resource: "financeiro",
    separator: true,
    items: [
      { title: "Receita", url: "/receita" },
      { title: "Transações", url: "/financeiro?tab=transacoes" },
      { title: "Custos", url: "/custos" },
      { title: "Despesas", url: "/custos/despesas" },
      { title: "Pagamentos", url: "/financeiro", requiredRoles: ["admin", "financeiro"] },
    ],
  },

  // RELATÓRIOS
  {
    title: "Relatórios",
    icon: FileText,
    resource: "relatorios",
    items: [
      { title: "Visão Geral", url: "/relatorios" },
      { title: "Leads sem Tag", url: "/relatorios/leads-sem-tag" },
    ],
  },

  // RH
  {
    title: "RH",
    icon: Users,
    resource: "rh" as any,
    requiredRoles: ["admin", "rh"],
    items: [{ title: "Colaboradores", url: "/rh/colaboradores" }],
  },

  // ===== ITENS AVULSOS PARA SDR/CLOSER =====

  // Minhas Reuniões (apenas SDR)
  {
    title: "Minhas Reuniões",
    url: "/sdr/minhas-reunioes",
    icon: Calendar,
    resource: "crm",
    requiredRoles: ["sdr"],
    separator: true,
  },

  // Agenda (SDR e Closer)
  {
    title: "Agenda",
    url: "/crm/agenda",
    icon: Calendar,
    resource: "crm",
    requiredRoles: ["sdr", "closer"],
  },

  // Metas da Equipe (SDRs da BU Incorporador)
  {
    title: "Metas da Equipe",
    url: "/crm/reunioes-equipe",
    icon: BarChart3,
    resource: "crm",
    requiredRoles: ["sdr"],
    requiredBU: ["incorporador"],
  },

  // ===== CONFIGURAÇÕES =====

  {
    title: "Configurações",
    url: "/configuracoes",
    icon: Settings,
  },

  // ===== ADMINISTRAÇÃO =====

  {
    title: "Administração",
    icon: Shield,
    requiredRoles: ["admin"],
    items: [
      { title: "Usuários", url: "/usuarios" },
      { title: "Closers", url: "/crm/configurar-closers" },
      { title: "Permissões", url: "/admin/permissoes" },
    ],
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
  { title: "Meu Fechamento", url: "/meu-fechamento", icon: Receipt, requiredRoles: ["sdr"] },
  { title: "Alertas", url: "/alertas", icon: Bell },
];

export function AppSidebar() {
  const { user, role, signOut } = useAuth();
  const { canAccessResource, isAdmin } = useMyPermissions();
  const { data: myProducts = [] } = useMyProducts();
  const { data: myBU } = useMyBU();
  const { state, toggleSidebar } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const isCollapsed = state === "collapsed";
  const [myFilesOpen, setMyFilesOpen] = useState(false);

  const getRoleBadgeVariant = (userRole: AppRole | null) => {
    if (userRole === "admin") return "default";
    if (userRole === "manager") return "secondary";
    return "outline";
  };

  const getRoleLabel = (userRole: AppRole | null) => {
    if (userRole === "admin") return "Admin";
    if (userRole === "manager") return "Manager";
    if (userRole === "coordenador") return "Coordenador";
    if (userRole === "sdr") return "SDR";
    if (userRole === "closer") return "Closer";
    if (userRole === "rh") return "RH";
    if (userRole === "financeiro") return "Financeiro";
    return "Viewer";
  };

  // Filtragem de menu items
  const filteredMenuItems = menuItems.filter((item) => {
    // Se tem requiredRoles e o usuário não tem a role
    if (item.requiredRoles && role && !item.requiredRoles.includes(role)) {
      // Se o item tem requiredProducts, verifica se o usuário tem algum dos produtos
      if (item.requiredProducts && ["sdr", "closer"].includes(role)) {
        return item.requiredProducts.some((p) => myProducts.includes(p));
      }
      return false;
    }

    // Verificação de BU para SDRs
    if (item.requiredBU && item.requiredBU.length > 0) {
      // Se o usuário não tem BU definida ou a BU não está na lista, não mostra
      if (!myBU || !item.requiredBU.includes(myBU)) {
        return false;
      }
    }

    if (isAdmin) return true;
    if (item.resource && !canAccessResource(item.resource)) {
      return false;
    }
    return true;
  });

  // Filtragem de sub-items baseado em roles (1º nível de subitens)
  const getFilteredSubItems = (items: SubMenuItem[]) => {
    return items.filter((subItem) => {
      if (!subItem.requiredRoles) return true;
      if (isAdmin) return true;
      return role && subItem.requiredRoles.includes(role);
    });
  };

  // Filtragem de sub-sub-items (2º nível de subitens)
  const getFilteredSubSubItems = (items: SubSubItem[]) => {
    return items.filter((subItem) => {
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

  // Verifica se uma rota está ativa (suporta 3 níveis)
  const isRouteActive = (item: MenuItem) => {
    if (item.url) return location.pathname === item.url;
    if (item.items) {
      return item.items.some((sub) => {
        if (sub.url) {
          return location.pathname === sub.url || (sub.url !== "/" && location.pathname.startsWith(sub.url + "/"));
        }
        if (sub.items) {
          return sub.items.some(
            (subSub) =>
              location.pathname === subSub.url ||
              (subSub.url !== "/" && location.pathname.startsWith(subSub.url + "/")),
          );
        }
        return false;
      });
    }
    return false;
  };

  // Verifica se submenu está ativo
  const isSubMenuActive = (subItem: SubMenuItem) => {
    if (subItem.url) {
      return location.pathname === subItem.url;
    }
    if (subItem.items) {
      return subItem.items.some(
        (item) => location.pathname === item.url || (item.url !== "/" && location.pathname.startsWith(item.url + "/")),
      );
    }
    return false;
  };

  const isPersonalRouteActive = () => {
    return personalMenuItems.some((item) => location.pathname === item.url);
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
              {filteredMenuItems.map((item, index) => {
                const isActive = isRouteActive(item);
                const showSeparator = item.separator && index > 0;

                const menuElement = item.items ? (
                  <Collapsible key={item.title} asChild defaultOpen={isActive} className="group/collapsible">
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
                          {getFilteredSubItems(item.items).map((subItem) =>
                            // Se o subItem tem items próprios, renderiza um Collapsible aninhado (3º nível)
                            subItem.items ? (
                              <Collapsible
                                key={subItem.title}
                                asChild
                                defaultOpen={isSubMenuActive(subItem)}
                                className="group/nested"
                              >
                                <SidebarMenuSubItem>
                                  <CollapsibleTrigger asChild>
                                    <SidebarMenuSubButton
                                      className={`justify-between cursor-pointer ${isSubMenuActive(subItem) ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : ""}`}
                                    >
                                      <span>{subItem.title}</span>
                                      <ChevronDown className="h-3 w-3 transition-transform duration-200 group-data-[state=open]/nested:rotate-180" />
                                    </SidebarMenuSubButton>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent>
                                    <SidebarMenuSub className="ml-2 border-l border-sidebar-border">
                                      {getFilteredSubSubItems(subItem.items).map((subSubItem) => (
                                        <SidebarMenuSubItem key={subSubItem.url}>
                                          <SidebarMenuSubButton asChild>
                                            <NavLink
                                              to={subSubItem.url}
                                              className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sm"
                                              activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                                            >
                                              <span>{subSubItem.title}</span>
                                            </NavLink>
                                          </SidebarMenuSubButton>
                                        </SidebarMenuSubItem>
                                      ))}
                                    </SidebarMenuSub>
                                  </CollapsibleContent>
                                </SidebarMenuSubItem>
                              </Collapsible>
                            ) : (
                              // Item simples (sem sub-subitens)
                              <SidebarMenuSubItem key={subItem.url}>
                                <SidebarMenuSubButton asChild>
                                  <NavLink
                                    to={subItem.url!}
                                    className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                    activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                                  >
                                    <span>{subItem.title}</span>
                                  </NavLink>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ),
                          )}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                ) : (
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

                // Se não há sub-items após filtro, não mostra o grupo
                if (item.items) {
                  const filteredSubItems = getFilteredSubItems(item.items);
                  if (filteredSubItems.length === 0) return null;
                }

                return (
                  <div key={item.title}>
                    {showSeparator && !isCollapsed && <div className="my-2 mx-3 border-t border-sidebar-border" />}
                    {menuElement}
                  </div>
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
              className={`w-full justify-start gap-2 h-auto py-2 px-2 hover:bg-sidebar-accent ${isPersonalRouteActive() ? "bg-sidebar-accent" : ""}`}
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {user?.email?.[0]?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-xs font-medium text-sidebar-foreground truncate">{user?.email || "Usuário"}</p>
                    <Badge variant={getRoleBadgeVariant(role)} className="text-[10px] px-1.5 py-0 h-4 mt-0.5">
                      {getRoleLabel(role)}
                    </Badge>
                  </div>
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56 bg-popover border border-border shadow-lg">
            {filteredPersonalItems.map((item) => (
              <DropdownMenuItem
                key={item.url}
                onClick={() => navigate(item.url)}
                className={`cursor-pointer ${location.pathname === item.url ? "bg-accent" : ""}`}
              >
                <item.icon className="mr-2 h-4 w-4" />
                <span>{item.title}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setMyFilesOpen(true)} className="cursor-pointer">
              <FolderOpen className="mr-2 h-4 w-4" />
              <span>Meus Arquivos</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>

      {/* Drawer de Meus Arquivos */}
      <DrawerArquivosUsuario open={myFilesOpen} onOpenChange={setMyFilesOpen} mode="pessoal" />
    </Sidebar>
  );
}
