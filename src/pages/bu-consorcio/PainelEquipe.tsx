import { useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay, startOfYear, endOfYear, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";
import { CONSORCIO_WEEK_STARTS_ON, contarDiasUteis } from "@/lib/businessDays";
import { Calendar, Users, Download, Briefcase, TrendingUp } from "lucide-react";
import { SetorRow } from "@/components/dashboard/SetorRow";
import { useSetoresDashboard } from "@/hooks/useSetoresDashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePickerCustom } from "@/components/ui/DatePickerCustom";
import { TeamKPICards } from "@/components/sdr/TeamKPICards";
import { TeamGoalsPanel } from "@/components/sdr/TeamGoalsPanel";
import { ConsorcioGoalsMatrixTable, ConsorcioMetricRow } from "@/components/sdr/ConsorcioGoalsMatrixTable";
import { useConsorcioPipelineMetrics } from "@/hooks/useConsorcioPipelineMetrics";
import { useConsorcioProdutosFechadosMetrics } from "@/hooks/useConsorcioProdutosFechadosMetrics";
import { useSdrTeamTargets } from "@/hooks/useSdrTeamTargets";
import { TeamGoalsEditModal } from "@/components/sdr/TeamGoalsEditModal";
import { Target, Settings2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ConsorcioSdrSummaryTable } from "@/components/sdr/ConsorcioSdrSummaryTable";
import { useConsorcioPipelineMetricsBySdr } from "@/hooks/useConsorcioPipelineMetricsBySdr";
import { useConsorcioProdutosFechadosBySdr } from "@/hooks/useConsorcioProdutosFechadosBySdr";
import { useConsorcioProdutosFechadosByCloser } from "@/hooks/useConsorcioProdutosFechadosByCloser";
import { ConsorcioCloserSummaryTable } from "@/components/sdr/ConsorcioCloserSummaryTable";
import { PipelineSelector } from "@/components/crm/PipelineSelector";

import { useTeamMeetingsData, SdrSummaryRow } from "@/hooks/useTeamMeetingsData";

import { useMeetingSlotsKPIs } from "@/hooks/useMeetingSlotsKPIs";
import { useR2MeetingSlotsKPIs } from "@/hooks/useR2MeetingSlotsKPIs";
import { useR2VendasKPIs } from "@/hooks/useR2VendasKPIs";
import { useR1CloserMetrics } from "@/hooks/useR1CloserMetrics";

import { useSdrOutsideMetrics } from "@/hooks/useSdrOutsideMetrics";
import { useBUPipelineMap } from "@/hooks/useBUPipelineMap";
import { useCRMOriginsByPipeline } from "@/hooks/useCRMOriginsByPipeline";

import { useSdrsAll } from "@/hooks/useSdrFechamento";
import { useAuth } from "@/contexts/AuthContext";
import { useSdrsFromSquad } from "@/hooks/useSdrsFromSquad";
import { SdrActivityMetricsTable } from "@/components/sdr/SdrActivityMetricsTable";
import { BURevenueGoalsEditModal } from "@/components/sdr/BURevenueGoalsEditModal";
import { useConsorcioSummary } from "@/hooks/useConsorcio";

const BU_SQUAD = "consorcio";
const BU_PREFIX = "consorcio_sdr_";

type DatePreset = "today" | "week" | "month" | "custom";

function ConsorcioMetricsCard({ onEditGoals, canEdit }: { onEditGoals?: () => void; canEdit?: boolean }) {
  const { data: setoresData, isLoading: setoresLoading } = useSetoresDashboard();
  const efeitoAlavanca = setoresData?.setores.find(s => s.id === 'efeito_alavanca');
  const credito = setoresData?.setores.find(s => s.id === 'credito');

  // Calculate date ranges for all cards (not just inside)
  const today = new Date();
  const todayNorm = startOfDay(today);
  const wStart = startOfWeek(todayNorm, { weekStartsOn: CONSORCIO_WEEK_STARTS_ON });
  const wEnd = endOfWeek(todayNorm, { weekStartsOn: CONSORCIO_WEEK_STARTS_ON });
  const mStart = startOfMonth(today);
  const mEnd = endOfMonth(today);
  const yStart = startOfYear(today);
  const yEnd = endOfYear(today);

  // Fetch ALL consortium cards (no categoria filter) for each period
  const { data: weeklySummary, isLoading: wLoading } = useConsorcioSummary({ startDate: wStart, endDate: wEnd });
  const { data: monthlySummary, isLoading: mLoading } = useConsorcioSummary({ startDate: mStart, endDate: mEnd });
  const { data: annualSummary, isLoading: yLoading } = useConsorcioSummary({ startDate: yStart, endDate: yEnd });

  const summaryLoading = wLoading || mLoading || yLoading;

  if (!efeitoAlavanca && !credito && !setoresLoading && !summaryLoading) return null;

  // Use totalCredito from ALL cards + credito sector commission from consortium_payments
  const combined = {
    apuradoSemanal: (weeklySummary?.totalCredito || 0) + (credito?.apuradoSemanal || 0),
    metaSemanal: (efeitoAlavanca?.metaSemanal || 0) + (credito?.metaSemanal || 0),
    apuradoMensal: (monthlySummary?.totalCredito || 0) + (credito?.apuradoMensal || 0),
    metaMensal: (efeitoAlavanca?.metaMensal || 0) + (credito?.metaMensal || 0),
    apuradoAnual: (annualSummary?.totalCredito || 0) + (credito?.apuradoAnual || 0),
    metaAnual: (efeitoAlavanca?.metaAnual || 0) + (credito?.metaAnual || 0),
  };

  return (
    <div className="relative group">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary via-primary/60 to-primary rounded-xl blur opacity-30 group-hover:opacity-50 transition-opacity duration-300" />
      <div className="relative">
        <SetorRow
          titulo="BU Consórcio"
          icone={TrendingUp}
          semanaLabel={setoresData?.semanaLabel || 'Semana'}
          mesLabel={setoresData?.mesLabel || 'Mês'}
          apuradoSemanal={combined.apuradoSemanal}
          metaSemanal={combined.metaSemanal}
          apuradoMensal={combined.apuradoMensal}
          metaMensal={combined.metaMensal}
          apuradoAnual={combined.apuradoAnual}
          metaAnual={combined.metaAnual}
          isLoading={setoresLoading || summaryLoading}
        />
        {canEdit && (
          <button
            onClick={onEditGoals}
            className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
            title="Editar metas"
          >
            <Settings2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function ConsorcioPainelEquipe() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const isRestrictedRole = role === 'sdr' || role === 'closer';
  const [searchParams, setSearchParams] = useSearchParams();

  const initialPreset = (searchParams.get("preset") as DatePreset) || "month";
  const initialMonth = searchParams.get("month")
    ? parseISO(searchParams.get("month") + "-01")
    : new Date();
  const initialStart = searchParams.get("start")
    ? parseISO(searchParams.get("start")!)
    : null;
  const initialEnd = searchParams.get("end")
    ? parseISO(searchParams.get("end")!)
    : initialStart;

  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [datePreset, setDatePreset] = useState<DatePreset>(initialPreset);
  const [customStartDate, setCustomStartDate] = useState<Date | null>(initialStart);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(initialEnd || initialStart);
  const [sdrFilter, setSdrFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"sdrs" | "closers">("sdrs");
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [goalsEditModalOpen, setGoalsEditModalOpen] = useState(false);
  const [revenueGoalsEditOpen, setRevenueGoalsEditOpen] = useState(false);

  // BU pipeline mapping for Consórcio
  const { data: buMapping } = useBUPipelineMap('consorcio');
  const allowedGroupIds = buMapping?.groups || [];

  // Get origins for the selected pipeline to filter meetings
  const { data: pipelineOrigins } = useCRMOriginsByPipeline(selectedPipelineId);

  // Build set of allowed origin names for filtering
  const allowedOriginNames = useMemo(() => {
    if (!selectedPipelineId || !pipelineOrigins) return null; // null = no filter
    // pipelineOrigins can be an array of origins or groups with children
    const names = new Set<string>();
    if (Array.isArray(pipelineOrigins)) {
      pipelineOrigins.forEach((item: any) => {
        if (item.children) {
          // It's a group with children origins
          item.children.forEach((child: any) => {
            if (child.name) names.add(child.name.toLowerCase());
            if (child.display_name) names.add(child.display_name.toLowerCase());
          });
        } else {
          // It's a direct origin
          if (item.name) names.add(item.name.toLowerCase());
          if (item.display_name) names.add(item.display_name.toLowerCase());
        }
      });
    }
    return names.size > 0 ? names : null;
  }, [selectedPipelineId, pipelineOrigins]);

  const updateUrlParams = (
    preset: DatePreset,
    month?: Date,
    startDate?: Date | null,
    endDate?: Date | null
  ) => {
    const params = new URLSearchParams(searchParams);
    params.set("preset", preset);
    if (preset === "month" && month) {
      params.set("month", format(month, "yyyy-MM"));
      params.delete("start");
      params.delete("end");
    } else if (preset === "custom") {
      params.delete("month");
      if (startDate) params.set("start", format(startDate, "yyyy-MM-dd"));
      if (endDate) params.set("end", format(endDate, "yyyy-MM-dd"));
    } else {
      params.delete("month");
      params.delete("start");
      params.delete("end");
    }
    setSearchParams(params, { replace: true });
  };

  const getDateRange = () => {
    const today = new Date();
    switch (datePreset) {
      case "today":
        return { start: startOfDay(today), end: endOfDay(today) };
      case "week": {
        const todayNormalized = startOfDay(today);
        return { start: startOfWeek(todayNormalized, { weekStartsOn: CONSORCIO_WEEK_STARTS_ON }), end: endOfWeek(todayNormalized, { weekStartsOn: CONSORCIO_WEEK_STARTS_ON }) };
      }
      case "month":
        return { start: startOfMonth(selectedMonth), end: endOfMonth(selectedMonth) };
      case "custom":
        const startCustom = customStartDate || startOfMonth(today);
        const endCustom = customEndDate || customStartDate || endOfMonth(today);
        if (startCustom > endCustom) return { start: endCustom, end: startCustom };
        return { start: startCustom, end: endCustom };
      default:
        return { start: startOfMonth(selectedMonth), end: endOfMonth(selectedMonth) };
    }
  };

  const { start, end } = getDateRange();

  const today = new Date();
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);
  const todayNormalized = startOfDay(today);
  const weekStartDate = startOfWeek(todayNormalized, { weekStartsOn: CONSORCIO_WEEK_STARTS_ON });
  const weekEndDate = endOfWeek(todayNormalized, { weekStartsOn: CONSORCIO_WEEK_STARTS_ON });
  const monthStartDate = startOfMonth(today);
  const monthEndDate = endOfMonth(today);

  // Fetch data with squad = 'consorcio'
  const {
    teamKPIs,
    bySDR,
    allMeetings,
    isLoading,
    refetch,
  } = useTeamMeetingsData({
    startDate: start,
    endDate: end,
    sdrEmailFilter: sdrFilter !== "all" ? sdrFilter : undefined,
    squad: BU_SQUAD,
  });

  const { teamKPIs: dayKPIs } = useTeamMeetingsData({ startDate: dayStart, endDate: dayEnd, squad: BU_SQUAD });
  const { teamKPIs: weekKPIs } = useTeamMeetingsData({ startDate: weekStartDate, endDate: weekEndDate, squad: BU_SQUAD });
  const { teamKPIs: monthKPIs } = useTeamMeetingsData({ startDate: monthStartDate, endDate: monthEndDate, squad: BU_SQUAD });

  
  const { data: allSdrsData } = useSdrsAll();
  const { data: activeSdrsList } = useSdrsFromSquad(BU_SQUAD);

  const sdrMetaMap = useMemo(() => {
    const map = new Map<string, number>();
    if (allSdrsData) {
      allSdrsData.forEach(sdr => {
        if (sdr.email) map.set(sdr.email.toLowerCase(), sdr.meta_diaria || 10);
      });
    }
    return map;
  }, [allSdrsData]);

  const diasUteisNoPeriodo = useMemo(() => contarDiasUteis(start, end), [start, end]);

  const { data: dayAgendaKPIs } = useMeetingSlotsKPIs(dayStart, dayEnd);
  const { data: weekAgendaKPIs } = useMeetingSlotsKPIs(weekStartDate, weekEndDate);
  const { data: dayR2AgendaKPIs } = useR2MeetingSlotsKPIs(dayStart, dayEnd);
  const { data: weekR2AgendaKPIs } = useR2MeetingSlotsKPIs(weekStartDate, weekEndDate);
  const { data: dayR2VendasKPIs } = useR2VendasKPIs(dayStart, dayEnd);
  const { data: weekR2VendasKPIs } = useR2VendasKPIs(weekStartDate, weekEndDate);
  const { data: monthAgendaKPIs } = useMeetingSlotsKPIs(monthStartDate, monthEndDate);
  const { data: monthR2AgendaKPIs } = useR2MeetingSlotsKPIs(monthStartDate, monthEndDate);
  const { data: monthR2VendasKPIs } = useR2VendasKPIs(monthStartDate, monthEndDate);

  // Closer metrics filtered by BU consorcio
  const { data: closerMetrics, isLoading: closerLoading } = useR1CloserMetrics(start, end, BU_SQUAD);
  
  const { data: outsideData } = useSdrOutsideMetrics(start, end);

  // Consórcio pipeline metrics (deals by stage)
  const pipelineMetrics = useConsorcioPipelineMetrics();
  const produtosFechados = useConsorcioProdutosFechadosMetrics();
  const { data: propostasData } = useConsorcioPipelineMetricsBySdr(start, end);
  const { data: produtosFechadosBySdr } = useConsorcioProdutosFechadosBySdr(start, end);
  const { data: produtosFechadosByCloser } = useConsorcioProdutosFechadosByCloser(start, end);
  
  // Consórcio team targets
  const { data: consorcioTargets, isLoading: targetsLoading } = useSdrTeamTargets(BU_PREFIX);
  const canEditGoals = role && ['admin', 'manager', 'coordenador'].includes(role);

  // Helper to get target value by suffix
  const getTargetValue = (suffix: string): number => {
    const targetType = `${BU_PREFIX}${suffix}`;
    const target = consorcioTargets?.find(t => t.target_type === targetType);
    return target?.target_value ?? 0;
  };

  // Helper to check if a meeting matches the selected pipeline
  const matchesPipeline = (originName: string | null) => {
    if (!allowedOriginNames) return true; // No pipeline filter
    return allowedOriginNames.has((originName || '').toLowerCase());
  };

  // Filter meetings by pipeline
  const pipelineFilteredMeetings = useMemo(() => {
    if (!allowedOriginNames) return allMeetings;
    return allMeetings.filter(m => matchesPipeline(m.origin_name));
  }, [allMeetings, allowedOriginNames]);

  // Re-derive SDR metrics from pipeline-filtered meetings
  const pipelineFilteredBySDR = useMemo((): SdrSummaryRow[] => {
    if (!allowedOriginNames) return bySDR; // No filter, use original data
    
    // Re-aggregate from filtered meetings
    const sdrMap = new Map<string, SdrSummaryRow>();
    pipelineFilteredMeetings.forEach(m => {
      const email = m.intermediador?.toLowerCase() || '';
      if (!email) return;
      
      if (!sdrMap.has(email)) {
        const sdrName = activeSdrsList?.find(s => s.email?.toLowerCase() === email)?.name 
          || m.intermediador?.split('@')[0] || 'Desconhecido';
        sdrMap.set(email, {
          sdrEmail: m.intermediador,
          sdrName,
          agendamentos: 0,
          r1Agendada: 0,
          r1Realizada: 0,
          noShows: 0,
          contratos: 0,
        });
      }
      
      const row = sdrMap.get(email)!;
      row.agendamentos++;
      
      const status = (m.status_atual || '').toLowerCase();
      if (status.includes('agendada')) row.r1Agendada++;
      if (status.includes('realizada')) row.r1Realizada++;
      if (status.includes('no-show') || status.includes('no show')) row.noShows++;
      if (status.includes('contrato') || status.includes('contract')) row.contratos++;
    });
    
    return Array.from(sdrMap.values()).sort((a, b) => b.agendamentos - a.agendamentos);
  }, [bySDR, pipelineFilteredMeetings, allowedOriginNames, activeSdrsList]);

  // Re-derive KPIs from pipeline-filtered data
  const pipelineFilteredKPIs = useMemo(() => {
    if (!allowedOriginNames) return teamKPIs; // No filter
    
    const data = pipelineFilteredBySDR;
    const totalAgendamentos = data.reduce((sum, s) => sum + s.agendamentos, 0);
    const totalRealizadas = data.reduce((sum, s) => sum + s.r1Realizada, 0);
    const totalNoShows = data.reduce((sum, s) => sum + s.noShows, 0);
    const totalContratos = data.reduce((sum, s) => sum + s.contratos, 0);
    const totalR1Agendada = data.reduce((sum, s) => sum + s.r1Agendada, 0);
    
    return {
      sdrCount: data.length,
      totalAgendamentos,
      totalRealizadas,
      totalNoShows,
      totalContratos,
      totalOutside: 0,
      totalR1Agendada,
      taxaConversao: totalRealizadas > 0 ? (totalContratos / totalRealizadas) * 100 : 0,
      taxaNoShow: totalR1Agendada > 0 ? (totalNoShows / totalR1Agendada) * 100 : 0,
    };
  }, [teamKPIs, pipelineFilteredBySDR, allowedOriginNames]);

  const enrichedKPIs = useMemo(() => ({
    ...pipelineFilteredKPIs,
    totalOutside: allowedOriginNames ? 0 : (outsideData?.totalOutside || 0),
  }), [pipelineFilteredKPIs, outsideData, allowedOriginNames]);

  const allSdrsWithZeros = useMemo((): SdrSummaryRow[] => {
    const sdrs = activeSdrsList || [];
    return sdrs.map(sdr => ({
      sdrEmail: sdr.email,
      sdrName: sdr.name,
      agendamentos: 0,
      r1Agendada: 0,
      r1Realizada: 0,
      noShows: 0,
      contratos: 0,
    }));
  }, [activeSdrsList]);

  const mergedBySDR = useMemo((): SdrSummaryRow[] => {
    const source = pipelineFilteredBySDR;
    const dataMap = new Map(allSdrsWithZeros.map(s => [s.sdrEmail, { ...s }]));
    source.forEach(realRow => {
      if (dataMap.has(realRow.sdrEmail)) dataMap.set(realRow.sdrEmail, realRow);
    });
    return Array.from(dataMap.values()).sort((a, b) => {
      if (b.agendamentos !== a.agendamentos) return b.agendamentos - a.agendamentos;
      if (b.r1Realizada !== a.r1Realizada) return b.r1Realizada - a.r1Realizada;
      return a.sdrName.localeCompare(b.sdrName);
    });
  }, [allSdrsWithZeros, pipelineFilteredBySDR]);

  const filteredBySDR = useMemo(() => {
    const baseData = datePreset === "today" ? mergedBySDR : pipelineFilteredBySDR;
    if (sdrFilter === "all") return baseData;
    return baseData.filter(s => s.sdrEmail === sdrFilter);
  }, [datePreset, mergedBySDR, pipelineFilteredBySDR, sdrFilter]);

  const pendentesHojeConsorcio = Math.max(0,
    (dayKPIs?.totalR1Agendada || 0) - (dayKPIs?.totalRealizadas || 0) - (dayKPIs?.totalNoShows || 0)
  );

  const dayValues = useMemo(() => ({
    agendamento: dayKPIs?.totalAgendamentos || 0,
    r1Agendada: dayKPIs?.totalR1Agendada || 0,
    r1Realizada: dayKPIs?.totalRealizadas || 0,
    noShow: dayKPIs?.totalNoShows || 0,
    contrato: dayKPIs?.totalContratos || 0,
    r2Agendada: dayR2AgendaKPIs?.r2Agendadas || 0,
    r2Realizada: dayR2AgendaKPIs?.r2Realizadas || 0,
    vendaRealizada: dayR2VendasKPIs?.vendasRealizadas || 0,
  }), [dayKPIs, dayR2AgendaKPIs, dayR2VendasKPIs]);

  const weekValues = useMemo(() => ({
    agendamento: weekKPIs?.totalAgendamentos || 0,
    r1Agendada: weekKPIs?.totalR1Agendada || 0,
    r1Realizada: weekKPIs?.totalRealizadas || 0,
    noShow: weekKPIs?.totalNoShows || 0,
    contrato: weekKPIs?.totalContratos || 0,
    r2Agendada: weekR2AgendaKPIs?.r2Agendadas || 0,
    r2Realizada: weekR2AgendaKPIs?.r2Realizadas || 0,
    vendaRealizada: weekR2VendasKPIs?.vendasRealizadas || 0,
  }), [weekKPIs, weekR2AgendaKPIs, weekR2VendasKPIs]);

  const monthValues = useMemo(() => ({
    agendamento: monthKPIs?.totalAgendamentos || 0,
    r1Agendada: monthKPIs?.totalR1Agendada || 0,
    r1Realizada: monthKPIs?.totalRealizadas || 0,
    noShow: monthKPIs?.totalNoShows || 0,
    contrato: monthKPIs?.totalContratos || 0,
    r2Agendada: monthR2AgendaKPIs?.r2Agendadas || 0,
    r2Realizada: monthR2AgendaKPIs?.r2Realizadas || 0,
    vendaRealizada: monthR2VendasKPIs?.vendasRealizadas || 0,
  }), [monthKPIs, monthR2AgendaKPIs, monthR2VendasKPIs]);

  // Build Consórcio goals matrix rows combining agenda + pipeline metrics
  const consorcioGoalsRows = useMemo((): ConsorcioMetricRow[] => {
    const pm = pipelineMetrics;
    return [
      // Agenda metrics (shared across pipelines)
      {
        label: 'Agendamento',
        day: { value: dayValues.agendamento, target: getTargetValue('agendamento_dia') },
        week: { value: weekValues.agendamento, target: getTargetValue('agendamento_semana') },
        month: { value: monthValues.agendamento, target: getTargetValue('agendamento_mes') },
      },
      {
        label: 'R1 Agendada',
        day: { value: dayValues.r1Agendada, target: getTargetValue('r1_agendada_dia') },
        week: { value: weekValues.r1Agendada, target: getTargetValue('r1_agendada_semana') },
        month: { value: monthValues.r1Agendada, target: getTargetValue('r1_agendada_mes') },
      },
      {
        label: 'R1 Realizada',
        day: { value: dayValues.r1Realizada, target: getTargetValue('r1_realizada_dia') },
        week: { value: weekValues.r1Realizada, target: getTargetValue('r1_realizada_semana') },
        month: { value: monthValues.r1Realizada, target: getTargetValue('r1_realizada_mes') },
      },
      {
        label: 'No-Show',
        day: { value: dayValues.noShow, target: getTargetValue('noshow_dia') },
        week: { value: weekValues.noShow, target: getTargetValue('noshow_semana') },
        month: { value: monthValues.noShow, target: getTargetValue('noshow_mes') },
      },
      // Proposta Enviada (standalone)
      {
        label: 'Proposta Enviada',
        day: { value: pm.day.propostaEnviada, target: getTargetValue('proposta_enviada_dia') },
        week: { value: pm.week.propostaEnviada, target: getTargetValue('proposta_enviada_semana') },
        month: { value: pm.month.propostaEnviada, target: getTargetValue('proposta_enviada_mes') },
      },
      // Produtos Fechados (dynamic from DB)
      ...produtosFechados.products.map((prod) => ({
        label: prod.label,
        pipelineGroup: 'Produtos Fechados',
        day: { value: prod.day, target: 0 },
        week: { value: prod.week, target: 0 },
        month: { value: prod.month, target: 0 },
      })),
    ];
  }, [dayValues, weekValues, monthValues, pipelineMetrics, consorcioTargets, produtosFechados]);

  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    updateUrlParams(preset, selectedMonth, customStartDate, customEndDate);
  };

  const handleMonthChange = (increment: number) => {
    const newDate = new Date(selectedMonth);
    newDate.setMonth(newDate.getMonth() + increment);
    setSelectedMonth(newDate);
    updateUrlParams("month", newDate, null, null);
  };

  const handleCustomStartChange = (date: Date | null) => {
    setCustomStartDate(date);
    updateUrlParams("custom", selectedMonth, date, customEndDate);
  };

  const handleCustomEndChange = (date: Date | null) => {
    setCustomEndDate(date);
    updateUrlParams("custom", selectedMonth, customStartDate, date);
  };

  const handleExportExcel = () => {
    const resumoData = filteredBySDR.map(sdr => ({
      "SDR": sdr.sdrName,
      "Agendamento": sdr.agendamentos,
      "R1 Agendada": sdr.r1Agendada,
      "R1 Realizada": sdr.r1Realizada,
      "No-Show": sdr.noShows,
      "Contrato PAGO": sdr.contratos,
    }));

    const leadsData = pipelineFilteredMeetings
      .filter(m => sdrFilter === "all" || m.intermediador === sdrFilter)
      .map(m => ({
        "SDR": m.intermediador || "",
        "Data/Hora": m.data_agendamento ? format(new Date(m.data_agendamento), "dd/MM/yyyy HH:mm") : "",
        "Lead": m.contact_name || "",
        "Email": m.contact_email || "",
        "Telefone": m.contact_phone || "",
        "Tipo": m.tipo || "",
        "Status": m.status_atual || "",
        "Origem": m.origin_name || "",
        "Closer": m.closer || "",
        "Probabilidade": m.probability ? `${m.probability}%` : "",
      }));

    const wb = XLSX.utils.book_new();
    const wsResumo = XLSX.utils.json_to_sheet(resumoData);
    const wsLeads = XLSX.utils.json_to_sheet(leadsData);
    XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo SDR");
    XLSX.utils.book_append_sheet(wb, wsLeads, "Leads Detalhados");
    XLSX.writeFile(wb, `painel_consorcio_${format(start, "yyyyMMdd")}_${format(end, "yyyyMMdd")}.xlsx`);
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6">
      {/* Consórcio Metrics Card */}
      <ConsorcioMetricsCard
        onEditGoals={() => setRevenueGoalsEditOpen(true)}
        canEdit={canEditGoals || false}
      />

      {/* Revenue Goals Edit Modal */}
      <BURevenueGoalsEditModal
        open={revenueGoalsEditOpen}
        onOpenChange={setRevenueGoalsEditOpen}
        title="BU Consórcio"
        sections={[
          { prefix: "setor_efeito_alavanca", label: "Efeito Alavanca (Valor em Carta)" },
          { prefix: "setor_credito", label: "Crédito (Comissão)" },
        ]}
      />

      {/* Goals Panel - Consórcio specific with both pipelines */}
      {targetsLoading ? (
        <Card className="bg-card border-border">
          <CardContent className="p-3 sm:p-6">
            <Skeleton className="h-[400px] w-full rounded-lg" />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="bg-card border-border">
            <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Target className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  Metas da Equipe
                </CardTitle>
                {canEditGoals && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setGoalsEditModalOpen(true)}
                    className="h-7 sm:h-8 px-2 text-xs sm:text-sm"
                  >
                    <Settings2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    <span className="hidden sm:inline">Editar</span>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-3 sm:px-6 pb-3 sm:pb-6">
              <ConsorcioGoalsMatrixTable rows={consorcioGoalsRows} />
            </CardContent>
          </Card>

          <TeamGoalsEditModal
            open={goalsEditModalOpen}
            onOpenChange={setGoalsEditModalOpen}
            existingTargets={consorcioTargets || []}
            buPrefix={BU_PREFIX}
          />
        </>
      )}

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-full sm:w-auto">
              <Button variant={datePreset === "today" ? "secondary" : "ghost"} size="sm" onClick={() => handlePresetChange("today")} className="flex-1 sm:flex-initial text-xs sm:text-sm">Hoje</Button>
              <Button variant={datePreset === "week" ? "secondary" : "ghost"} size="sm" onClick={() => handlePresetChange("week")} className="flex-1 sm:flex-initial text-xs sm:text-sm">Semana</Button>
              <Button variant={datePreset === "month" ? "secondary" : "ghost"} size="sm" onClick={() => handlePresetChange("month")} className="flex-1 sm:flex-initial text-xs sm:text-sm">Mês</Button>
              <Button variant={datePreset === "custom" ? "secondary" : "ghost"} size="sm" onClick={() => handlePresetChange("custom")} className="flex-1 sm:flex-initial text-xs sm:text-sm">Custom</Button>
            </div>

            {datePreset === "month" && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => handleMonthChange(-1)}>
                  <Calendar className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium min-w-[120px] text-center">
                  {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
                </span>
                <Button variant="outline" size="icon" onClick={() => handleMonthChange(1)}>
                  <Calendar className="h-4 w-4" />
                </Button>
              </div>
            )}

            {datePreset === "custom" && (
              <div className="flex items-center gap-2">
                <DatePickerCustom selected={customStartDate || undefined} onSelect={(date) => handleCustomStartChange(date as Date | null)} placeholder="Data início" />
                <span className="text-muted-foreground">até</span>
                <DatePickerCustom selected={customEndDate || undefined} onSelect={(date) => handleCustomEndChange(date as Date | null)} placeholder="Data fim" />
              </div>
            )}

            <PipelineSelector
              selectedPipelineId={selectedPipelineId}
              onSelectPipeline={setSelectedPipelineId}
              allowedGroupIds={allowedGroupIds}
            />

            <Select value={sdrFilter} onValueChange={setSdrFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filtrar por SDR" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os SDRs</SelectItem>
                {(activeSdrsList || []).map(sdr => (
                  <SelectItem key={sdr.email} value={sdr.email}>{sdr.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={isLoading} className="w-full sm:w-auto">
              <Download className="h-4 w-4 mr-1" />
              <span className="sm:inline">Exportar</span>
            </Button>
          </div>

          <div className="mt-3 text-xs text-muted-foreground">
            Período: {format(start, "dd/MM/yyyy")} - {format(end, "dd/MM/yyyy")}
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <TeamKPICards
        kpis={enrichedKPIs}
        isLoading={isLoading}
        isToday={datePreset === "today"}
        pendentesHoje={pendentesHojeConsorcio}
      />

      {/* SDR / Closer Summary Table with Tabs */}
      <Card className="bg-card border-border overflow-hidden">
        <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "sdrs" | "closers")}>
            <TabsList className="bg-muted/50 w-full sm:w-auto">
              <TabsTrigger value="sdrs" className="flex-1 sm:flex-initial flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                SDRs
                <span className="text-[10px] sm:text-xs text-muted-foreground">({filteredBySDR.length})</span>
              </TabsTrigger>
              <TabsTrigger value="closers" className="flex-1 sm:flex-initial flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <Briefcase className="h-3 w-3 sm:h-4 sm:w-4" />
                Closers
                <span className="text-[10px] sm:text-xs text-muted-foreground">({closerMetrics?.length || 0})</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="pt-0 px-0 sm:px-6 pb-3 sm:pb-6 overflow-x-auto">
          {activeTab === "sdrs" ? (
            <>
              <ConsorcioSdrSummaryTable
                data={filteredBySDR}
                isLoading={isLoading}
                disableNavigation={isRestrictedRole}
                sdrMetaMap={sdrMetaMap}
                diasUteisNoPeriodo={diasUteisNoPeriodo}
                propostasEnviadasBySdr={propostasData}
                propostasFechadasBySdr={produtosFechadosBySdr}
              />
              <div className="mt-6 px-0 sm:px-0">
                <SdrActivityMetricsTable startDate={start} endDate={end} squad="consorcio" />
              </div>
            </>
          ) : (
            <ConsorcioCloserSummaryTable
              data={closerMetrics}
              isLoading={closerLoading}
              propostasEnviadasByCloser={propostasData}
              propostasFechadasByCloser={produtosFechadosByCloser}
              onCloserClick={isRestrictedRole ? undefined : (closerId: string) => {
                const params = new URLSearchParams();
                params.set("preset", datePreset);
                if (datePreset === "month") {
                  params.set("month", format(selectedMonth, "yyyy-MM"));
                } else if (datePreset === "custom" && customStartDate && customEndDate) {
                  params.set("start", format(customStartDate, "yyyy-MM-dd"));
                  params.set("end", format(customEndDate, "yyyy-MM-dd"));
                }
                navigate(`/consorcio/painel-equipe/closer/${closerId}?${params.toString()}`);
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
