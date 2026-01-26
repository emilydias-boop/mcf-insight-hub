import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type SalesChannel = 'a010' | 'bio' | 'live';

interface DealChannelInfo {
  tags?: string[];
  customFields?: Record<string, any>;
}

/**
 * Detecta o canal de venda de um deal individual
 * Prioridade: A010 (compra confirmada) > BIO (tag/source) > LIVE (padrão)
 */
export function detectSalesChannel(
  email: string | null | undefined,
  a010Emails: Set<string>,
  dealInfo?: DealChannelInfo
): SalesChannel {
  const normalizedEmail = email?.toLowerCase();
  
  // 1. A010: Compra confirmada tem prioridade máxima
  if (normalizedEmail && a010Emails.has(normalizedEmail)) {
    return 'a010';
  }
  
  // 2. BIO: Verificar tags e custom_fields.source
  if (dealInfo) {
    const tags = dealInfo.tags || [];
    const source = dealInfo.customFields?.source || '';
    
    const hasBioTag = tags.some((tag: string) => {
      const tagLower = (typeof tag === 'string' ? tag : String(tag)).toLowerCase();
      return tagLower.includes('bio') || tagLower.includes('instagram');
    });
    
    const hasBioSource = typeof source === 'string' && (
      source.toLowerCase().includes('bio') || 
      source.toLowerCase().includes('instagram')
    );
    
    if (hasBioTag || hasBioSource) {
      return 'bio';
    }
  }
  
  // 3. LIVE: Padrão (leads gratuitos de lives)
  return 'live';
}

/**
 * Hook para verificar em batch quais emails são A010 (compradores)
 * Retorna um Map<email, isA010> para compatibilidade retroativa
 */
export const useBulkA010Check = (emails: string[]) => {
  // Remover emails nulos/undefined e duplicados
  const cleanEmails = [...new Set(emails.filter(Boolean).map(e => e.toLowerCase()))];
  
  return useQuery({
    queryKey: ['bulk-a010-check', cleanEmails.sort().join(',')],
    queryFn: async (): Promise<Map<string, boolean>> => {
      const resultMap = new Map<string, boolean>();
      
      if (cleanEmails.length === 0) return resultMap;
      
      // Buscar transações A010 completadas para esses emails
      const { data, error } = await supabase
        .from('hubla_transactions')
        .select('customer_email')
        .eq('product_category', 'a010')
        .eq('sale_status', 'completed')
        .in('customer_email', cleanEmails);
      
      if (error) {
        console.error('Erro ao buscar A010 status:', error);
        // Retornar todos como false em caso de erro
        cleanEmails.forEach(email => resultMap.set(email, false));
        return resultMap;
      }
      
      // Criar set de emails A010
      const a010Emails = new Set(
        data?.map(t => t.customer_email?.toLowerCase()).filter(Boolean) || []
      );
      
      // Mapear resultado
      cleanEmails.forEach(email => {
        resultMap.set(email, a010Emails.has(email));
      });
      
      return resultMap;
    },
    enabled: cleanEmails.length > 0,
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
  });
};

/**
 * Hook para detectar canal de venda em batch
 * Retorna um Map<email, SalesChannel>
 */
export const useBulkChannelCheck = (
  deals: Array<{ email?: string; tags?: string[]; customFields?: Record<string, any> }>
) => {
  const emails = deals.map(d => d.email).filter(Boolean) as string[];
  const cleanEmails = [...new Set(emails.map(e => e.toLowerCase()))];
  
  return useQuery({
    queryKey: ['bulk-channel-check', cleanEmails.sort().join(',')],
    queryFn: async (): Promise<Map<string, SalesChannel>> => {
      const resultMap = new Map<string, SalesChannel>();
      
      if (cleanEmails.length === 0) return resultMap;
      
      // Buscar transações A010 completadas para esses emails
      const { data, error } = await supabase
        .from('hubla_transactions')
        .select('customer_email')
        .eq('product_category', 'a010')
        .eq('sale_status', 'completed')
        .in('customer_email', cleanEmails);
      
      if (error) {
        console.error('Erro ao buscar A010 status:', error);
      }
      
      // Criar set de emails A010
      const a010Emails = new Set(
        data?.map(t => t.customer_email?.toLowerCase()).filter(Boolean) || []
      );
      
      // Mapear cada deal para seu canal
      deals.forEach(deal => {
        if (deal.email) {
          const channel = detectSalesChannel(deal.email, a010Emails, {
            tags: deal.tags,
            customFields: deal.customFields,
          });
          resultMap.set(deal.email.toLowerCase(), channel);
        }
      });
      
      return resultMap;
    },
    enabled: cleanEmails.length > 0,
    staleTime: 5 * 60 * 1000,
  });
};
