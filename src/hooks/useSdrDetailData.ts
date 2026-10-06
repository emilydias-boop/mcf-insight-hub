import { useMemo } from "react";
import { useTeamMeetingsData, SdrSummaryRow } from "./useTeamMeetingsData";
import { MeetingV2 } from "./useSdrMetricsV2";
import { useSdrsFromSquad } from "./useSdrsFromSquad";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TeamAverages {
  avgAgendamentos: number;
  avgR1Agendada: number;
  avgR1Realizada: number;
  avgNoShows: number;
  avgContratos: number;
}

export interface SdrRanking {
  agendamentos: number;
  r1Agendada: number;
  r1Realizada: number;
  contratos: number;
  taxaContrato: number;
  totalSdrs: number;
}

export interface SdrDetailData {
  sdrInfo: {
    email: string;
    name: string;
    cargo: string;
    squad: string;
    status: string;
  } | null;
  sdrMetrics: SdrSummaryRow | null;
  teamAverages: TeamAverages;
  ranking: SdrRanking;
  meetings: MeetingV2[];
  allSdrs: SdrSummaryRow[];
  metaDiaria: number | null;
  dataAdmissao: string | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

interface UseSdrDetailParams {
  sdrEmail: string;
  startDate: Date | null;
  endDate: Date | null;
}

export function useSdrDetailData({ sdrEmail, startDate, endDate }: UseSdrDetailParams): SdrDetailData {
  const teamData = useTeamMeetingsData({ startDate, endDate });
  const sdrsQuery = useSdrsFromSquad("inside_sales");

  // sdr_id do SDR
  const sdrIdQuery = useQuery({
    queryKey: ['sdr-id-detail', sdrEmail],
    queryFn: async () => {
      const { data } = await supabase
        .from('sdr')
        .select('id')
        .eq('email', sdrEmail.toLowerCase())
        .eq('active', true)
        .maybeSingle();
      return data?.id ?? null;
    },
    enabled: !!sdrEmail,
    staleTime: 1000 * 60 * 5,
  });

  // Meta diária — fonte única: RH (metas_agendamento_por_sdr), mês do início do período
  const anoMesMeta = startDate
    ? `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`
    : null;
  const metaDiariaQuery = useQuery({
    queryKey: ['metas-agendamento-por-sdr', anoMesMeta, [sdrIdQuery.data]],
    queryFn: async () => {
      const sdrId = sdrIdQuery.data;
      const { data, error } = await (supabase.rpc as any)('metas_agendamento_por_sdr', {
        p_sdr_ids: [sdrId],
        p_ano_mes: anoMesMeta,
      });
      if (error) throw error;
      const row = ((data || []) as any[])[0];
      return {
        metaDiaria: row?.meta_diaria != null ? Number(row.meta_diaria) : null,
        sdrId,
      };
    },
    enabled: !!sdrIdQuery.data && !!anoMesMeta,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch data_admissao from employees table using sdr_id
  const dataAdmissaoQuery = useQuery({
    queryKey: ['sdr-data-admissao-detail', sdrIdQuery.data],
    queryFn: async () => {
      const sdrId = sdrIdQuery.data;
      if (!sdrId) return null;
      const { data } = await supabase
        .from('employees')
        .select('data_admissao')
        .eq('sdr_id', sdrId)
        .maybeSingle();
      return data?.data_admissao ?? null;
    },
    enabled: !!sdrIdQuery.data,
    staleTime: 1000 * 60 * 5,
  });

  // Find SDR info from database (dynamic, no hardcoded list)
  const sdrInfo = useMemo(() => {
    const sdrs = sdrsQuery.data || [];
    const sdrFromDb = sdrs.find(s => s.email?.toLowerCase() === sdrEmail.toLowerCase());
    if (!sdrFromDb) return null;
    
    return {
      email: sdrFromDb.email || sdrEmail,
      name: sdrFromDb.name,
      cargo: sdrFromDb.role_type || "SDR",
      squad: "Inside Sales",
      status: "Ativo",
    };
  }, [sdrEmail, sdrsQuery.data]);

  // Get specific SDR metrics
  const sdrMetrics = useMemo(() => {
    return teamData.bySDR.find(s => s.sdrEmail.toLowerCase() === sdrEmail.toLowerCase()) || null;
  }, [teamData.bySDR, sdrEmail]);

  // Calculate team averages
  const teamAverages = useMemo((): TeamAverages => {
    const sdrs = teamData.bySDR;
    if (sdrs.length === 0) {
      return {
        avgAgendamentos: 0,
        avgR1Agendada: 0,
        avgR1Realizada: 0,
        avgNoShows: 0,
        avgContratos: 0,
      };
    }

    const sum = sdrs.reduce(
      (acc, s) => ({
        agendamentos: acc.agendamentos + s.agendamentos,
        r1Agendada: acc.r1Agendada + s.r1Agendada,
        r1Realizada: acc.r1Realizada + s.r1Realizada,
        noShows: acc.noShows + s.noShows,
        contratos: acc.contratos + s.contratos,
      }),
      { agendamentos: 0, r1Agendada: 0, r1Realizada: 0, noShows: 0, contratos: 0 }
    );

    return {
      avgAgendamentos: sum.agendamentos / sdrs.length,
      avgR1Agendada: sum.r1Agendada / sdrs.length,
      avgR1Realizada: sum.r1Realizada / sdrs.length,
      avgNoShows: sum.noShows / sdrs.length,
      avgContratos: sum.contratos / sdrs.length,
    };
  }, [teamData.bySDR]);

  // Calculate ranking for this SDR
  const ranking = useMemo((): SdrRanking => {
    const sdrs = teamData.bySDR;
    const totalSdrs = sdrs.length;

    if (totalSdrs === 0 || !sdrMetrics) {
      return {
        agendamentos: 0,
        r1Agendada: 0,
        r1Realizada: 0,
        contratos: 0,
        taxaContrato: 0,
        totalSdrs: 0,
      };
    }

    const byAgendamentos = [...sdrs].sort((a, b) => b.agendamentos - a.agendamentos);
    const agendamentosRank = byAgendamentos.findIndex(s => s.sdrEmail === sdrEmail) + 1;

    const byR1Agendada = [...sdrs].sort((a, b) => b.r1Agendada - a.r1Agendada);
    const r1AgendadaRank = byR1Agendada.findIndex(s => s.sdrEmail === sdrEmail) + 1;

    const byR1Realizada = [...sdrs].sort((a, b) => b.r1Realizada - a.r1Realizada);
    const r1RealizadaRank = byR1Realizada.findIndex(s => s.sdrEmail === sdrEmail) + 1;

    const byContratos = [...sdrs].sort((a, b) => b.contratos - a.contratos);
    const contratosRank = byContratos.findIndex(s => s.sdrEmail === sdrEmail) + 1;

    const withTaxaContrato = sdrs.map(s => ({
      ...s,
      taxaContrato: s.r1Realizada > 0 ? (s.contratos / s.r1Realizada) * 100 : 0
    }));
    const byTaxaContrato = [...withTaxaContrato].sort((a, b) => b.taxaContrato - a.taxaContrato);
    const taxaContratoRank = byTaxaContrato.findIndex(s => s.sdrEmail === sdrEmail) + 1;

    return {
      agendamentos: agendamentosRank,
      r1Agendada: r1AgendadaRank,
      r1Realizada: r1RealizadaRank,
      contratos: contratosRank,
      taxaContrato: taxaContratoRank,
      totalSdrs,
    };
  }, [teamData.bySDR, sdrMetrics, sdrEmail]);

  // Get meetings for this SDR
  const meetings = useMemo(() => {
    return teamData.getMeetingsForSDR(sdrEmail);
  }, [teamData, sdrEmail]);

  return {
    sdrInfo,
    sdrMetrics,
    teamAverages,
    ranking,
    meetings,
    allSdrs: teamData.bySDR,
    metaDiaria: metaDiariaQuery.data?.metaDiaria ?? null,
    dataAdmissao: dataAdmissaoQuery.data ?? null,
    isLoading: teamData.isLoading || sdrsQuery.isLoading,
    error: teamData.error || sdrsQuery.error || null,
    refetch: teamData.refetch,
  };
}
