import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ActivitySummary {
  totalCalls: number;
  answeredCalls: number;
  missedCalls: number;
  whatsappSent: number;
  lastContactAttempt: string | null;
  attemptsExhausted: boolean;
}

const defaultSummary: ActivitySummary = {
  totalCalls: 0,
  answeredCalls: 0,
  missedCalls: 0,
  whatsappSent: 0,
  lastContactAttempt: null,
  attemptsExhausted: false,
};

// Limite de tentativas configurável por estágio (pode ser expandido)
const MAX_ATTEMPTS = 5;

export function useDealActivitySummary(dealId: string | undefined) {
  return useQuery({
    queryKey: ['deal-activity-summary', dealId],
    queryFn: async (): Promise<ActivitySummary> => {
      if (!dealId) return defaultSummary;

      // Buscar ligações do deal
      const { data: calls, error } = await supabase
        .from('calls')
        .select('status, outcome, created_at')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching call activity:', error);
        return defaultSummary;
      }

      const totalCalls = calls?.length || 0;
      
      // Ligações atendidas são as que tem status completed/in-progress ou outcome positivo
      const answeredCalls = calls?.filter(c =>
        ['completed', 'in-progress'].includes(c.status || '') ||
        ['interessado', 'agendou_r1', 'agendou_r2', 'agendou', 'atendeu'].includes(c.outcome || '')
      ).length || 0;

      // Buscar atividades de WhatsApp do deal
      const { data: whatsappActivities } = await supabase
        .from('deal_activities')
        .select('id')
        .eq('deal_id', dealId)
        .eq('activity_type', 'whatsapp_sent');

      const whatsappSent = whatsappActivities?.length || 0;

      const attemptsExhausted = totalCalls >= MAX_ATTEMPTS && answeredCalls === 0;

      return {
        totalCalls,
        answeredCalls,
        missedCalls: totalCalls - answeredCalls,
        whatsappSent,
        lastContactAttempt: calls?.[0]?.created_at || null,
        attemptsExhausted,
      };
    },
    enabled: !!dealId,
    staleTime: 30 * 1000, // Cache por 30 segundos
  });
}

// Hook para buscar atividades de múltiplos deals de uma vez (otimização)
export function useBatchDealActivitySummary(dealIds: string[]) {
  return useQuery({
    queryKey: ['batch-deal-activity-summary', dealIds.sort().join(',')],
    queryFn: async (): Promise<Map<string, ActivitySummary>> => {
      const summaryMap = new Map<string, ActivitySummary>();
      
      if (dealIds.length === 0) return summaryMap;

      // Inicializar com valores padrão
      dealIds.forEach(id => summaryMap.set(id, { ...defaultSummary }));

      // Buscar todas as ligações de uma vez
      const { data: calls } = await supabase
        .from('calls')
        .select('deal_id, status, outcome, created_at')
        .in('deal_id', dealIds)
        .order('created_at', { ascending: false });

      // Buscar atividades de WhatsApp
      const { data: whatsappActivities } = await supabase
        .from('deal_activities')
        .select('deal_id')
        .in('deal_id', dealIds)
        .eq('activity_type', 'whatsapp_sent');

      // Agregar por deal_id
      calls?.forEach(call => {
        const summary = summaryMap.get(call.deal_id);
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

      // Agregar WhatsApp
      whatsappActivities?.forEach(activity => {
        const summary = summaryMap.get(activity.deal_id);
        if (summary) {
          summary.whatsappSent++;
        }
      });

      // Marcar tentativas esgotadas
      summaryMap.forEach((summary) => {
        summary.attemptsExhausted = summary.totalCalls >= MAX_ATTEMPTS && summary.answeredCalls === 0;
      });

      return summaryMap;
    },
    enabled: dealIds.length > 0,
    staleTime: 30 * 1000,
  });
}
