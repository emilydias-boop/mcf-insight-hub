import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays, differenceInHours } from 'date-fns';

// Terminal stage patterns — deals in these stages are considered "closed"
const TERMINAL_STAGE_PATTERNS = [
  'perdido', 'sem interesse', 'contrato pago', 'venda realizada',
  'fechado', 'venda', 'contrato consórcio', 'consórcio fechado',
];

function isTerminalStage(stageName: string): boolean {
  const lower = stageName.toLowerCase().trim();
  return TERMINAL_STAGE_PATTERNS.some(p => lower.includes(p));
}

function isLossStage(stageName: string): boolean {
  const lower = stageName.toLowerCase().trim();
  return lower.includes('perdido') || lower.includes('sem interesse') || lower.includes('contato perdido');
}

export interface OverviewKPIData {
  leadsEntraram: number;
  leadsTrabalhados: number;
  leadsAvancados: number;
  leadsPerdidos: number;
  leadsSemMovimentacao: number;
  leadsEsquecidos: number;
  leadsSemOwner: number;
}

export interface PipelineHealthData {
  totalAbertos: number;
  leadsParados: number; // 3+ days
  leadsEnvelhecidos: number; // 7+ days
  tempoMedioSemMovHoras: number;
  leadsSlaEstourado: number; // 14+ days
  travadosPorEtapa: { stageName: string; count: number }[];
}

export interface FlowFunnelStep {
  label: string;
  value: number;
}

export interface SdrRankingRow {
  sdrId: string;
  sdrName: string;
  recebidos: number;
  trabalhados: number;
  semMovimentacao: number;
  agendados: number;
  qualificados: number;
  perdidos: number;
  esquecidos: number;
  taxaAproveitamento: number;
}

export interface CloserRankingRow {
  closerId: string;
  closerName: string;
  r1Recebidas: number;
  r1Realizadas: number;
  noShow: number;
  contratos: number;
  r2Agendadas: number;
  r2Realizadas: number;
  aprovados: number;
  vendas: number;
  taxaConversao: number;
}

export interface CRMOverviewData {
  kpis: OverviewKPIData;
  health: PipelineHealthData;
  funnel: FlowFunnelStep[];
  sdrRanking: SdrRankingRow[];
  closerRanking: CloserRankingRow[];
}

export function useCRMOverviewData(
  periodStart: Date,
  periodEnd: Date,
  originIds: string[]
) {
  return useQuery({
    queryKey: ['crm-overview-data', periodStart.toISOString(), periodEnd.toISOString(), originIds.join(',')],
    queryFn: async (): Promise<CRMOverviewData> => {
      if (!originIds.length) {
        return emptyData();
      }

      const startISO = periodStart.toISOString();
      const endISO = periodEnd.toISOString();
      const now = new Date();

      // Fetch stages to classify terminal/loss
      const { data: allStages } = await supabase
        .from('crm_stages')
        .select('id, stage_name')
        .in('origin_id', originIds);

      const stageMap = new Map<string, string>();
      const terminalStageIds = new Set<string>();
      const lossStageIds = new Set<string>();
      (allStages || []).forEach(s => {
        stageMap.set(s.id, s.stage_name);
        if (isTerminalStage(s.stage_name)) terminalStageIds.add(s.id);
        if (isLossStage(s.stage_name)) lossStageIds.add(s.id);
      });

      // Parallel queries
      const [
        dealsResult,
        newDealsResult,
        activitiesResult,
        rpcResult,
        closerR1Result,
        closerR2Result,
      ] = await Promise.all([
        // All open deals (not in terminal stages) for health metrics
        supabase
          .from('crm_deals')
          .select('id, owner_id, stage_id, last_worked_at, stage_moved_at, created_at')
          .in('origin_id', originIds)
          .limit(5000),

        // New deals in period
        supabase
          .from('crm_deals')
          .select('id', { count: 'exact', head: true })
          .in('origin_id', originIds)
          .gte('created_at', startISO)
          .lte('created_at', endISO),

        // Activities in period
        supabase
          .from('deal_activities')
          .select('id, deal_id, activity_type, from_stage, to_stage, created_at')
          .gte('created_at', startISO)
          .lte('created_at', endISO)
          .limit(10000),

        // SDR metrics from agenda RPC
        supabase.rpc('get_sdr_metrics_from_agenda', {
          start_date: format(periodStart, 'yyyy-MM-dd'),
          end_date: format(periodEnd, 'yyyy-MM-dd'),
          sdr_email_filter: null,
        }),

        // Closer R1 metrics
        supabase
          .from('meeting_slot_attendees')
          .select(`
            id, status, meeting_slot_id, booked_by,
            meeting_slots!inner (id, closer_id, meeting_type, scheduled_at,
              closers (id, name))
          `)
          .gte('meeting_slots.scheduled_at', startISO)
          .lte('meeting_slots.scheduled_at', endISO)
          .eq('meeting_slots.meeting_type', 'r1'),

        // Closer R2 metrics
        supabase
          .from('meeting_slot_attendees')
          .select(`
            id, status, meeting_slot_id,
            meeting_slots!inner (id, closer_id, meeting_type, scheduled_at,
              closers (id, name))
          `)
          .gte('meeting_slots.scheduled_at', startISO)
          .lte('meeting_slots.scheduled_at', endISO)
          .eq('meeting_slots.meeting_type', 'r2'),
      ]);

      const allDeals = dealsResult.data || [];
      const buDealIds = new Set(allDeals.map(d => d.id));

      // Filter activities to only BU deals
      const buActivities = (activitiesResult.data || []).filter(a => buDealIds.has(a.deal_id));

      // Open deals = not in terminal stages
      const openDeals = allDeals.filter(d => d.stage_id && !terminalStageIds.has(d.stage_id));

      // === KPIs ===
      const leadsEntraram = newDealsResult.count || 0;

      const workedDealIds = new Set(buActivities.map(a => a.deal_id));
      const leadsTrabalhados = workedDealIds.size;

      // Advanced = stage_change where to_stage order > from_stage order (simplified: any forward stage_change)
      const stageChanges = buActivities.filter(a => 
        a.activity_type === 'stage_change' || a.activity_type === 'stage_changed'
      );
      const leadsAvancados = new Set(
        stageChanges
          .filter(a => a.to_stage && !lossStageIds.has(a.to_stage) && !terminalStageIds.has(a.to_stage))
          .map(a => a.deal_id)
      ).size;

      // Lost = stage changed to loss stage in period
      const leadsPerdidos = new Set(
        stageChanges
          .filter(a => a.to_stage && lossStageIds.has(a.to_stage))
          .map(a => a.deal_id)
      ).size;

      // Sem movimentação = open deals where last_worked_at < periodStart or null
      const leadsSemMovimentacao = openDeals.filter(d => {
        if (!d.last_worked_at) return true;
        return new Date(d.last_worked_at) < periodStart;
      }).length;

      // Esquecidos = open deals, last_worked_at < 7 days ago
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const leadsEsquecidos = openDeals.filter(d => {
        if (!d.last_worked_at) return true;
        return new Date(d.last_worked_at) < sevenDaysAgo;
      }).length;

      const leadsSemOwner = openDeals.filter(d => !d.owner_id).length;

      const kpis: OverviewKPIData = {
        leadsEntraram,
        leadsTrabalhados,
        leadsAvancados,
        leadsPerdidos,
        leadsSemMovimentacao,
        leadsEsquecidos,
        leadsSemOwner,
      };

      // === Pipeline Health ===
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const leadsParados = openDeals.filter(d => {
        const ref = d.last_worked_at ? new Date(d.last_worked_at) : (d.created_at ? new Date(d.created_at) : now);
        return ref < threeDaysAgo;
      }).length;

      const leadsEnvelhecidos = openDeals.filter(d => {
        const ref = d.last_worked_at ? new Date(d.last_worked_at) : (d.created_at ? new Date(d.created_at) : now);
        return ref < sevenDaysAgo;
      }).length;

      const leadsSlaEstourado = openDeals.filter(d => {
        const ref = d.last_worked_at ? new Date(d.last_worked_at) : (d.created_at ? new Date(d.created_at) : now);
        return ref < fourteenDaysAgo;
      }).length;

      // Average time without movement (hours)
      let totalHours = 0;
      let countForAvg = 0;
      openDeals.forEach(d => {
        const ref = d.last_worked_at ? new Date(d.last_worked_at) : (d.created_at ? new Date(d.created_at) : null);
        if (ref) {
          totalHours += differenceInHours(now, ref);
          countForAvg++;
        }
      });
      const tempoMedioSemMovHoras = countForAvg > 0 ? Math.round(totalHours / countForAvg) : 0;

      // Stalled by stage
      const stalledByStage = new Map<string, number>();
      openDeals.forEach(d => {
        const ref = d.last_worked_at ? new Date(d.last_worked_at) : (d.created_at ? new Date(d.created_at) : now);
        if (ref < threeDaysAgo && d.stage_id) {
          const name = stageMap.get(d.stage_id) || 'Desconhecido';
          stalledByStage.set(name, (stalledByStage.get(name) || 0) + 1);
        }
      });
      const travadosPorEtapa = Array.from(stalledByStage.entries())
        .map(([stageName, count]) => ({ stageName, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const health: PipelineHealthData = {
        totalAbertos: openDeals.length,
        leadsParados,
        leadsEnvelhecidos,
        tempoMedioSemMovHoras,
        leadsSlaEstourado,
        travadosPorEtapa,
      };

      // === Flow Funnel ===
      // Count transitions to key stage patterns in the period
      const funnelSteps: FlowFunnelStep[] = [];
      funnelSteps.push({ label: 'Entraram', value: leadsEntraram });
      funnelSteps.push({ label: 'Trabalhados', value: leadsTrabalhados });

      // Count unique deals that reached specific stage types
      const qualifiedDeals = new Set(
        stageChanges
          .filter(a => {
            const name = a.to_stage ? stageMap.get(a.to_stage) : null;
            return name && (name.toLowerCase().includes('qualificad') || name.toLowerCase().includes('lead qualificado'));
          })
          .map(a => a.deal_id)
      );
      funnelSteps.push({ label: 'Qualificados', value: qualifiedDeals.size });

      // R1 Agendadas / Realizadas / Contratos from RPC
      const rpcMetrics = ((rpcResult.data as any)?.metrics || []) as any[];
      const totalR1Agendadas = rpcMetrics.reduce((s: number, m: any) => s + (m.r1_agendada || 0), 0);
      const totalR1Realizadas = rpcMetrics.reduce((s: number, m: any) => s + (m.r1_realizada || 0), 0);
      const totalContratos = rpcMetrics.reduce((s: number, m: any) => s + (m.contratos || 0), 0);

      funnelSteps.push({ label: 'R1 Agendadas', value: totalR1Agendadas });
      funnelSteps.push({ label: 'R1 Realizadas', value: totalR1Realizadas });
      funnelSteps.push({ label: 'Contratos', value: totalContratos });

      // R2 from closer R2 data
      const r2Atts = closerR2Result.data || [];
      funnelSteps.push({ label: 'R2', value: r2Atts.length });

      // Vendas = contratos with sold/approved
      const vendas = r2Atts.filter((a: any) => a.status === 'sold' || a.status === 'contract_paid').length;
      funnelSteps.push({ label: 'Vendas', value: vendas });

      // === SDR Ranking ===
      // Group deals by owner for SDR ranking
      const sdrMap = new Map<string, {
        recebidos: number;
        trabalhados: number;
        semMovimentacao: number;
        esquecidos: number;
        perdidos: number;
      }>();

      // Deals assigned to each owner (created in period = recebidos)
      const dealsCreatedInPeriod = allDeals.filter(d => {
        const created = new Date(d.created_at);
        return created >= periodStart && created <= periodEnd;
      });

      dealsCreatedInPeriod.forEach(d => {
        const ownerId = d.owner_id || '__sem_owner__';
        if (!sdrMap.has(ownerId)) sdrMap.set(ownerId, { recebidos: 0, trabalhados: 0, semMovimentacao: 0, esquecidos: 0, perdidos: 0 });
        sdrMap.get(ownerId)!.recebidos++;
      });

      // Trabalhados per owner
      const dealOwnerMap = new Map(allDeals.map(d => [d.id, d.owner_id || '__sem_owner__']));
      buActivities.forEach(a => {
        const ownerId = dealOwnerMap.get(a.deal_id);
        if (!ownerId) return;
        if (!sdrMap.has(ownerId)) sdrMap.set(ownerId, { recebidos: 0, trabalhados: 0, semMovimentacao: 0, esquecidos: 0, perdidos: 0 });
        // Mark as worked
        sdrMap.get(ownerId)!.trabalhados++;
      });

      // Sem movimentação and esquecidos per owner
      openDeals.forEach(d => {
        const ownerId = d.owner_id || '__sem_owner__';
        if (!sdrMap.has(ownerId)) sdrMap.set(ownerId, { recebidos: 0, trabalhados: 0, semMovimentacao: 0, esquecidos: 0, perdidos: 0 });
        const ref = d.last_worked_at ? new Date(d.last_worked_at) : (d.created_at ? new Date(d.created_at) : now);
        if (ref < periodStart) sdrMap.get(ownerId)!.semMovimentacao++;
        if (ref < sevenDaysAgo) sdrMap.get(ownerId)!.esquecidos++;
      });

      // Perdidos per owner
      stageChanges.filter(a => a.to_stage && lossStageIds.has(a.to_stage)).forEach(a => {
        const ownerId = dealOwnerMap.get(a.deal_id);
        if (!ownerId) return;
        if (!sdrMap.has(ownerId)) sdrMap.set(ownerId, { recebidos: 0, trabalhados: 0, semMovimentacao: 0, esquecidos: 0, perdidos: 0 });
        sdrMap.get(ownerId)!.perdidos++;
      });

      // SDR agenda data from RPC
      const sdrAgendaMap = new Map<string, { agendados: number; qualificados: number }>();
      rpcMetrics.forEach((m: any) => {
        const email = m.sdr_email;
        if (email) {
          sdrAgendaMap.set(email, {
            agendados: m.r1_agendada || 0,
            qualificados: m.contratos || 0,
          });
        }
      });

      // Resolve SDR names from employees table
      const ownerIds = [...sdrMap.keys()].filter(id => id !== '__sem_owner__');
      const sdrNames = new Map<string, string>();
      if (ownerIds.length > 0) {
        // owner_id in crm_deals is email-like or profile id. Try employees.
        const { data: emps } = await supabase
          .from('employees')
          .select('profile_id, nome_completo, email')
          .limit(500);
        
        if (emps) {
          emps.forEach(e => {
            if (e.profile_id) sdrNames.set(e.profile_id, e.nome_completo || e.email || e.profile_id);
            if (e.email) sdrNames.set(e.email, e.nome_completo || e.email);
          });
        }
      }

      const sdrRanking: SdrRankingRow[] = [...sdrMap.entries()]
        .filter(([id]) => id !== '__sem_owner__')
        .map(([sdrId, data]) => {
          // Deduplicate trabalhados (count unique deals, not activities)
          const agendaData = sdrAgendaMap.get(sdrId) || { agendados: 0, qualificados: 0 };
          const total = data.recebidos || 1;
          return {
            sdrId,
            sdrName: sdrNames.get(sdrId) || sdrId.split('@')[0] || sdrId,
            recebidos: data.recebidos,
            trabalhados: data.trabalhados,
            semMovimentacao: data.semMovimentacao,
            agendados: agendaData.agendados,
            qualificados: agendaData.qualificados,
            perdidos: data.perdidos,
            esquecidos: data.esquecidos,
            taxaAproveitamento: data.recebidos > 0
              ? Math.round(((data.trabalhados) / data.recebidos) * 100)
              : 0,
          };
        })
        .sort((a, b) => b.recebidos - a.recebidos);

      // === Closer Ranking ===
      const closerAgg = new Map<string, {
        name: string;
        r1Recebidas: number;
        r1Realizadas: number;
        noShow: number;
        contratos: number;
        r2Agendadas: number;
        r2Realizadas: number;
        aprovados: number;
        vendas: number;
      }>();

      // R1 data
      (closerR1Result.data || []).forEach((att: any) => {
        const closer = att.meeting_slots?.closers;
        if (!closer) return;
        const cid = closer.id;
        if (!closerAgg.has(cid)) {
          closerAgg.set(cid, { name: closer.name, r1Recebidas: 0, r1Realizadas: 0, noShow: 0, contratos: 0, r2Agendadas: 0, r2Realizadas: 0, aprovados: 0, vendas: 0 });
        }
        const c = closerAgg.get(cid)!;
        c.r1Recebidas++;
        if (att.status === 'completed' || att.status === 'contract_paid' || att.status === 'sold') c.r1Realizadas++;
        if (att.status === 'no_show') c.noShow++;
        if (att.status === 'contract_paid') c.contratos++;
      });

      // R2 data
      (closerR2Result.data || []).forEach((att: any) => {
        const closer = att.meeting_slots?.closers;
        if (!closer) return;
        const cid = closer.id;
        if (!closerAgg.has(cid)) {
          closerAgg.set(cid, { name: closer.name, r1Recebidas: 0, r1Realizadas: 0, noShow: 0, contratos: 0, r2Agendadas: 0, r2Realizadas: 0, aprovados: 0, vendas: 0 });
        }
        const c = closerAgg.get(cid)!;
        c.r2Agendadas++;
        if (att.status === 'completed' || att.status === 'sold' || att.status === 'contract_paid') c.r2Realizadas++;
        if (att.status === 'approved' || att.status === 'sold') c.aprovados++;
        if (att.status === 'sold' || att.status === 'contract_paid') c.vendas++;
      });

      const closerRanking: CloserRankingRow[] = [...closerAgg.entries()].map(([closerId, c]) => ({
        closerId,
        closerName: c.name,
        r1Recebidas: c.r1Recebidas,
        r1Realizadas: c.r1Realizadas,
        noShow: c.noShow,
        contratos: c.contratos,
        r2Agendadas: c.r2Agendadas,
        r2Realizadas: c.r2Realizadas,
        aprovados: c.aprovados,
        vendas: c.vendas,
        taxaConversao: c.r1Realizadas > 0 ? Math.round((c.contratos / c.r1Realizadas) * 100) : 0,
      })).sort((a, b) => b.contratos - a.contratos);

      return { kpis, health, funnel: funnelSteps, sdrRanking, closerRanking };
    },
    enabled: originIds.length > 0,
    staleTime: 2 * 60 * 1000,
  });
}

function emptyData(): CRMOverviewData {
  return {
    kpis: { leadsEntraram: 0, leadsTrabalhados: 0, leadsAvancados: 0, leadsPerdidos: 0, leadsSemMovimentacao: 0, leadsEsquecidos: 0, leadsSemOwner: 0 },
    health: { totalAbertos: 0, leadsParados: 0, leadsEnvelhecidos: 0, tempoMedioSemMovHoras: 0, leadsSlaEstourado: 0, travadosPorEtapa: [] },
    funnel: [],
    sdrRanking: [],
    closerRanking: [],
  };
}
