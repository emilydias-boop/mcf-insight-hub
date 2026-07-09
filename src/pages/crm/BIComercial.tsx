import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  endOfMonth, endOfWeek, eachWeekOfInterval, eachDayOfInterval,
  isWithinInterval, parseISO, max, min, format, startOfMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Target, TrendingUp, CalendarDays, Wallet, Trophy,
  CheckCircle2, AlertCircle, Sparkles, Tv, Pencil,
  Users, Award, TrendingDown,
} from "lucide-react";
import { toast } from "sonner";
import { BITVMode } from "@/components/consorcio/BITVMode";

// Token público de Incorporador (seed em bi_public_tokens)
const PUBLIC_TOKEN = "i9f42a8c1de5b7c30a9e4b6d8f2103bc7e5a9";
const WEEK_STARTS_ON = 6 as const; // Sáb → Sex

const ALLOWED_EDITORS = [
  "thobson.motta@minhacasafinanciada.com",
  "jessica.bellini@minhacasafinanciada.com",
  "jessica.bellini.r2@minhacasafinanciada.com",
];

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function BIComercial() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canEdit = !!user?.email && ALLOWED_EDITORS.includes(user.email.toLowerCase());
  const [tvMode, setTvMode] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  const monthRefISO = format(startOfMonth(new Date()), "yyyy-MM-dd");

  const { data: metaRow } = useQuery({
    queryKey: ["incorporador-bi-meta", monthRefISO],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("incorporador_bi_metas")
        .select("id, meta_valor, month_ref")
        .eq("month_ref", monthRefISO)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: tvMode ? 30_000 : false,
  });

  useEffect(() => { setEditValue(String(metaRow?.meta_valor ?? "")); }, [metaRow]);

  const saveMeta = useMutation({
    mutationFn: async (valor: number) => {
      if (metaRow?.id) {
        const { error } = await (supabase as any)
          .from("incorporador_bi_metas")
          .update({ meta_valor: valor, updated_at: new Date().toISOString() })
          .eq("id", metaRow.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("incorporador_bi_metas")
          .insert({ month_ref: monthRefISO, meta_valor: valor, created_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Meta atualizada");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["incorporador-bi-meta", monthRefISO] });
      qc.invalidateQueries({ queryKey: ["bi-incorporador-runtime"] });
    },
    onError: (e: any) => toast.error("Erro ao salvar meta: " + e.message),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["bi-incorporador-runtime"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_bi_public_incorporador", { _token: PUBLIC_TOKEN });
      if (error) throw error;
      return data as any;
    },
    refetchInterval: tvMode ? 30_000 : 60_000,
  });

  const { data: rankings } = useQuery({
    queryKey: ["bi-incorporador-weekly-rankings", monthRefISO],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_bi_incorporador_weekly_rankings", { _month_ref: monthRefISO });
      if (error) throw error;
      return data as { month_ref: string; weeks: WeeklyRankingRow[] };
    },
    refetchInterval: tvMode ? 60_000 : 120_000,
  });

  const rankingsByWeekStart = useMemo(() => {
    const map = new Map<string, WeeklyRankingRow>();
    (rankings?.weeks || []).forEach((w) => map.set(w.week_start, w));
    return map;
  }, [rankings]);

  const view = useMemo(() => {
    if (!data || data.error) return null;
    const monthStart = parseISO(data.month_ref);
    const monthEnd = endOfMonth(monthStart);
    const today = new Date();
    const meta = Number(data.meta_mes || 0);
    const totalDias = eachDayOfInterval({ start: monthStart, end: monthEnd }).length;
    const metaDia = totalDias > 0 ? meta / totalDias : 0;

    const rawSem = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { weekStartsOn: WEEK_STARTS_ON });
    const semanas = rawSem.map((wStart, i) => {
      const wEnd = endOfWeek(wStart, { weekStartsOn: WEEK_STARTS_ON });
      const start = max([wStart, monthStart]);
      const end = min([wEnd, monthEnd]);
      const dias = eachDayOfInterval({ start, end }).length;
      return { index: i + 1, start, end, diasUteis: dias, metaSemana: dias * metaDia };
    });

    const todayStr = format(today, "yyyy-MM-dd");
    let realizado = 0, realizadoHoje = 0;
    const bySem = semanas.map(() => 0);
    for (const row of (data.daily || []) as Array<{ d: string; v: string }>) {
      const v = Number(row.v || 0);
      const d = parseISO(row.d);
      realizado += v;
      if (row.d === todayStr) realizadoHoje += v;
      const idx = semanas.findIndex(s => isWithinInterval(d, { start: s.start, end: s.end }));
      if (idx >= 0) bySem[idx] += v;
    }
    const semanaAtualIdx = semanas.findIndex(s => isWithinInterval(today, { start: s.start, end: s.end }));
    const metaSemana = Number(data.meta_semana || 0);
    const metaAno = Number(data.meta_ano || 0);
    const apuradoSemana = Number(data.apurado_semana || 0);
    const apuradoAno = Number(data.apurado_ano || 0);

    return {
      meta, realizado, realizadoHoje, metaDia, totalDias, monthStart,
      semanas: semanas.map((s, i) => ({
        ...s,
        realizado: bySem[i] || 0,
        isCurrent: i === semanaAtualIdx,
      })),
      metaSemana, metaAno, apuradoSemana, apuradoAno,
    };
  }, [data]);

  if (isLoading || !view) {
    return (
      <div className="space-y-4 p-2">
        <Skeleton className="h-12 w-72" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  const progresso = view.meta > 0 ? Math.min(100, (view.realizado / view.meta) * 100) : 0;
  const falta = Math.max(0, view.meta - view.realizado);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-7 w-7" style={{ color: "#ff7a00" }} />
            BI Comercial — Incorporador
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {format(view.monthStart, "MMMM 'de' yyyy", { locale: ptBR })} · valores do card MCF Incorporador (semana Sáb→Sex).
          </p>
        </div>
        {canEdit && !editing && (
          <Button variant="outline" onClick={() => setEditing(true)} className="gap-2">
            <Pencil className="h-4 w-4" /> Editar meta do mês
          </Button>
        )}
        <Button
          onClick={() => setTvMode(true)}
          className="gap-2 font-bold text-black hover:opacity-90"
          style={{ backgroundColor: "#ff7a00", boxShadow: "0 0 20px -4px rgba(255,122,0,0.6)" }}
        >
          <Tv className="h-4 w-4" /> Modo TV
        </Button>
      </div>

      {editing && canEdit && (
        <Card className="border-2" style={{ borderColor: "#ff7a00", background: "rgba(255,122,0,0.05)" }}>
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
              <p className="text-[11px] text-muted-foreground mt-1">
                O valor é distribuído automaticamente por dia, semana (Sáb→Sex) e replicado no Modo TV.
              </p>
            </div>
            <Button
              onClick={() => saveMeta.mutate(Number(editValue) || 0)}
              disabled={saveMeta.isPending}
              style={{ backgroundColor: "#ff7a00", color: "#000" }}
            >
              Salvar
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
          </CardContent>
        </Card>
      )}

      {tvMode && (
        <BITVMode
          meta={view.meta}
          realizado={view.realizado}
          realizadoHoje={view.realizadoHoje}
          metaDia={view.metaDia}
          diasUteis={view.totalDias}
          monthStart={view.monthStart}
          semanas={view.semanas.map(s => ({
            index: s.index, metaSemana: s.metaSemana, realizado: s.realizado,
            isCurrent: s.isCurrent, diasUteis: s.diasUteis, start: s.start, end: s.end,
          }))}
          onClose={() => setTvMode(false)}
          accent="orange"
          title="MCF · BI Comercial ao vivo · Incorporador"
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard icon={<Target className="h-5 w-5" />} label="Meta do mês" value={fmtBRL(view.meta)} hint={`${view.totalDias} dias corridos`} />
        <KpiCard icon={<Wallet className="h-5 w-5" />} label="Meta por dia" value={fmtBRL(view.metaDia)} hint="mês fracionado" />
        <KpiCard icon={<TrendingUp className="h-5 w-5" />} label="Realizado no mês" value={fmtBRL(view.realizado)} hint={`${progresso.toFixed(1)}% da meta`} />
        <KpiCard
          icon={falta === 0 ? <Trophy className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          label={falta === 0 ? "Meta batida" : "Falta atingir"}
          value={fmtBRL(falta)}
          hint={falta === 0 ? "parabéns" : `hoje: ${fmtBRL(view.realizadoHoje)}`}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MiniPeriodo label="Semana atual" meta={view.metaSemana} real={view.apuradoSemana} />
        <MiniPeriodo label="Mês" meta={view.meta} real={view.realizado} />
        <MiniPeriodo label="Ano" meta={view.metaAno} real={view.apuradoAno} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-5 w-5" style={{ color: "#ff7a00" }} />
            Progresso mensal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Progress value={progresso} className="h-4" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span>{progresso.toFixed(1)}% concluído</span>
            <span>100%</span>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <CalendarDays className="h-5 w-5" style={{ color: "#ff7a00" }} />
          Semanas do mês (Sáb → Sex)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {view.semanas.map((s) => {
            const pct = s.metaSemana > 0 ? Math.min(100, (s.realizado / s.metaSemana) * 100) : 0;
            const bateu = s.realizado >= s.metaSemana && s.metaSemana > 0;
            const wkKey = format(s.start, "yyyy-MM-dd");
            const rk = rankingsByWeekStart.get(wkKey);
            return (
              <Card key={s.index} className={s.isCurrent ? "border-2" : ""} style={s.isCurrent ? { borderColor: "#ff7a00" } : undefined}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">Semana {s.index}</CardTitle>
                    {bateu && <CheckCircle2 className="h-4 w-4 text-success" />}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(s.start, "dd/MM")} → {format(s.end, "dd/MM")} · {s.diasUteis} dias
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Meta</span>
                    <span className="font-mono">{fmtBRL(s.metaSemana)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Realizado</span>
                    <span className="font-mono font-semibold">{fmtBRL(s.realizado)}</span>
                  </div>
                  <Progress value={pct} className="h-2" />
                  <div className="text-right text-xs font-bold">{pct.toFixed(0)}%</div>

                  <WeeklyRefundBlock rk={rk} />
                  <WeeklyRankingBlock title="Top 5 SDRs (contratos intermediados)" icon={<Users className="h-3.5 w-3.5" />} items={rk?.top_sdrs || []} limit={5} />
                  <WeeklyRankingBlock title="Top 3 Closers (contratos vendidos)" icon={<Award className="h-3.5 w-3.5" />} items={rk?.top_closers || []} limit={3} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type RankingItem = { sdr_id?: string; closer_id?: string; name: string; contratos: number; valor: number };
type WeeklyRankingRow = {
  week_start: string;
  vendas_valor: number;
  vendas_qtd: number;
  reembolsos_valor: number;
  reembolsos_qtd: number;
  saldo: number;
  top_sdrs: RankingItem[];
  top_closers: RankingItem[];
};

function WeeklyRefundBlock({ rk }: { rk: WeeklyRankingRow | undefined }) {
  const vendasQtd = rk?.vendas_qtd ?? 0;
  const vendasVal = rk?.vendas_valor ?? 0;
  const refQtd = rk?.reembolsos_qtd ?? 0;
  const refVal = rk?.reembolsos_valor ?? 0;
  const saldo = vendasVal - refVal;
  return (
    <div className="rounded-md border border-border/60 bg-muted/30 p-2 space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1 text-muted-foreground">
          <TrendingUp className="h-3 w-3 text-success" /> Vendas
        </span>
        <span className="font-mono font-semibold">{vendasQtd} · {fmtBRL(vendasVal)}</span>
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1 text-muted-foreground">
          <TrendingDown className="h-3 w-3 text-destructive" /> Reembolsos
        </span>
        <span className="font-mono font-semibold text-destructive">
          {refQtd} · {refVal > 0 ? `- ${fmtBRL(refVal)}` : fmtBRL(0)}
        </span>
      </div>
      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/60">
        <span className="font-medium">Saldo</span>
        <span className={`font-mono font-bold ${saldo >= 0 ? "text-success" : "text-destructive"}`}>
          {fmtBRL(saldo)}
        </span>
      </div>
    </div>
  );
}

function WeeklyRankingBlock({
  title, icon, items, limit,
}: { title: string; icon: React.ReactNode; items: RankingItem[]; limit: number }) {
  const list = (items || []).slice(0, limit);
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        {icon}<span>{title}</span>
      </div>
      {list.length === 0 ? (
        <div className="text-[11px] text-muted-foreground/70 italic">Sem contratos nesta semana</div>
      ) : (
        <ol className="space-y-0.5">
          {list.map((it, idx) => (
            <li key={(it.sdr_id || it.closer_id || it.name) + idx} className="flex items-center justify-between text-[11px]">
              <span className="truncate max-w-[70%]">
                <span className="inline-block w-4 text-muted-foreground">{idx + 1}º</span>
                {it.name}
              </span>
              <span className="font-mono font-semibold">
                {it.contratos} · <span className="text-muted-foreground">{fmtBRL(it.valor)}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-2">
          {icon}<span>{label}</span>
        </div>
        <div className="text-2xl font-black tabular-nums">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function MiniPeriodo({ label, meta, real }: { label: string; meta: number; real: number }) {
  const pct = meta > 0 ? Math.min(100, (real / meta) * 100) : 0;
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="flex items-baseline justify-between">
          <div className="text-xl font-black tabular-nums">{fmtBRL(real)}</div>
          <div className="text-xs text-muted-foreground">de {fmtBRL(meta)}</div>
        </div>
        <Progress value={pct} className="h-2" />
        <div className="text-right text-xs font-bold">{pct.toFixed(1)}%</div>
      </CardContent>
    </Card>
  );
}
