import { useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay, parseISO } from "date-fns";
import { parseYearMonthLocal, parseYmdLocal } from "@/lib/dateHelpers";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";
import { WEEK_STARTS_ON, contarDiasUteis, getWeekStartsOn } from "@/lib/businessDays";
import { useActiveBU } from "@/hooks/useActiveBU";
import { Calendar, Users, RefreshCw, Download, Building2, Briefcase } from "lucide-react";
import { SetorRow } from "@/components/dashboard/SetorRow";
import { useSetoresDashboard } from "@/hooks/useSetoresDashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { KpiDrillDownDialog, type KpiBucket } from "@/components/sdr/KpiDrillDownDialog";
import { TeamGoalsPanel } from "@/components/sdr/TeamGoalsPanel";
import { SdrSummaryTable } from "@/components/sdr/SdrSummaryTable";
import { CloserSummaryTable } from "@/components/sdr/CloserSummaryTable";
import { SdrActivityMetricsTable } from "@/components/sdr/SdrActivityMetricsTable";

import { useTeamMeetingsData, SdrSummaryRow } from "@/hooks/useTeamMeetingsData";

import { useR2MeetingSlotsKPIs } from "@/hooks/useR2MeetingSlotsKPIs";
import { useR2VendasKPIs } from "@/hooks/useR2VendasKPIs";
import { useR1CloserMetrics } from "@/hooks/useR1CloserMetrics";
import { useMeetingsPendentesHoje } from "@/hooks/useMeetingsPendentesHoje";
import { computePendentesBreakdown } from "@/lib/pendentesBreakdown";
import { usePendentesDrilldown } from "@/hooks/usePendentesDrilldown";
import { useSdrMeetingsFromAgenda } from "@/hooks/useSdrMeetingsFromAgenda";
import { useCloserBreakdownMetrics, averageRate } from "@/hooks/useCloserBreakdownMetrics";


import { useSdrsAll } from "@/hooks/useSdrFechamento";
import { useAuth } from "@/contexts/AuthContext";
import { useSdrsForSquadInPeriod } from "@/hooks/useSdrsForSquadInPeriod";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { BURevenueGoalsEditModal } from "@/components/sdr/BURevenueGoalsEditModal";
import { Settings2 } from "lucide-react";
import { MonthLockBanner } from "@/components/shared/MonthLockBanner";
import { toAnoMes } from "@/hooks/useMonthLock";

type DatePreset = "today" | "week" | "month" | "custom";

function IncorporadorMetricsCard({ onEditGoals, canEdit }: { onEditGoals?: () => void; canEdit?: boolean }) {
  const { data: setoresData, isLoading: setoresLoading } = useSetoresDashboard();
  const incorporadorSetor = setoresData?.setores.find(s => s.id === 'incorporador');

  if (!incorporadorSetor && !setoresLoading) return null;

  return (
    <div className="relative group">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary via-primary/60 to-primary rounded-xl blur opacity-30 group-hover:opacity-50 transition-opacity duration-300" />
      <div className="relative">
        <SetorRow
          titulo="MCF Incorporador"
          icone={Building2}
          semanaLabel={setoresData?.semanaLabel || 'Semana'}
          mesLabel={setoresData?.mesLabel || 'Mês'}
          apuradoSemanal={incorporadorSetor?.apuradoSemanal || 0}
          metaSemanal={incorporadorSetor?.metaSemanal || 0}
          apuradoMensal={incorporadorSetor?.apuradoMensal || 0}
          metaMensal={incorporadorSetor?.metaMensal || 0}
          apuradoAnual={incorporadorSetor?.apuradoAnual || 0}
          metaAnual={incorporadorSetor?.metaAnual || 0}
          isLoading={setoresLoading}
          onEditGoals={onEditGoals}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}

export default function ReunioesEquipe() {
  const { role } = useAuth();
  const activeBU = useActiveBU();
  const wso = getWeekStartsOn(activeBU);
  const navigate = useNavigate();
  const isRestrictedRole = role === 'sdr' || role === 'closer';
  const canEditGoals = !!role && ['admin', 'manager', 'coordenador'].includes(role);
  const [incorpGoalsOpen, setIncorpGoalsOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Initialize state from URL params
  const initialPreset = (searchParams.get("preset") as DatePreset) || "month";
  // Use local-timezone parsing to avoid UTC shift (parseISO("2026-04-01") becomes
  // March 31 in negative offsets / browsers in UTC). Mantém o mês/dia exatos do filtro
  // independente do fuso do navegador.
  const initialMonth = parseYearMonthLocal(searchParams.get("month")) ?? new Date();
  const initialStart = parseYmdLocal(searchParams.get("start"));
  const initialEnd = parseYmdLocal(searchParams.get("end")) ?? initialStart;

  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [datePreset, setDatePreset] = useState<DatePreset>(initialPreset);
  const [customStartDate, setCustomStartDate] = useState<Date | null>(initialStart);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(initialEnd || initialStart);
  const [sdrFilter, setSdrFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"sdrs" | "closers">("sdrs");
  const [drillBucket, setDrillBucket] = useState<KpiBucket | null>(null);
  const [drillTitle, setDrillTitle] = useState<string>("");

  // Sync state changes to URL
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

  // Calculate date range based on preset
  const getDateRange = () => {
    const today = new Date();
    switch (datePreset) {
      case "today":
        return { start: startOfDay(today), end: endOfDay(today) };
      case "week": {
        const todayNormalized = startOfDay(today);
        return { start: startOfWeek(todayNormalized, { weekStartsOn: wso }), end: endOfWeek(todayNormalized, { weekStartsOn: wso }) };
      }
      case "month":
        return { start: startOfMonth(selectedMonth), end: endOfMonth(selectedMonth) };
      case "custom": {
        const startCustom = customStartDate || startOfMonth(today);
        const endCustom = customEndDate || customStartDate || endOfMonth(today);
        // Ensure start <= end
        if (startCustom > endCustom) {
          return { start: endCustom, end: startCustom };
        }
        return { start: startCustom, end: endCustom };
      }
      default:
        return { start: startOfMonth(selectedMonth), end: endOfMonth(selectedMonth) };
    }
  };

  const { start, end } = getDateRange();

  // Today's dates for day metrics
  const today = new Date();
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);
  
  // Week dates for week metrics (sábado a sexta)
  const todayNormalized = startOfDay(today);
  const weekStartDate = startOfWeek(todayNormalized, { weekStartsOn: wso });
  const weekEndDate = endOfWeek(todayNormalized, { weekStartsOn: wso });

  // Month dates for month metrics
  const monthStartDate = startOfMonth(today);
  const monthEndDate = endOfMonth(today);

  // Fetch data with optional SDR filter
  const {
    teamKPIs,
    bySDR,
    allMeetings,
    allMeetingsRaw,
    isLoading,
    refetch,
  } = useTeamMeetingsData({
    startDate: start,
    endDate: end,
    sdrEmailFilter: sdrFilter !== "all" ? sdrFilter : undefined,
  });

  // Fetch day data for goals panel
  const { teamKPIs: dayKPIs } = useTeamMeetingsData({
    startDate: dayStart,
    endDate: dayEnd,
  });

  // Fetch week data for goals panel
  const { teamKPIs: weekKPIs } = useTeamMeetingsData({
    startDate: weekStartDate,
    endDate: weekEndDate,
  });


  // Fetch all SDRs for meta_diaria (fallback)
  const { data: allSdrsData } = useSdrsAll();
  
  // Fetch active SDRs from squad for dropdown and base dataset
  // Usa histórico de squad (sdr_squad_history) para incluir SDRs que pertenciam
  // ao squad durante o período selecionado, mesmo que hoje estejam inativos
  // ou em outro squad. Evita também mostrar contratações futuras em meses passados.
  const { data: sdrsInPeriod } = useSdrsForSquadInPeriod('incorporador', start, end);

  // Cross-check com user_roles para excluir quem tem cargo administrativo/closer
  // (ex.: Yanca foi promovida a admin, não deve aparecer como SDR).
  const sdrEmailsRaw = useMemo(
    () => (sdrsInPeriod || []).map(s => s.email?.toLowerCase()).filter(Boolean) as string[],
    [sdrsInPeriod]
  );
  const { data: nonSdrEmails } = useQuery({
    queryKey: ['non-sdr-emails-for-squad-period', sdrEmailsRaw],
    queryFn: async () => {
      if (sdrEmailsRaw.length === 0) return new Set<string>();
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('email', sdrEmailsRaw);
      const profileIds = (profiles || []).map(p => p.id);
      if (profileIds.length === 0) return new Set<string>();
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', profileIds)
        .in('role', ['admin', 'manager', 'coordenador', 'assistente_administrativo', 'closer', 'closer_sombra']);
      const blockedIds = new Set((roles || []).map(r => r.user_id));
      const blockedEmails = new Set<string>(
        (profiles || [])
          .filter(p => blockedIds.has(p.id))
          .map(p => p.email?.toLowerCase() || '')
      );
      return blockedEmails;
    },
    enabled: sdrEmailsRaw.length > 0,
    staleTime: 60000,
  });

  const activeSdrsList = useMemo(
    () => (sdrsInPeriod || [])
      .filter(s => !nonSdrEmails || !nonSdrEmails.has((s.email || '').toLowerCase()))
      .map(s => ({
        id: s.sdr_id,
        name: s.name,
        email: s.email,
        role_type: 'sdr' as string | null,
        meta_diaria: null as number | null,
      })),
    [sdrsInPeriod, nonSdrEmails]
  );

  // IDs dos SDRs ativos no período (precisa estar declarado antes dos hooks que dependem)
  const sdrIds = useMemo(() => (activeSdrsList || []).map(s => s.id), [activeSdrsList]);

  // Buscar planos de comp vigentes no mês do filtro para usar a meta configurada
  // no fechamento (meta_reunioes_agendadas) em vez da meta_diaria do cadastro do SDR.
  const monthStartIso = useMemo(() => format(startOfMonth(start), 'yyyy-MM-dd'), [start]);
  const { data: compPlansForPeriod } = useQuery({
    queryKey: ['sdr-comp-plans-for-period', monthStartIso, sdrIds],
    queryFn: async () => {
      if (!sdrIds || sdrIds.length === 0) return [] as any[];
      const { data, error } = await supabase
        .from('sdr_comp_plan')
        .select('sdr_id, meta_reunioes_agendadas, dias_uteis, vigencia_inicio, vigencia_fim')
        .in('sdr_id', sdrIds)
        .lte('vigencia_inicio', monthStartIso)
        .or(`vigencia_fim.is.null,vigencia_fim.gte.${monthStartIso}`)
        .order('vigencia_inicio', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: (sdrIds || []).length > 0 && !!monthStartIso,
    staleTime: 60000,
  });

  // Create sdrMetaMap: email -> meta diária EFETIVA (= meta_reunioes_agendadas / dias_uteis do plano).
  // Mantém pro-rata por admissão funcionando ao multiplicar por sdrDiasUteisMap na tabela.
  // Fallback: meta_diaria do cadastro do SDR (ou 10).
  const sdrMetaMap = useMemo(() => {
    const map = new Map<string, number>();
    const sdrIdToEmail = new Map<string, string>();
    (activeSdrsList || []).forEach(s => {
      if (s.email && s.id) sdrIdToEmail.set(s.id, s.email.toLowerCase());
    });

    // Pega o plano mais recente por sdr_id (ordenado desc por vigencia_inicio)
    const planBySdr = new Map<string, { meta: number | null; dias: number | null }>();
    (compPlansForPeriod || []).forEach((p: any) => {
      if (!p.sdr_id || planBySdr.has(p.sdr_id)) return;
      planBySdr.set(p.sdr_id, {
        meta: p.meta_reunioes_agendadas,
        dias: p.dias_uteis,
      });
    });

    planBySdr.forEach((plan, sdrId) => {
      const email = sdrIdToEmail.get(sdrId);
      if (!email) return;
      if (plan.meta && plan.dias && plan.dias > 0) {
        map.set(email, plan.meta / plan.dias);
      }
    });

    // Fallback para SDRs sem plano vigente: usa meta_diaria do cadastro.
    if (allSdrsData) {
      allSdrsData.forEach(sdr => {
        if (sdr.email && !map.has(sdr.email.toLowerCase())) {
          map.set(sdr.email.toLowerCase(), sdr.meta_diaria || 10);
        }
      });
    }
    return map;
  }, [compPlansForPeriod, allSdrsData, activeSdrsList]);

  // Calculate business days in the selected period
  const diasUteisNoPeriodo = useMemo(() => {
    return contarDiasUteis(start, end);
  }, [start, end]);

  // Fetch data_admissao from employees linked to active SDRs
  const { data: employeeAdmissaoData } = useQuery({
    queryKey: ['employee-admissao-for-sdrs', sdrIds],
    queryFn: async () => {
      if (sdrIds.length === 0) return [];
      const { data, error } = await supabase
        .from('employees')
        .select('sdr_id, data_admissao')
        .in('sdr_id', sdrIds)
        .not('data_admissao', 'is', null);
      if (error) throw error;
      return data || [];
    },
    enabled: sdrIds.length > 0,
    staleTime: 60000,
  });

  // Build sdrDiasUteisMap: email -> effective business days in period
  const sdrDiasUteisMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!employeeAdmissaoData || !activeSdrsList) return map;
    
    const sdrIdToEmail = new Map<string, string>();
    activeSdrsList.forEach(s => {
      if (s.email) sdrIdToEmail.set(s.id, s.email.toLowerCase());
    });

    employeeAdmissaoData.forEach(emp => {
      if (!emp.sdr_id || !emp.data_admissao) return;
      const email = sdrIdToEmail.get(emp.sdr_id);
      if (!email) return;
      
      const admissao = new Date(emp.data_admissao);
      if (admissao <= start) return; // Started before period, full days
      
      const inicioEfetivo = admissao > start ? admissao : start;
      const dias = contarDiasUteis(inicioEfetivo, end);
      map.set(email, dias);
    });
    return map;
  }, [employeeAdmissaoData, activeSdrsList, start, end]);

  // Fetch R2 agenda KPIs for today (from meeting_slots where meeting_type='r2')
  const { data: dayR2AgendaKPIs } = useR2MeetingSlotsKPIs(dayStart, dayEnd);

  // Fetch R2 agenda KPIs for the week
  const { data: weekR2AgendaKPIs } = useR2MeetingSlotsKPIs(weekStartDate, weekEndDate);

  // Fetch Vendas KPIs for today
  const { data: dayR2VendasKPIs } = useR2VendasKPIs(dayStart, dayEnd);

  // Fetch Vendas KPIs for the week
  const { data: weekR2VendasKPIs } = useR2VendasKPIs(weekStartDate, weekEndDate);

  // Fetch month data for goals panel
  const { teamKPIs: monthKPIs } = useTeamMeetingsData({
    startDate: monthStartDate,
    endDate: monthEndDate,
  });

  // Fetch R2 agenda KPIs for the month
  const { data: monthR2AgendaKPIs } = useR2MeetingSlotsKPIs(monthStartDate, monthEndDate);

  // Fetch Vendas KPIs for the month
  const { data: monthR2VendasKPIs } = useR2VendasKPIs(monthStartDate, monthEndDate);

  // Fetch Closer metrics for the selected period
  const { data: closerMetrics, isLoading: closerLoading } = useR1CloserMetrics(start, end);

  // Breakdown por closer (R1 recebida / realizada / no-shows / contratos)
  // — usado para a média individual entre Closers nos cards de Taxa.
  const { data: closerBreakdown } = useCloserBreakdownMetrics(start, end, "incorporador");

  // Fetch pending meetings for today (only used when preset is "today")
  const { data: pendentesHoje } = useMeetingsPendentesHoje('incorporador');

  // Chamada extra incluindo canceladas — usada apenas para o card
  // "Pendentes / Sem Desfecho" fechar a conta com R1 Agendada.
  const { data: meetingsWithCancelled } = useSdrMeetingsFromAgenda({
    startDate: start,
    endDate: end,
    sdrEmailFilter: sdrFilter !== "all" ? sdrFilter : undefined,
    buFilter: "incorporador",
    includeCancelled: true,
  });

  // Fetch Outside metrics for the selected period
  

  // Calculate contract totals from closerMetrics (source of truth - deduplicated, consistent with Closer table)
  const contractsFromClosers = useMemo(() => {
    const contratoPago = closerMetrics?.reduce((sum, c) => sum + c.contrato_pago, 0) || 0;
    const outside = closerMetrics?.reduce((sum, c) => sum + c.outside, 0) || 0;
    return { contratoPago, outside, total: contratoPago + outside };
  }, [closerMetrics]);

  // Derive ALL R1 KPIs from closerMetrics (source of truth — same data as Closers table)
  const r1FromClosers = useMemo(() => {
    const r1Agendada = closerMetrics?.reduce((sum, c) => sum + c.r1_agendada, 0) || 0;
    const r1Realizada = closerMetrics?.reduce((sum, c) => sum + c.r1_realizada, 0) || 0;
    const noShows = closerMetrics?.reduce((sum, c) => sum + c.noshow, 0) || 0;
    const r2Agendada = closerMetrics?.reduce((sum, c) => sum + c.r2_agendada, 0) || 0;
    return { r1Agendada, r1Realizada, noShows, r2Agendada };
  }, [closerMetrics]);

  // ============================================================
  // Breakdown SDR/Closer das taxas (média individual)
  // ============================================================
  const taxaBreakdowns = useMemo(() => {
    // Média entre SDRs — usa bySDR (já agregado pelo hook)
    const sdrRows = bySDR || [];
    const sdrConversao = averageRate(
      sdrRows.map((s) => ({
        numerator: s.contratos || 0,
        denominator: s.r1Realizada || 0,
      })),
    );
    const sdrNoShow = averageRate(
      sdrRows.map((s) => ({
        numerator: s.noShows || 0,
        denominator: s.r1Agendada || 0,
      })),
    );

    // Média entre Closers — usa o breakdown novo
    const closerRows = closerBreakdown?.closers || [];
    const closerConversao = averageRate(
      closerRows.map((c) => ({
        numerator: c.contratos,
        denominator: c.r1_realizada,
      })),
    );
    const closerNoShow = averageRate(
      closerRows.map((c) => ({
        numerator: c.no_shows,
        denominator: c.r1_recebida,
      })),
    );

    return {
      conversao: { sdrAvg: sdrConversao, closerAvg: closerConversao },
      noShow: { sdrAvg: sdrNoShow, closerAvg: closerNoShow },
    };
  }, [bySDR, closerBreakdown]);

  // Janela é "futura" quando o end_date >= hoje (controla rótulo de Sem Status)
  const isFutureWindow = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const e = new Date(end);
    e.setHours(0, 0, 0, 0);
    return e.getTime() >= today.getTime();
  }, [end]);

  // Create base dataset with all SDRs (zeros) for "today" preset
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

  // Merge real data with base dataset for "today" preset
  const mergedBySDR = useMemo((): SdrSummaryRow[] => {
    const dataMap = new Map(allSdrsWithZeros.map(s => [s.sdrEmail, { ...s }]));
    
    // Overwrite with real data where it exists
    bySDR.forEach(realRow => {
      if (dataMap.has(realRow.sdrEmail)) {
        dataMap.set(realRow.sdrEmail, realRow);
      }
    });

    // Sort: agendamentos desc, r1Realizada desc, sdrName asc
    return Array.from(dataMap.values()).sort((a, b) => {
      if (b.agendamentos !== a.agendamentos) return b.agendamentos - a.agendamentos;
      if (b.r1Realizada !== a.r1Realizada) return b.r1Realizada - a.r1Realizada;
      return a.sdrName.localeCompare(b.sdrName);
    });
  }, [allSdrsWithZeros, bySDR]);

  // Filter bySDR based on sdrFilter and datePreset
  const filteredBySDR = useMemo(() => {
    // Use merged data (all SDRs) for "today", otherwise use real data only
    const baseData = datePreset === "today" ? mergedBySDR : bySDR;

    // Restringe pela lista de SDRs válidos do squad NO PERÍODO selecionado.
    // Isso evita que SDRs admitidos APÓS o período (ex.: Andre/Nicola em abril)
    // apareçam em meses anteriores caso tenham agendamentos atribuídos a eles
    // por transferência/replicação. Também aplica o cross-check de role
    // (admins/managers/closers excluídos via activeSdrsList).
    const allowedEmails = new Set(
      (activeSdrsList || [])
        .map(s => (s.email || '').toLowerCase())
        .filter(Boolean)
    );
    const restricted = allowedEmails.size > 0
      ? baseData.filter(s => allowedEmails.has((s.sdrEmail || '').toLowerCase()))
      : baseData;

    if (sdrFilter === "all") return restricted;
    return restricted.filter(s => s.sdrEmail === sdrFilter);
  }, [datePreset, mergedBySDR, bySDR, sdrFilter, activeSdrsList]);

  // Enrich teamKPIs: somado a partir de filteredBySDR (mesmo array exibido na
  // tabela de SDRs) para garantir que o card e o total da tabela batam exatamente.
  // Antes usávamos teamKPIs cru, que incluía SDRs ex-squad/admins/managers fora
  // do recorte oficial e inflava os KPIs.
  // Métricas financeiras (contratos/outside) continuam vindo do closer (verdade contábil).
  const enrichedKPIs = useMemo(() => {
    const totalAgendamentos = filteredBySDR.reduce((s, r) => s + (r.agendamentos || 0), 0);
    const totalR1Agendada = filteredBySDR.reduce((s, r) => s + (r.r1Agendada || 0), 0);
    const totalRealizadas = filteredBySDR.reduce((s, r) => s + (r.r1Realizada || 0), 0);
    const totalNoShows = filteredBySDR.reduce((s, r) => s + (r.noShows || 0), 0);
    const totalSemStatus = filteredBySDR.reduce((s, r) => s + (r.semStatus || 0), 0);
    return {
      ...teamKPIs,
      sdrCount: filteredBySDR.length,
      totalAgendamentos,
      totalR1Agendada,
      totalRealizadas,
      totalNoShows,
      totalSemStatus,
      totalContratos: contractsFromClosers.contratoPago,
      totalOutside: contractsFromClosers.outside,
      taxaNoShow: totalR1Agendada > 0
        ? (totalNoShows / totalR1Agendada) * 100
        : 0,
      taxaConversao: totalRealizadas > 0
        ? (contractsFromClosers.total / totalRealizadas) * 100
        : 0,
    };
  }, [teamKPIs, contractsFromClosers, filteredBySDR]);

  // Values for goals panel - UNIFICADO: usa teamKPIs para consistência (filtrado por SDR_LIST)
  // R1 Agendada = Realizadas + NoShows + Pendentes (todas que foram marcadas)
  // Isso garante que GoalsPanel e TeamKPICards mostrem os mesmos números
  const dayPendentes = pendentesHoje ?? 0;

  // Breakdown REAL de Pendentes (a partir das reuniões já deduplicadas que
  // alimentam o drill-down). Substitui o cálculo aritmético inflado.
  // Filtra pelas SDRs válidas do squad (mesmo recorte do KPI R1 Agendada
  // exibido na tela), para fechar a aritmética
  // Realizada + No-Show + Pendente == R1 Agendada.
  const allowedSdrEmailsForBreakdown = useMemo(() => {
    return new Set(
      (activeSdrsList || [])
        .map(s => (s.email || '').toLowerCase())
        .filter(Boolean)
    );
  }, [activeSdrsList]);

  const meetingsForBreakdown = useMemo(() => {
    if (!meetingsWithCancelled) return [];
    if (allowedSdrEmailsForBreakdown.size === 0) return meetingsWithCancelled;
    return meetingsWithCancelled.filter(m => {
      const sdr = (m.current_owner || m.intermediador || '').toLowerCase();
      return allowedSdrEmailsForBreakdown.has(sdr);
    });
  }, [meetingsWithCancelled, allowedSdrEmailsForBreakdown]);

  const pendentesBreakdown = useMemo(
    () => computePendentesBreakdown(meetingsForBreakdown, start, end),
    [meetingsForBreakdown, start, end],
  );

  // Total de Pendentes vindo direto do RPC (R1 Agendada - Realizadas - No-Shows).
  // Usa o mesmo recorte (filteredBySDR) dos outros KPIs do topo, garantindo que
  // Realizadas + No-Show + Pendentes = R1 Agendada exatamente.
  // Os sub-buckets (futuras/vencidas/canceladas) continuam vindo do breakdown
  // local, mas o total exibido respeita a aritmética do RPC.
  const pendentesTotalRpc = useMemo(
    () => filteredBySDR.reduce((sum, r) => sum + (r.pendentes || 0), 0),
    [filteredBySDR],
  );

  // Reconcilia o breakdown: se o total local for menor que o do RPC, joga a
  // diferença em "vencidas" (cenário mais comum: reuniões antigas sem desfecho
  // que foram excluídas do hook por status fora do filtro padrão).
  const pendentesBreakdownReconciled = useMemo(() => {
    const diff = pendentesTotalRpc - pendentesBreakdown.total;
    if (diff <= 0) return pendentesBreakdown;
    return {
      ...pendentesBreakdown,
      vencidas: pendentesBreakdown.vencidas + diff,
      total: pendentesTotalRpc,
    };
  }, [pendentesBreakdown, pendentesTotalRpc]);

  // Drill-down completo de Pendentes (inclui no-shows acima do cap), usado
  // pelo modal para listar TODOS os leads contabilizados no KPI.
  const { data: pendentesDrilldownData } = usePendentesDrilldown({
    startDate: start,
    endDate: end,
    sdrEmailFilter: sdrFilter !== "all" ? sdrFilter : undefined,
    buFilter: "incorporador",
    enabled: drillBucket === "pendentes",
  });
  
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
    contrato: contractsFromClosers.total,
    r2Agendada: monthR2AgendaKPIs?.r2Agendadas || 0,
    r2Realizada: monthR2AgendaKPIs?.r2Realizadas || 0,
    vendaRealizada: monthR2VendasKPIs?.vendasRealizadas || 0,
  }), [monthKPIs, monthR2AgendaKPIs, monthR2VendasKPIs, contractsFromClosers]);

  // Handlers that sync with URL
  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    updateUrlParams(preset, selectedMonth, customStartDate, customEndDate);
  };

  // Month navigation
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

  // Export to Excel function - contextual based on active tab
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    if (activeTab === "closers" && closerMetrics) {
      // Aba Closers: exportar resumo por Closer
      const closerData = closerMetrics.map(c => ({
        "Closer": c.closer_name,
        "R1 Agendada": c.r1_agendada,
        "R1 Realizada": c.r1_realizada,
        "No-Show": c.noshow,
        "Contrato Pago": c.contrato_pago,
        "Outside": c.outside,
        "R2 Agendada": c.r2_agendada,
        "Taxa Conversão": c.r1_realizada > 0 ? `${((c.contrato_pago / c.r1_realizada) * 100).toFixed(1)}%` : "0%",
        "Taxa No-Show": c.r1_agendada > 0 ? `${((c.noshow / c.r1_agendada) * 100).toFixed(1)}%` : "0%",
      }));
      const wsClosers = XLSX.utils.json_to_sheet(closerData);
      XLSX.utils.book_append_sheet(wb, wsClosers, "Resumo Closers");
      XLSX.writeFile(wb, `painel_closers_${format(start, "yyyyMMdd")}_${format(end, "yyyyMMdd")}.xlsx`);
    } else {
      // Aba SDRs: exportar resumo por SDR + leads detalhados
      const resumoData = filteredBySDR.map(sdr => ({
        "SDR": sdr.sdrName,
        "Agendamento": sdr.agendamentos,
        "R1 Agendada": sdr.r1Agendada,
        "R1 Realizada": sdr.r1Realizada,
        "No-Show": sdr.noShows,
        "Contrato PAGO": sdr.contratos,
      }));

      const leadsData = allMeetings
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

      const wsResumo = XLSX.utils.json_to_sheet(resumoData);
      const wsLeads = XLSX.utils.json_to_sheet(leadsData);
      XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo SDR");
      XLSX.utils.book_append_sheet(wb, wsLeads, "Leads Detalhados");
      XLSX.writeFile(wb, `painel_sdr_${format(start, "yyyyMMdd")}_${format(end, "yyyyMMdd")}.xlsx`);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6">
      {/* MCF Incorporador - Métricas Monetárias - PRIMEIRO */}
      <IncorporadorMetricsCard
        onEditGoals={() => setIncorpGoalsOpen(true)}
        canEdit={canEditGoals}
      />

      <BURevenueGoalsEditModal
        open={incorpGoalsOpen}
        onOpenChange={setIncorpGoalsOpen}
        title="MCF Incorporador"
        sections={[{ prefix: "setor_incorporador", label: "Incorporador" }]}
      />

      {/* Goals Panel */}
      <TeamGoalsPanel dayValues={dayValues} weekValues={weekValues} monthValues={monthValues} />

      {/* Trava de fechamento mensal */}
      <MonthLockBanner anoMes={toAnoMes(start)} />

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
            {/* Date Preset Buttons */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-full sm:w-auto">
              <Button
                variant={datePreset === "today" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => handlePresetChange("today")}
                className="flex-1 sm:flex-initial text-xs sm:text-sm"
              >
                Hoje
              </Button>
              <Button
                variant={datePreset === "week" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => handlePresetChange("week")}
                className="flex-1 sm:flex-initial text-xs sm:text-sm"
              >
                Semana
              </Button>
              <Button
                variant={datePreset === "month" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => handlePresetChange("month")}
                className="flex-1 sm:flex-initial text-xs sm:text-sm"
              >
                Mês
              </Button>
              <Button
                variant={datePreset === "custom" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => handlePresetChange("custom")}
                className="flex-1 sm:flex-initial text-xs sm:text-sm"
              >
                Custom
              </Button>
            </div>

            {/* Month Selector (when month preset) */}
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

            {/* Custom Date Range */}
            {datePreset === "custom" && (
              <div className="flex items-center gap-2">
                <DatePickerCustom
                  selected={customStartDate || undefined}
                  onSelect={(date) => handleCustomStartChange(date as Date | null)}
                  placeholder="Data início"
                />
                <span className="text-muted-foreground">até</span>
                <DatePickerCustom
                  selected={customEndDate || undefined}
                  onSelect={(date) => handleCustomEndChange(date as Date | null)}
                  placeholder="Data fim"
                />
              </div>
            )}

            {/* SDR Filter */}
            <Select value={sdrFilter} onValueChange={setSdrFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder={activeTab === "closers" ? "Filtrar por Closer" : "Filtrar por SDR"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{activeTab === "closers" ? "Todos os Closers" : "Todos os SDRs"}</SelectItem>
                {(activeSdrsList || []).map(sdr => (
                  <SelectItem key={sdr.email} value={sdr.email}>
                    {sdr.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  refetch();
                  setLastRefresh(new Date());
                }}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={isLoading}
              >
                <Download className="h-4 w-4 mr-1" />
                Exportar
              </Button>
            </div>
          </div>

          {/* Active period display + last refresh */}
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>Período: {format(start, "dd/MM/yyyy")} - {format(end, "dd/MM/yyyy")}</span>
            <span>Atualizado às {format(lastRefresh, "HH:mm")}</span>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards - SDR tab uses teamKPIs (SDR perspective), Closers tab uses enrichedKPIs (closer perspective) */}
      <TeamKPICards 
        kpis={enrichedKPIs} 
        isLoading={isLoading}
        isToday={datePreset === "today"}
        pendentesHoje={pendentesHoje}
        bu="incorporador"
        semStatus={enrichedKPIs.totalSemStatus || 0}
        pendentesBreakdown={pendentesBreakdownReconciled}
        isFutureWindow={isFutureWindow}
        taxaConversaoBreakdown={taxaBreakdowns.conversao}
        taxaNoShowBreakdown={taxaBreakdowns.noShow}
        onCardClick={(bucket, title) => {
          setDrillBucket(bucket);
          setDrillTitle(title);
        }}
      />

      <KpiDrillDownDialog
        open={drillBucket !== null}
        onOpenChange={(o) => { if (!o) setDrillBucket(null); }}
        bucket={drillBucket}
        title={drillTitle}
        meetings={allMeetings}
        meetingsRaw={drillBucket === "pendentes" ? meetingsWithCancelled : allMeetingsRaw}
        startDate={start}
        endDate={end}
        pendentesOverride={pendentesDrilldownData}
      />

      {/* SDR / Closer Summary Table with Tabs */}
      <Card className="bg-card border-border overflow-hidden">
        <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "sdrs" | "closers")}>
            <TabsList className="bg-muted/50 w-full sm:w-auto">
              <TabsTrigger value="sdrs" className="flex-1 sm:flex-initial flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                SDRs
                <span className="text-[10px] sm:text-xs text-muted-foreground">
                  ({filteredBySDR.length})
                </span>
              </TabsTrigger>
              <TabsTrigger value="closers" className="flex-1 sm:flex-initial flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <Briefcase className="h-3 w-3 sm:h-4 sm:w-4" />
                Closers
                <span className="text-[10px] sm:text-xs text-muted-foreground">
                  ({closerMetrics?.length || 0})
                </span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="pt-0 px-0 sm:px-6 pb-3 sm:pb-6 overflow-x-auto">
          {activeTab === "sdrs" ? (
            <SdrSummaryTable
              data={filteredBySDR}
              isLoading={isLoading}
              disableNavigation={isRestrictedRole}
              sdrMetaMap={sdrMetaMap}
              diasUteisNoPeriodo={diasUteisNoPeriodo}
              sdrDiasUteisMap={sdrDiasUteisMap}
              totaisOverride={{
                agendamentos: enrichedKPIs.totalAgendamentos,
                r1Agendada: enrichedKPIs.totalR1Agendada,
                r1Realizada: enrichedKPIs.totalRealizadas,
                noShows: enrichedKPIs.totalNoShows,
                contratos: enrichedKPIs.totalContratos,
              }}
            />
          ) : (
            <CloserSummaryTable
              data={closerMetrics}
              isLoading={closerLoading}
              totalContratosFromKPI={contractsFromClosers.total}
              onCloserClick={isRestrictedRole ? undefined : (closerId: string) => {
                const params = new URLSearchParams();
                params.set("preset", datePreset);
                if (datePreset === "month") {
                  params.set("month", format(selectedMonth, "yyyy-MM"));
                } else if (datePreset === "custom" && customStartDate && customEndDate) {
                  params.set("start", format(customStartDate, "yyyy-MM-dd"));
                  params.set("end", format(customEndDate, "yyyy-MM-dd"));
                }
                navigate(`/crm/reunioes-equipe/closer/${closerId}?${params.toString()}`);
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Tabela de Atividades por SDR */}
      {activeTab === "sdrs" && (
        <SdrActivityMetricsTable
          startDate={start}
          endDate={end}
          originId={undefined}
        />
      )}
    </div>
  );
}
