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
      mainRowsClassName="grid-rows-[auto_1fr]"
    >
      <div className="grid grid-cols-3 gap-4 xl:gap-6 min-h-0">
        <DiaMesCard titulo="Leads Novos" dia={data.leads_novos?.dia} mes={data.leads_novos?.mes} accent="#38bdf8" />
        <DiaMesCard titulo="Agendamento" dia={data.dia.a?.agendamento} mes={data.mes.a?.agendamento} diaB={data.dia.b?.agendamento} mesB={data.mes.b?.agendamento} accent={ACCENT} />
        <DiaMesCard titulo="Contrato Pago" dia={data.dia.a?.contrato_pago} mes={data.mes.a?.contrato_pago} diaB={data.dia.b?.contrato_pago} mesB={data.mes.b?.contrato_pago} accent="#bfff00" invertGoal />
      </div>
      <div className="grid grid-cols-3 gap-5 xl:gap-8 min-h-0">
        <TVSdrRankingBlock rows={data.sdr_ranking} accent={ACCENT} />
        <TVCloserRankingBlock rows={data.closer_ranking} accent="#bfff00" />
        <TVLigacaoRankingBlock rows={data.ligacao_ranking} accent="#a855f7" />
      </div>
    </TVShell>
  );
}
