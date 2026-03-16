import { FinanceiroCobrancas } from '@/components/financeiro/cobranca/FinanceiroCobrancas';

const Cobrancas = () => {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Cobranças</h1>
        <p className="text-sm text-muted-foreground hidden sm:block">
          Gestão de assinaturas, parcelas e acordos de cobrança
        </p>
      </div>

      <FinanceiroCobrancas />
    </div>
  );
};

export default Cobrancas;
