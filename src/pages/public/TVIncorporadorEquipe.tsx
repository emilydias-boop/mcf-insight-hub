import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TVMetricCard, TVShell, TVMsg, TVSection, Metric } from "@/components/public/TVTeamShared";

const TOKEN = "e03633d2-f881-4b6d-a5dd-a928e6b7da0c";

interface Block {
  agendamento: Metric;
  r1_realizada: Metric;
  no_show: Metric;
  contrato_pago: Metric;
}
interface Payload { today: string; updated_at: string; dia: Block; mes: Block; error?: string }

const ACCENT = "#ff7a00";

function Grid({ b }: { b?: Block }) {
  return (
    <div className="flex-1 min-h-0 grid grid-cols-2 grid-rows-2 gap-4 xl:gap-6">
      <TVMetricCard titulo="Agendamento" metric={b?.agendamento} accent={ACCENT} />
      <TVMetricCard titulo="R1 Realizada" metric={b?.r1_realizada} accent="#38bdf8" />
      <TVMetricCard titulo="No-show" metric={b?.no_show} accent="#ef4444" invertGoal />
      <TVMetricCard titulo="Contrato Pago" metric={b?.contrato_pago} accent="#bfff00" />
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
