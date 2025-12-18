import { useMemo } from "react";
import { useTeamMeetingsData, SdrSummaryRow } from "./useTeamMeetingsData";
import { MeetingV2 } from "./useSdrMetricsV2";
import { SDR_LIST } from "@/constants/team";

export interface TeamAverages {
  avgAgendamentos: number;
  avgRealizadas: number;
  avgNoShows: number;
  avgContratos: number;
  avgTaxaConversao: number;
  avgTaxaNoShow: number;
}

export interface SdrRanking {
  agendamentos: number;
  realizadas: number;
  contratos: number;
  taxaConversao: number;
  taxaNoShow: number; // Lower is better
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
        avgRealizadas: 0,
        avgNoShows: 0,
        avgContratos: 0,
        avgTaxaConversao: 0,
        avgTaxaNoShow: 0,
      };
    }

    const sum = sdrs.reduce(
      (acc, s) => ({
        agendamentos: acc.agendamentos + s.totalAgendamentos,
        realizadas: acc.realizadas + s.realizadas,
        noShows: acc.noShows + s.noShows,
        contratos: acc.contratos + s.contratos,
        taxaConversao: acc.taxaConversao + s.taxaConversao,
        taxaNoShow: acc.taxaNoShow + s.taxaNoShow,
      }),
      { agendamentos: 0, realizadas: 0, noShows: 0, contratos: 0, taxaConversao: 0, taxaNoShow: 0 }
    );

    return {
      avgAgendamentos: sum.agendamentos / sdrs.length,
      avgRealizadas: sum.realizadas / sdrs.length,
      avgNoShows: sum.noShows / sdrs.length,
      avgContratos: sum.contratos / sdrs.length,
      avgTaxaConversao: sum.taxaConversao / sdrs.length,
      avgTaxaNoShow: sum.taxaNoShow / sdrs.length,
    };
  }, [teamData.bySDR]);

  // Calculate ranking for this SDR
  const ranking = useMemo((): SdrRanking => {
    const sdrs = teamData.bySDR;
    const totalSdrs = sdrs.length;

    if (totalSdrs === 0 || !sdrMetrics) {
      return {
        agendamentos: 0,
        realizadas: 0,
        contratos: 0,
        taxaConversao: 0,
        taxaNoShow: 0,
        totalSdrs: 0,
      };
    }

    // Agendamentos (higher is better)
    const byAgendamentos = [...sdrs].sort((a, b) => b.totalAgendamentos - a.totalAgendamentos);
    const agendamentosRank = byAgendamentos.findIndex(s => s.sdrEmail === sdrEmail) + 1;

    // Realizadas (higher is better)
    const byRealizadas = [...sdrs].sort((a, b) => b.realizadas - a.realizadas);
    const realizadasRank = byRealizadas.findIndex(s => s.sdrEmail === sdrEmail) + 1;

    // Contratos (higher is better)
    const byContratos = [...sdrs].sort((a, b) => b.contratos - a.contratos);
    const contratosRank = byContratos.findIndex(s => s.sdrEmail === sdrEmail) + 1;

    // Taxa Conversão (higher is better)
    const byTaxaConversao = [...sdrs].sort((a, b) => b.taxaConversao - a.taxaConversao);
    const taxaConversaoRank = byTaxaConversao.findIndex(s => s.sdrEmail === sdrEmail) + 1;

    // Taxa No-Show (lower is better, so sort ascending)
    const byTaxaNoShow = [...sdrs].sort((a, b) => a.taxaNoShow - b.taxaNoShow);
    const taxaNoShowRank = byTaxaNoShow.findIndex(s => s.sdrEmail === sdrEmail) + 1;

    return {
      agendamentos: agendamentosRank,
      realizadas: realizadasRank,
      contratos: contratosRank,
      taxaConversao: taxaConversaoRank,
      taxaNoShow: taxaNoShowRank,
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
