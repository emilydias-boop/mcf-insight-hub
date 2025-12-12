import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Ultrameta {
  ultrametaClint: number;
  faturamentoIncorporador50k: number;
  faturamentoClintBruto: number;
  ultrametaLiquido: number;
  vendasA010: number;
  faturamentoLiquido: number;
}

// Lista completa de produtos para Faturamento Clint (Bruto e Líquido)
const FATURAMENTO_CLINT_PRODUCTS = [
  '000 - PRÉ RESERVA MINHA CASA FINANCIADA',
  '000 - CONTRATO',
  '001- PRÉ-RESERVA ANTICRISE',
  '003 - IMERSÃO SÓCIOS MCF',
  '016-ANÁLISE E DEFESA DE PROPOSTA DE CRÉDITO',
  'A000 - CONTRATO',
  'A000 - PRÉ-RESERVA PLANO ANTICRISE',
  'A001 - MCF INCORPORADOR COMPLETO',
  'A002 - MCF INCORPORADOR BÁSICO',
  'A003 - MCF INCORPORADOR - P2',
  'A003 - MCF PLANO ANTICRISE COMPLETO',
  'A004 - MCF INCORPORADOR BÁSICO',
  'A004 - MCF PLANO ANTICRISE BÁSICO',
  'A005 - ANTICRISE COMPLETO',
  'A005 - MCF P2',
  'A005 - MCF P2 - ASAAS',
  'A006 - ANTICRISE BÁSICO',
  // EXCLUÍDO: 'A006 - RENOVAÇÃO PARCEIRO MCF' (não faz parte do Faturamento Clint)
  'A007 - IMERSÃO SÓCIOS MCF',
  'A008 - THE CLUB',
  'A008 - THE CLUB - CONSULTORIA CLUB',
  'A009 - MCF INCORPORADOR COMPLETO + THE CLUB',
  'A009 - RENOVAÇÃO PARCEIRO MCF',
  'ASAAS',
  'COBRANÇAS ASAAS',
  'CONTRATO ANTICRISE',
  'CONTRATO - ANTICRISE',
  'CONTRATO - SÓCIO MCF',
  'CONTRATO SOCIOS',
  'JANTAR NETWORKING',
  'R001 - INCORPORADOR COMPLETO 50K',
  'R004 - INCORPORADOR 50K BÁSICO',
  'R005 - ANTICRISE COMPLETO',
  'R006 - ANTICRISE BÁSICO',
  'R009 - RENOVAÇÃO PARCEIRO MCF',
  'R21- MCF INCORPORADOR P2 (ASSINATURA)',
  'R21 - MCF INCORPORADOR P2 (ASSINATURA)',
  'SÓCIO JANTAR',
];

// Helper para verificar se produto está na lista de Faturamento Clint
const isProductInFaturamentoClint = (productName: string): boolean => {
  const normalized = productName.toUpperCase().trim();
  return FATURAMENTO_CLINT_PRODUCTS.some(p => normalized.includes(p) || p.includes(normalized));
};

// Helper para formatar data no fuso horário de Brasília (UTC-3)
const formatDateForBrazil = (date: Date, isEndOfDay: boolean = false): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  if (isEndOfDay) {
    return `${year}-${month}-${day}T23:59:59-03:00`;
  }
  return `${year}-${month}-${day}T00:00:00-03:00`;
};

export const useUltrameta = (startDate?: Date, endDate?: Date, sdrIa: number = 0) => {
  return useQuery({
    queryKey: ['ultrameta', startDate?.toISOString(), endDate?.toISOString(), sdrIa],
    queryFn: async (): Promise<Ultrameta> => {
      // Buscar transações Hubla completadas no período
      let query = supabase
        .from('hubla_transactions')
        .select('hubla_id, product_name, product_category, product_price, net_value, sale_status, raw_data, installment_number, customer_name, customer_email, source')
        .eq('sale_status', 'completed');
      
      // Aplicar filtro de data com fuso horário de Brasília
      if (startDate) {
        query = query.gte('sale_date', formatDateForBrazil(startDate, false));
      }
      if (endDate) {
        query = query.lte('sale_date', formatDateForBrazil(endDate, true));
      }
      
      const { data: transactions, error } = await query;
      
      if (error) throw error;
      
      if (!transactions || transactions.length === 0) {
        return {
          ultrametaClint: sdrIa * 1400,
          faturamentoIncorporador50k: 0,
          faturamentoClintBruto: 0,
          ultrametaLiquido: 0,
          vendasA010: 0,
          faturamentoLiquido: 0,
        };
      }

      // ===== VENDAS A010 (EMAILS ÚNICOS) =====
      // CORREÇÃO: Conta emails únicos para A010, INCLUINDO source='make'
      const a010Emails = new Set<string>();
      transactions.forEach(tx => {
        const productName = (tx.product_name || '').toUpperCase();
        const isA010 = tx.product_category === 'a010' || productName.includes('A010');
        const hasValidEmail = tx.customer_email && tx.customer_email.trim() !== '';
        const hublaId = tx.hubla_id || '';
        
        // Excluir newsale- e -offer- mas INCLUIR Make
        if (hublaId.startsWith('newsale-') || hublaId.includes('-offer-')) return;
        
        if (isA010 && hasValidEmail) {
          a010Emails.add(tx.customer_email!.toLowerCase().trim());
        }
      });
      const vendasA010 = a010Emails.size;

      // ===== IDENTIFICAR PARENTS COM OFFERS =====
      // Parents que têm offers correspondentes serão excluídos (são containers)
      const parentIdsWithOffers = new Set<string>();
      transactions.forEach(tx => {
        const hublaId = tx.hubla_id || '';
        if (hublaId.includes('-offer-')) {
          const parentId = hublaId.split('-offer-')[0];
          parentIdsWithOffers.add(parentId);
        }
      });

      // ===== FATURAMENTO CLINT (BRUTO) =====
      // NOVA LÓGICA: Incluir offers OU transações normais sem offers correspondentes
      // Excluir parents que são containers (têm offers filhos)
      const seenClintBrutoIds = new Set<string>();
      const faturamentoClintBruto = transactions
        .filter(tx => {
          const productName = (tx.product_name || '').toUpperCase();
          const hublaId = tx.hubla_id || '';
          const source = tx.source || 'hubla';
          
          // Excluir A006 - Renovação Parceiro MCF
          if (productName.includes('A006') && (productName.includes('RENOVAÇÃO') || productName.includes('RENOVACAO'))) return false;
          
          // Verificar se é produto válido do Faturamento Clint
          const isValidProduct = isProductInFaturamentoClint(tx.product_name || '');
          
          // Excluir source='make' (duplicatas)
          const isValidSource = ['hubla', 'kiwify', 'manual'].includes(source);
          
          // Excluir newsale-%
          if (hublaId.startsWith('newsale-')) return false;
          
          // NOVA LÓGICA: Identificar offers vs parents
          const isOffer = hublaId.includes('-offer-');
          const isParentWithOffers = parentIdsWithOffers.has(hublaId);
          
          // Excluir parents que são containers (têm offers filhos)
          if (!isOffer && isParentWithOffers) return false;
          
          // Exigir customer_email válido
          const hasValidEmail = tx.customer_email && tx.customer_email.trim() !== '';
          
          // Deduplicar por hubla_id
          if (seenClintBrutoIds.has(hublaId)) return false;
          
          if (isValidProduct && isValidSource && hasValidEmail) {
            seenClintBrutoIds.add(hublaId);
            return true;
          }
          return false;
        })
        .reduce((sum, tx) => {
          // Usar "Valor do produto" do raw_data se disponível
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

      // ===== FATURAMENTO LÍQUIDO =====
      // NOVA LÓGICA: Mesma deduplicação parent/offer do Faturamento Clint
      const seenLiquidoIds = new Set<string>();
      const faturamentoLiquido = transactions
        .filter(tx => {
          const productName = (tx.product_name || '').toUpperCase();
          const hublaId = tx.hubla_id || '';
          const source = tx.source || 'hubla';
          
          // Excluir A006 - Renovação Parceiro MCF
          if (productName.includes('A006') && (productName.includes('RENOVAÇÃO') || productName.includes('RENOVACAO'))) return false;
          
          const isValidProduct = isProductInFaturamentoClint(tx.product_name || '');
          const isValidSource = ['hubla', 'kiwify', 'manual'].includes(source);
          
          // Excluir newsale-%
          if (hublaId.startsWith('newsale-')) return false;
          
          // NOVA LÓGICA: Identificar offers vs parents
          const isOffer = hublaId.includes('-offer-');
          const isParentWithOffers = parentIdsWithOffers.has(hublaId);
          
          // Excluir parents que são containers (têm offers filhos)
          if (!isOffer && isParentWithOffers) return false;
          
          const hasValidEmail = tx.customer_email && tx.customer_email.trim() !== '';
          
          // Deduplicar por hubla_id
          if (seenLiquidoIds.has(hublaId)) return false;
          
          if (isValidProduct && isValidSource && hasValidEmail) {
            seenLiquidoIds.add(hublaId);
            return true;
          }
          return false;
        })
        .reduce((sum, tx) => {
          const netValue = tx.net_value && tx.net_value > 0 
            ? tx.net_value 
            : (tx.product_price || 0) * 0.9417;
          return sum + netValue;
        }, 0);

      // ===== INCORPORADOR 50K (LÍQUIDO) - mantém lógica anterior para compatibilidade =====
      const INCORPORADOR_PRODUCTS = ['A000', 'A001', 'A002', 'A003', 'A004', 'A005', 'A009'];
      const EXCLUDED_PRODUCT_NAMES = ['A006', 'A010', 'IMERSÃO SÓCIOS', 'IMERSAO SOCIOS', 'EFEITO ALAVANCA', 'CLUBE DO ARREMATE', 'CLUBE ARREMATE'];
      
      const seenIncorporadorIds = new Set<string>();
      const incorporador50kLiquido = transactions
        .filter(tx => {
          const productName = (tx.product_name || '').toUpperCase();
          const isIncorporador = INCORPORADOR_PRODUCTS.some(code => productName.startsWith(code));
          const isExcluded = EXCLUDED_PRODUCT_NAMES.some(name => productName.includes(name.toUpperCase()));
          
          if (seenIncorporadorIds.has(tx.hubla_id)) return false;
          
          if (isIncorporador && !isExcluded) {
            seenIncorporadorIds.add(tx.hubla_id);
            return true;
          }
          return false;
        })
        .reduce((sum, tx) => {
          const netValue = tx.net_value && tx.net_value > 0 
            ? tx.net_value 
            : (tx.product_price || 0) * 0.9417;
          return sum + netValue;
        }, 0);

      // ===== ULTRAMETAS =====
      // Ultrameta Clint = Vendas A010 × R$ 1.680
      const ultrametaClint = vendasA010 * 1680;
      // Ultrameta Líquido = Vendas A010 × R$ 1.400
      const ultrametaLiquido = vendasA010 * 1400;

      return {
        ultrametaClint,
        faturamentoIncorporador50k: incorporador50kLiquido,
        faturamentoClintBruto,
        ultrametaLiquido,
        vendasA010,
        faturamentoLiquido,
      };
    },
    refetchInterval: 60000,
  });
};
