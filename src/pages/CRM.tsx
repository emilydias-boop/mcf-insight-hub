import { Outlet } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import { LayoutDashboard, Users, Briefcase, MapPin, Layers, Tag, Settings, Upload } from 'lucide-react';

const CRM = () => {
  const navItems = [
    { to: '/crm', label: 'Visão Geral', icon: LayoutDashboard, end: true },
    { to: '/crm/contatos', label: 'Contatos', icon: Users },
    { to: '/crm/negocios', label: 'Negócios', icon: Briefcase },
    { to: '/crm/origens', label: 'Origens', icon: MapPin },
    { to: '/crm/grupos', label: 'Grupos', icon: Layers },
    { to: '/crm/tags', label: 'Tags', icon: Tag },
    { to: '/crm/importar-contatos', label: 'Importar', icon: Upload },
    { to: '/crm/configuracoes', label: 'Configurações', icon: Settings },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border bg-card">
        <div className="container py-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">CRM Clint</h1>
          <p className="text-muted-foreground">Gerencie seus contatos, negócios e relacionamentos</p>
        </div>
        
        <div className="container">
          <nav className="flex gap-1 overflow-x-auto pb-px">
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
      </div>

      <div className="flex-1 overflow-auto">
        <div className="container py-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default CRM;
