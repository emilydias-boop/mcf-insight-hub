import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PayoutSummary {
  id: string;
  sdrName: string;
  roleType: string;
  squad: string | null;
  fixo: number;
  variavel: number;
  totalConta: number;
  ifoodMensal: number;
  ifoodUltrameta: number;
  totalGeral: number;
  pctMeta: number;
  status: string;
}

export interface SquadSummary {
  squad: string;
  sdrs: {
    count: number;
    totalFixo: number;
    totalVariavel: number;
    totalConta: number;
    avgMetaPct: number;
    members: PayoutSummary[];
  };
  closers: {
    count: number;
    totalFixo: number;
    totalVariavel: number;
    totalConta: number;
    avgMetaPct: number;
    members: PayoutSummary[];
  };
  totals: {
    headcount: number;
    totalFixo: number;
    totalVariavel: number;
    totalConta: number;
    totalIfood: number;
    totalGeral: number;
    avgMetaPct: number;
  };
}

export interface ConsolidadoData {
  squads: SquadSummary[];
  grandTotals: {
    headcount: number;
    totalFixo: number;
    totalVariavel: number;
    totalConta: number;
    totalIfood: number;
    totalGeral: number;
    avgMetaPct: number;
  };
}

export function useRelatorioConsolidado(anoMes: string) {
  return useQuery({
    queryKey: ["relatorio-consolidado", anoMes],
    queryFn: async (): Promise<ConsolidadoData> => {
      // Fetch all payouts for the month with SDR details
      const { data: payouts, error } = await supabase
        .from("sdr_payouts")
        .select(`
          *,
          sdr:sdr_id (
            id,
            name,
            email,
            role_type,
            squad
          )
        `)
        .eq("ano_mes", anoMes);

      if (error) throw error;

      // Group by squad and role_type
      const squadMap = new Map<string, SquadSummary>();

      for (const payout of (payouts || []) as any[]) {
        const sdr = payout.sdr;
        if (!sdr) continue;

        const squad = sdr.squad || 'incorporador';
        const roleType = sdr.role_type || 'sdr';

        if (!squadMap.has(squad)) {
          squadMap.set(squad, {
            squad,
            sdrs: { count: 0, totalFixo: 0, totalVariavel: 0, totalConta: 0, avgMetaPct: 0, members: [] },
            closers: { count: 0, totalFixo: 0, totalVariavel: 0, totalConta: 0, avgMetaPct: 0, members: [] },
            totals: { headcount: 0, totalFixo: 0, totalVariavel: 0, totalConta: 0, totalIfood: 0, totalGeral: 0, avgMetaPct: 0 },
          });
        }

        const squadData = squadMap.get(squad)!;
        const memberData: PayoutSummary = {
          id: payout.id,
          sdrName: sdr.name,
          roleType,
          squad,
          fixo: payout.fixo || 0,
          variavel: payout.variavel || 0,
          totalConta: payout.total_conta || 0,
          ifoodMensal: payout.ifood_mensal || 0,
          ifoodUltrameta: payout.ifood_ultrameta || 0,
          totalGeral: (payout.total_conta || 0) + (payout.ifood_mensal || 0) + (payout.ifood_ultrameta || 0),
          pctMeta: payout.pct_media_global || 0,
          status: payout.status || 'draft',
        };

        const group = roleType === 'closer' ? squadData.closers : squadData.sdrs;
        group.count++;
        group.totalFixo += memberData.fixo;
        group.totalVariavel += memberData.variavel;
        group.totalConta += memberData.totalConta;
        group.members.push(memberData);
      }

      // Calculate averages and totals
      const squads: SquadSummary[] = [];
      let grandTotals = {
        headcount: 0,
        totalFixo: 0,
        totalVariavel: 0,
        totalConta: 0,
        totalIfood: 0,
        totalGeral: 0,
        avgMetaPct: 0,
      };
      let totalMetaPctSum = 0;

      for (const [, squadData] of squadMap) {
        // Calculate averages for SDRs
        if (squadData.sdrs.count > 0) {
          const sdrMetaSum = squadData.sdrs.members.reduce((sum, m) => sum + m.pctMeta, 0);
          squadData.sdrs.avgMetaPct = sdrMetaSum / squadData.sdrs.count;
        }

        // Calculate averages for Closers
        if (squadData.closers.count > 0) {
          const closerMetaSum = squadData.closers.members.reduce((sum, m) => sum + m.pctMeta, 0);
          squadData.closers.avgMetaPct = closerMetaSum / squadData.closers.count;
        }

        // Squad totals
        const allMembers = [...squadData.sdrs.members, ...squadData.closers.members];
        squadData.totals.headcount = allMembers.length;
        squadData.totals.totalFixo = allMembers.reduce((sum, m) => sum + m.fixo, 0);
        squadData.totals.totalVariavel = allMembers.reduce((sum, m) => sum + m.variavel, 0);
        squadData.totals.totalConta = allMembers.reduce((sum, m) => sum + m.totalConta, 0);
        squadData.totals.totalIfood = allMembers.reduce((sum, m) => sum + m.ifoodMensal + m.ifoodUltrameta, 0);
        squadData.totals.totalGeral = allMembers.reduce((sum, m) => sum + m.totalGeral, 0);
        squadData.totals.avgMetaPct = allMembers.length > 0 
          ? allMembers.reduce((sum, m) => sum + m.pctMeta, 0) / allMembers.length 
          : 0;

        // Add to grand totals
        grandTotals.headcount += squadData.totals.headcount;
        grandTotals.totalFixo += squadData.totals.totalFixo;
        grandTotals.totalVariavel += squadData.totals.totalVariavel;
        grandTotals.totalConta += squadData.totals.totalConta;
        grandTotals.totalIfood += squadData.totals.totalIfood;
        grandTotals.totalGeral += squadData.totals.totalGeral;
        totalMetaPctSum += squadData.totals.avgMetaPct * allMembers.length;

        squads.push(squadData);
      }

      // Calculate grand average
      if (grandTotals.headcount > 0) {
        grandTotals.avgMetaPct = totalMetaPctSum / grandTotals.headcount;
      }

      // Sort squads by name
      squads.sort((a, b) => a.squad.localeCompare(b.squad));

      return { squads, grandTotals };
    },
  });
}
