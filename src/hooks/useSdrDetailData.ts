import { useMemo } from "react";
import { useTeamMeetingsData, SdrSummaryRow } from "./useTeamMeetingsData";
import { MeetingV2 } from "./useSdrMetricsV2";
import { SDR_LIST } from "@/constants/team";

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

  // Find SDR info from constants
  const sdrInfo = useMemo(() => {
    const sdrFromList = SDR_LIST.find(s => s.email.toLowerCase() === sdrEmail.toLowerCase());
    if (!sdrFromList) return null;
    
    return {
      email: sdrFromList.email,
      name: sdrFromList.nome,
      cargo: "SDR",
      squad: "Inside Sales",
      status: "Ativo",
    };
  }, [sdrEmail]);

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

    // Agendamentos (higher is better)
    const byAgendamentos = [...sdrs].sort((a, b) => b.agendamentos - a.agendamentos);
    const agendamentosRank = byAgendamentos.findIndex(s => s.sdrEmail === sdrEmail) + 1;

    // R1 Agendada (higher is better)
    const byR1Agendada = [...sdrs].sort((a, b) => b.r1Agendada - a.r1Agendada);
    const r1AgendadaRank = byR1Agendada.findIndex(s => s.sdrEmail === sdrEmail) + 1;

    // R1 Realizada (higher is better)
    const byR1Realizada = [...sdrs].sort((a, b) => b.r1Realizada - a.r1Realizada);
    const r1RealizadaRank = byR1Realizada.findIndex(s => s.sdrEmail === sdrEmail) + 1;

    // Contratos (higher is better)
    const byContratos = [...sdrs].sort((a, b) => b.contratos - a.contratos);
    const contratosRank = byContratos.findIndex(s => s.sdrEmail === sdrEmail) + 1;

    // Taxa Contrato (Contratos / Agendamentos - higher % is better)
    const withTaxaContrato = sdrs.map(s => ({
      ...s,
      taxaContrato: s.agendamentos > 0 ? (s.contratos / s.agendamentos) * 100 : 0
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
    isLoading: teamData.isLoading,
    error: teamData.error,
    refetch: teamData.refetch,
  };
}
