import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Categorias que ENTRAM no Incorporador 50k
// A006 (renovação) é EXCLUÍDO
const INCORPORADOR_CATEGORIES = [
  'incorporador',
  'contrato-anticrise',
];

// Categorias explicitamente excluídas
const EXCLUDED_CATEGORIES = [
  'renovacao',
  'imersao_socios',
  'efeito_alavanca',
  'clube_arremate',
  'a010',
  'ob_construir_alugar',
  'ob_vitalicio',
  'ob_evento',
];

export interface Incorporador50kData {
  total: number;
  netTotal: number;
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
  }[];
}

export const useIncorporador50k = (startDate?: Date, endDate?: Date) => {
  return useQuery({
    queryKey: ['incorporador-50k', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async (): Promise<Incorporador50kData> => {
      let query = supabase
        .from('hubla_transactions')
        .select('id, hubla_id, product_name, product_category, product_price, net_value, customer_name, sale_date, installment_number, total_installments, is_offer, sale_status')
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

      // Filtrar apenas transações válidas para Incorporador 50k
      const validTransactions = (data || []).filter(tx => {
        const category = tx.product_category?.toLowerCase() || '';
        
        // Verificar se está nas categorias incluídas
        const isIncluded = INCORPORADOR_CATEGORIES.some(cat => 
          category === cat || category.includes(cat)
        );
        
        // Verificar se não está nas categorias excluídas
        const isExcluded = EXCLUDED_CATEGORIES.some(cat => 
          category === cat || category.includes(cat)
        );
        
        // Verificar pelo nome do produto também (casos especiais)
        const productName = tx.product_name?.toUpperCase() || '';
        
        // A006 é renovação, excluir
        if (productName.includes('A006') || productName.includes('RENOVAÇÃO PARCEIRO')) {
          return false;
        }
        
        // Imersão Sócios não conta
        if (productName.includes('IMERSÃO SÓCIOS') || productName.includes('IMERSAO SOCIOS')) {
          return false;
        }
        
        // Efeito Alavanca e Clube Arremate não contam
        if (productName.includes('EFEITO ALAVANCA') || productName.includes('CLUBE')) {
          return false;
        }
        
        return isIncluded && !isExcluded;
      });

      // Calcular totais usando net_value (valor líquido corrigido)
      const netTotal = validTransactions.reduce((sum, tx) => {
        // Usar net_value se disponível, senão calcular aproximadamente
        const netValue = tx.net_value && tx.net_value > 0 
          ? tx.net_value 
          : (tx.product_price || 0) * 0.9417;
        return sum + netValue;
      }, 0);

      const grossTotal = validTransactions.reduce((sum, tx) => {
        return sum + (tx.product_price || 0);
      }, 0);

      return {
        total: grossTotal,
        netTotal,
        transactionCount: validTransactions.length,
        transactions: validTransactions.map(tx => ({
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
        })),
      };
    },
    refetchInterval: 60000, // Atualizar a cada minuto
  });
};
