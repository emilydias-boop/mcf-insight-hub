import { FunilDashboard } from '@/components/crm/FunilDashboard';
import { PosVendaDashboard } from '@/components/crm/pos-venda/PosVendaDashboard';
import { useActiveBU } from '@/hooks/useActiveBU';

const Overview = () => {
  const isPosVenda = (useActiveBU() as string | null) === 'pos_venda';
  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-1 sm:mb-2">
          {isPosVenda ? 'Painel de Controle do Pós-Venda' : 'Painel de Controle do Funil Comercial'}
        </h2>
        <p className="text-sm text-muted-foreground hidden sm:block">Acompanhe a performance do seu funil de vendas em tempo real</p>
      </div>

      {isPosVenda ? <PosVendaDashboard /> : <FunilDashboard />}
    </div>
  );
};

export default Overview;
