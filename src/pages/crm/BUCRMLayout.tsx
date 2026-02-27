import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  MessageCircle, 
  Settings, 
  Shield, 
  CalendarDays, 
  UserX, 
  Copy,
  ShoppingCart,
  ClipboardCheck,
  Inbox
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { BUProvider } from '@/contexts/BUContext';
import { BusinessUnit } from '@/hooks/useMyBU';
import { canUserAccessR2 } from '@/components/auth/R2AccessGuard';

// Configuração de abas visíveis por BU
const BU_VISIBLE_TABS: Record<BusinessUnit, string[]> = {
  incorporador: [
    'visao-geral', 'contatos', 'negocios', 
    'agenda', 'agenda-r2', 'r2-carrinho', 'deals-orfaos', 'leads-limbo',
    'contatos-duplicados', 'auditoria-agendamentos', 'configuracoes'
  ],
  consorcio: [
    'visao-geral', 'contatos', 'negocios', 
    'agenda', 'pos-reuniao', 'configuracoes'
  ],
  credito: [
    'visao-geral', 'contatos', 'negocios', 
    'agenda', 'configuracoes'
  ],
  projetos: [
    'visao-geral', 'contatos', 'negocios', 
    'agenda', 'configuracoes'
  ],
  leilao: [
    'visao-geral', 'contatos', 'negocios', 
    'agenda', 'configuracoes'
  ],
  marketing: [],
};

interface BUCRMLayoutProps {
  bu: BusinessUnit;
  basePath: string;
}

/**
 * Layout component for BU-specific CRM views.
 * Wraps child routes with BU context and provides navigation tabs.
 */
export function BUCRMLayout({ bu, basePath }: BUCRMLayoutProps) {
  const { role, user } = useAuth();
  const location = useLocation();
  
  // Roles que só podem ver Agenda
  const agendaOnlyRoles = ['sdr', 'closer', 'closer_sombra'];
  const isAgendaOnly = role && agendaOnlyRoles.includes(role);
  
  // Verificar permissões R2
  const canViewR2 = canUserAccessR2(role, user?.id);
  
  // Map BU para nome exibição
  const buDisplayName: Record<BusinessUnit, string> = {
    incorporador: 'Incorporador',
    consorcio: 'Consórcio',
    credito: 'Crédito',
    projetos: 'Projetos',
    leilao: 'Leilão',
    marketing: 'Marketing',
  };
  
  // Redirecionar para agenda se for role restrita
  if (isAgendaOnly && !canViewR2 && location.pathname === basePath) {
    return <Navigate to={`${basePath}/agenda`} replace />;
  }
  
  // Navigation items - com keys para filtro por BU
  const allNavItems = [
    { key: 'visao-geral', to: basePath, label: 'Visão Geral', icon: LayoutDashboard, end: true },
    { key: 'contatos', to: `${basePath}/contatos`, label: 'Contatos', icon: Users },
    { key: 'negocios', to: `${basePath}/negocios`, label: 'Negócios', icon: Briefcase },
    // { key: 'atendimentos', to: `${basePath}/atendimentos`, label: 'Atendimentos', icon: MessageCircle }, // Oculto até telefones disponíveis
    { key: 'agenda', to: `${basePath}/agenda`, label: 'Agenda R1', icon: CalendarDays },
    { key: 'agenda-r2', to: `${basePath}/agenda-r2`, label: 'Agenda R2', icon: CalendarDays },
    { key: 'r2-carrinho', to: `${basePath}/r2-carrinho`, label: 'Carrinho R2', icon: ShoppingCart },
    { key: 'deals-orfaos', to: `${basePath}/deals-orfaos`, label: 'Órfãos', icon: UserX },
    { key: 'leads-limbo', to: `${basePath}/leads-limbo`, label: 'Limbo', icon: Inbox },
    { key: 'contatos-duplicados', to: `${basePath}/contatos-duplicados`, label: 'Duplicados', icon: Copy },
    { key: 'auditoria-agendamentos', to: `${basePath}/auditoria-agendamentos`, label: 'Auditoria', icon: Shield },
    { key: 'pos-reuniao', to: `${basePath}/pos-reuniao`, label: 'Pós-Reunião', icon: ClipboardCheck },
    { key: 'configuracoes', to: `${basePath}/configuracoes`, label: 'Configurações', icon: Settings },
  ];
  
  // Primeiro filtrar por BU
  const buVisibleTabs = BU_VISIBLE_TABS[bu] || [];
  let navItems = allNavItems.filter(item => buVisibleTabs.includes(item.key));
  
  // Depois aplicar filtro de roles (sdr/closer)
  if (isAgendaOnly) {
    const allowedTabs: string[] = ['agenda'];
    
    if (canViewR2 && buVisibleTabs.includes('agenda-r2')) {
      allowedTabs.push('agenda-r2');
    }
    
    // Permitir pos-reuniao para closers/SDRs (necessário para ações pós-reunião)
    if (buVisibleTabs.includes('pos-reuniao')) {
      allowedTabs.push('pos-reuniao');
    }
    
    allowedTabs.push('negocios');
    
    navItems = navItems.filter(item => allowedTabs.includes(item.key));
  }

  return (
    <BUProvider bu={bu} basePath={basePath}>
      <div className="h-full flex flex-col">
        {/* Header com nome da BU */}
        <div className="border-b border-border bg-card px-6">
          <div className="flex items-center justify-between py-2">
            <h1 className="text-lg font-semibold text-primary">
              CRM - {buDisplayName[bu]}
            </h1>
          </div>
          <nav className="flex gap-1 overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors border-b-2 border-transparent whitespace-nowrap"
                  activeClassName="text-primary border-primary"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="py-4 px-6 w-full max-w-[1920px] mx-auto">
            <Outlet />
          </div>
        </div>
      </div>
    </BUProvider>
  );
}

export default BUCRMLayout;
