import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Ultrameta {
  ultrametaClint: number;
  faturamentoIncorporador50k: number;
  faturamentoClintBruto: number;
  ultrametaLiquido: number;
  vendasA010: number;
}

// Produtos que ENTRAM no Incorporador 50k (A005 EXCLUÍDO conforme correção)
const INCORPORADOR_PRODUCTS = ['A000', 'A001', 'A003', 'A009'];

// Produtos EXCLUÍDOS do Incorporador 50k
const EXCLUDED_PRODUCT_NAMES = [
  'A005', // P2 excluído
  'A006', // Renovação
  'A010', // A010 é contado separadamente
  'IMERSÃO SÓCIOS',
  'IMERSAO SOCIOS', 
  'EFEITO ALAVANCA',
  'CLUBE DO ARREMATE',
  'CLUBE ARREMATE',
];

export const useUltrameta = (startDate?: Date, endDate?: Date, sdrIa: number = 0) => {
  return useQuery({
    queryKey: ['ultrameta', startDate?.toISOString(), endDate?.toISOString(), sdrIa],
    queryFn: async (): Promise<Ultrameta> => {
      // Buscar transações Hubla completadas no período
      let query = supabase
        .from('hubla_transactions')
        .select('hubla_id, product_name, product_category, product_price, net_value, sale_status, raw_data, installment_number, customer_name')
        .eq('sale_status', 'completed');
      
      if (startDate) {
        query = query.gte('sale_date', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('sale_date', endDate.toISOString());
      }
      
      const { data: transactions, error } = await query;
      
      if (error) throw error;
      
      if (!transactions || transactions.length === 0) {
        return {
          ultrametaClint: sdrIa * 1400, // Mesmo sem vendas, SDR IA conta
          faturamentoIncorporador50k: 0,
          faturamentoClintBruto: 0,
          ultrametaLiquido: 0,
          vendasA010: 0,
        };
      }

      // ===== FATURAMENTO CLINT (BRUTO) =====
      // Usa o valor do produto completo (raw_data->>'Valor do produto')
      // Filtra por DATA DA VENDA, apenas vendas novas (não recorrências)
      const faturamentoClintBruto = transactions
        .filter(tx => {
          const productName = (tx.product_name || '').toUpperCase();
          // Verificar se é produto válido do Incorporador
          const isIncorporador = INCORPORADOR_PRODUCTS.some(code => productName.startsWith(code));
          // Excluir produtos específicos
          const isExcluded = EXCLUDED_PRODUCT_NAMES.some(name => 
            productName.includes(name.toUpperCase())
          );
          // Apenas primeira parcela (vendas novas)
          const isFirstInstallment = !tx.installment_number || tx.installment_number === 1;
          return isIncorporador && !isExcluded && isFirstInstallment;
        })
        .reduce((sum, tx) => {
          // Usar "Valor do produto" do raw_data se disponível
          const rawData = tx.raw_data as Record<string, any> | null;
          let valorProduto = 0;
          
          if (rawData?.['Valor do produto']) {
            // Formato CSV: "R$ 19.500,00" ou "19500"
            const valorStr = String(rawData['Valor do produto']);
            valorProduto = parseFloat(valorStr.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
          } else if (rawData?.event?.invoice?.amount?.subtotalCents) {
            // Formato webhook: valor em centavos
            valorProduto = rawData.event.invoice.amount.subtotalCents / 100;
          } else {
            // Fallback: usar product_price
            valorProduto = tx.product_price || 0;
          }
          
          return sum + valorProduto;
        }, 0);

      // ===== INCORPORADOR 50K (LÍQUIDO) =====
      // Soma net_value das parcelas PAGAS no período
      // Inclui recorrências (todas as parcelas)
      // Deduplicar por hubla_id
      const seenHublaIds = new Set<string>();
      const incorporador50kLiquido = transactions
        .filter(tx => {
          const productName = (tx.product_name || '').toUpperCase();
          const isIncorporador = INCORPORADOR_PRODUCTS.some(code => productName.startsWith(code));
          const isExcluded = EXCLUDED_PRODUCT_NAMES.some(name => 
            productName.includes(name.toUpperCase())
          );
          
          // Deduplicar por hubla_id
          if (seenHublaIds.has(tx.hubla_id)) return false;
          seenHublaIds.add(tx.hubla_id);
          
          return isIncorporador && !isExcluded;
        })
        .reduce((sum, tx) => {
          // Usar net_value diretamente (valor líquido da parcela)
          const netValue = tx.net_value && tx.net_value > 0 
            ? tx.net_value 
            : (tx.product_price || 0) * 0.9417;
          return sum + netValue;
        }, 0);

      // ===== VENDAS A010 =====
      // Contar vendas A010 (excluindo -offer- para corresponder à planilha = 179)
      const vendasA010 = transactions.filter(tx => {
        const productName = (tx.product_name || '').toUpperCase();
        const isA010 = tx.product_category === 'a010' || productName.includes('A010');
        const hasValidName = tx.customer_name && tx.customer_name.trim() !== '';
        const isFirstInstallment = !tx.installment_number || tx.installment_number === 1;
        // Excluir Order Bumps (-offer-)
        const isNotOffer = !tx.hubla_id.includes('-offer-');
        return isA010 && hasValidName && isFirstInstallment && isNotOffer;
      }).length;

      // ===== ULTRAMETAS =====
      // Ultrameta Clint = (Vendas A010 × R$ 1.680) + (SDR IA × R$ 1.400)
      const ultrametaClint = (vendasA010 * 1680) + (sdrIa * 1400);
      // Ultrameta Líquido = Vendas A010 × R$ 1.400
      const ultrametaLiquido = vendasA010 * 1400;

      return {
        ultrametaClint,
        faturamentoIncorporador50k: incorporador50kLiquido,
        faturamentoClintBruto,
        ultrametaLiquido,
        vendasA010,
      };
    },
    refetchInterval: 60000,
  });
};
