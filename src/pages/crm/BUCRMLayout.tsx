import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  MessageCircle,
  Settings,
  Shield,
  ShieldAlert,
  CalendarDays,
  ShoppingCart,
  ClipboardCheck,
  Inbox,
  History
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { BUProvider } from '@/contexts/BUContext';
import { BusinessUnit } from '@/hooks/useMyBU';
import { canUserAccessR2 } from '@/components/auth/R2AccessGuard';
import { useIsR1SupportActive } from '@/hooks/useIsR1SupportActive';

// Configuração de abas visíveis por BU
const BU_VISIBLE_TABS: Record<BusinessUnit, string[]> = {
  incorporador: [
    'visao-geral', 'contatos', 'negocios', 
    'agenda', 'meu-historico', 'agenda-r2', 'r2-carrinho', 'leads-limbo',
    'auditoria-agendamentos', 'meus-no-shows', 'configuracoes'
  ],
  consorcio: [
    'visao-geral', 'contatos', 'negocios', 
    'agenda', 'meu-historico', 'pos-reuniao', 'meus-no-shows', 'configuracoes'
  ],
  credito: [
    'visao-geral', 'contatos', 'negocios',
    'agenda', 'meu-historico', 'meus-no-shows', 'configuracoes'
  ],
  projetos: [
    'visao-geral', 'contatos', 'negocios',
    'agenda', 'meu-historico', 'meus-no-shows', 'configuracoes'
  ],
  leilao: [
    'visao-geral', 'contatos', 'negocios',
    'agenda', 'meu-historico', 'meus-no-shows', 'configuracoes'
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

  // Closer R2 em modo "Apoio R1" deve poder navegar como SDR
  const { isActive: isR1SupportActive } = useIsR1SupportActive();

  // Roles que só podem ver Agenda
  const agendaOnlyRoles = ['sdr', 'closer', 'closer_sombra'];
  const isAgendaOnly = role && agendaOnlyRoles.includes(role) && !isR1SupportActive;
  
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
    { key: 'meu-historico', to: `${basePath}/meu-historico`, label: 'Meu Histórico', icon: History },
    { key: 'agenda-r2', to: `${basePath}/agenda-r2`, label: 'Agenda R2', icon: CalendarDays },
    { key: 'r2-carrinho', to: `${basePath}/r2-carrinho`, label: 'Carrinho R2', icon: ShoppingCart },
    
    { key: 'leads-limbo', to: `${basePath}/leads-limbo`, label: 'Limbo', icon: Inbox },
    
    { key: 'auditoria-agendamentos', to: `${basePath}/auditoria-agendamentos`, label: 'Auditoria', icon: Shield },
    { key: 'meus-no-shows', to: `${basePath}/meus-no-shows`, label: 'Meus No-Shows', icon: ShieldAlert },
    { key: 'pos-reuniao', to: `${basePath}/pos-reuniao`, label: 'Pós-Reunião', icon: ClipboardCheck },
    { key: 'configuracoes', to: `${basePath}/configuracoes`, label: 'Configurações', icon: Settings },
  ];
  
  // Primeiro filtrar por BU
  const buVisibleTabs = BU_VISIBLE_TABS[bu] || [];
  let navItems = allNavItems.filter(item => buVisibleTabs.includes(item.key));
  
  // Depois aplicar filtro de roles (sdr/closer)
  if (isAgendaOnly) {
    const allowedTabs: string[] = ['agenda', 'contatos'];
    
    if (canViewR2 && buVisibleTabs.includes('agenda-r2')) {
      allowedTabs.push('agenda-r2');
    }
    
    // Permitir pos-reuniao para closers/SDRs (necessário para ações pós-reunião)
    if (buVisibleTabs.includes('pos-reuniao')) {
      allowedTabs.push('pos-reuniao');
    }
    
    allowedTabs.push('negocios');
    if (buVisibleTabs.includes('meu-historico')) {
      allowedTabs.push('meu-historico');
    }
    // SDR/Closer precisa ver as próprias contestações de no-show
    if (buVisibleTabs.includes('meus-no-shows')) {
      allowedTabs.push('meus-no-shows');
    }
    
    navItems = navItems.filter(item => allowedTabs.includes(item.key));
  }

  return (
    <BUProvider bu={bu} basePath={basePath}>
      <div className="h-full flex flex-col">
        {/* Header com nome da BU */}
        <div className="border-b border-border bg-card px-6">
          <div className="flex items-center justify-between py-3">
            <h1 className="text-xl font-semibold text-primary tracking-tight">
              CRM - {buDisplayName[bu]}
            </h1>
          </div>
        </div>

        {/* Navegação em mini cards */}
        <div className="px-6 py-4 bg-background">
          <nav className="flex gap-3 overflow-x-auto pb-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.end
                ? location.pathname === item.to
                : location.pathname === item.to || location.pathname.startsWith(item.to + '/');

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={cn(
                    "group flex flex-col items-center justify-center gap-2 min-w-[110px] px-4 py-3 rounded-xl border-2 transition-all duration-200",
                    "hover:shadow-md hover:-translate-y-0.5",
                    isActive
                      ? "border-primary bg-primary/5 text-primary shadow-[0_0_16px_-4px_hsl(var(--primary)/0.3)]"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  <div className={cn(
                    "flex items-center justify-center h-10 w-10 rounded-lg transition-colors",
                    isActive ? "bg-primary/10" : "bg-muted group-hover:bg-primary/5"
                  )}>
                    <Icon className={cn(
                      "h-5 w-5 transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary"
                    )} />
                  </div>
                  <span className={cn(
                    "text-xs font-semibold text-center leading-tight",
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )}>
                    {item.label}
                  </span>
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
