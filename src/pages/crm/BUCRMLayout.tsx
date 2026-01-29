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
  ShoppingCart
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { BUProvider } from '@/contexts/BUContext';
import { BusinessUnit } from '@/hooks/useMyBU';
import { canUserAccessR2 } from '@/components/auth/R2AccessGuard';

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
  };
  
  // Redirecionar para agenda se for role restrita
  if (isAgendaOnly && !canViewR2 && location.pathname === basePath) {
    return <Navigate to={`${basePath}/agenda`} replace />;
  }
  
  // Navigation items - ajustados para o basePath da BU
  const allNavItems = [
    { to: basePath, label: 'Visão Geral', icon: LayoutDashboard, end: true },
    { to: `${basePath}/contatos`, label: 'Contatos', icon: Users },
    { to: `${basePath}/negocios`, label: 'Negócios', icon: Briefcase },
    { to: `${basePath}/atendimentos`, label: 'Atendimentos', icon: MessageCircle },
    { to: `${basePath}/agenda`, label: 'Agenda R1', icon: CalendarDays },
    { to: `${basePath}/agenda-r2`, label: 'Agenda R2', icon: CalendarDays },
    { to: `${basePath}/r2-carrinho`, label: 'Carrinho R2', icon: ShoppingCart },
    { to: `${basePath}/deals-orfaos`, label: 'Órfãos', icon: UserX },
    { to: `${basePath}/contatos-duplicados`, label: 'Duplicados', icon: Copy },
    { to: `${basePath}/auditoria-agendamentos`, label: 'Auditoria', icon: Shield },
    { to: `${basePath}/configuracoes`, label: 'Configurações', icon: Settings },
  ];
  
  // Filtrar navegação baseado nas permissões
  let navItems = allNavItems;
  
  if (isAgendaOnly) {
    const allowedTabs: string[] = [`${basePath}/agenda`];
    
    if (canViewR2) {
      allowedTabs.push(`${basePath}/agenda-r2`);
    }
    
    // Negócios sempre permitido (filtrado por BU)
    allowedTabs.push(`${basePath}/negocios`);
    
    navItems = allNavItems.filter(item => allowedTabs.includes(item.to));
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
