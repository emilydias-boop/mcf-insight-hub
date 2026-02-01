import { useAuth } from '@/contexts/AuthContext';
import { useMyBU } from '@/hooks/useMyBU';
import { useUltrametaByBU } from '@/hooks/useUltrametaByBU';
import { BUMoonCard } from '@/components/home/BUMoonCard';
import { Button } from '@/components/ui/button';
import { Building2, TrendingUp, CreditCard, Gavel, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// BU configuration with colors and icons
const BU_CONFIG = {
  incorporador: {
    name: 'Incorporador',
    icon: Building2,
    color: 'hsl(220, 90%, 56%)', // Blue
    href: '/bu-incorporador/transacoes',
  },
  consorcio: {
    name: 'Consórcio',
    icon: TrendingUp,
    color: 'hsl(142, 76%, 36%)', // Green
    href: '/consorcio',
  },
  credito: {
    name: 'Crédito',
    icon: CreditCard,
    color: 'hsl(200, 80%, 50%)', // Cyan
    href: '/bu-credito',
  },
  leilao: {
    name: 'Leilão',
    icon: Gavel,
    color: 'hsl(45, 93%, 47%)', // Gold
    href: '/leilao',
  },
} as const;

// Role-based navigation destinations
const ROLE_DESTINATIONS: Record<string, string> = {
  admin: '/',
  manager: '/',
  coordenador: '/',
  closer: '/crm/agenda',
  closer_sombra: '/crm/agenda',
  sdr: '/sdr/minhas-reunioes',
  viewer: '/',
  financeiro: '/financeiro',
  rh: '/rh/colaboradores',
};

export default function Home() {
  const { user, role } = useAuth();
  const { data: myBU } = useMyBU();
  const { data: metrics, isLoading } = useUltrametaByBU();
  const navigate = useNavigate();

  // Get user's first name for greeting
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'Usuário';

  // Only admin and manager can navigate to BU dashboards
  const canNavigateToBU = role === 'admin' || role === 'manager';

  // Determine where to navigate based on role and BU
  const getMyAreaDestination = () => {
    // If user has a BU assigned, go to that BU's dashboard
    if (myBU) {
      return BU_CONFIG[myBU as keyof typeof BU_CONFIG]?.href || '/';
    }
    
    // Otherwise, use role-based destination
    const primaryRole = role || 'viewer';
    return ROLE_DESTINATIONS[primaryRole] || '/';
  };

  const handleGoToMyArea = () => {
    navigate(getMyAreaDestination());
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-6xl space-y-10">
        {/* Welcome Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            Olá, {firstName}! 👋
          </h1>
          <p className="text-lg text-muted-foreground">
            Acompanhe o progresso da Ultrameta de cada equipe
          </p>
        </div>

        {/* 4 Moons Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {(['incorporador', 'consorcio', 'credito', 'leilao'] as const).map((bu) => {
            const config = BU_CONFIG[bu];
            const buMetrics = metrics?.find((m) => m.bu === bu);

            return (
              <BUMoonCard
                key={bu}
                name={config.name}
                icon={config.icon}
                color={config.color}
                href={config.href}
                value={buMetrics?.value || 0}
                target={buMetrics?.target || 0}
                isLoading={isLoading}
                canNavigate={canNavigateToBU}
              />
            );
          })}
        </div>

        {/* Go to My Area Button */}
        <div className="flex justify-center">
          <Button 
            onClick={handleGoToMyArea}
            size="lg"
            className="gap-2 text-base px-8"
          >
            Ir para minha área
            <ArrowRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Month info */}
        <p className="text-center text-sm text-muted-foreground">
          Mês atual
        </p>
      </div>
    </div>
  );
}
