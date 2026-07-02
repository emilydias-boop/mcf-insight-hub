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
} from "lucide-react";
import { toast } from "sonner";
import {
  isDiaUtil, CONSORCIO_WEEK_STARTS_ON,
} from "@/lib/businessDays";
import { BIProgressGauge } from "@/components/consorcio/BIProgressGauge";
import { BITVMode } from "@/components/consorcio/BITVMode";
import { Tv } from "lucide-react";

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

  // === Meta ===
  const { data: metaRow, isLoading: metaLoading } = useQuery({
    queryKey: ["consorcio-bi-meta", monthRefISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consorcio_bi_metas")
        .select("id, meta_valor, month_ref, dias_uteis_override")
        .eq("month_ref", monthRefISO)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: tvMode ? 30000 : false,
  });
  const meta = Number(metaRow?.meta_valor ?? 0);

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  useEffect(() => { setEditValue(String(meta || "")); }, [meta]);

  const saveMeta = useMutation({
    mutationFn: async (valor: number) => {
      if (metaRow?.id) {
        const { error } = await supabase
          .from("consorcio_bi_metas")
          .update({ meta_valor: valor, updated_at: new Date().toISOString() })
          .eq("id", metaRow.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("consorcio_bi_metas")
          .insert({ month_ref: monthRefISO, meta_valor: valor, created_by: user?.id });
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
      </div>

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
          onClose={() => setTvMode(false)}
        />
      )}

      {/* Meta editor */}
      {editing && canEdit && (
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">Definir meta integral do mês</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
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
            <Button
              onClick={() => saveMeta.mutate(Number(editValue) || 0)}
              disabled={saveMeta.isPending}
            >
              Salvar
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
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