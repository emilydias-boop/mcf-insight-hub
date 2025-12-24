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
  // REMOVIDO: 'A009 - RENOVAÇÃO PARCEIRO MCF' - Não faz parte do Faturamento Clint
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
  // NOVO: Produtos Make sem prefixo de código
  'PARCERIA',
  'CONTRATO',
];

// Categorias excluídas do Faturamento Total (sincronizado com useDirectorKPIs)
const EXCLUDED_CATEGORIES_FATURAMENTO = ["clube_arremate", "efeito_alavanca", "renovacao", "imersao", "contrato"];
const EXCLUDED_PRODUCTS_FATURAMENTO = [
  "SÓCIO MCF", "SOCIO MCF", "SÓCIO", "SOCIO",
  "PARCERIA",
  "ALMOÇO NETWORKING", "ALMOCO NETWORKING", "ALMOÇO", "ALMOCO",
  "MENTORIA INDIVIDUAL",
  "CLUBE DO ARREMATE", "CONTRATO - CLUBE DO ARREMATE",
];

// Helper para verificar se produto está na lista de Faturamento Clint
// Verifica por nome OU por categoria (para produtos Make)
const isProductInFaturamentoClint = (productName: string, productCategory?: string | null): boolean => {
  const normalized = productName.toUpperCase().trim();
  
  // Verificar por nome
  if (FATURAMENTO_CLINT_PRODUCTS.some(p => normalized.includes(p.toUpperCase()) || p.toUpperCase().includes(normalized))) {
    return true;
  }
  
  // Verificar por categoria (produtos Make)
  const validCategories = ['incorporador', 'parceria', 'contrato', 'imersao_socios'];
  if (productCategory && validCategories.includes(productCategory)) {
    return true;
  }
  
  return false;
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
        .select('hubla_id, product_name, product_category, product_price, net_value, sale_status, raw_data, installment_number, customer_name, customer_email, source, sale_date, count_in_dashboard')
        .eq('sale_status', 'completed')
        .or('count_in_dashboard.is.null,count_in_dashboard.eq.true');
      
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
      // CORREÇÃO: Usar APENAS transações do Make para contagem de A010
      // A planilha usa dados do Make, então devemos espelhar essa lógica
      const a010Emails = new Set<string>();
      transactions.forEach(tx => {
        // APENAS transações do Make com categoria a010
        const isA010FromMake = tx.product_category === 'a010' && tx.source === 'make';
        const hasValidEmail = tx.customer_email && tx.customer_email.trim() !== '';
        
        if (isA010FromMake && hasValidEmail) {
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

      // ===== NORMALIZAÇÃO DE PRODUTO =====
      // Agrupa produtos equivalentes (ex: A009 de diferentes fontes)
      const normalizeProductName = (productName: string): string => {
        const name = (productName || '').toUpperCase();
        
        if (name.includes('A009')) return 'A009_INCORPORADOR_CLUB';
        if (name.includes('A008')) return 'A008_CLUB';
        if (name.includes('A007')) return 'A007_IMERSAO';
        if (name.includes('A005')) return 'A005_P2';
        if (name.includes('A004')) return 'A004_BASICO';
        if (name.includes('A003')) return 'A003_ANTICRISE';
        if (name.includes('A002')) return 'A002_BASICO';
        if (name.includes('A001')) return 'A001_INCORPORADOR';
        if (name.includes('A000') || name.includes('CONTRATO')) return 'A000_CONTRATO';
        if (name.includes('R00')) return 'R00_RENOVACAO';
        
        return name.substring(0, 30); // fallback
      };

      // ===== FATURAMENTO CLINT (BRUTO + LÍQUIDO) =====
      // NOVA LÓGICA: Deduplicar por email + produto normalizado
      // Para BRUTO: usar apenas o maior product_price do grupo
      // Para LÍQUIDO: somar todos os net_value (sem deduplicação)

      // Primeiro: filtrar transações válidas
      const validTransactions: typeof transactions = [];
      
      transactions.forEach(tx => {
        const productName = (tx.product_name || '').toUpperCase();
        const hublaId = tx.hubla_id || '';
        
        // Excluir newsale- (sem dados completos)
        if (hublaId.startsWith('newsale-')) return;
        
        // Excluir -offer- (são split transactions já contabilizadas)
        if (hublaId.includes('-offer-')) return;
        
        // Excluir A006 - Renovação Parceiro MCF e A009 - Renovação
        if (productName.includes('RENOVAÇÃO') || productName.includes('RENOVACAO')) return;
        
        // Verificar se é produto válido do Faturamento Clint (por nome OU categoria)
        const isValidProduct = isProductInFaturamentoClint(tx.product_name || '', tx.product_category);
        if (!isValidProduct) return;
        
        // Excluir parents que são containers (têm offers filhos)
        const isParentWithOffers = parentIdsWithOffers.has(hublaId);
        if (isParentWithOffers) return;
        
        // Exigir customer_email válido
        const email = (tx.customer_email || '').toLowerCase().trim();
        if (!email) return;
        
        // Aceitar se tiver net_value > 0 OU product_price > 0
        const hasValue = (tx.net_value && tx.net_value > 0) || (tx.product_price && tx.product_price > 0);
        if (!hasValue) return;
        
        validTransactions.push(tx);
      });

      // ===== FATURAMENTO BRUTO =====
      // Agrupar por email + produto normalizado, manter apenas o maior product_price
      const brutoPorClienteProduto = new Map<string, number>();
      
      validTransactions.forEach(tx => {
        const email = (tx.customer_email || '').toLowerCase().trim();
        const normalizedProduct = normalizeProductName(tx.product_name || '');
        const key = `${email}|${normalizedProduct}`;
        
        // Apenas primeira parcela conta para bruto
        const installmentNum = tx.installment_number || 1;
        if (installmentNum !== 1) return;
        
        const productPrice = tx.product_price || 0;
        const existing = brutoPorClienteProduto.get(key) || 0;
        
        // Manter o maior valor bruto (ignora R$0 quando existe valor real)
        if (productPrice > existing) {
          brutoPorClienteProduto.set(key, productPrice);
        }
      });
      
      const faturamentoClintBruto = Array.from(brutoPorClienteProduto.values())
        .reduce((sum, val) => sum + val, 0);

      // ===== FATURAMENTO LÍQUIDO =====
      // Somar TODOS os net_value (todas as parcelas, todos os pagamentos)
      // Não deduplica - cada valor líquido recebido conta
      const faturamentoLiquido = validTransactions
        .reduce((sum, tx) => sum + (tx.net_value || 0), 0);

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
