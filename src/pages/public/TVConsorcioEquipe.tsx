import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TVMetricCard, TVShell, TVMsg, TVSection, Metric } from "@/components/public/TVTeamShared";

const TOKEN = "24151d71-1f8e-44b9-9761-b01f1fca7bec";

interface Block {
  agendamento: Metric;
  r1_realizada: Metric;
  no_show: Metric;
  valor_fechado: Metric;
}
interface Payload { today: string; updated_at: string; dia: Block; mes: Block; error?: string }

const ACCENT = "#bfff00";

function formatBRL(v: number) {
  const n = v || 0;
  if (Math.abs(n) >= 1_000_000)
    return `R$ ${(n / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`;
  if (Math.abs(n) >= 1_000)
    return `R$ ${(n / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return `R$ ${n.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

function Grid({ b }: { b?: Block }) {
  return (
    <div className="flex-1 min-h-0 grid grid-cols-2 grid-rows-2 gap-4 xl:gap-6">
      <TVMetricCard titulo="Agendamento" metric={b?.agendamento} accent={ACCENT} />
      <TVMetricCard titulo="R1 Realizada" metric={b?.r1_realizada} accent="#38bdf8" />
      <TVMetricCard titulo="No-show" metric={b?.no_show} accent="#ef4444" invertGoal />
      <TVMetricCard titulo="Valor Fechado" metric={b?.valor_fechado} accent={ACCENT} format={formatBRL} />
    </div>
  );
}

export default function TVConsorcioEquipe() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["tv-consorcio-equipe", TOKEN],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_tv_consorcio_public" as any, { _token: TOKEN });
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
      subtitle="BU · Consórcio"
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
