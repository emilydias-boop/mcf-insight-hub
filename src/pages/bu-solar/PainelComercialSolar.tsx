import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { endOfMonth, endOfWeek, format, parseISO, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  Briefcase,
  Calendar,
  CalendarCheck,
  CheckCircle,
  FileCheck2,
  Settings2,
  Sun,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TeamKPICards, type TeamKpiCardDefinition } from "@/components/sdr/TeamKPICards";
import { TeamCommercialFilters, type TeamCommercialDatePreset } from "@/components/sdr/TeamCommercialFilters";
import {
  SolarCloserSummaryTable,
  SolarSdrSummaryTable,
  type SolarCloserRow,
  type SolarSdrRow,
} from "@/components/sdr/SolarSummaryTable";
import { useBUPipelineMap } from "@/hooks/useBUPipelineMap";
import { CONSORCIO_WEEK_STARTS_ON } from "@/lib/businessDays";

type Numeric = number | string;
interface Meta {
  meta_valor: number | null;
  meta_agendamento_dia: number | null;
  closer_targets: Record<string, number> | null;
}
interface SolarPanelResponse {
  totais: {
    agendamentos: Numeric;
    agendadas: Numeric;
    realizadas: Numeric;
    no_show: Numeric;
    pendentes_futuras: Numeric;
    pendentes_vencidas: Numeric;
    remarcadas: Numeric;
    vendas: Numeric;
    contratos_pagos: Numeric;
    valor_registrado: Numeric;
  };
  meta: Meta | null;
  sdrs: SolarSdrRow[];
  closers: SolarCloserRow[];
  fonte_vendas: string;
}

const numberValue = (value: Numeric | null | undefined) => Number(value ?? 0);

export default function PainelComercialSolar() {
  const { role } = useAuth();
  const canEdit = !!role && ["admin", "manager", "coordenador"].includes(role);
  const queryClient = useQueryClient();
  const [datePreset, setDatePreset] = useState<TeamCommercialDatePreset>("month");
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [sdrFilter, setSdrFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"sdrs" | "closers">("sdrs");
  const [metaOpen, setMetaOpen] = useState(false);
  const { data: buMapping } = useBUPipelineMap("solar");
  const allowedGroupIds = buMapping?.groups || [];

  const { start, end } = useMemo(() => {
    const today = new Date();
    if (datePreset === "today") return { start: startOfDay(today), end: startOfDay(today) };
    if (datePreset === "week") return {
      start: startOfWeek(today, { weekStartsOn: CONSORCIO_WEEK_STARTS_ON }),
      end: endOfWeek(today, { weekStartsOn: CONSORCIO_WEEK_STARTS_ON }),
    };
    if (datePreset === "custom") {
      const customStart = customStartDate || startOfMonth(today);
      const customEnd = customEndDate || customStartDate || endOfMonth(today);
      return customStart > customEnd
        ? { start: customEnd, end: customStart }
        : { start: customStart, end: customEnd };
    }
    return { start: startOfMonth(selectedMonth), end: endOfMonth(selectedMonth) };
  }, [customEndDate, customStartDate, datePreset, selectedMonth]);

  const pFrom = format(start, "yyyy-MM-dd");
  const pTo = format(end, "yyyy-MM-dd");
  const { data, isLoading, error } = useQuery({
    queryKey: ["painel-comercial-solar", pFrom, pTo],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("painel_comercial_solar", { p_from: pFrom, p_to: pTo });
      if (error) throw error;
      return data as SolarPanelResponse;
    },
    staleTime: 30000,
  });

  const sdrs = useMemo(
    () => (data?.sdrs ?? []).filter((sdr) => sdrFilter === "all" || (sdr.sdr_id ?? "unassigned") === sdrFilter),
    [data?.sdrs, sdrFilter],
  );
  const closers = data?.closers ?? [];
  const totals = data?.totais;
  const meta = data?.meta ?? null;
  const pendentes = numberValue(totals?.pendentes_futuras) + numberValue(totals?.pendentes_vencidas);
  const realizadas = numberValue(totals?.realizadas);
  const agendadas = numberValue(totals?.agendadas);
  const vendas = numberValue(totals?.vendas);
  const noShows = numberValue(totals?.no_show);
  const percentage = (value: number, base: number) => base > 0 ? `${((value / base) * 100).toFixed(1)}%` : "—";

  const kpiCards: TeamKpiCardDefinition[] = [
    { title: "Agendamentos", value: numberValue(totals?.agendamentos), icon: Calendar, color: "text-blue-500", bgColor: "bg-blue-500/10", tooltip: "Agendamentos criados no período." },
    { title: "Reuniões Agendadas", value: agendadas, icon: CalendarCheck, color: "text-cyan-500", bgColor: "bg-cyan-500/10", tooltip: "Reuniões R1 marcadas para o período." },
    { title: "Reuniões Realizadas", value: realizadas, icon: CheckCircle, color: "text-green-500", bgColor: "bg-green-500/10", tooltip: "Reuniões R1 realizadas no período." },
    { title: "No-shows", value: noShows, icon: XCircle, color: "text-red-500", bgColor: "bg-red-500/10", tooltip: "Faltas registradas na agenda no período." },
    { title: "Pendentes", value: pendentes, icon: AlertTriangle, color: "text-yellow-500", bgColor: "bg-yellow-500/10", tooltip: "Reuniões futuras, vencidas sem desfecho e remarcadas.", subline: `${numberValue(totals?.pendentes_futuras)} futuras · ${numberValue(totals?.pendentes_vencidas)} vencidas · ${numberValue(totals?.remarcadas)} reman.` },
    { title: "Vendas Realizadas", value: vendas, icon: Sun, color: "text-lime-500", bgColor: "bg-lime-500/10", tooltip: "Negócios que entraram na etapa Venda realizada no período." },
    { title: "Contrato Pago", value: numberValue(totals?.contratos_pagos), icon: FileCheck2, color: "text-amber-500", bgColor: "bg-amber-500/10", tooltip: "Negócios que entraram na etapa Contrato Pago no período. Não são somados às vendas." },
    { title: "Conversão", value: percentage(vendas, realizadas), icon: TrendingUp, color: "text-purple-500", bgColor: "bg-purple-500/10", tooltip: "Vendas Realizadas ÷ Reuniões Realizadas × 100." },
    { title: "Taxa de No-show", value: percentage(noShows, agendadas), icon: AlertTriangle, color: "text-orange-500", bgColor: "bg-orange-500/10", tooltip: "No-shows ÷ Reuniões Agendadas × 100." },
  ];

  const handleMonthChange = (increment: number) => {
    const next = new Date(selectedMonth);
    next.setMonth(next.getMonth() + increment);
    setSelectedMonth(next);
  };

  const exportData = () => {
    const rows = [
      ["SDR", "Fora da BU", "Meta agend./dia", "Agendamentos", "Reuniões agendadas", "Realizadas", "No-show", "Pendentes", "Vendas"],
      ...sdrs.map((sdr) => [sdr.name, sdr.na_bu ? "" : "sim", meta?.meta_agendamento_dia ?? "sem meta", numberValue(sdr.agendamentos), numberValue(sdr.agendadas), numberValue(sdr.realizadas), numberValue(sdr.no_show), numberValue(sdr.pendentes), numberValue(sdr.vendas)]),
      [],
      ["Closer", "Ativo", "Agendadas", "Realizadas", "No-show", "Pendentes", "Vendas"],
      ...closers.map((closer) => [closer.name, closer.is_active ? "sim" : "não", numberValue(closer.agendadas), numberValue(closer.realizadas), numberValue(closer.no_show), numberValue(closer.pendentes), numberValue(closer.vendas)]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `painel-solar-${pFrom}_${pTo}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6">
      <Card className="bg-card border-border">
        <CardContent className="p-3 sm:p-4">
          <TeamCommercialFilters
            datePreset={datePreset}
            selectedMonth={selectedMonth}
            start={start}
            end={end}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
            selectedPipelineId={selectedPipelineId}
            allowedGroupIds={allowedGroupIds}
            sdrFilter={sdrFilter}
            sdrOptions={(data?.sdrs ?? []).map((sdr) => ({ value: sdr.sdr_id ?? "unassigned", label: sdr.name }))}
            isLoading={isLoading}
            onPresetChange={setDatePreset}
            onMonthChange={handleMonthChange}
            onCustomStartChange={(date) => { setCustomStartDate(date); setDatePreset("custom"); }}
            onCustomEndChange={(date) => { setCustomEndDate(date); setDatePreset("custom"); }}
            onSelectPipeline={setSelectedPipelineId}
            onSdrFilterChange={setSdrFilter}
            onExport={exportData}
          />
          {canEdit && (
            <div className="mt-3 flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => setMetaOpen(true)}>
                <Settings2 className="h-4 w-4 mr-1" /> Metas
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
      <TeamKPICards
        kpis={{ sdrCount: 0, totalAgendamentos: 0, totalRealizadas: 0, totalNoShows: 0, totalContratos: 0, totalOutside: 0, totalR1Agendada: 0, taxaConversao: 0, taxaNoShow: 0 }}
        isLoading={isLoading}
        bu="solar"
        customCards={kpiCards}
      />

      <Card className="bg-card border-border overflow-hidden">
        <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "sdrs" | "closers")}>
            <TabsList className="bg-muted/50 w-full sm:w-auto">
              <TabsTrigger value="sdrs" className="flex-1 sm:flex-initial flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <Users className="h-3 w-3 sm:h-4 sm:w-4" /> SDRs
                <span className="text-[10px] sm:text-xs text-muted-foreground">({sdrs.length})</span>
              </TabsTrigger>
              <TabsTrigger value="closers" className="flex-1 sm:flex-initial flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <Briefcase className="h-3 w-3 sm:h-4 sm:w-4" /> Closers
                <span className="text-[10px] sm:text-xs text-muted-foreground">({closers.length})</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="pt-0 px-0 sm:px-6 pb-3 sm:pb-6 overflow-x-auto">
          {activeTab === "sdrs" ? (
            <SolarSdrSummaryTable data={sdrs} isLoading={isLoading} metaAgendamentoDia={meta?.meta_agendamento_dia ?? null} />
          ) : (
            <SolarCloserSummaryTable data={closers} isLoading={isLoading} closerTargets={meta?.closer_targets ?? null} />
          )}
        </CardContent>
      </Card>

      {canEdit && (
        <MetaDialog
          open={metaOpen}
          onOpenChange={setMetaOpen}
          monthRef={format(startOfMonth(start), "yyyy-MM-dd")}
          meta={meta}
          closers={closers}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["painel-comercial-solar"] })}
        />
      )}
    </div>
  );
}

function MetaDialog({ open, onOpenChange, monthRef, meta, closers, onSaved }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monthRef: string;
  meta: Meta | null;
  closers: SolarCloserRow[];
  onSaved: () => void;
}) {
  const [valor, setValor] = useState("");
  const [agendamentoDia, setAgendamentoDia] = useState("");
  const [closerTargets, setCloserTargets] = useState<Record<string, string>>({});
  const [loadedMonth, setLoadedMonth] = useState<string | null>(null);
  if (open && loadedMonth !== monthRef) {
    setLoadedMonth(monthRef);
    setValor(meta?.meta_valor != null ? String(meta.meta_valor) : "");
    setAgendamentoDia(meta?.meta_agendamento_dia != null ? String(meta.meta_agendamento_dia) : "");
    setCloserTargets(Object.fromEntries(Object.entries(meta?.closer_targets ?? {}).map(([key, value]) => [key, String(value)])));
  }
  const save = useMutation({
    mutationFn: async () => {
      const targets = Object.fromEntries(Object.entries(closerTargets).filter(([, value]) => value !== "").map(([key, value]) => [key, Number(value)]));
      const { error } = await (supabase as any).from("solar_bi_metas").upsert({
        month_ref: monthRef,
        meta_valor: valor === "" ? null : Number(valor),
        meta_agendamento_dia: agendamentoDia === "" ? null : Number(agendamentoDia),
        closer_targets: targets,
      }, { onConflict: "month_ref" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Metas salvas"); onSaved(); onOpenChange(false); setLoadedMonth(null); },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { onOpenChange(nextOpen); if (!nextOpen) setLoadedMonth(null); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Metas Solar — {format(parseISO(monthRef), "MMMM/yyyy", { locale: ptBR })}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Meta de valor (R$)</Label><Input type="number" value={valor} onChange={(event) => setValor(event.target.value)} /></div>
          <div><Label>Meta de agendamento por dia</Label><Input type="number" value={agendamentoDia} onChange={(event) => setAgendamentoDia(event.target.value)} /></div>
          {closers.filter((closer) => closer.is_active).map((closer) => (
            <div key={closer.closer_id}><Label>Meta de vendas — {closer.name}</Label><Input type="number" value={closerTargets[closer.closer_id] ?? ""} onChange={(event) => setCloserTargets({ ...closerTargets, [closer.closer_id]: event.target.value })} /></div>
          ))}
        </div>
        <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}