import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Ultrameta {
  ultrametaClint: number;
  faturamentoIncorporador50k: number;
  faturamentoClintBruto: number;
  ultrametaLiquido: number;
}

// Categorias que ENTRAM no Incorporador 50k (A006 EXCLUÍDO)
const INCORPORADOR_CATEGORIES = ['incorporador', 'contrato-anticrise'];
const EXCLUDED_CATEGORIES = ['renovacao', 'imersao_socios', 'efeito_alavanca', 'clube_arremate', 'a010'];

export const useUltrameta = (startDate?: Date, endDate?: Date) => {
  return useQuery({
    queryKey: ['ultrameta', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async (): Promise<Ultrameta> => {
      // Buscar transações Hubla diretamente para cálculo preciso
      let query = supabase
        .from('hubla_transactions')
        .select('product_name, product_category, product_price, net_value, sale_status')
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
          ultrametaClint: 0,
          faturamentoIncorporador50k: 0,
          faturamentoClintBruto: 0,
          ultrametaLiquido: 0,
        };
      }

      // Filtrar transações válidas para Incorporador 50k
      const incorporadorTransactions = transactions.filter(tx => {
        const category = tx.product_category?.toLowerCase() || '';
        const productName = tx.product_name?.toUpperCase() || '';
        
        // Excluir A006 (renovação)
        if (productName.includes('A006') || productName.includes('RENOVAÇÃO PARCEIRO')) {
          return false;
        }
        
        // Excluir Imersão Sócios
        if (productName.includes('IMERSÃO SÓCIOS') || productName.includes('IMERSAO SOCIOS')) {
          return false;
        }
        
        // Excluir Efeito Alavanca e Clube Arremate
        if (productName.includes('EFEITO ALAVANCA') || productName.includes('CLUBE')) {
          return false;
        }
        
        // Verificar categorias
        const isIncluded = INCORPORADOR_CATEGORIES.some(cat => 
          category === cat || category.includes(cat)
        );
        const isExcluded = EXCLUDED_CATEGORIES.some(cat => 
          category === cat || category.includes(cat)
        );
        
        return isIncluded && !isExcluded;
      });

      // Calcular Incorporador 50k usando net_value (valor líquido)
      const incorporador50k = incorporadorTransactions.reduce((sum, tx) => {
        const netValue = tx.net_value && tx.net_value > 0 
          ? tx.net_value 
          : (tx.product_price || 0) * 0.9417;
        return sum + netValue;
      }, 0);

      // Calcular faturamento bruto total (todas as transações)
      const faturamentoClintBruto = transactions.reduce((sum, tx) => {
        return sum + (tx.product_price || 0);
      }, 0);

      // Contar vendas A010 para Ultrameta
      const vendasA010 = transactions.filter(tx => 
        tx.product_category?.toLowerCase() === 'a010'
      ).length;

      // Ultrameta Clint = Vendas A010 × R$ 1.680
      const ultrametaClint = vendasA010 * 1680;

      // Ultrameta Líquido = Vendas A010 × R$ 1.400
      const ultrametaLiquido = vendasA010 * 1400;

      return {
        ultrametaClint,
        faturamentoIncorporador50k: incorporador50k,
        faturamentoClintBruto,
        ultrametaLiquido,
      };
    },
    refetchInterval: 60000,
  });
};
