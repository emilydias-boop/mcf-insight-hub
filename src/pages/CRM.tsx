import { Outlet } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import { LayoutDashboard, Users, Briefcase, Settings, CalendarDays, Inbox, ShieldAlert, Shield, BarChart3, History } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { canUserAccessR2 } from '@/components/auth/R2AccessGuard';
import { BUProvider } from '@/contexts/BUContext';
import { useIsR1SupportActive } from '@/hooks/useIsR1SupportActive';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const CRM = () => {
  const { role, user } = useAuth();

  // Closer R2 em modo "Apoio R1" deve poder navegar como SDR (acessar Negócios/Contatos)
  const { isActive: isR1SupportActive } = useIsR1SupportActive();

  // Roles que só podem ver Agenda (exceto se estiver na whitelist R2 ou Negócios)
  const agendaOnlyRoles = ['sdr', 'closer', 'closer_sombra'];
  const isAgendaOnly = role && agendaOnlyRoles.includes(role) && !isR1SupportActive;
  
  // Verificar se usuário tem permissão especial para R2
  const canViewR2ByRole = canUserAccessR2(role, user?.id);

  // Permissão individual em user_permissions para agenda_r2
  const { data: r2UserPermission } = useQuery({
    queryKey: ['crm-nav-r2-permission', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('user_permissions')
        .select('permission_level')
        .eq('user_id', user.id)
        .eq('resource', 'agenda_r2')
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
  const hasR2UserPermission = !!r2UserPermission?.permission_level &&
    r2UserPermission.permission_level !== 'none';
  const canViewR2 = canViewR2ByRole || hasR2UserPermission;
  
  const allNavItems = [
    { to: '/crm', label: 'Visão Geral', icon: LayoutDashboard, end: true },
    { to: '/crm/contatos', label: 'Contatos', icon: Users },
    { to: '/crm/negocios', label: 'Negócios', icon: Briefcase },
    { to: '/crm/agenda', label: 'Agenda R1', icon: CalendarDays },
    { to: '/crm/meu-historico', label: 'Meu Histórico', icon: History },
    { to: '/crm/agenda-r2', label: 'Agenda R2', icon: CalendarDays },
    { to: '/crm/r2-carrinho', label: 'Carrinho R2', icon: Briefcase },
    
    { to: '/crm/leads-limbo', label: 'Limbo', icon: Inbox },
    
    { to: '/crm/retornos-parceiros', label: 'Retornos', icon: ShieldAlert },
    { to: '/crm/auditoria-agendamentos', label: 'Auditoria', icon: Shield },
    { to: '/crm/webhook-analytics', label: 'Análise Webhooks', icon: BarChart3 },
    { to: '/crm/configuracoes', label: 'Configurações', icon: Settings },
  ];
  
  // Filtrar navegação baseado nas permissões
  let navItems = allNavItems;
  
  if (isAgendaOnly) {
    const allowedTabs: string[] = ['/crm/agenda', '/crm/negocios', '/crm/contatos', '/crm/meu-historico']; // Agenda R1 + Negócios + Contatos + Histórico sempre liberados
    
    if (canViewR2) {
      allowedTabs.push('/crm/agenda-r2');
      allowedTabs.push('/crm/r2-carrinho');
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
