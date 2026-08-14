import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TVMetricCard, TVShell, TVMsg, TVSection, Metric } from "@/components/public/TVTeamShared";
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
  sdr_ranking?: TVSdrRankingRow[];
  closer_ranking?: TVCloserRankingRow[];
  ligacao_ranking?: TVLigacaoRankingRow[];
  error?: string;
}

const ACCENT = "#ff7a00";

function Grid({ b }: { b?: Block }) {
  const a = b?.a ?? b;
  const seg = b?.b;
  return (
    <div className="flex-1 min-h-0 grid grid-cols-2 grid-rows-1 gap-4 xl:gap-6">
      <TVMetricCard titulo="Agendamento" metric={a?.agendamento} metricB={seg?.agendamento} accent={ACCENT} />
      <TVMetricCard titulo="Contrato Pago" metric={a?.contrato_pago} metricB={seg?.contrato_pago} accent="#bfff00" />
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
      side={
        <div className="min-h-0 flex-1 grid grid-rows-3 gap-4 xl:gap-6">
          <TVSdrRankingBlock rows={data.sdr_ranking} accent={ACCENT} />
          <TVCloserRankingBlock rows={data.closer_ranking} accent="#bfff00" />
          <TVLigacaoRankingBlock rows={data.ligacao_ranking} accent="#a855f7" />
        </div>
      }
    >
      <TVSection label="Hoje" accent={ACCENT}>
        <Grid b={data.dia} />
      </TVSection>
      <TVSection label="Acumulado do mês" accent={ACCENT}>
        <Grid b={data.mes} />
      </TVSection>
    </TVShell>
  );
}
