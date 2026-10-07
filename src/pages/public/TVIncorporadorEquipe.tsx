import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TVShell, TVMsg, Metric } from "@/components/public/TVTeamShared";
import { TVSdrRankingBlock, TVSdrRankingRow } from "@/components/public/TVSdrRankingBlock";
import { TVCloserRankingBlock, TVCloserRankingRow } from "@/components/public/TVCloserRankingBlock";
import { TVLigacaoRankingBlock, TVLigacaoRankingRow } from "@/components/public/TVLigacaoRankingBlock";

const TOKEN = "e03633d2-f881-4b6d-a5dd-a928e6b7da0c";

interface SegBlock {
  agendamento: Metric;
  r1_realizada: Metric;
  no_show: Metric;
  contrato_pago: Metric;
}
interface Block extends SegBlock {
  a?: SegBlock;
  b?: SegBlock;
}
interface ReguaSemana {
  numero: number;
  inicio: string; // YYYY-MM-DD
  fim: string;
  status: "passada" | "atual" | "futura";
  dias_uteis: number;
  meta_base: number;
  saldo_anterior: number | null;
  meta: number;
  realizadas: number | null;
  saldo: number | null;
  faltam: number | null;
}
interface ReguaR1 {
  meta_mes: number;
  realizadas_mes: number;
  pct_mes: number;
  dias_uteis_mes: number;
  dias_uteis_restantes: number;
  necessario_por_dia_util: number | null;
  ritmo_mes_anterior: number | null;
  semana_atual: ReguaSemana | null;
  semanas: ReguaSemana[];
}
interface Payload {
  today: string;
  updated_at: string;
  dia: Block;
  mes: Block;
  leads_novos?: {
    dia: Metric;
    mes: Metric;
  } | null;
  sdr_ranking?: TVSdrRankingRow[];
  closer_ranking?: TVCloserRankingRow[];
  ligacao_ranking?: TVLigacaoRankingRow[];
  regua_r1?: ReguaR1 | null;
  error?: string;
}

const ACCENT = "#ff7a00";

function DiaMesCard({
  titulo,
  dia,
  mes,
  diaB,
  mesB,
  accent,
  invertGoal,
  format,
  ocultarAvisoMeta,
}: {
  titulo: string;
  dia?: Metric;
  mes?: Metric;
  diaB?: Metric;
  mesB?: Metric;
  accent: string;
  invertGoal?: boolean;
  format?: (v: number) => string;
  /** Quando true e sem meta, oculta a legenda "meta não configurada" mantendo a altura (espaçador invisível). */
  ocultarAvisoMeta?: boolean;
}) {
  const fmt = format ?? ((v: number) => v.toLocaleString("pt-BR"));
  return (
    <div
      className="rounded-2xl border p-3 xl:p-4 flex flex-col min-h-0"
      style={{
        backgroundColor: "rgba(255,255,255,0.04)",
        borderColor: "rgba(255,255,255,0.10)",
      }}
    >
      <div className="text-white/60 uppercase tracking-widest text-xs xl:text-sm font-bold">{titulo}</div>
      <div className="flex-1 min-h-0 grid grid-cols-2 gap-4 xl:gap-6 mt-2">
        {([["Diário", dia], ["Mensal", mes]] as const).map(([label, m]) => {
          const atual = Number(m?.atual ?? 0);
          const meta = Number(m?.meta ?? 0);
          const hasMeta = meta > 0;
          const pct = hasMeta ? (atual / meta) * 100 : 0;
          const overGoal = hasMeta && atual > meta;
          const alert = !!invertGoal && overGoal;
          const color = alert ? "#ef4444" : accent;
          return (
            <div key={label} className="flex flex-col">
              <div className="text-[10px] xl:text-xs font-black tracking-widest text-white/40 uppercase">{label}</div>
              <div className="mt-1 flex items-baseline gap-1.5 xl:gap-2 flex-wrap">
                <span className="text-xl xl:text-3xl font-black leading-none" style={{ color }}>
                  {fmt(atual)}
                </span>
                {hasMeta && (
                  <span className="text-base xl:text-xl font-bold text-white/40">
                    / {fmt(meta)}
                    {m?.meta_calculada ? <span className="ml-1 text-white/30">*</span> : null}
                  </span>
                )}
              </div>
              {hasMeta ? (
                <div className="mt-2">
                  <div className="h-1.5 xl:h-2 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[10px] xl:text-xs font-bold text-white/50">
                    <span>{m?.meta_calculada ? "* meta estimada" : ""}</span>
                    <span style={alert ? { color } : undefined}>
                      {pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                    </span>
                  </div>
                </div>
              ) : ocultarAvisoMeta ? (
                <div className="mt-3 text-[11px] xl:text-sm font-semibold italic invisible">meta não configurada</div>
              ) : (
                <div className="mt-3 text-[11px] xl:text-sm text-white/35 font-semibold italic">meta não configurada</div>
              )}
            </div>
          );
        })}
      </div>
      {(diaB || mesB) && (
        <div
          className="mt-2 xl:mt-3 pt-2 xl:pt-3 border-t grid grid-cols-2 gap-4 xl:gap-6"
          style={{ borderColor: "rgba(255,255,255,0.12)" }}
        >
          <div className="flex items-baseline gap-2">
            <span className="text-[9px] xl:text-[10px] font-black tracking-widest text-white/40 uppercase">Lead B</span>
            <span className="text-lg xl:text-2xl font-black text-white/70">{fmt(Number(diaB?.atual ?? 0))}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[9px] xl:text-[10px] font-black tracking-widest text-white/40 uppercase">Lead B</span>
            <span className="text-lg xl:text-2xl font-black text-white/70">{fmt(Number(mesB?.atual ?? 0))}</span>
          </div>
        </div>
      )}
    </div>
  );
}

const REGUA_ACCENT = "#f59e0b";
const ddmm = (iso: string) => { const [, m, d] = iso.split("-"); return `${d}/${m}`; };
const dd = (iso: string) => iso.split("-")[2];

function ReguaR1Strip({ r }: { r: ReguaR1 }) {
  const fmt = (v: number) => Number(v ?? 0).toLocaleString("pt-BR");
  const atual = r.semana_atual;
  const pctSem = atual && atual.meta > 0 ? Math.min(((atual.realizadas ?? 0) / atual.meta) * 100, 100) : 0;
  const pctMes = Math.min(Number(r.pct_mes ?? 0), 100);
  const saldoAnt = atual?.saldo_anterior ?? 0;
  return (
    <div
      className="rounded-2xl border p-3 xl:p-4 grid gap-4 xl:gap-6 items-stretch"
      style={{ gridTemplateColumns: "1.05fr 2.4fr 0.9fr", borderColor: `${REGUA_ACCENT}8c`, backgroundColor: `${REGUA_ACCENT}0f` }}
    >
      <div className="flex flex-col justify-center min-w-0">
        <div className="uppercase tracking-widest text-[10px] xl:text-xs font-black" style={{ color: REGUA_ACCENT }}>
          R1 Realizada{atual ? ` · Semana ${atual.numero} · ${ddmm(atual.inicio)}–${ddmm(atual.fim)}` : ""}
        </div>
        {atual ? (
          <>
            <div className="mt-1 flex items-baseline gap-1.5 xl:gap-2">
              <span className="text-3xl xl:text-5xl font-black leading-none" style={{ color: REGUA_ACCENT }}>{fmt(atual.realizadas ?? 0)}</span>
              <span className="text-lg xl:text-2xl font-bold text-white/40">/ {fmt(atual.meta)}</span>
            </div>
            <div className="mt-2 h-1.5 xl:h-2 w-full rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pctSem}%`, backgroundColor: REGUA_ACCENT }} />
            </div>
            <div className="mt-1.5 text-[10px] xl:text-xs font-semibold text-white/55">
              {saldoAnt < 0 ? (
                <>{fmt(atual.meta_base)} da semana <b className="text-white">+ {fmt(-saldoAnt)} que faltaram</b></>
              ) : saldoAnt > 0 ? (
                <>{fmt(atual.meta_base)} da semana <b className="text-white">− {fmt(saldoAnt)} de sobra</b></>
              ) : (
                <>meta da semana</>
              )}
            </div>
            <div className="text-[10px] xl:text-xs font-semibold text-white/55">
              {(atual.faltam ?? 0) > 0 ? <>Faltam <b className="text-white">{fmt(atual.faltam ?? 0)}</b> até domingo</> : <b style={{ color: "#22c55e" }}>Meta da semana batida</b>}
            </div>
          </>
        ) : (
          <div className="mt-2 text-white/40 text-sm">sem semana em andamento</div>
        )}
      </div>

      <div className="flex flex-col justify-center min-w-0">
        <div className="text-white/60 uppercase tracking-widest text-[10px] xl:text-xs font-bold">Régua do mês · o que falta passa para a semana seguinte</div>
        <div className="mt-2 grid gap-1.5 xl:gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(r.semanas.length, 1)}, minmax(0, 1fr))` }}>
          {r.semanas.map((s) => {
            const isAtual = s.status === "atual";
            const isFut = s.status === "futura";
            const bateu = s.status === "passada" && (s.saldo ?? 0) >= 0;
            const valColor = isAtual ? REGUA_ACCENT : isFut ? "rgba(255,255,255,0.7)" : bateu ? "#22c55e" : "#ef4444";
            return (
              <div
                key={s.numero}
                className="rounded-xl border p-1.5 xl:p-2"
                style={{
                  opacity: isFut ? 0.55 : 1,
                  borderColor: isAtual ? REGUA_ACCENT : "rgba(255,255,255,0.10)",
                  backgroundColor: isAtual ? `${REGUA_ACCENT}1f` : "rgba(255,255,255,0.04)",
                }}
              >
                <div className="text-[9px] xl:text-[10px] font-black tracking-widest" style={{ color: isAtual ? REGUA_ACCENT : "rgba(255,255,255,0.5)" }}>
                  S{s.numero} · {dd(s.inicio)}–{dd(s.fim)}
                </div>
                <div className="mt-0.5 flex items-baseline gap-1">
                  <span className="text-base xl:text-xl font-black" style={{ color: valColor }}>{isFut ? "—" : fmt(s.realizadas ?? 0)}</span>
                  <span className="text-[10px] xl:text-xs font-bold text-white/40">/ {fmt(s.meta)}</span>
                </div>
                <div className="text-[9px] xl:text-[10px] font-extrabold min-h-[1em]">
                  {s.status === "passada" ? (
                    <span style={{ color: bateu ? "#22c55e" : "#ef4444" }}>
                      {(s.saldo ?? 0) >= 0 ? "+" : "−"}{fmt(Math.abs(s.saldo ?? 0))} → S{s.numero + 1}
                    </span>
                  ) : isAtual ? (
                    <span className="text-white/50">em andamento</span>
                  ) : (
                    <span className="text-white/45">{s.dias_uteis} dias úteis</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col justify-center min-w-0">
        <div className="text-white/60 uppercase tracking-widest text-[10px] xl:text-xs font-bold">Mês</div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-2xl xl:text-4xl font-black leading-none" style={{ color: REGUA_ACCENT }}>{fmt(r.realizadas_mes)}</span>
          <span className="text-base xl:text-xl font-bold text-white/40">/ {fmt(r.meta_mes)}</span>
        </div>
        <div className="mt-2 h-1.5 xl:h-2 w-full rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pctMes}%`, backgroundColor: REGUA_ACCENT }} />
        </div>
        <div className="mt-1.5 text-[10px] xl:text-xs font-semibold text-white/55">
          {Number(r.pct_mes ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
          {r.necessario_por_dia_util != null ? <> · precisa de <b className="text-white">~{fmt(r.necessario_por_dia_util)} por dia útil</b></> : null}
        </div>
        {r.ritmo_mes_anterior != null ? (
          <div className="text-[10px] xl:text-xs font-semibold text-white/40">mês passado fez {fmt(r.ritmo_mes_anterior)} por dia útil</div>
        ) : null}
      </div>
    </div>
  );
}

export default function TVIncorporadorEquipe() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["tv-incorporador-equipe", TOKEN],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_tv_incorporador_public" as any, { _token: TOKEN });
      if (error) throw error;
      return data as unknown as Payload;
    },
    refetchInterval: 45000,
  });

  if (isLoading) return <TVMsg title="Carregando…" msg="Buscando dados ao vivo" accent={ACCENT} />;
  if (error || !data || (data as any).error)
    return <TVMsg title="Acesso negado" msg="Chave inválida ou desativada." accent={ACCENT} />;

  return (
    <TVShell
      title="MCF · Painel de Equipe"
      subtitle="BU · Incorporador MCF"
      accent={ACCENT}
      today={data.today}
      updatedAt={data.updated_at}
      mainRowsClassName={data.regua_r1 ? "grid-rows-[auto_auto_1fr]" : "grid-rows-[auto_1fr]"}
    >
      <div className="grid grid-cols-3 gap-4 xl:gap-6 min-h-0">
        <DiaMesCard titulo="Leads Novos" dia={data.leads_novos?.dia} mes={data.leads_novos?.mes} accent="#38bdf8" ocultarAvisoMeta />
        <DiaMesCard titulo="Agendamento" dia={data.dia.a?.agendamento} mes={data.mes.a?.agendamento} diaB={data.dia.b?.agendamento} mesB={data.mes.b?.agendamento} accent={ACCENT} />
        <DiaMesCard titulo="Contrato Pago" dia={data.dia.a?.contrato_pago} mes={data.mes.a?.contrato_pago} diaB={data.dia.b?.contrato_pago} mesB={data.mes.b?.contrato_pago} accent="#bfff00" invertGoal />
      </div>
      {data.regua_r1 ? <ReguaR1Strip r={data.regua_r1} /> : null}
      <div className="grid grid-cols-3 gap-5 xl:gap-8 min-h-0">
        <TVSdrRankingBlock rows={data.sdr_ranking} accent={ACCENT} />
        <TVCloserRankingBlock rows={data.closer_ranking} accent="#bfff00" />
        <TVLigacaoRankingBlock rows={data.ligacao_ranking} accent="#a855f7" />
      </div>
    </TVShell>
  );
}
