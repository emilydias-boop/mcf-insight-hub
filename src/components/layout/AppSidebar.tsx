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
  Crown,
  CheckSquare,
  Briefcase,
  Megaphone,
  Monitor,
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

type AppRole = "admin" | "manager" | "viewer" | "sdr" | "closer" | "closer_sombra" | "coordenador" | "rh" | "financeiro" | "gr";

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
  // Visão Chairman - Executive Dashboard
  {
    title: "Visão Chairman",
    url: "/chairman",
    icon: Crown,
    requiredRoles: ["admin", "manager"],
  },
  
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    resource: "dashboard",
    items: [
      { title: "Visão Geral", url: "/dashboard" },
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
      { title: "Painel Comercial", url: "/crm/reunioes-equipe" },
      { title: "Fechamento Equipe", url: "/fechamento-sdr" },
      { title: "Vendas", url: "/bu-incorporador/transacoes" },
      { title: "CRM", url: "/crm" },
      { title: "Relatórios", url: "/bu-incorporador/relatorios" },
      { title: "Documentos Estratégicos", url: "/bu-incorporador/documentos-estrategicos", requiredRoles: ["admin", "manager", "coordenador"] },
    ],
  },

  // BU - CONSÓRCIO (unificado com filtro de categoria)
  {
    title: "BU - Consórcio",
    icon: Handshake,
    requiredRoles: ["admin", "manager", "coordenador", "sdr", "closer"],
    requiredProducts: ["consorcio"],
    items: [
      { title: "Fechamento", url: "/consorcio/fechamento", requiredRoles: ["admin", "manager", "coordenador"] },
      { title: "CRM", url: "/consorcio/crm" },
      { title: "Painel Equipe", url: "/consorcio/painel-equipe" },
      { title: "Vendas", url: "/consorcio/vendas", requiredRoles: ["admin", "manager", "coordenador"] },
      { title: "Controle Consorcio", url: "/consorcio", requiredRoles: ["admin", "manager", "coordenador"] },
      { title: "Importar", url: "/consorcio/importar", requiredRoles: ["admin", "manager", "coordenador"] },
      { title: "Relatórios", url: "/consorcio/relatorio", requiredRoles: ["admin", "manager", "coordenador"] },
      { title: "Documentos Estratégicos", url: "/consorcio/documentos-estrategicos", requiredRoles: ["admin", "manager", "coordenador"] },
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
      { title: "CRM", url: "/bu-credito/crm" },
      { title: "Gestão Legado", url: "/credito" },
      { title: "Relatórios", url: "/bu-credito/relatorios" },
      { title: "Documentos Estratégicos", url: "/bu-credito/documentos-estrategicos", requiredRoles: ["admin", "manager", "coordenador"] },
    ],
  },

  // BU - PROJETOS
  {
    title: "BU - Projetos",
    icon: FolderKanban,
    resource: "projetos",
    items: [
      { title: "Gestão de Projetos", url: "/projetos" },
      { title: "CRM", url: "/bu-projetos/crm" },
      { title: "Relatórios", url: "/bu-projetos/relatorios" },
      { title: "Documentos Estratégicos", url: "/bu-projetos/documentos-estrategicos", requiredRoles: ["admin", "manager", "coordenador"] },
    ],
  },

  // LEILÃO
  {
    title: "Leilão",
    icon: Gavel,
    resource: "leilao",
    requiredRoles: ["admin", "manager"],
    items: [
      { title: "Leilões Imobiliários", url: "/leilao" },
      { title: "CRM", url: "/leilao/crm" },
      { title: "Documentos Estratégicos", url: "/leilao/documentos-estrategicos", requiredRoles: ["admin", "manager", "coordenador"] },
    ],
  },

  // BU - MARKETING
  {
    title: "BU - Marketing",
    icon: Megaphone,
    requiredRoles: ["admin", "manager", "coordenador"],
    items: [
      { title: "Dashboard Ads", url: "/bu-marketing" },
      { title: "Campanhas", url: "/bu-marketing/campanhas" },
      { title: "Aquisição A010", url: "/bu-marketing/aquisicao-a010" },
      { title: "Config Links A010", url: "/bu-marketing/a010-links-config" },
      { title: "Documentos Estratégicos", url: "/bu-marketing/documentos-estrategicos", requiredRoles: ["admin", "manager", "coordenador"] },
    ],
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
    items: [
      { title: "Colaboradores", url: "/rh/colaboradores" },
      { title: "Prova Equipe", url: "/rh/prova-equipe" },
      { title: "Configurações", url: "/rh/configuracoes" },
    ],
  },

  // TAREFAS
  {
    title: "Tarefas",
    url: "/tarefas",
    icon: CheckSquare,
    requiredRoles: ["admin", "manager", "coordenador"],
  },

  // PATRIMÔNIO
  {
    title: "Patrimônio",
    icon: Monitor,
    resource: "patrimonio" as any,
    items: [
      { title: "Central de Patrimônio", url: "/patrimonio", requiredRoles: ["admin", "manager", "rh"] },
      { title: "Relatórios", url: "/patrimonio/relatorios", requiredRoles: ["admin", "manager", "rh"] },
      { title: "Meus Equipamentos", url: "/patrimonio/meus-equipamentos" },
    ],
  },

  // GERENTES DE CONTA
  {
    title: "Gerentes de Conta",
    icon: Briefcase,
    requiredRoles: ["admin", "manager", "coordenador", "gr"],
    items: [
      { title: "Minha Carteira", url: "/gerentes-conta/minha-carteira", requiredRoles: ["gr"] },
      { title: "Gestão Carteiras", url: "/gerentes-conta/gestao", requiredRoles: ["admin", "manager", "coordenador"] },
    ],
  },

  // ===== ITENS AVULSOS PARA SDR/CLOSER =====
  // NOTA: Os itens "Agenda" e "Negócios" para SDR/Closer são gerados dinamicamente
  // dentro do componente AppSidebar para suportar rotas baseadas na BU do usuário.
  // Veja a variável `dynamicSDRCloserItems` no componente.

  // Minhas Reuniões (apenas SDR)
  {
    title: "Minhas Reuniões",
    url: "/sdr/minhas-reunioes",
    icon: Calendar,
    resource: "crm",
    requiredRoles: ["sdr"],
    separator: true,
  },

  // Meu Desempenho (apenas Closer)
  {
    title: "Meu Desempenho",
    url: "/closer/meu-desempenho",
    icon: BarChart3,
    resource: "crm",
    requiredRoles: ["closer"],
    separator: true,
  },

  // Metas da Equipe (SDRs, Closers e Closer Sombra da BU Incorporador)
  {
    title: "Metas da Equipe",
    url: "/crm/reunioes-equipe",
    icon: BarChart3,
    resource: "crm",
    requiredRoles: ["sdr", "closer", "closer_sombra"],
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
    requiredRoles: ["admin", "manager"],
    items: [
      { title: "Usuários", url: "/usuarios", requiredRoles: ["admin"] },
      { title: "Closers", url: "/crm/configurar-closers", requiredRoles: ["admin"] },
      { title: "Automações", url: "/admin/automacoes", requiredRoles: ["admin"] },
      { title: "Permissões", url: "/admin/permissoes", requiredRoles: ["admin"] },
      { title: "Produtos", url: "/admin/produtos", requiredRoles: ["admin"] },
      { title: "Distribuição Leads", url: "/admin/distribuicao-leads" },
      { title: "Configuração BU", url: "/admin/configuracao-bu", requiredRoles: ["admin", "manager"] },
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
  { title: "Meu Fechamento", url: "/meu-fechamento", icon: Receipt, requiredRoles: ["sdr", "closer"] },
  { title: "Alertas", url: "/alertas", icon: Bell },
];

// Mapa de base paths do CRM por BU
const BU_CRM_BASE_PATH: Record<BusinessUnit, string> = {
  incorporador: '/crm',
  consorcio: '/consorcio/crm',
  credito: '/bu-credito/crm',
  projetos: '/bu-projetos/crm',
  leilao: '/leilao/crm',
  marketing: '/bu-marketing',
};

// Helper para resolver o base path do CRM baseado nas BUs do usuário
const getCRMBasePath = (userBUs: BusinessUnit[]): string => {
  const buPriority: BusinessUnit[] = ['consorcio', 'credito', 'projetos', 'leilao', 'marketing'];
  
  for (const bu of buPriority) {
    if (userBUs.includes(bu)) {
      return BU_CRM_BASE_PATH[bu];
    }
  }
  
  return '/crm';
};

export function AppSidebar() {
  const { user, role, allRoles, signOut, loading: authLoading } = useAuth();
  const { canAccessResource, isAdmin } = useMyPermissions();
  const { data: myProducts = [] } = useMyProducts();
  const { data: myBUs = [] } = useMyBU();
  const { state, toggleSidebar, isMobile } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const isCollapsed = state === "collapsed";
  const showText = isMobile || !isCollapsed;
  const [myFilesOpen, setMyFilesOpen] = useState(false);

  // === ITENS DINÂMICOS PARA SDR/CLOSER ===
  // Estes itens precisam de URLs dinâmicas baseadas na BU do usuário
  const crmBasePath = getCRMBasePath(myBUs);
  
  const dynamicSDRCloserItems: MenuItem[] = [
    // Agenda (SDR, Closer e Closer Sombra) - URL dinâmica por BU
    {
      title: "Agenda",
      url: `${crmBasePath}/agenda`,
      icon: Calendar,
      resource: "crm",
      requiredRoles: ["sdr", "closer", "closer_sombra"],
    },
    // Negócios (SDR, Closer) - URL dinâmica por BU  
    {
      title: "Negócios",
      url: `${crmBasePath}/negocios`,
      icon: Briefcase,
      resource: "crm",
      requiredRoles: ["sdr", "closer"],
    },
  ];

  const getRoleBadgeVariant = (userRole: AppRole | null, isLoading: boolean) => {
    if (isLoading) return "outline";
    if (userRole === "admin") return "default";
    if (userRole === "manager") return "secondary";
    return "outline";
  };

  const getRoleLabel = (userRole: AppRole | null, isLoading: boolean) => {
    if (isLoading) return "Carregando...";
    if (userRole === "admin") return "Admin";
    if (userRole === "manager") return "Manager";
    if (userRole === "coordenador") return "Coordenador";
    if (userRole === "sdr") return "SDR";
    if (userRole === "closer") return "Closer";
    if (userRole === "rh") return "RH";
    if (userRole === "financeiro") return "Financeiro";
    return "Viewer";
  };

  // Combinar menu items estáticos com itens dinâmicos de SDR/Closer
  const allMenuItems = [...menuItems, ...dynamicSDRCloserItems];

  // Filtragem de menu items
  const filteredMenuItems = allMenuItems.filter((item) => {
    // Verificação de roles
    if (item.requiredRoles && role && !item.requiredRoles.some(r => (allRoles as string[]).includes(r))) {
      // Fallback: SDR/Closer pode ver se tem o produto
      if (item.requiredProducts && ["sdr", "closer"].includes(role)) {
        return item.requiredProducts.some((p) => myProducts.includes(p));
      }
      return false;
    }

    // Verificação de produtos (aplica SEMPRE, não só como fallback)
    if (item.requiredProducts && item.requiredProducts.length > 0) {
      if (!myProducts || !item.requiredProducts.some(p => myProducts.includes(p))) {
        // Admin/Manager/Coordenador ignoram filtro de produto
        if (!isAdmin && role !== 'manager' && role !== 'coordenador') {
          return false;
        }
      }
    }

    // Verificação de BU - ATUALIZADO PARA ARRAY
    if (item.requiredBU && item.requiredBU.length > 0) {
      if (!myBUs || myBUs.length === 0) return false;
      if (!myBUs.some(bu => item.requiredBU!.includes(bu))) return false;
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
      return role && subItem.requiredRoles.some(r => (allRoles as string[]).includes(r));
    });
  };

  // Filtragem de sub-sub-items (2º nível de subitens)
  const getFilteredSubSubItems = (items: SubSubItem[]) => {
    return items.filter((subItem) => {
      if (!subItem.requiredRoles) return true;
      if (isAdmin) return true;
      return role && subItem.requiredRoles.some(r => (allRoles as string[]).includes(r));
    });
  };

  // Filtragem de itens pessoais
  const filteredPersonalItems = personalMenuItems.filter((item) => {
    if (!item.requiredRoles) return true;
    if (isAdmin) return true;
    return role && item.requiredRoles.some(r => (allRoles as string[]).includes(r));
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
              <button 
                onClick={() => navigate('/home')} 
                className="text-xl font-bold text-primary hover:opacity-80 transition-opacity cursor-pointer"
              >
                MCF
              </button>
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
                          onClick={(e) => {
                            // Apenas no desktop com sidebar colapsado, expande o sidebar primeiro
                            if (isCollapsed && !isMobile) {
                              e.preventDefault();
                              toggleSidebar();
                            }
                            // No mobile ou com sidebar expandido, deixa o Collapsible funcionar
                          }}
                        >
                          <item.icon className="h-5 w-5" />
                          {showText && (
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
                    <Badge variant={getRoleBadgeVariant(role, authLoading)} className="text-[10px] px-1.5 py-0 h-4 mt-0.5">
                      {getRoleLabel(role, authLoading)}
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
