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
  ajuste?: number | null; // + parte do que faltou / − parte do que sobrou
  meta: number;
  realizadas: number | null;
  saldo: number | null;
  faltam: number | null;
}
interface ReguaR1 {
  meta_mes: number;
  realizadas_mes: number;
  pct_mes: number;
  faltam_mes?: number;
  dias_uteis_mes: number;
  dias_uteis_restantes: number;
  necessario_por_dia_util: number | null;
  ritmo_mes_anterior: number | null;
  saldo_antes_semana_atual?: number | null; // >0 faltou, <0 sobrou
  semanas_restantes?: number;
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
  const ajusteAtual = Number(atual?.ajuste ?? 0);
  const saldoAntes = Number(r.saldo_antes_semana_atual ?? 0);
  const restantes = Number(r.semanas_restantes ?? 0);
  return (
    <div
      className="rounded-3xl border-2 p-4 xl:p-7 grid gap-5 xl:gap-8 items-stretch"
      style={{
        gridTemplateColumns: "1.1fr 2.6fr 1fr",
        borderColor: REGUA_ACCENT,
        backgroundColor: `${REGUA_ACCENT}14`,
        boxShadow: `0 0 48px ${REGUA_ACCENT}40, inset 0 0 0 1px ${REGUA_ACCENT}33`,
      }}
    >
      {/* Semana atual */}
      <div className="flex flex-col justify-center min-w-0">
        <div className="uppercase tracking-widest text-xs xl:text-lg font-black" style={{ color: REGUA_ACCENT }}>
          R1 Realizada · Semana {atual?.numero ?? "—"}
        </div>
        {atual ? (
          <>
            <div className="text-[11px] xl:text-base font-bold text-white/50">{ddmm(atual.inicio)} a {ddmm(atual.fim)}</div>
            <div className="mt-1 xl:mt-2 flex items-baseline gap-2 xl:gap-3">
              <span className="text-5xl xl:text-8xl font-black leading-none" style={{ color: REGUA_ACCENT }}>{fmt(atual.realizadas ?? 0)}</span>
              <span className="text-2xl xl:text-5xl font-bold text-white/45">/ {fmt(atual.meta)}</span>
            </div>
            <div className="mt-3 h-2.5 xl:h-4 w-full rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pctSem}%`, backgroundColor: REGUA_ACCENT }} />
            </div>
            <div className="mt-2 text-xs xl:text-lg font-semibold text-white/60">
              {ajusteAtual > 0 ? (
                <>{fmt(atual.meta_base)} da semana <b className="text-white">+ {fmt(ajusteAtual)} do que faltou</b></>
              ) : ajusteAtual < 0 ? (
                <>{fmt(atual.meta_base)} da semana <b className="text-white">− {fmt(-ajusteAtual)} do que sobrou</b></>
              ) : (
                <>meta da semana</>
              )}
            </div>
            <div className="text-xs xl:text-lg font-semibold text-white/60">
              {(atual.faltam ?? 0) > 0 ? (
                <>Faltam <b className="text-white">{fmt(atual.faltam ?? 0)}</b> até domingo</>
              ) : (
                <b style={{ color: "#22c55e" }}>Meta da semana batida</b>
              )}
            </div>
          </>
        ) : (
          <div className="mt-2 text-white/40 text-base">sem semana em andamento</div>
        )}
      </div>

      {/* Régua das semanas */}
      <div className="flex flex-col justify-center min-w-0">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div className="text-white/70 uppercase tracking-widest text-xs xl:text-lg font-black">Régua do mês</div>
          <div className="text-[11px] xl:text-base font-bold" style={{ color: saldoAntes > 0 ? "#f87171" : saldoAntes < 0 ? "#4ade80" : "rgba(255,255,255,0.5)" }}>
            {saldoAntes > 0
              ? `Faltaram ${fmt(saldoAntes)} · divididos nas ${restantes} semanas restantes`
              : saldoAntes < 0
              ? `Sobraram ${fmt(-saldoAntes)} · descontados das ${restantes} semanas restantes`
              : "No ritmo da meta"}
          </div>
        </div>
        <div className="mt-2 xl:mt-4 grid gap-2 xl:gap-3" style={{ gridTemplateColumns: `repeat(${Math.max(r.semanas.length, 1)}, minmax(0, 1fr))` }}>
          {r.semanas.map((s) => {
            const isAtual = s.status === "atual";
            const isFut = s.status === "futura";
            const bateu = s.status === "passada" && (s.saldo ?? 0) >= 0;
            const valColor = isAtual ? REGUA_ACCENT : isFut ? "rgba(255,255,255,0.75)" : bateu ? "#22c55e" : "#ef4444";
            const aj = Number(s.ajuste ?? 0);
            return (
              <div
                key={s.numero}
                className="rounded-2xl border-2 p-2 xl:p-4"
                style={{
                  opacity: isFut ? 0.6 : 1,
                  borderColor: isAtual ? REGUA_ACCENT : s.status === "passada" ? (bateu ? "#22c55e80" : "#ef444480") : "rgba(255,255,255,0.12)",
                  backgroundColor: isAtual ? `${REGUA_ACCENT}26` : "rgba(255,255,255,0.04)",
                }}
              >
                <div className="text-[10px] xl:text-sm font-black tracking-widest" style={{ color: isAtual ? REGUA_ACCENT : "rgba(255,255,255,0.55)" }}>
                  S{s.numero} · {dd(s.inicio)}–{dd(s.fim)}
                </div>
                <div className="mt-1 flex items-baseline gap-1 xl:gap-1.5 flex-wrap">
                  <span className="text-2xl xl:text-5xl font-black leading-none" style={{ color: valColor }}>{isFut ? "—" : fmt(s.realizadas ?? 0)}</span>
                  <span className="text-sm xl:text-2xl font-bold text-white/45">/ {fmt(s.meta)}</span>
                </div>
                <div className="mt-1 text-[10px] xl:text-sm font-extrabold min-h-[1em]">
                  {s.status === "passada" ? (
                    <span style={{ color: bateu ? "#22c55e" : "#ef4444" }}>
                      {bateu ? `+${fmt(s.saldo ?? 0)} acima` : `−${fmt(Math.abs(s.saldo ?? 0))} faltaram`}
                    </span>
                  ) : isAtual ? (
                    <span className="text-white/60">em andamento</span>
                  ) : aj !== 0 ? (
                    <span className="text-white/55">{fmt(s.meta_base)} {aj > 0 ? `+ ${fmt(aj)}` : `− ${fmt(-aj)}`}</span>
                  ) : (
                    <span className="text-white/50">{s.dias_uteis} dias úteis</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mês */}
      <div className="flex flex-col justify-center min-w-0">
        <div className="text-white/70 uppercase tracking-widest text-xs xl:text-lg font-black">Mês</div>
        <div className="mt-1 xl:mt-2 flex items-baseline gap-2">
          <span className="text-4xl xl:text-7xl font-black leading-none" style={{ color: REGUA_ACCENT }}>{fmt(r.realizadas_mes)}</span>
          <span className="text-xl xl:text-4xl font-bold text-white/45">/ {fmt(r.meta_mes)}</span>
        </div>
        <div className="mt-3 h-2.5 xl:h-4 w-full rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pctMes}%`, backgroundColor: REGUA_ACCENT }} />
        </div>
        <div className="mt-2 text-xs xl:text-lg font-semibold text-white/60">
          {Number(r.pct_mes ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
          {r.faltam_mes != null ? <> · faltam <b className="text-white">{fmt(r.faltam_mes)}</b></> : null}
        </div>
        {r.necessario_por_dia_util != null ? (
          <div className="text-xs xl:text-lg font-semibold text-white/60">precisa de <b className="text-white">~{fmt(r.necessario_por_dia_util)} por dia útil</b></div>
        ) : null}
        {r.ritmo_mes_anterior != null ? (
          <div className="text-[11px] xl:text-base font-semibold text-white/40">mês passado fez {fmt(r.ritmo_mes_anterior)} por dia útil</div>
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
      mainRowsClassName={data.regua_r1 ? "grid-rows-[auto_1fr_auto]" : "grid-rows-[auto_1fr]"}
    >
      <div className="grid grid-cols-3 gap-4 xl:gap-6 min-h-0">
        <DiaMesCard titulo="Leads Novos" dia={data.leads_novos?.dia} mes={data.leads_novos?.mes} accent="#38bdf8" ocultarAvisoMeta />
        <DiaMesCard titulo="Agendamento" dia={data.dia.a?.agendamento} mes={data.mes.a?.agendamento} diaB={data.dia.b?.agendamento} mesB={data.mes.b?.agendamento} accent={ACCENT} />
        <DiaMesCard titulo="Contrato Pago" dia={data.dia.a?.contrato_pago} mes={data.mes.a?.contrato_pago} diaB={data.dia.b?.contrato_pago} mesB={data.mes.b?.contrato_pago} accent="#bfff00" invertGoal />
      </div>
      <div className="grid grid-cols-3 gap-5 xl:gap-8 min-h-0">
        <TVSdrRankingBlock rows={data.sdr_ranking} accent={ACCENT} />
        <TVCloserRankingBlock rows={data.closer_ranking} accent="#bfff00" />
        <TVLigacaoRankingBlock rows={data.ligacao_ranking} accent="#a855f7" />
      </div>
      {data.regua_r1 ? <ReguaR1Strip r={data.regua_r1} /> : null}
    </TVShell>
  );
}
