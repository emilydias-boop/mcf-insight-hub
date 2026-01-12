import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface IncorporadorTransactionFilters {
  startDate?: Date;
  endDate?: Date;
  search?: string;
  onlyCountInDashboard?: boolean;
}

// Produtos que ENTRAM no Incorporador 50k
const INCORPORADOR_PRODUCTS = ['A000', 'A001', 'A003', 'A005', 'A008', 'A009'];

// Padrões EXCLUÍDOS
const EXCLUDED_PATTERNS = [
  'A006',
  'A010',
  'IMERSÃO SÓCIOS',
  'IMERSAO SOCIOS',
  'EFEITO ALAVANCA',
  'CLUBE DO ARREMATE',
  'CLUBE ARREMATE',
  'RENOVAÇÃO',
  'RENOVACAO',
];

export interface IncorporadorTransaction {
  id: string;
  hubla_id: string;
  product_name: string;
  product_category: string | null;
  product_price: number;
  net_value: number | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  sale_date: string;
  sale_status: string;
  installment_number: number | null;
  total_installments: number | null;
  is_offer: boolean | null;
  count_in_dashboard: boolean | null;
  raw_data: Record<string, any> | null;
  source: string | null;
}

export const useIncorporadorTransactions = (filters: IncorporadorTransactionFilters) => {
  return useQuery({
    queryKey: ['incorporador-transactions', filters.startDate?.toISOString(), filters.endDate?.toISOString(), filters.search, filters.onlyCountInDashboard],
    queryFn: async (): Promise<IncorporadorTransaction[]> => {
      let query = supabase
        .from('hubla_transactions')
        .select('id, hubla_id, product_name, product_category, product_price, net_value, customer_name, customer_email, customer_phone, sale_date, sale_status, installment_number, total_installments, is_offer, count_in_dashboard, raw_data, source')
        .eq('sale_status', 'completed')
        .order('sale_date', { ascending: false });

      // Filtros de data - usar formato sem timezone para evitar corte de transações
      if (filters.startDate) {
        const year = filters.startDate.getFullYear();
        const month = String(filters.startDate.getMonth() + 1).padStart(2, '0');
        const day = String(filters.startDate.getDate()).padStart(2, '0');
        query = query.gte('sale_date', `${year}-${month}-${day}T00:00:00`);
      }
      if (filters.endDate) {
        const year = filters.endDate.getFullYear();
        const month = String(filters.endDate.getMonth() + 1).padStart(2, '0');
        const day = String(filters.endDate.getDate()).padStart(2, '0');
        query = query.lte('sale_date', `${year}-${month}-${day}T23:59:59`);
      }

      if (filters.onlyCountInDashboard) {
        query = query.eq('count_in_dashboard', true);
      }

      const { data, error } = await query.limit(5000);
      if (error) throw error;

      // Filtrar por produtos Incorporador 50k
      let result = (data || []).filter(tx => {
        const productName = (tx.product_name || '').toUpperCase();
        
        // Verificar se é produto válido do Incorporador
        const isIncorporador = INCORPORADOR_PRODUCTS.some(code => 
          productName.startsWith(code)
        );
        
        // Excluir produtos específicos
        const isExcluded = EXCLUDED_PATTERNS.some(pattern => 
          productName.includes(pattern.toUpperCase())
        );
        
        return isIncorporador && !isExcluded;
      });

      // Filtro de busca
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        result = result.filter(tx => 
          tx.customer_name?.toLowerCase().includes(searchLower) ||
          tx.customer_email?.toLowerCase().includes(searchLower) ||
          tx.product_name?.toLowerCase().includes(searchLower)
        );
      }

      return result as IncorporadorTransaction[];
    },
    refetchInterval: 30000,
  });
};
