import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const TOKEN = "a3bfe75a-df9e-4431-8569-8b8d1f4d9436";

interface Metric { atual: number; meta: number; pct_agendados?: number }
interface TeamDashboard {
  today: string;
  updated_at: string;
  incorporador: {
    agendamento: Metric;
    r1_realizada: Metric;
    no_show: Metric;
    contrato_pago: Metric;
  };
  consorcio: { valor_fechado: number; meta_valor: number; pct_meta: number };
  error?: string;
}

function pct(atual: number, meta: number) {
  if (!meta || meta <= 0) return 0;
  return Math.min((atual / meta) * 100, 100);
}

function formatMilhoes(v: number) {
  const milhoes = (v || 0) / 1_000_000;
  return `R$ ${milhoes.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`;
}

function formatDataHoje(iso?: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y) return iso;
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
}

function MetricCard({
  titulo, atual, meta, accent, extra,
}: { titulo: string; atual: number; meta: number; accent: string; extra?: string }) {
  const p = pct(atual, meta);
  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-5 xl:p-7 flex flex-col justify-between">
      <div className="text-white/60 uppercase tracking-widest text-xs xl:text-sm font-bold">{titulo}</div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-5xl xl:text-7xl font-black leading-none" style={{ color: accent }}>
          {atual}
        </span>
        <span className="text-2xl xl:text-3xl font-bold text-white/40">/ {meta}</span>
      </div>
      {extra && <div className="mt-1 text-sm xl:text-base text-white/50 font-semibold">{extra}</div>}
      <div className="mt-4">
        <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${p}%`, backgroundColor: accent }}
          />
        </div>
        <div className="mt-1.5 text-right text-xs xl:text-sm font-bold text-white/50">
          {p.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
        </div>
      </div>
    </div>
  );
}

function Msg({ title, msg }: { title: string; msg: string }) {
  return (
    <div className="fixed inset-0 bg-[#050505] text-white flex flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="text-4xl font-black text-[#bfff00]">{title}</div>
      <div className="text-white/70">{msg}</div>
    </div>
  );
}

export default function TVEquipeGeral() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["tv-equipe-geral", TOKEN],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_team_dashboard_public" as any, { _token: TOKEN });
      if (error) throw error;
      return data as unknown as TeamDashboard;
    },
    refetchInterval: 45000,
  });

  if (isLoading) return <Msg title="Carregando…" msg="Buscando dados ao vivo" />;
  if (error || !data || (data as any).error) return <Msg title="Acesso negado" msg="Chave inválida ou desativada." />;

  const inc = data.incorporador;
  const cons = data.consorcio;
  const consPct = Number(cons?.pct_meta ?? pct(cons?.valor_fechado || 0, cons?.meta_valor || 0));

  return (
    <div className="fixed inset-0 bg-[#050505] text-white overflow-hidden flex flex-col p-6 xl:p-10">
      {/* Header */}
      <header className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <span className="relative flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-70 animate-ping" />
            <span className="relative inline-flex h-4 w-4 rounded-full bg-[#22c55e]" />
          </span>
          <h1 className="text-2xl xl:text-4xl font-black tracking-tight">
            MCF · Painel de Equipe <span className="text-white/40">ao vivo</span>
          </h1>
        </div>
        <div className="text-right">
          <div className="text-base xl:text-2xl font-bold capitalize">{formatDataHoje(data.today)}</div>
          <div className="text-xs xl:text-sm text-white/40">
            Atualizado {data.updated_at ? new Date(data.updated_at).toLocaleTimeString("pt-BR") : ""}
          </div>
        </div>
      </header>

      {/* Painéis */}
      <main className="flex-1 min-h-0 mt-6 xl:mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6 xl:gap-10">
        {/* Incorporador */}
        <section className="rounded-3xl border border-[#ff7a00]/30 bg-[#ff7a00]/[0.04] p-5 xl:p-8 flex flex-col min-h-0">
          <h2 className="text-xl xl:text-3xl font-black text-[#ff7a00] tracking-wide">BU · INCORPORADOR MCF</h2>
          <div className="flex-1 min-h-0 mt-5 xl:mt-8 grid grid-cols-2 grid-rows-2 gap-4 xl:gap-6">
            <MetricCard titulo="Agendamento" atual={inc?.agendamento?.atual ?? 0} meta={inc?.agendamento?.meta ?? 0} accent="#ff7a00" />
            <MetricCard titulo="R1 Realizada" atual={inc?.r1_realizada?.atual ?? 0} meta={inc?.r1_realizada?.meta ?? 0} accent="#38bdf8" />
            <MetricCard
              titulo="No-show"
              atual={inc?.no_show?.atual ?? 0}
              meta={inc?.no_show?.meta ?? 0}
              accent="#ef4444"
              extra={
                inc?.no_show?.pct_agendados != null
                  ? `${Number(inc.no_show.pct_agendados).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% dos agendados`
                  : undefined
              }
            />
            <MetricCard titulo="Contrato Pago" atual={inc?.contrato_pago?.atual ?? 0} meta={inc?.contrato_pago?.meta ?? 0} accent="#bfff00" />
          </div>
        </section>

        {/* Consórcio */}
        <section className="rounded-3xl border border-[#bfff00]/30 bg-[#bfff00]/[0.04] p-5 xl:p-8 flex flex-col min-h-0">
          <h2 className="text-xl xl:text-3xl font-black text-[#bfff00] tracking-wide">BU · CONSÓRCIO</h2>
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center">
            <div className="text-white/60 uppercase tracking-widest text-xs xl:text-base font-bold">
              Valor Fechado (mês)
            </div>
            <div className="mt-3 text-6xl xl:text-[8rem] font-black leading-none text-[#bfff00]">
              {formatMilhoes(cons?.valor_fechado || 0)}
            </div>
            <div className="mt-3 text-lg xl:text-2xl font-bold text-white/40">
              Meta {formatMilhoes(cons?.meta_valor || 0)}
            </div>
            <div className="w-full mt-8 xl:mt-12 px-2">
              <div className="h-5 xl:h-7 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#bfff00] transition-all duration-700"
                  style={{ width: `${Math.min(consPct, 100)}%` }}
                />
              </div>
              <div className="mt-3 text-3xl xl:text-5xl font-black text-[#bfff00]">
                {consPct.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="shrink-0 mt-4 xl:mt-6 text-center text-[11px] xl:text-sm text-white/30">
        Dados do time atualizados automaticamente a cada 45 segundos · nenhuma ação necessária
      </footer>
    </div>
  );
}