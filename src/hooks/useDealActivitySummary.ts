import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ActivitySummary {
  totalCalls: number;
  answeredCalls: number;
  missedCalls: number;
  whatsappSent: number;
  lastContactAttempt: string | null;
  attemptsExhausted: boolean;
  maxAttempts: number;
  totalActivities: number;
  notesCount: number;
}

const DEFAULT_MAX_ATTEMPTS = 5;

const defaultSummary: ActivitySummary = {
  totalCalls: 0,
  answeredCalls: 0,
  missedCalls: 0,
  whatsappSent: 0,
  lastContactAttempt: null,
  attemptsExhausted: false,
  maxAttempts: DEFAULT_MAX_ATTEMPTS,
  totalActivities: 0,
  notesCount: 0,
};

export function useDealActivitySummary(dealId: string | undefined, stageId?: string) {
  return useQuery({
    queryKey: ['deal-activity-summary', dealId, stageId],
    queryFn: async (): Promise<ActivitySummary> => {
      if (!dealId) return defaultSummary;

      let maxAttempts = DEFAULT_MAX_ATTEMPTS;
      if (stageId) {
        const { data: limitData } = await supabase
          .from('stage_attempt_limits')
          .select('max_attempts')
          .eq('stage_id', stageId)
          .maybeSingle();
        
        if (limitData?.max_attempts) {
          maxAttempts = limitData.max_attempts;
        }
      }

      const { data: calls, error } = await supabase
        .from('calls')
        .select('status, outcome, created_at')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching call activity:', error);
        return { ...defaultSummary, maxAttempts };
      }

      const totalCalls = calls?.length || 0;
      const answeredCalls = calls?.filter(c =>
        ['completed', 'in-progress'].includes(c.status || '') ||
        ['interessado', 'agendou_r1', 'agendou_r2', 'agendou', 'atendeu'].includes(c.outcome || '')
      ).length || 0;

      const { data: whatsappActivities } = await supabase
        .from('deal_activities')
        .select('id')
        .eq('deal_id', dealId)
        .eq('activity_type', 'whatsapp_sent');

      const whatsappSent = whatsappActivities?.length || 0;
      const attemptsExhausted = totalCalls >= maxAttempts && answeredCalls === 0;

      const { data: noteActivities } = await supabase
        .from('deal_activities')
        .select('id')
        .eq('deal_id', dealId)
        .eq('activity_type', 'note');

      const notesCount = noteActivities?.length || 0;
      const totalActivities = totalCalls + whatsappSent + notesCount;

      return {
        totalCalls,
        answeredCalls,
        missedCalls: totalCalls - answeredCalls,
        whatsappSent,
        lastContactAttempt: calls?.[0]?.created_at || null,
        attemptsExhausted,
        maxAttempts,
        totalActivities,
        notesCount,
      };
    },
    enabled: !!dealId,
    staleTime: 30 * 1000,
  });
}

// Helper: fetch all rows with pagination to bypass the 1000-row limit
async function fetchAllPaginated<T>(
  queryBuilder: () => ReturnType<ReturnType<typeof supabase.from>['select']>,
  dealIds: string[],
  idField: string,
  PAGE_SIZE = 1000,
  BATCH_SIZE = 200
): Promise<T[]> {
  const allResults: T[] = [];
  
  // Split dealIds into batches to avoid URL length limits
  for (let b = 0; b < dealIds.length; b += BATCH_SIZE) {
    const batchIds = dealIds.slice(b, b + BATCH_SIZE);
    let from = 0;
    while (true) {
      const { data } = await (queryBuilder() as any)
        .in(idField, batchIds)
        .range(from, from + PAGE_SIZE - 1);
      if (!data || data.length === 0) break;
      allResults.push(...data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
  }
  
  return allResults;
}

// Hook para buscar atividades de múltiplos deals de uma vez (otimização)
export function useBatchDealActivitySummary(dealIds: string[], stageIds?: Map<string, string>) {
  return useQuery({
    queryKey: ['batch-deal-activity-summary', dealIds.map(id => id.toLowerCase().trim()).sort().join(','), stageIds ? Array.from(stageIds.entries()).sort().join(',') : ''],
    queryFn: async (): Promise<Map<string, ActivitySummary>> => {
      const summaryMap = new Map<string, ActivitySummary>();
      
      if (dealIds.length === 0) return summaryMap;

      const normalizedDealIds = dealIds.map(id => String(id || '').toLowerCase().trim());

      // Buscar limites de tentativas por estágio
      const { data: stageLimits } = await supabase
        .from('stage_attempt_limits')
        .select('stage_id, max_attempts');
      
      const limitsMap = new Map<string, number>();
      stageLimits?.forEach(l => {
        if (l.stage_id) limitsMap.set(l.stage_id, l.max_attempts);
      });

      // Inicializar com valores padrão
      normalizedDealIds.forEach((normalizedId, index) => {
        const originalId = dealIds[index];
        const stageId = stageIds?.get(originalId);
        const maxAttempts = stageId ? (limitsMap.get(stageId) ?? DEFAULT_MAX_ATTEMPTS) : DEFAULT_MAX_ATTEMPTS;
        summaryMap.set(normalizedId, { ...defaultSummary, maxAttempts });
      });

      const BATCH = 200;
      const PAGE = 1000;

      // Fetch all calls with pagination + batching
      const allCalls: any[] = [];
      for (let b = 0; b < dealIds.length; b += BATCH) {
        const batchIds = dealIds.slice(b, b + BATCH);
        let from = 0;
        while (true) {
          const { data } = await supabase
            .from('calls')
            .select('deal_id, status, outcome, created_at')
            .in('deal_id', batchIds)
            .order('created_at', { ascending: false })
            .range(from, from + PAGE - 1);
          if (!data || data.length === 0) break;
          allCalls.push(...data);
          if (data.length < PAGE) break;
          from += PAGE;
        }
      }

      // Fetch all whatsapp activities with pagination + batching
      const allWhatsapp: any[] = [];
      for (let b = 0; b < dealIds.length; b += BATCH) {
        const batchIds = dealIds.slice(b, b + BATCH);
        let from = 0;
        while (true) {
          const { data } = await supabase
            .from('deal_activities')
            .select('deal_id')
            .in('deal_id', batchIds)
            .eq('activity_type', 'whatsapp_sent')
            .range(from, from + PAGE - 1);
          if (!data || data.length === 0) break;
          allWhatsapp.push(...data);
          if (data.length < PAGE) break;
          from += PAGE;
        }
      }

      // Fetch all notes with pagination + batching
      const allNotes: any[] = [];
      for (let b = 0; b < dealIds.length; b += BATCH) {
        const batchIds = dealIds.slice(b, b + BATCH);
        let from = 0;
        while (true) {
          const { data } = await supabase
            .from('deal_activities')
            .select('deal_id')
            .in('deal_id', batchIds)
            .eq('activity_type', 'note')
            .range(from, from + PAGE - 1);
          if (!data || data.length === 0) break;
          allNotes.push(...data);
          if (data.length < PAGE) break;
          from += PAGE;
        }
      }

      // Agregar por deal_id
      allCalls.forEach(call => {
        const normalizedCallId = String(call.deal_id || '').toLowerCase().trim();
        const summary = summaryMap.get(normalizedCallId);
        if (summary) {
          summary.totalCalls++;
          
          const isAnswered = 
            ['completed', 'in-progress'].includes(call.status || '') ||
            ['interessado', 'agendou_r1', 'agendou_r2', 'agendou', 'atendeu'].includes(call.outcome || '');
          
          if (isAnswered) {
            summary.answeredCalls++;
          } else {
            summary.missedCalls++;
          }

          if (!summary.lastContactAttempt) {
            summary.lastContactAttempt = call.created_at;
          }
        }
      });

      allWhatsapp.forEach(activity => {
        const normalizedId = String(activity.deal_id || '').toLowerCase().trim();
        const summary = summaryMap.get(normalizedId);
        if (summary) {
          summary.whatsappSent++;
        }
      });

      allNotes.forEach(activity => {
        const normalizedId = String(activity.deal_id || '').toLowerCase().trim();
        const summary = summaryMap.get(normalizedId);
        if (summary) {
          summary.notesCount++;
        }
      });

      // Marcar tentativas esgotadas
      summaryMap.forEach((summary) => {
        summary.attemptsExhausted = summary.totalCalls >= summary.maxAttempts && summary.answeredCalls === 0;
        summary.totalActivities = summary.totalCalls + summary.whatsappSent + summary.notesCount;
      });

      return summaryMap;
    },
    enabled: dealIds.length > 0,
    staleTime: 30 * 1000,
  });
}
