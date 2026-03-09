import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSdrsFromSquad } from './useSdrsFromSquad';

export interface SdrActivityMetrics {
  sdrEmail: string;
  sdrName: string;
  
  // Atividades do período
  totalCalls: number;
  answeredCalls: number;
  notesAdded: number;
  stageChanges: number;
  whatsappSent: number;
  
  // Leads trabalhados
  uniqueLeadsWorked: number;
  
  // Calculado
  avgCallsPerLead: number;
}

export function useSdrActivityMetrics(
  startDate: Date,
  endDate: Date,
  originId?: string,
  squad: string = 'incorporador'
) {
  const sdrsQuery = useSdrsFromSquad(squad);
  
  return useQuery({
    queryKey: ['sdr-activity-metrics', startDate.toISOString(), endDate.toISOString(), originId, squad],
    queryFn: async (): Promise<SdrActivityMetrics[]> => {
      const sdrs = sdrsQuery.data || [];
      const validSdrEmails = new Set(sdrs.map(s => s.email.toLowerCase()));
      const sdrNameMap = new Map(sdrs.map(s => [s.email.toLowerCase(), s.name]));
      
      const startIso = startDate.toISOString();
      const endIso = endDate.toISOString();
      
      // Helper: fetch all rows with pagination (bypasses 1000-row limit)
      const PAGE = 1000;
      
      // 1. Buscar TODAS as ligações outbound no período
      const allCalls: any[] = [];
      let callsFrom = 0;
      while (true) {
        const { data } = await supabase
          .from('calls')
          .select('user_id, status, outcome, deal_id')
          .eq('direction', 'outbound')
          .gte('created_at', startIso)
          .lte('created_at', endIso)
          .range(callsFrom, callsFrom + PAGE - 1);
        if (!data || data.length === 0) break;
        allCalls.push(...data);
        if (data.length < PAGE) break;
        callsFrom += PAGE;
      }
      
      // 2. Buscar TODAS as deal_activities no período
      const allActivities: any[] = [];
      let actFrom = 0;
      while (true) {
        const { data } = await supabase
          .from('deal_activities')
          .select('user_id, activity_type, deal_id')
          .gte('created_at', startIso)
          .lte('created_at', endIso)
          .range(actFrom, actFrom + PAGE - 1);
        if (!data || data.length === 0) break;
        allActivities.push(...data);
        if (data.length < PAGE) break;
        actFrom += PAGE;
      }
      
      console.log(`[SdrActivityMetrics] Fetched ${allCalls.length} outbound calls, ${allActivities.length} activities`);
      
      // 3. Buscar profiles para mapear user_id -> email
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name');
      
      const profileMap = new Map<string, { email: string; name: string }>();
      profiles?.forEach(p => {
        if (p.email) {
          profileMap.set(p.id, { email: p.email.toLowerCase(), name: p.full_name || p.email });
        }
      });
      
      // 4. Inicializar métricas para SDRs conhecidos (do banco de dados)
      const metricsMap = new Map<string, SdrActivityMetrics>();
      sdrs.forEach(sdr => {
        metricsMap.set(sdr.email.toLowerCase(), {
          sdrEmail: sdr.email,
          sdrName: sdr.name,
          totalCalls: 0,
          answeredCalls: 0,
          notesAdded: 0,
          stageChanges: 0,
          whatsappSent: 0,
          uniqueLeadsWorked: 0,
          avgCallsPerLead: 0,
        });
      });
      
      // Sets para rastrear leads únicos por SDR
      const leadsWorkedBySdr = new Map<string, Set<string>>();
      sdrs.forEach(sdr => {
        leadsWorkedBySdr.set(sdr.email.toLowerCase(), new Set());
      });
      
      // 5. Agregar ligações
      allCalls.forEach(call => {
        if (!call.user_id) return;
        
        const profile = profileMap.get(call.user_id);
        if (!profile) return;
        
        const email = profile.email.toLowerCase();
        if (!validSdrEmails.has(email)) return;
        
        const metrics = metricsMap.get(email);
        if (!metrics) return;
        
        metrics.totalCalls++;
        
        const isAnswered = 
          ['completed', 'in-progress'].includes(call.status || '') ||
          ['interessado', 'agendou_r1', 'agendou_r2', 'agendou', 'atendeu'].includes(call.outcome || '');
        
        if (isAnswered) {
          metrics.answeredCalls++;
        }
        
        if (call.deal_id) {
          leadsWorkedBySdr.get(email)?.add(call.deal_id);
        }
      });
      
      // 6. Agregar atividades
      allActivities.forEach(activity => {
        if (!activity.user_id) return;
        
        const profile = profileMap.get(activity.user_id);
        if (!profile) return;
        
        const email = profile.email.toLowerCase();
        if (!validSdrEmails.has(email)) return;
        
        const metrics = metricsMap.get(email);
        if (!metrics) return;
        
        switch (activity.activity_type) {
          case 'note':
            metrics.notesAdded++;
            break;
          case 'stage_change':
            metrics.stageChanges++;
            break;
          case 'whatsapp_sent':
            metrics.whatsappSent++;
            break;
        }
        
        if (activity.deal_id) {
          leadsWorkedBySdr.get(email)?.add(activity.deal_id);
        }
      });
      
      // 7. Calcular métricas finais
      const results: SdrActivityMetrics[] = [];
      metricsMap.forEach((metrics, email) => {
        const leadsSet = leadsWorkedBySdr.get(email);
        metrics.uniqueLeadsWorked = leadsSet?.size || 0;
        metrics.avgCallsPerLead = metrics.uniqueLeadsWorked > 0 
          ? Math.round((metrics.totalCalls / metrics.uniqueLeadsWorked) * 10) / 10
          : 0;
        
        // Incluir apenas SDRs com alguma atividade
        if (metrics.totalCalls > 0 || metrics.notesAdded > 0 || metrics.stageChanges > 0 || metrics.whatsappSent > 0) {
          results.push(metrics);
        }
      });
      
      // Ordenar por total de ligações (desc)
      return results.sort((a, b) => b.totalCalls - a.totalCalls);
    },
    enabled: !!startDate && !!endDate && sdrsQuery.isSuccess,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}
