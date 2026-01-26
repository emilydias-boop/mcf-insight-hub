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
const CHUNK_SIZE = 200;

/**
 * Divide array em chunks menores
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Hook para verificar em batch quais emails são A010 (compradores)
 * Retorna um Map<email, isA010> para compatibilidade retroativa
 * Usa chunking para evitar URLs muito longas com muitos emails
 */
export const useBulkA010Check = (emails: string[]) => {
  // Remover emails nulos/undefined e duplicados
  const cleanEmails = [...new Set(emails.filter(Boolean).map(e => e.toLowerCase()))];
  
  return useQuery({
    queryKey: ['bulk-a010-check', cleanEmails.sort().join(',')],
    queryFn: async (): Promise<Map<string, boolean>> => {
      const resultMap = new Map<string, boolean>();
      
      if (cleanEmails.length === 0) return resultMap;
      
      // Dividir emails em chunks para evitar URL muito longa
      const emailChunks = chunkArray(cleanEmails, CHUNK_SIZE);
      
      console.log(`[useBulkA010Check] Buscando A010 status para ${cleanEmails.length} emails em ${emailChunks.length} chunks`);
      
      // Buscar cada chunk em paralelo
      const results = await Promise.allSettled(
        emailChunks.map(chunk => 
          supabase
            .from('hubla_transactions')
            .select('customer_email')
            .eq('product_category', 'a010')
            .eq('sale_status', 'completed')
            .in('customer_email', chunk)
        )
      );
      
      // Combinar resultados de todos os chunks
      const a010Emails = new Set<string>();
      let successCount = 0;
      let errorCount = 0;
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          if (result.value.error) {
            console.error(`[useBulkA010Check] Erro no chunk ${index + 1}:`, result.value.error);
            errorCount++;
          } else {
            successCount++;
            result.value.data?.forEach(t => {
              if (t.customer_email) {
                a010Emails.add(t.customer_email.toLowerCase());
              }
            });
          }
        } else {
          console.error(`[useBulkA010Check] Chunk ${index + 1} falhou:`, result.reason);
          errorCount++;
        }
      });
      
      console.log(`[useBulkA010Check] Resultado: ${successCount} chunks OK, ${errorCount} erros, ${a010Emails.size} emails A010 encontrados`);
      
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
      
      // Dividir emails em chunks para evitar URL muito longa
      const emailChunks = chunkArray(cleanEmails, CHUNK_SIZE);
      
      console.log(`[useBulkChannelCheck] Buscando A010 status para ${cleanEmails.length} emails em ${emailChunks.length} chunks`);
      
      // Buscar cada chunk em paralelo
      const results = await Promise.allSettled(
        emailChunks.map(chunk => 
          supabase
            .from('hubla_transactions')
            .select('customer_email')
            .eq('product_category', 'a010')
            .eq('sale_status', 'completed')
            .in('customer_email', chunk)
        )
      );
      
      // Combinar resultados de todos os chunks
      const a010Emails = new Set<string>();
      let successCount = 0;
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && !result.value.error) {
          successCount++;
          result.value.data?.forEach(t => {
            if (t.customer_email) {
              a010Emails.add(t.customer_email.toLowerCase());
            }
          });
        } else {
          console.error(`[useBulkChannelCheck] Chunk ${index + 1} falhou`);
        }
      });
      
      console.log(`[useBulkChannelCheck] ${successCount}/${emailChunks.length} chunks OK, ${a010Emails.size} A010 encontrados`);

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
