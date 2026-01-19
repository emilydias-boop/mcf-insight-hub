import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface SdrCallMetrics {
  totalCalls: number;
  answered: number;         // Contatos - ligações atendidas
  unanswered: number;       // Tentativas - ligações não atendidas
  totalDurationSeconds: number;
  avgDurationSeconds: number;
}

// Outcomes que indicam que a ligação foi atendida (contato)
const CONTACT_OUTCOMES = ['interessado', 'agendou_r1', 'agendou_r2', 'atendeu', 'qualificado', 'callback'];

/**
 * Hook para buscar métricas de ligações do SDR
 * @param userEmail - Email do usuário (usado para buscar user_id)
 * @param startDate - Data de início do período
 * @param endDate - Data de fim do período
 */
export const useSdrCallMetrics = (
  userEmail: string | undefined | null,
  startDate: Date | null,
  endDate: Date | null
) => {
  return useQuery({
    queryKey: ['sdr-call-metrics', userEmail, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async (): Promise<SdrCallMetrics> => {
      if (!userEmail) {
        return {
          totalCalls: 0,
          answered: 0,
          unanswered: 0,
          totalDurationSeconds: 0,
          avgDurationSeconds: 0,
        };
      }

      // Buscar user_id a partir do email usando a tabela profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', userEmail.toLowerCase())
        .maybeSingle();

      if (!profile?.id) {
        console.log('Perfil não encontrado para email:', userEmail);
        return {
          totalCalls: 0,
          answered: 0,
          unanswered: 0,
          totalDurationSeconds: 0,
          avgDurationSeconds: 0,
        };
      }

      // Construir query de ligações
      let query = supabase
        .from('calls')
        .select('id, status, outcome, duration_seconds, started_at, ended_at, created_at')
        .eq('user_id', profile.id)
        .eq('direction', 'outbound'); // Apenas ligações realizadas pelo SDR

      // Aplicar filtro de data
      if (startDate) {
        query = query.gte('created_at', format(startDate, "yyyy-MM-dd'T'00:00:00"));
      }
      if (endDate) {
        query = query.lte('created_at', format(endDate, "yyyy-MM-dd'T'23:59:59"));
      }

      const { data: calls, error } = await query;

      if (error) {
        console.error('Erro ao buscar ligações:', error);
        throw error;
      }

      if (!calls || calls.length === 0) {
        return {
          totalCalls: 0,
          answered: 0,
          unanswered: 0,
          totalDurationSeconds: 0,
          avgDurationSeconds: 0,
        };
      }

      // Calcular métricas
      const totalCalls = calls.length;
      let answered = 0;
      let totalDurationSeconds = 0;

      for (const call of calls) {
        // Calcular duração
        const duration = call.duration_seconds || 
          (call.started_at && call.ended_at 
            ? Math.floor((new Date(call.ended_at).getTime() - new Date(call.started_at).getTime()) / 1000)
            : 0);
        
        totalDurationSeconds += duration;

        // Verificar se foi contato (atendida)
        const isContact = 
          (call.status === 'completed' && duration > 0) ||
          CONTACT_OUTCOMES.includes(call.outcome || '');
        
        if (isContact) {
          answered++;
        }
      }

      const unanswered = totalCalls - answered;
      const avgDurationSeconds = answered > 0 ? Math.round(totalDurationSeconds / answered) : 0;

      return {
        totalCalls,
        answered,
        unanswered,
        totalDurationSeconds,
        avgDurationSeconds,
      };
    },
    enabled: !!userEmail && (!!startDate || !!endDate),
    staleTime: 1000 * 60 * 2, // 2 minutos
  });
};

/**
 * Hook para buscar métricas de ligações por SDR ID (usado no fechamento)
 */
export const useSdrCallMetricsBySdrId = (
  sdrId: string | undefined,
  anoMes: string
) => {
  return useQuery({
    queryKey: ['sdr-call-metrics-by-id', sdrId, anoMes],
    queryFn: async (): Promise<SdrCallMetrics> => {
      if (!sdrId || !anoMes) {
        return {
          totalCalls: 0,
          answered: 0,
          unanswered: 0,
          totalDurationSeconds: 0,
          avgDurationSeconds: 0,
        };
      }

      // Buscar SDR para obter user_id
      const { data: sdr } = await supabase
        .from('sdr')
        .select('user_id, email')
        .eq('id', sdrId)
        .single();

      if (!sdr?.user_id) {
        console.log('SDR não possui user_id vinculado:', sdrId);
        return {
          totalCalls: 0,
          answered: 0,
          unanswered: 0,
          totalDurationSeconds: 0,
          avgDurationSeconds: 0,
        };
      }

      // Calcular período do mês
      const [year, month] = anoMes.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      // Buscar ligações
      const { data: calls, error } = await supabase
        .from('calls')
        .select('id, status, outcome, duration_seconds, started_at, ended_at')
        .eq('user_id', sdr.user_id)
        .eq('direction', 'outbound')
        .gte('created_at', format(startDate, "yyyy-MM-dd'T'00:00:00"))
        .lte('created_at', format(endDate, "yyyy-MM-dd'T'23:59:59"));

      if (error) {
        console.error('Erro ao buscar ligações:', error);
        throw error;
      }

      if (!calls || calls.length === 0) {
        return {
          totalCalls: 0,
          answered: 0,
          unanswered: 0,
          totalDurationSeconds: 0,
          avgDurationSeconds: 0,
        };
      }

      const totalCalls = calls.length;
      let answered = 0;
      let totalDurationSeconds = 0;

      for (const call of calls) {
        const duration = call.duration_seconds || 
          (call.started_at && call.ended_at 
            ? Math.floor((new Date(call.ended_at).getTime() - new Date(call.started_at).getTime()) / 1000)
            : 0);
        
        totalDurationSeconds += duration;

        const isContact = 
          (call.status === 'completed' && duration > 0) ||
          CONTACT_OUTCOMES.includes(call.outcome || '');
        
        if (isContact) {
          answered++;
        }
      }

      return {
        totalCalls,
        answered,
        unanswered: totalCalls - answered,
        totalDurationSeconds,
        avgDurationSeconds: answered > 0 ? Math.round(totalDurationSeconds / answered) : 0,
      };
    },
    enabled: !!sdrId && !!anoMes,
    staleTime: 1000 * 60 * 5,
  });
};
