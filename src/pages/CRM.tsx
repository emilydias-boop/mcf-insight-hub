import { Outlet } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import { LayoutDashboard, Users, Briefcase, MessageCircle, Settings, Shield, CalendarDays, UserX } from 'lucide-react';

const CRM = () => {
  const navItems = [
    { to: '/crm', label: 'Visão Geral', icon: LayoutDashboard, end: true },
    { to: '/crm/contatos', label: 'Contatos', icon: Users },
    { to: '/crm/negocios', label: 'Negócios', icon: Briefcase },
    { to: '/crm/atendimentos', label: 'Atendimentos', icon: MessageCircle },
    { to: '/crm/agenda', label: 'Agenda', icon: CalendarDays },
    { to: '/crm/deals-orfaos', label: 'Órfãos', icon: UserX },
    { to: '/crm/auditoria-agendamentos', label: 'Auditoria', icon: Shield },
    { to: '/crm/configuracoes', label: 'Configurações', icon: Settings },
  ];

  return (
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
  );
};

export default CRM;
