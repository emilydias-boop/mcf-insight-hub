import { BUReportCenter } from '@/components/relatorios/BUReportCenter';

export default function IncorporadorRelatorios() {
    // [REMOVIDO 2026-09-29] 'carrinho' desativado — o Relatório do Carrinho antigo contava contratos errados (111 em vez de 58, reembolso sempre 0); a "Análise de Carrinho" o substitui. Preservado para rollback.
    return (
      <BUReportCenter 
        bu="incorporador" 
        availableReports={['daily_view', 'contracts', 'sales', 'acquisition', 'investigation', 'nao_comprou', 'controle_diego', 'carrinho_analysis']} 
      />
    );
}
