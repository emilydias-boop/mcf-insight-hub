import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Produtos que ENTRAM no Incorporador 50k
const INCORPORADOR_PRODUCTS = ['A000', 'A001', 'A003', 'A005', 'A008', 'A009'];

// Produtos EXCLUÍDOS
const EXCLUDED_PRODUCT_NAMES = [
  'A006', // Renovação
  'A010', // A010 é separado
  'IMERSÃO SÓCIOS',
  'IMERSAO SOCIOS',
  'EFEITO ALAVANCA',
  'CLUBE DO ARREMATE',
  'CLUBE ARREMATE',
];

export interface Incorporador50kData {
  total: number;           // Faturamento Bruto (Valor do Produto completo)
  netTotal: number;        // Incorporador 50k Líquido (net_value das parcelas)
  transactionCount: number;
  transactions: {
    id: string;
    hubla_id: string;
    product_name: string;
    product_category: string;
    product_price: number;
    net_value: number;
    customer_name: string;
    sale_date: string;
    installment_number: number;
    total_installments: number;
    is_offer: boolean;
    valor_produto: number;  // Valor do produto completo
  }[];
}

export const useIncorporador50k = (startDate?: Date, endDate?: Date) => {
  return useQuery({
    queryKey: ['incorporador-50k', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async (): Promise<Incorporador50kData> => {
      let query = supabase
        .from('hubla_transactions')
        .select('id, hubla_id, product_name, product_category, product_price, net_value, customer_name, sale_date, installment_number, total_installments, is_offer, sale_status, raw_data')
        .eq('sale_status', 'completed')
        .order('sale_date', { ascending: false });

      if (startDate) {
        query = query.gte('sale_date', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('sale_date', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filtrar apenas produtos válidos do Incorporador 50k
      const validTransactions = (data || []).filter(tx => {
        const productName = (tx.product_name || '').toUpperCase();
        
        // Verificar se é produto válido
        const isIncorporador = INCORPORADOR_PRODUCTS.some(code => 
          productName.startsWith(code)
        );
        
        // Excluir produtos específicos
        const isExcluded = EXCLUDED_PRODUCT_NAMES.some(name => 
          productName.includes(name.toUpperCase())
        );
        
        return isIncorporador && !isExcluded;
      });

      // Deduplicar por hubla_id para evitar contagem dupla
      const seenHublaIds = new Set<string>();
      const uniqueTransactions = validTransactions.filter(tx => {
        if (seenHublaIds.has(tx.hubla_id)) return false;
        seenHublaIds.add(tx.hubla_id);
        return true;
      });

      // Calcular Faturamento Bruto (Valor do Produto completo)
      // Apenas vendas novas (primeira parcela)
      const grossTotal = uniqueTransactions
        .filter(tx => !tx.installment_number || tx.installment_number === 1)
        .reduce((sum, tx) => {
          const rawData = tx.raw_data as Record<string, any> | null;
          let valorProduto = 0;
          
          if (rawData?.['Valor do produto']) {
            const valorStr = String(rawData['Valor do produto']);
            valorProduto = parseFloat(valorStr.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
          } else if (rawData?.event?.invoice?.amount?.subtotalCents) {
            valorProduto = rawData.event.invoice.amount.subtotalCents / 100;
          } else {
            valorProduto = tx.product_price || 0;
          }
          
          return sum + valorProduto;
        }, 0);

      // Calcular Incorporador 50k Líquido (todas as parcelas pagas)
      const netTotal = uniqueTransactions.reduce((sum, tx) => {
        const netValue = tx.net_value && tx.net_value > 0 
          ? tx.net_value 
          : (tx.product_price || 0) * 0.9417;
        return sum + netValue;
      }, 0);

      return {
        total: grossTotal,
        netTotal,
        transactionCount: uniqueTransactions.length,
        transactions: uniqueTransactions.map(tx => {
          const rawData = tx.raw_data as Record<string, any> | null;
          let valorProduto = tx.product_price || 0;
          
          if (rawData?.['Valor do produto']) {
            const valorStr = String(rawData['Valor do produto']);
            valorProduto = parseFloat(valorStr.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
          } else if (rawData?.event?.invoice?.amount?.subtotalCents) {
            valorProduto = rawData.event.invoice.amount.subtotalCents / 100;
          }
          
          return {
            id: tx.id,
            hubla_id: tx.hubla_id,
            product_name: tx.product_name,
            product_category: tx.product_category || 'outros',
            product_price: tx.product_price || 0,
            net_value: tx.net_value && tx.net_value > 0 ? tx.net_value : (tx.product_price || 0) * 0.9417,
            customer_name: tx.customer_name || 'Cliente',
            sale_date: tx.sale_date,
            installment_number: tx.installment_number || 1,
            total_installments: tx.total_installments || 1,
            is_offer: tx.is_offer || false,
            valor_produto: valorProduto,
          };
        }),
      };
    },
    refetchInterval: 60000,
  });
};
