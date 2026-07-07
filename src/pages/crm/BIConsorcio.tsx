import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  startOfMonth, endOfMonth, endOfWeek, format,
  eachWeekOfInterval, eachDayOfInterval, isWithinInterval, parseISO, max, min,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Target, TrendingUp, CalendarDays, Wallet, Trophy, Pencil,
  CheckCircle2, AlertCircle, Sparkles, Info, RotateCcw,
  Tv, Copy, Check, Download, QrCode, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  isDiaUtil, CONSORCIO_WEEK_STARTS_ON,
} from "@/lib/businessDays";
import { BIProgressGauge } from "@/components/consorcio/BIProgressGauge";
import { BITVMode } from "@/components/consorcio/BITVMode";
import { CampaignCarousel } from "@/components/consorcio/CampaignCarousel";
import { CampaignManagerDialog } from "@/components/consorcio/CampaignManagerDialog";
import { useConsorcioRealizadoByCloser } from "@/hooks/useConsorcioRealizadoByCloser";
import { Users } from "lucide-react";

const ALLOWED_EDITORS = [
  "thobson.motta@minhacasafinanciada.com",
  "jessica.bellini@minhacasafinanciada.com",
  "jessica.bellini.r2@minhacasafinanciada.com",
];

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function BIConsorcio() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canEdit = !!user?.email && ALLOWED_EDITORS.includes(user.email.toLowerCase());

  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const monthRefISO = format(monthStart, "yyyy-MM-dd");
  const [tvMode, setTvMode] = useState(false);
  const [previewCampaign, setPreviewCampaign] = useState(false);
  const [manageCampaign, setManageCampaign] = useState(false);

  // === Meta ===
  const { data: metaRow, isLoading: metaLoading } = useQuery({
    queryKey: ["consorcio-bi-meta", monthRefISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consorcio_bi_metas")
        .select("id, meta_valor, month_ref, dias_uteis_override, closer_targets")
        .eq("month_ref", monthRefISO)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: tvMode ? 30000 : false,
  });
  const meta = Number(metaRow?.meta_valor ?? 0);
  const closerTargets: Record<string, number> =
    (metaRow as any)?.closer_targets && typeof (metaRow as any).closer_targets === "object"
      ? ((metaRow as any).closer_targets as Record<string, number>)
      : {};

  // === Closers do Consórcio ===
  const { data: consorcioClosers } = useQuery({
    queryKey: ["consorcio-closers-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("closers")
        .select("id, name, email, color")
        .eq("is_active", true)
        .eq("bu", "consorcio")
        .in("id", [
          "1472d772-a48b-4c88-ba07-398898532df4", // Andre dos Santos Duarte
          "4e3eabf5-149f-4130-ad8b-72fa929671f6", // João Pedro Martins Vieira
        ])
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: realizadoByCloser } = useConsorcioRealizadoByCloser(monthStart, monthEnd);

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [editPct, setEditPct] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  useEffect(() => { setEditValue(String(meta || "")); }, [meta]);
  useEffect(() => {
    const init: Record<string, string> = {};
    (consorcioClosers || []).forEach((c) => {
      const v = closerTargets[c.id];
      init[c.id] = v != null ? String(v) : "";
    });
    setEditPct(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consorcioClosers, metaRow?.id]);

  const saveMeta = useMutation({
    mutationFn: async ({ valor, targets }: { valor: number; targets: Record<string, number> }) => {
      if (metaRow?.id) {
        const { error } = await supabase
          .from("consorcio_bi_metas")
          .update({ meta_valor: valor, closer_targets: targets as any, updated_at: new Date().toISOString() })
          .eq("id", metaRow.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("consorcio_bi_metas")
          .insert({ month_ref: monthRefISO, meta_valor: valor, closer_targets: targets as any, created_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Meta atualizada");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["consorcio-bi-meta", monthRefISO] });
    },
    onError: (e: any) => toast.error("Erro ao salvar meta: " + e.message),
  });

  const pctSum = Object.values(editPct).reduce((a, v) => a + (Number(v) || 0), 0);
  const handleSaveMeta = () => {
    const targets: Record<string, number> = {};
    Object.entries(editPct).forEach(([id, v]) => {
      const n = Number(v);
      if (n > 0) targets[id] = n;
    });
    saveMeta.mutate({ valor: Number(editValue) || 0, targets });
  };

  // === Dias úteis com override editável ===
  const todosDiasMes = useMemo(
    () => eachDayOfInterval({ start: monthStart, end: monthEnd }),
    [monthRefISO]
  );
  const diasPadraoISO = useMemo(
    () => todosDiasMes.filter(isDiaUtil).map((d) => format(d, "yyyy-MM-dd")),
    [todosDiasMes]
  );
  const overrideISO: string[] | null = Array.isArray((metaRow as any)?.dias_uteis_override)
    ? ((metaRow as any).dias_uteis_override as string[])
    : null;
  const diasConsideradosISO = overrideISO ?? diasPadraoISO;
  const diasConsideradosSet = useMemo(() => new Set(diasConsideradosISO), [diasConsideradosISO]);

  const saveDias = useMutation({
    mutationFn: async (novosDias: string[] | null) => {
      if (metaRow?.id) {
        const { error } = await supabase
          .from("consorcio_bi_metas")
          .update({ dias_uteis_override: novosDias as any, updated_at: new Date().toISOString() })
          .eq("id", metaRow.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("consorcio_bi_metas")
          .insert({
            month_ref: monthRefISO,
            meta_valor: 0,
            dias_uteis_override: novosDias as any,
            created_by: user?.id,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Dias considerados atualizados");
      qc.invalidateQueries({ queryKey: ["consorcio-bi-meta", monthRefISO] });
    },
    onError: (e: any) => toast.error("Erro ao salvar dias: " + e.message),
  });

  const toggleDia = (iso: string) => {
    const base = new Set(diasConsideradosISO);
    if (base.has(iso)) base.delete(iso);
    else base.add(iso);
    saveDias.mutate(Array.from(base).sort());
  };

  // === Cartas fechadas (propostas) do mês ===
  const { data: propostas, isLoading: propLoading } = useQuery({
    queryKey: ["consorcio-bi-propostas", monthRefISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consorcio_proposals")
        .select("id, valor_credito, proposal_date, created_at")
        .gte("created_at", monthStart.toISOString())
        .lte("created_at", monthEnd.toISOString());
      if (error) throw error;
      return data || [];
    },
    refetchInterval: tvMode ? 30000 : false,
  });

  const diasUteisMes = diasConsideradosISO.length;
  const metaDia = diasUteisMes > 0 ? meta / diasUteisMes : 0;

  // Semanas do mês (segunda a domingo)
  const semanas = useMemo(() => {
    const raw = eachWeekOfInterval(
      { start: monthStart, end: monthEnd },
      { weekStartsOn: CONSORCIO_WEEK_STARTS_ON as 1 }
    );
    return raw.map((wStart, i) => {
      const wEnd = endOfWeek(wStart, { weekStartsOn: CONSORCIO_WEEK_STARTS_ON as 1 });
      const clampedStart = max([wStart, monthStart]);
      const clampedEnd = min([wEnd, monthEnd]);
      const dias = eachDayOfInterval({ start: clampedStart, end: clampedEnd }).filter((d) =>
        diasConsideradosSet.has(format(d, "yyyy-MM-dd"))
      ).length;
      return {
        index: i + 1,
        start: clampedStart,
        end: clampedEnd,
        diasUteis: dias,
        metaSemana: dias * metaDia,
      };
    });
  }, [monthRefISO, metaDia, diasConsideradosSet]);

  // Realizado por semana + total
  const { realizadoTotal, realizadoPorSemana, realizadoHoje } = useMemo(() => {
    const list = propostas || [];
    let total = 0;
    let hoje = 0;
    const bySem: number[] = semanas.map(() => 0);
    const todayStr = format(today, "yyyy-MM-dd");
    for (const p of list) {
      const v = Number(p.valor_credito || 0);
      if (!v) continue;
      const dRaw = p.proposal_date || p.created_at;
      if (!dRaw) continue;
      const d = typeof dRaw === "string" && dRaw.length === 10 ? parseISO(dRaw) : new Date(dRaw);
      if (isNaN(d.getTime())) continue;
      if (!isWithinInterval(d, { start: monthStart, end: monthEnd })) continue;
      total += v;
      if (format(d, "yyyy-MM-dd") === todayStr) hoje += v;
      const idx = semanas.findIndex(s => isWithinInterval(d, { start: s.start, end: s.end }));
      if (idx >= 0) bySem[idx] += v;
    }
    return { realizadoTotal: total, realizadoPorSemana: bySem, realizadoHoje: hoje };
  }, [propostas, semanas, monthRefISO]);

  const progressoMes = meta > 0 ? Math.min(100, (realizadoTotal / meta) * 100) : 0;
  const faltaMes = Math.max(0, meta - realizadoTotal);

  const semanaAtualIdx = semanas.findIndex(s =>
    isWithinInterval(today, { start: s.start, end: s.end })
  );

  const loading = metaLoading || propLoading;

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-primary" />
            BI Consórcio
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Meta de {format(monthStart, "MMMM 'de' yyyy", { locale: ptBR })} — fracionada em dias úteis, semanas e mês.
          </p>
        </div>
        {canEdit && !editing && (
          <Button variant="outline" onClick={() => setEditing(true)} className="gap-2">
            <Pencil className="h-4 w-4" /> Editar meta do mês
          </Button>
        )}
        <Button
          onClick={() => setTvMode(true)}
          className="gap-2 bg-[#bfff00] text-black hover:bg-[#bfff00]/90 font-bold shadow-[0_0_20px_-4px_rgba(191,255,0,0.6)]"
        >
          <Tv className="h-4 w-4" /> Modo TV
        </Button>
        <Button
          variant="outline"
          onClick={() => setPreviewCampaign(true)}
          className="gap-2"
        >
          <Sparkles className="h-4 w-4" /> Prévia Campanha
        </Button>
        {canEdit && (
          <Button variant="outline" onClick={() => setManageCampaign(true)} className="gap-2">
            <Trophy className="h-4 w-4" /> Gerenciar Campanha
          </Button>
        )}
      </div>

      {previewCampaign && <CampaignCarousel onClose={() => setPreviewCampaign(false)} />}
      <CampaignManagerDialog open={manageCampaign} onOpenChange={setManageCampaign} />


      {tvMode && (
        <BITVMode
          meta={meta}
          realizado={realizadoTotal}
          realizadoHoje={realizadoHoje}
          metaDia={metaDia}
          diasUteis={diasUteisMes}
          monthStart={monthStart}
          semanas={semanas.map((s, i) => ({
            index: s.index,
            metaSemana: s.metaSemana,
            realizado: realizadoPorSemana[i] || 0,
            isCurrent: i === semanaAtualIdx,
            diasUteis: s.diasUteis,
            start: s.start,
            end: s.end,
          }))}
          closers={(consorcioClosers || [])
            .filter((c) => (closerTargets[c.id] || 0) > 0)
            .map((c) => ({
              id: c.id,
              name: c.name,
              color: c.color,
              metaIndividual: (Number(closerTargets[c.id] || 0) / 100) * meta,
              realizado: realizadoByCloser?.get(c.id) || 0,
            }))}
          onClose={() => setTvMode(false)}
        />
      )}

      {/* Meta editor */}
      {editing && canEdit && (
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">Definir meta integral do mês</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[240px]">
                <label className="text-xs text-muted-foreground">Valor total (R$)</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder="Ex: 5000000"
                />
              </div>
            </div>

            <div className="rounded-md border border-border/60 bg-background/60 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  % da meta por closer
                </p>
                <span
                  className={
                    "text-xs font-mono " +
                    (Math.abs(pctSum - 100) < 0.01
                      ? "text-success"
                      : pctSum > 100
                      ? "text-destructive"
                      : "text-muted-foreground")
                  }
                >
                  Soma: {pctSum.toFixed(1)}%
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {(consorcioClosers || []).map((c) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <span className="flex-1 text-sm truncate">{c.name}</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      className="w-24 h-8 text-right"
                      placeholder="0"
                      value={editPct[c.id] ?? ""}
                      onChange={(e) =>
                        setEditPct((prev) => ({ ...prev, [c.id]: e.target.value }))
                      }
                    />
                    <span className="text-xs text-muted-foreground w-4">%</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                A % define a meta individual (% × meta do mês). O realizado é calculado pelas
                propostas lançadas por cada closer no mês.
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSaveMeta} disabled={saveMeta.isPending}>
                Salvar
              </Button>
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : (
        <>
          {/* KPIs principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              icon={<Target className="h-5 w-5" />}
              label="Meta do mês"
              value={fmtBRL(meta)}
              hint={`${diasUteisMes} dias úteis`}
              accent="primary"
            />
            <KpiCard
              icon={<Wallet className="h-5 w-5" />}
              label="Meta por dia útil"
              value={fmtBRL(metaDia)}
              hint={`${diasUteisMes} dias considerados`}
              accent="muted"
              extra={
                <DiasUteisPopover
                  todosDias={todosDiasMes}
                  consideradosSet={diasConsideradosSet}
                  canEdit={canEdit}
                  onToggle={toggleDia}
                  onReset={() => saveDias.mutate(null)}
                  isOverride={!!overrideISO}
                  saving={saveDias.isPending}
                />
              }
            />
            <KpiCard
              icon={<TrendingUp className="h-5 w-5" />}
              label="Realizado no mês"
              value={fmtBRL(realizadoTotal)}
              hint={`${progressoMes.toFixed(1)}% da meta`}
              accent={progressoMes >= 100 ? "success" : "primary"}
            />
            <KpiCard
              icon={faltaMes === 0 ? <Trophy className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
              label={faltaMes === 0 ? "Meta batida" : "Falta atingir"}
              value={fmtBRL(faltaMes)}
              hint={faltaMes === 0 ? "parabéns" : `hoje: ${fmtBRL(realizadoHoje)}`}
              accent={faltaMes === 0 ? "success" : "danger"}
            />
          </div>

          {/* Gauge visual BI */}
          <BIProgressGauge
            meta={meta}
            realizado={realizadoTotal}
            semanas={semanas.map((s, i) => ({
              index: s.index,
              metaSemana: s.metaSemana,
              realizado: realizadoPorSemana[i] || 0,
              isCurrent: i === semanaAtualIdx,
            }))}
          />

          {/* Progresso do mês */}
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  Progresso mensal
                </CardTitle>
                <span className="text-sm font-semibold">
                  {fmtBRL(realizadoTotal)} <span className="text-muted-foreground">/ {fmtBRL(meta)}</span>
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <Progress value={progressoMes} className="h-4" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>{progressoMes.toFixed(1)}% concluído</span>
                <span>100%</span>
              </div>
            </CardContent>
          </Card>

          {/* Semanas */}
          <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Semanas do mês
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {semanas.map((s, i) => {
                const real = realizadoPorSemana[i] || 0;
                const pct = s.metaSemana > 0 ? Math.min(100, (real / s.metaSemana) * 100) : 0;
                const falta = Math.max(0, s.metaSemana - real);
                const isCurrent = i === semanaAtualIdx;
                const bateu = real >= s.metaSemana && s.metaSemana > 0;
                return (
                  <Card
                    key={i}
                    className={
                      "relative overflow-hidden transition-all hover:shadow-lg " +
                      (isCurrent ? "border-primary shadow-[0_0_24px_-8px_hsl(var(--primary)/0.5)]" : "")
                    }
                  >
                    {isCurrent && (
                      <div className="absolute top-2 right-2 text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                        Agora
                      </div>
                    )}
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold">
                          Semana {s.index}
                        </CardTitle>
                        {bateu && <CheckCircle2 className="h-4 w-4 text-success" />}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(s.start, "dd/MM")} → {format(s.end, "dd/MM")} · {s.diasUteis} dias úteis
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Meta</span>
                          <span className="font-mono">{fmtBRL(s.metaSemana)}</span>
                        </div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Realizado</span>
                          <span className="font-mono font-semibold">{fmtBRL(real)}</span>
                        </div>
                        <Progress
                          value={pct}
                          className="h-2.5"
                          indicatorClassName={bateu ? "bg-success" : ""}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1 border-t">
                        <span className="text-muted-foreground">
                          {bateu ? "Meta batida" : "Falta"}
                        </span>
                        <span className={"font-mono font-semibold " + (bateu ? "text-success" : "text-destructive")}>
                          {bateu ? "🏆" : fmtBRL(falta)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Metas individuais por closer */}
          {(consorcioClosers || []).some((c) => (closerTargets[c.id] || 0) > 0) && (
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Metas individuais dos closers
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {(consorcioClosers || [])
                  .filter((c) => (closerTargets[c.id] || 0) > 0)
                  .map((c) => {
                    const pct = Number(closerTargets[c.id] || 0);
                    const metaCloser = (meta * pct) / 100;
                    const real = realizadoByCloser?.get(c.id) || 0;
                    const prog = metaCloser > 0 ? Math.min(100, (real / metaCloser) * 100) : 0;
                    const falta = Math.max(0, metaCloser - real);
                    const bateu = metaCloser > 0 && real >= metaCloser;
                    return (
                      <Card key={c.id} className="overflow-hidden hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-semibold truncate">
                              {c.name}
                            </CardTitle>
                            {bateu && <Trophy className="h-4 w-4 text-success" />}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {pct.toFixed(1)}% da meta do mês
                          </p>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                              <span>Meta</span>
                              <span className="font-mono">{fmtBRL(metaCloser)}</span>
                            </div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-muted-foreground">Realizado</span>
                              <span className="font-mono font-semibold">{fmtBRL(real)}</span>
                            </div>
                            <Progress
                              value={prog}
                              className="h-2.5"
                              indicatorClassName={bateu ? "bg-success" : ""}
                            />
                            <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                              <span>0%</span>
                              <span>{prog.toFixed(1)}%</span>
                              <span>100%</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs pt-1 border-t">
                            <span className="text-muted-foreground">
                              {bateu ? "Meta batida" : "Falta"}
                            </span>
                            <span
                              className={
                                "font-mono font-semibold " +
                                (bateu ? "text-success" : "text-destructive")
                              }
                            >
                              {bateu ? "🏆" : fmtBRL(falta)}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </div>
          )}

          {!canEdit && (
            <p className="text-xs text-muted-foreground text-center">
              Somente Thobson e Jéssica Bellini podem alterar a meta.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function KpiCard({
  icon, label, value, hint, accent, extra,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  accent?: "primary" | "success" | "danger" | "muted";
  extra?: React.ReactNode;
}) {
  const styles: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    danger: "bg-destructive/10 text-destructive",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <Card className="hover:shadow-md transition-shadow overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className={"p-2.5 rounded-lg " + (styles[accent || "primary"])}>{icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
              {extra}
            </div>
            <p className="text-2xl font-bold mt-1 truncate">{value}</p>
            {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DiasUteisPopover({
  todosDias, consideradosSet, canEdit, onToggle, onReset, isOverride, saving,
}: {
  todosDias: Date[];
  consideradosSet: Set<string>;
  canEdit: boolean;
  onToggle: (iso: string) => void;
  onReset: () => void;
  isOverride: boolean;
  saving: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:text-primary transition-colors"
          aria-label="Ver e editar dias considerados"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-sm font-semibold">Dias considerados no cálculo</p>
            <p className="text-[11px] text-muted-foreground">
              {canEdit
                ? "Marque/desmarque dias (ex.: inclua sábados)."
                : "Somente editores autorizados podem alterar."}
            </p>
          </div>
          {canEdit && isOverride && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 gap-1 text-[11px]"
              onClick={onReset}
              disabled={saving}
            >
              <RotateCcw className="h-3 w-3" /> Padrão
            </Button>
          )}
        </div>
        <ScrollArea className="h-64 pr-2">
          <div className="space-y-1">
            {todosDias.map((d) => {
              const iso = format(d, "yyyy-MM-dd");
              const checked = consideradosSet.has(iso);
              const label = format(d, "EEE, dd/MM", { locale: ptBR });
              return (
                <label
                  key={iso}
                  className={
                    "flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer hover:bg-muted " +
                    (checked ? "text-foreground" : "text-muted-foreground")
                  }
                >
                  <Checkbox
                    checked={checked}
                    disabled={!canEdit || saving}
                    onCheckedChange={() => onToggle(iso)}
                  />
                  <span className="capitalize">{label}</span>
                </label>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function TVLauncherCard({
  copied,
  setCopied,
}: {
  copied: boolean;
  setCopied: (v: boolean) => void;
}) {
  const shortUrl = "https://mcfgestao.com/tv";
  const fullUrl = "https://mcfgestao.com/bi/consorcio?k=c6009ecc80511bdf3cec8ec7f8debc1308c0";

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const downloadExtension = () => {
    fetch("/mcf-tv-launcher.zip")
      .then((res) => {
        if (!res.ok) throw new Error(`Download failed: ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "mcf-tv-launcher.zip";
        a.click();
        URL.revokeObjectURL(a.href);
        toast.success("Extensão baixada. Descompacte e carregue em chrome://extensions");
      })
      .catch((err) => toast.error(err.message));
  };

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-[#bfff00]/5 to-transparent overflow-hidden">
      <CardContent className="p-5">
        <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-[#bfff00] text-black">
                <Tv className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold">Abrir na TV sem digitar</h3>
                <p className="text-xs text-muted-foreground">
                  Três opções rápidas para colocar o dashboard na televisão.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href={shortUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#bfff00] text-black font-bold text-sm hover:opacity-90"
              >
                <ExternalLink className="h-4 w-4" /> Abrir /tv
              </a>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => copy(shortUrl)}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copiado" : "Copiar /tv"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={downloadExtension}
              >
                <Download className="h-4 w-4" /> Extensão Chrome
              </Button>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                <strong className="text-foreground">URL curta:</strong>{" "}
                <code className="bg-muted px-1 py-0.5 rounded">{shortUrl}</code>{" "}
                (digite uma vez no navegador da TV e salve como favorito)
              </p>
              <p>
                <strong className="text-foreground">Chrome:</strong> baixe a extensão, descompacte, abra{" "}
                <code className="bg-muted px-1 py-0.5 rounded">chrome://extensions</code>{" "}
                com modo de desenvolvedor e clique em "Carregar sem compactação".
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="text-center space-y-1">
              <QrCode className="h-4 w-4 mx-auto text-muted-foreground" />
              <img
                src="/qr-tv-short.png"
                alt="QR code para abrir TV MCF"
                className="w-28 h-28 rounded-lg border border-border bg-white"
                loading="lazy"
              />
              <p className="text-[10px] text-muted-foreground">Escaneie para abrir /tv</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}