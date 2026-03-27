import { BUReportCenter } from '@/components/relatorios/BUReportCenter';

export default function IncorporadorRelatorios() {
  return (
    <BUReportCenter 
      bu="incorporador" 
      availableReports={['contracts', 'sales', 'carrinho', 'acquisition', 'investigation', 'nao_comprou', 'controle_diego', 'carrinho_analysis']} 
    />
  );
}
