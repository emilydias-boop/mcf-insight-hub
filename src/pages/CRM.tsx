import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import { LayoutDashboard, Users, Briefcase, MessageCircle, Settings, CalendarDays, UserX, Copy, Inbox, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { canUserAccessR2 } from '@/components/auth/R2AccessGuard';
import { canUserAccessNegocios } from '@/components/auth/NegociosAccessGuard';
import { BUProvider } from '@/contexts/BUContext';

const CRM = () => {
  const { role, user } = useAuth();
  const location = useLocation();
  
  // Roles que só podem ver Agenda (exceto se estiver na whitelist R2 ou Negócios)
  const agendaOnlyRoles = ['sdr', 'closer', 'closer_sombra'];
  const isAgendaOnly = role && agendaOnlyRoles.includes(role);
  
  // Verificar se usuário tem permissão especial para R2
  const canViewR2 = canUserAccessR2(role, user?.id);
  
  // Verificar se usuário tem permissão para Negócios
  // AGORA: Todos têm acesso (filtro é baseado na BU)
  const canViewNegocios = true;
  
  // Redirecionar para /crm/agenda se for sdr/closer sem permissão R2 ou Negócios
  if (isAgendaOnly && !canViewR2 && !canViewNegocios && location.pathname === '/crm') {
    return <Navigate to="/crm/agenda" replace />;
  }
  
  const allNavItems = [
    { to: '/crm', label: 'Visão Geral', icon: LayoutDashboard, end: true },
    { to: '/crm/contatos', label: 'Contatos', icon: Users },
    { to: '/crm/negocios', label: 'Negócios', icon: Briefcase },
    // { to: '/crm/atendimentos', label: 'Atendimentos', icon: MessageCircle }, // Oculto até telefones disponíveis
    { to: '/crm/agenda', label: 'Agenda R1', icon: CalendarDays },
    { to: '/crm/agenda-r2', label: 'Agenda R2', icon: CalendarDays },
    { to: '/crm/r2-carrinho', label: 'Carrinho R2', icon: Briefcase },
    { to: '/crm/deals-orfaos', label: 'Órfãos', icon: UserX },
    { to: '/crm/leads-limbo', label: 'Limbo', icon: Inbox },
    { to: '/crm/contatos-duplicados', label: 'Duplicados', icon: Copy },
    { to: '/crm/retornos-parceiros', label: 'Retornos', icon: ShieldAlert },
    { to: '/crm/configuracoes', label: 'Configurações', icon: Settings },
  ];
  
  // Filtrar navegação baseado nas permissões
  let navItems = allNavItems;
  
  if (isAgendaOnly) {
    const allowedTabs: string[] = ['/crm/agenda']; // Sempre tem acesso à Agenda R1
    
    if (canViewR2) {
      allowedTabs.push('/crm/agenda-r2');
    }
    
    if (canViewNegocios) {
      allowedTabs.push('/crm/negocios');
    }
    
    navItems = allNavItems.filter(item => allowedTabs.includes(item.to));
  }

  return (
    <BUProvider bu="incorporador" basePath="/crm">
      <div className="h-full flex flex-col">
        <div className="border-b border-border bg-card px-6">
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
};

export default CRM;
