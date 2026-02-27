import { FunilDashboard } from '@/components/crm/FunilDashboard';

const Overview = () => {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-1 sm:mb-2">Painel de Controle do Funil Comercial</h2>
        <p className="text-sm text-muted-foreground hidden sm:block">Acompanhe a performance do seu funil de vendas em tempo real</p>
      </div>

      <FunilDashboard />
    </div>
  );
};

export default Overview;
