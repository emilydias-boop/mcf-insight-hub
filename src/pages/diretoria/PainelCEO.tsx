// src/pages/diretoria/PainelCEO.tsx
// Painel do CEO (/ceo). Só lê a RPC ceo_painel(), que checa admin no banco e devolve snapshots
// recalculados de hora em hora pelo pg_cron. Nenhuma conta de negócio nova aqui: só razões,
// pró-rata e comparação com as metas de ceo_metas.
import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveContainer, LineChart, Line, Tooltip as RTooltip, XAxis, ReferenceLine } from "recharts";
import { AlertTriangle, CheckCircle2, CircleDashed, Crown, Info } from "lucide-react";

// ---------- tipos (só o que a tela usa) ----------
type Bloco = {
  ini: string; fim: string;
  receita: {
    bruta_caixa: number; estornos: number; estornos_n: number; liquida: number; recorrente: number;
    por_bu: { incorporador: number; consorcio: number; sem_bu: number; outras: number };
    mix_incorporador: { a010: number; contrato: number; parceria_50k: number; outros: number };
  };
  midia: { conversao_com_fator: number; divulgacao_com_fator: number; total_com_fator: number; total_bruto: number;
           conversao_bruto: number; fator: number; liq_total_bu: number; liq_total_anuncio: number };
  funil: { todas: Funil; anuncio: Funil };
  vendas: {
    compradores_a010: number; parcerias: number; parcerias_valor: number; parcerias_midia: number; parcerias_midia_valor: number;
    contratos_oficial: { total: number; a: number; b: number; c: number; sem_icp: number };
    caucoes_bruto: number; caucoes_estornadas: number; orfas: number; r1_realizadas: number; r1_agendadas_linhas: number;
  };
  no_show: { no_show: number; realizadas: number; sem_marcacao: number };
  coorte_a010: { n: number; r1a: number; contrato: number; parceria: number; parceria_14d: number; mediana_h_r1a: number | null };
  coorte_caucao: { n: number; parceria: number; parceria_14d: number; mediana_dias: number | null };
  consorcio: { vendas: number; cartas: number; credito: number; cotas_abertas: number; cotas_abertas_credito: number;
               aceites: number; declinadas: number; declinadas_credito: number; closers_atendidos: number };
  war_room: { vendas: number; liquido: number; negocios_novos: number; r1_atendidas: number };
  pos_venda: { realizadas: number; no_show: number; canceladas: number; vencidas: number };
  mkt_gastos: number;
};
type Funil = { entradas: number; a010: number; r1a: number; r1r: number; contratos: number; r2r: number; parcerias: number };
type Meta = { valor: number; unidade: string; descricao: string; fonte: string };
type Closer = { nome: string; bu: string; tipo: string; ativo: boolean; reunioes: number; atendidos: number;
                contratos_liquidos: number; conversao_pct: number | null; vendas_consorcio: number; cartas: number; credito: number };
type Painel = {
  gerado_em: string | null;
  periodo: { ini: string; fim: string; fim_mes: string; dias: number; dias_mes: number; ini_anterior: string; fim_anterior: string } | null;
  atual: Bloco | null;
  anterior_mesmo_periodo: Bloco | null;
  serie: { mes: string; bloco: Bloco; gerado_em: string }[];
  metas: Record<string, Meta>;
  extras: {
    calendario: { dias_uteis_mes: number; dias_uteis_decorridos: number };
    consorcio_fila: { n: number; credito: number; mais_antiga: string | null; idade_media_dias: number | null; ultima_cota_aberta: string | null };
    pos_venda_coorte: { desde: string; clientes: number; sem_reuniao: number };
    closers: Closer[];
    closers_ativos: { bu: string; tipo: string; n: number; sem_producao: number }[];
    sdrs_ativos: number;
    payout_sdr: { ano_mes: string; total: number; sdrs: number; status: string } | null;
    custos_fixos: { equipe: number | null; escritorio: number | null; mes_referencia: string | null };
    saude: {
      gateways: { source: string; ultima_venda: string }[];
      produtos_nao_cadastrados: number;
      crons_com_falha_24h: { job: string; falhas: number; execucoes: number }[];
      vinculo_alto_ticket_30d: { vendas: number; vinculadas: number };
    };
  } | null;
};

// ---------- formatação ----------
const brl = (v: number | null | undefined, dec = 0) =>
  v == null || !isFinite(v) ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: dec, minimumFractionDigits: dec });
const brlCurto = (v: number | null | undefined) => {
  if (v == null || !isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`;
  if (a >= 1_000) return `R$ ${(v / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return brl(v);
};
const num = (v: number | null | undefined, dec = 0) =>
  v == null || !isFinite(v) ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: dec, minimumFractionDigits: dec });
const pct = (v: number | null | undefined, dec = 1) => (v == null || !isFinite(v) ? "—" : `${num(v, dec)}%`);
const div = (a: number | null | undefined, b: number | null | undefined) => (a == null || b == null || !b ? null : a / b);
const p100 = (a: number | null | undefined, b: number | null | undefined) => { const r = div(a, b); return r == null ? null : r * 100; };
const dataBR = (iso: string | null | undefined) => (iso ? new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("pt-BR") : "—");
const horaBR = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const mesCurto = (ym: string) => { const [y, m] = ym.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""); };
const diasDesde = (iso: string | null | undefined) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null);
const media = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x != null && isFinite(x)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };

type Tom = "ok" | "atencao" | "alerta" | "neutro" | "imaturo";
const TOM_COR: Record<Tom, string> = {
  ok: "text-emerald-600 dark:text-emerald-400",
  atencao: "text-amber-600 dark:text-amber-400",
  alerta: "text-red-600 dark:text-red-400",
  neutro: "text-foreground",
  imaturo: "text-muted-foreground",
};
const TOM_BORDA: Record<Tom, string> = {
  ok: "border-l-emerald-500",
  atencao: "border-l-amber-500",
  alerta: "border-l-red-500",
  neutro: "border-l-border",
  imaturo: "border-l-border",
};

// ---------- peças ----------
function Delta({ atual, anterior, inverso = false, rotulo }: { atual: number | null; anterior: number | null; inverso?: boolean; rotulo: string }) {
  if (atual == null || anterior == null || !anterior) return <span className="text-xs text-muted-foreground">sem base de comparação</span>;
  const d = ((atual - anterior) / Math.abs(anterior)) * 100;
  const bom = inverso ? d < 0 : d > 0;
  return (
    <span className={`text-xs font-medium ${Math.abs(d) < 0.5 ? "text-muted-foreground" : bom ? TOM_COR.ok : TOM_COR.alerta}`}>
      {d > 0 ? "▲" : d < 0 ? "▼" : "="} {num(Math.abs(d), 1)}% <span className="font-normal text-muted-foreground">{rotulo}</span>
    </span>
  );
}

function Spark({ dados, formato, referencia }: { dados: { mes: string; v: number | null; parcial?: boolean }[]; formato: (v: number) => string; referencia?: number | null }) {
  if (!dados.length) return null;
  return (
    <div className="h-12 w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dados} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <XAxis dataKey="mes" hide />
          {referencia != null && <ReferenceLine y={referencia} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />}
          <RTooltip
            formatter={(v: any) => [v == null ? "—" : formato(Number(v)), ""]}
            labelFormatter={(l: any, p: any) => `${l}${p?.[0]?.payload?.parcial ? " (parcial)" : ""}`}
            contentStyle={{ fontSize: 12, padding: "4px 8px" }}
          />
          <Line type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2 }} connectNulls isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Kpi({ titulo, valor, tom = "neutro", sub, children, ajuda }: {
  titulo: string; valor: string; tom?: Tom; sub?: ReactNode; children?: ReactNode; ajuda?: string;
}) {
  return (
    <Card className={`border-l-4 ${TOM_BORDA[tom]}`}>
      <CardHeader className="pb-1 pt-4 px-4">
        <CardDescription className="text-xs uppercase tracking-wide flex items-center gap-1">
          {titulo}
          {ajuda && <span title={ajuda} className="cursor-help"><Info className="h-3 w-3" /></span>}
        </CardDescription>
        <CardTitle className={`text-2xl tabular-nums ${TOM_COR[tom]}`}>{valor}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-1 text-sm">
        {sub && <div className="text-muted-foreground text-xs leading-relaxed">{sub}</div>}
        {children}
      </CardContent>
    </Card>
  );
}

function Secao({ numero, titulo, pergunta, children }: { numero: number; titulo: string; pergunta: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{numero}. {titulo}</h2>
        <p className="text-sm text-muted-foreground">{pergunta}</p>
      </div>
      {children}
    </section>
  );
}

function Linha({ rotulo, valor, tom = "neutro", nota }: { rotulo: string; valor: string; tom?: Tom; nota?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 border-b border-border/50 last:border-0">
      <span className="text-sm">{rotulo}{nota && <span className="block text-xs text-muted-foreground">{nota}</span>}</span>
      <span className={`text-sm font-medium tabular-nums text-right shrink-0 max-w-[55%] sm:whitespace-nowrap sm:max-w-none ${TOM_COR[tom]}`}>{valor}</span>
    </div>
  );
}

// ---------- página ----------
export default function PainelCEO() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["ceo-painel"],
    staleTime: 10 * 60_000,
    refetchInterval: 15 * 60_000,
    queryFn: async (): Promise<Painel> => {
      // A função não está em types.ts: chamada sem tipo de propósito (não regenerar types.ts por causa disto).
      const { data, error } = await (supabase.rpc as any)("ceo_painel");
      if (error) throw error;
      return data as Painel;
    },
  });

  const v = useMemo(() => (data ? calcular(data) : null), [data]);

  if (isLoading) {
    return (
      <div className="space-y-4 p-1">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      </div>
    );
  }
  if (error) {
    return <Card className="m-2"><CardContent className="p-6 text-sm">Não foi possível carregar o painel: {(error as any)?.message ?? "erro desconhecido"}. O painel é só para admin.</CardContent></Card>;
  }
  if (!data || !v || !data.atual || !data.periodo || !data.extras) {
    return <Card className="m-2"><CardContent className="p-6 text-sm">O painel ainda não foi calculado. O cálculo roda de hora em hora (minuto 12).</CardContent></Card>;
  }

  const { atual: A, anterior_mesmo_periodo: B, periodo: P, extras: X } = data;

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto pb-10">
      {/* Cabeçalho */}
      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Crown className="h-6 w-6" /> Painel do CEO</h1>
          <p className="text-sm text-muted-foreground">
            {dataBR(P.ini)} a {dataBR(P.fim)} · dia {P.dias} de {P.dias_mes} · comparado com {dataBR(P.ini_anterior)} a {dataBR(P.fim_anterior)} (mesmos dias do mês anterior)
          </p>
        </div>
        <p className="text-xs text-muted-foreground">Atualizado em {horaBR(data.gerado_em)} · recalcula de hora em hora</p>
      </header>

      {/* Alertas */}
      {v.alertas.length > 0 && (
        <Card className="border-amber-500/50">
          <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> O que pede atenção agora</CardTitle></CardHeader>
          <CardContent className="px-4 pb-4">
            <ul className="space-y-1.5 text-sm">
              {v.alertas.map((a, i) => (
                <li key={i} className="flex gap-2"><span className={a.tom === "alerta" ? "text-red-500" : "text-amber-500"}>●</span><span>{a.texto}</span></li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* 1. Dinheiro */}
      <Secao numero={1} titulo="Dinheiro" pergunta="A empresa está crescendo e sobra dinheiro depois da mídia, do imposto e dos custos fixos?">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Kpi titulo="Receita líquida da empresa" valor={brlCurto(A.receita.liquida)} tom={v.tomReceita}
               ajuda="Todas as vendas concluídas (Hubla, MCF Pay, Kiwify) com valor líquido de taxa do gateway, de todas as BUs, menos os estornos registrados no período. Visão caixa: inclui parcelas e saldos. Crédito de carta de consórcio nunca entra."
               sub={<>Ritmo {brlCurto(v.receitaDia)}/dia · projeção do mês {brlCurto(v.projecaoReceita)}</>}>
            <Delta atual={A.receita.liquida} anterior={B?.receita.liquida ?? null} rotulo="vs mesmos dias do mês anterior" />
            <Spark dados={v.serie("receita")} formato={brlCurto} />
          </Kpi>

          <Kpi titulo="Sobra estimada após mídia, imposto e fixos" valor={brlCurto(v.sobra)} tom={v.sobra != null && v.sobra < 0 ? "alerta" : "neutro"}
               ajuda="Estimativa, não é lucro contábil. Receita líquida − imposto estimado − mídia Meta com o fator 1,125 − custos fixos cadastrados (pró-rata pelos dias). Não desconta comissão de closer, payout de SDR nem custo de entrega."
               sub={<>Margem estimada {pct(v.margem)} · sem comissão, payout de SDR e entrega</>}>
            <div className="pt-1">
              <Linha rotulo="Receita líquida" valor={brl(A.receita.liquida)} />
              <Linha rotulo={`Imposto estimado (${num(v.impostoPct, 1)}%)`} valor={`− ${brl(v.imposto)}`} nota="Taxa a confirmar com o financeiro" />
              <Linha rotulo="Mídia Meta (com fator 1,125)" valor={`− ${brl(A.midia.total_com_fator)}`} />
              <Linha rotulo="Custos fixos (pró-rata)" valor={`− ${brl(v.fixos)}`} tom={v.fixosDesatualizados ? "atencao" : "neutro"}
                     nota={X.custos_fixos.mes_referencia ? `Último lançamento: ${dataBR(X.custos_fixos.mes_referencia).slice(3)}${v.fixosDesatualizados ? " (desatualizado)" : ""}` : "Sem custos cadastrados"} />
            </div>
          </Kpi>

          <Kpi titulo="De onde vem a receita" valor={pct(v.pctParceria, 0)} sub="da receita do Incorporador vem da parceria (Incorporador 50K)">
            <div className="pt-1">
              <Linha rotulo="Parceria (50K, recorrência, renovação)" valor={brlCurto(A.receita.mix_incorporador.parceria_50k)} />
              <Linha rotulo="Contratos (caução A000)" valor={brlCurto(A.receita.mix_incorporador.contrato)} />
              <Linha rotulo="A010" valor={brlCurto(A.receita.mix_incorporador.a010)} />
              <Linha rotulo="Consórcio (infoproduto, sem comissão de carta)" valor={brlCurto(A.receita.por_bu.consorcio)} />
              <Linha rotulo="Sem BU (inclui War Room)" valor={brlCurto(A.receita.por_bu.sem_bu + A.receita.por_bu.outras)} tom={A.receita.por_bu.sem_bu > 5000 ? "atencao" : "neutro"} />
              <Linha rotulo="Estornos registrados" valor={`− ${brlCurto(A.receita.estornos)}`} nota={`${num(A.receita.estornos_n)} estornos · Kiwify não informa estorno`} />
            </div>
          </Kpi>
        </div>
      </Secao>

      {/* 2. Vendas */}
      <Secao numero={2} titulo="Vendas" pergunta="Estamos vendendo a parceria, que paga a empresa, no preço certo e com qualidade?">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi titulo="Parcerias vendidas" valor={num(A.vendas.parcerias)}
               ajuda="Pessoas distintas que fizeram a 1ª venda de parceria no período (régua do marketing: pessoa, pela data da venda). Saldo de parceria não conta."
               sub={<>{brlCurto(A.vendas.parcerias_valor)} na 1ª venda · projeção do mês {num(v.projecaoParcerias)}</>}>
            <Delta atual={A.vendas.parcerias} anterior={B?.vendas.parcerias ?? null} rotulo="vs mesmos dias do mês anterior" />
            <Spark dados={v.serie("parcerias")} formato={(x) => num(x)} />
          </Kpi>

          <Kpi titulo="Ticket médio da parceria" valor={brl(v.ticket)}
               ajuda="Valor líquido da 1ª venda de parceria ÷ pessoas. Líquido de taxa do gateway, antes de imposto e comissão."
               sub={<>sobre {num(A.vendas.parcerias)} parcerias{A.vendas.parcerias < 30 ? " · amostra pequena" : ""} · média 6 meses {brl(v.ticketMedio6)}</>}>
            <Spark dados={v.serie("ticket")} formato={(x) => brl(x)} />
          </Kpi>

          <Kpi titulo="Contratos pagos (caução)" valor={num(A.vendas.contratos_oficial.total)} tom={v.tomContratos}
               ajuda="Régua oficial do comercial e da TV: cauções pagas no período, com as estornadas, mais atribuições manuais e órfãos. Meta: 12 por dia útil."
               sub={<>Meta até hoje {num(v.metaContratosHoje)} ({pct(v.atingContratos, 0)}) · meta do mês {num(v.metaContratosMes)} · líquido de estorno {num(v.contratosLiquidos)}</>}>
            <Delta atual={A.vendas.contratos_oficial.total} anterior={B?.vendas.contratos_oficial.total ?? null} rotulo="vs mesmos dias do mês anterior" />
            <Spark dados={v.serie("contratos")} formato={(x) => num(x)} />
          </Kpi>

          <Kpi titulo="Estorno de caução (última safra madura)" valor={pct(v.estornoMaduro?.v)} tom={v.estornoMaduro?.v == null ? "neutro" : v.estornoMaduro.v > 25 ? "alerta" : v.estornoMaduro.v > 20 ? "atencao" : "ok"}
               ajuda="Cauções estornadas ÷ cauções pagas no mês. O estorno chega depois: só vale como definitivo para mês fechado há mais de 30 dias."
               sub={<>Safra {v.estornoMaduro ? mesCurto(v.estornoMaduro.mes) : "—"} · mês atual {pct(p100(A.vendas.caucoes_estornadas, A.vendas.caucoes_bruto))} (imaturo)</>}>
            <Spark dados={v.serie("estorno")} formato={(x) => pct(x)} />
          </Kpi>
        </div>
      </Secao>

      {/* 3. A máquina se paga? */}
      <Secao numero={3} titulo="A máquina se paga?" pergunta="De cada 100 compradores do A010, quantos viram parceria, e a mídia volta em dinheiro?">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Kpi titulo="Comprador A010 → parceria" valor={pct(v.a010Parceria?.v, 1)}
               tom={v.a010Parceria?.v == null ? "neutro" : v.empate != null && v.a010Parceria.v < v.empate ? "alerta" : "ok"}
               ajuda="Coorte: compradores de A010 do mês e quantos fizeram parceria depois (pessoa). Mostra o último mês com pelo menos 14 dias de maturação. O ponto de empate vem da proposta do A010 refeito."
               sub={<>Coorte de {v.a010Parceria ? mesCurto(v.a010Parceria.mes) : "—"} · empate em {pct(v.empate, 2)} · em 14 dias {pct(v.a010Parceria14)}</>}>
            <Spark dados={v.serie("a010parceria")} formato={(x) => pct(x)} referencia={v.empate} />
          </Kpi>

          <Kpi titulo="Custo por parceria da mídia" valor={brl(v.custoParceria)}
               tom={v.custoParceria != null && v.ticketPosImposto != null ? (v.custoParceria > v.ticketPosImposto ? "alerta" : v.custoParceria > v.ticketPosImposto * 0.8 ? "atencao" : "ok") : "neutro"}
               ajuda="Investimento de conversão na Meta (com fator 1,125) ÷ parcerias que vieram de anúncio. Comparado com o ticket médio já sem o imposto estimado."
               sub={<>Ticket sem imposto {brl(v.ticketPosImposto)} · retorno da mídia só em parceria {v.retornoParceria == null ? "—" : `${num(v.retornoParceria, 2)}x`}</>}>
            <Spark dados={v.serie("custoParceria")} formato={(x) => brl(x)} />
          </Kpi>

          <Kpi titulo="Onde a esteira perde mais" valor={v.gargalo?.nome ?? "—"} tom={v.gargalo ? "atencao" : "neutro"}
               ajuda="Compara cada passagem do mês com a média dos 6 meses fechados. Coortes do mês corrente ainda amadurecem.">
            <div className="pt-1">
              {v.passagens.map((p) => (
                <Linha key={p.nome} rotulo={p.nome} nota={p.nota} tom={p.tom}
                       valor={`${pct(p.v)}${p.meta != null ? ` · meta ${pct(p.meta, 0)}` : ""}${p.media != null ? ` · 6m ${pct(p.media)}` : ""}`} />
              ))}
            </div>
          </Kpi>
        </div>
        <Card>
          <CardContent className="px-4 py-3">
            <p className="text-xs text-muted-foreground mb-2">Volumes do mês (pessoas, BU inteira). Não são conversão: cada etapa tem gente de safras diferentes.</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
              {([["Entradas", A.funil.todas.entradas], ["R1 agendada", A.funil.todas.r1a], ["R1 realizada", A.funil.todas.r1r],
                 ["Contrato", A.funil.todas.contratos], ["R2 realizada", A.funil.todas.r2r], ["Parceria", A.funil.todas.parcerias]] as [string, number][]).map(([r, n]) => (
                <div key={r}><div className="text-xl font-semibold tabular-nums">{num(n)}</div><div className="text-xs text-muted-foreground">{r}</div></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </Secao>

      {/* 4. Topo do funil e mídia */}
      <Secao numero={4} titulo="Topo do funil e mídia" pergunta="O contrato do marketing (50 compradores por dia) está sendo cumprido e dentro do orçamento?">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi titulo="Compradores de A010 por dia" valor={num(v.a010Dia, 1)} tom={v.tomA010}
               ajuda="Pessoas distintas (e-mail) que compraram A010 no período ÷ dias corridos. Inclui orgânico."
               sub={<>Meta {num(v.metaA010)}/dia ({pct(p100(v.a010Dia, v.metaA010), 0)}) · {num(A.vendas.compradores_a010)} no mês</>}>
            <Delta atual={A.vendas.compradores_a010} anterior={B?.vendas.compradores_a010 ?? null} rotulo="vs mesmos dias do mês anterior" />
            <Spark dados={v.serie("a010dia")} formato={(x) => num(x, 1)} referencia={v.metaA010} />
          </Kpi>

          <Kpi titulo="Mídia Meta por semana (bruto)" valor={brlCurto(v.midiaSemana)} tom={v.tetoMidia != null && v.midiaSemana != null && v.midiaSemana > v.tetoMidia ? "alerta" : "neutro"}
               ajuda="Gasto da Meta (conversão + divulgação) sem o fator de imposto 1,125, no ritmo de 7 dias. O teto de R$ 100 mil por semana é bruto."
               sub={<>Teto {brlCurto(v.tetoMidia)}/semana · no mês {brlCurto(A.midia.total_bruto)} bruto ({brlCurto(A.midia.total_com_fator)} com imposto)</>} />

          <Kpi titulo="CPA do comprador de anúncio (bruto)" valor={brl(v.cpaBruto)} tom={v.cpaMax != null && v.cpaBruto != null ? (v.cpaBruto > v.cpaMax * 1.25 ? "alerta" : v.cpaBruto > v.cpaMax ? "atencao" : "ok") : "neutro"}
               ajuda="Investimento de conversão sem o fator 1,125 ÷ compradores de A010 que vieram de anúncio. A meta de R$ 286 é bruta."
               sub={<>Meta {brl(v.cpaMax)} · {num(A.funil.anuncio.a010)} compradores de anúncio</>}>
            <Spark dados={v.serie("cpa")} formato={(x) => brl(x)} referencia={v.cpaMax} />
          </Kpi>

          <Kpi titulo="Receita que depende de anúncio" valor={pct(v.pctAnuncio, 0)}
               ajuda="Receita líquida de quem veio de anúncio ÷ receita líquida da BU inteira (régua do Painel de Marketing). Quanto maior, mais a empresa depende da Meta."
               sub={<>{brlCurto(A.midia.liq_total_anuncio)} via anúncio · {brlCurto(A.midia.liq_total_bu - A.midia.liq_total_anuncio)} por outras origens</>}>
            <Spark dados={v.serie("pctAnuncio")} formato={(x) => pct(x, 0)} />
          </Kpi>
        </div>
      </Secao>

      {/* 5. BUs */}
      <Secao numero={5} titulo="Unidades de negócio" pergunta="Fora do Incorporador, qual BU produz, qual está parada e onde há venda feita que não virou entrega?">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Kpi titulo="Consórcio: produção (volume, não receita)" valor={brlCurto(A.consorcio.credito)}
               ajuda="Crédito das cartas vendidas no período (data do aceite). É volume, não entra na receita. A comissão das cartas ainda não é registrada no sistema."
               sub={<>{num(A.consorcio.vendas)} vendas · {num(A.consorcio.cartas)} cartas</>}>
            <Delta atual={A.consorcio.vendas} anterior={B?.consorcio.vendas ?? null} rotulo="vendas vs mesmos dias do mês anterior" />
            <div className="pt-2">
              <Linha rotulo="Cotas abertas no mês" valor={`${num(A.consorcio.cotas_abertas)} · ${brlCurto(A.consorcio.cotas_abertas_credito)}`} />
              <Linha rotulo="Fila aguardando abertura de cota" valor={`${num(X.consorcio_fila.n)} · ${brlCurto(X.consorcio_fila.credito)}`}
                     tom={v.diasSemCota != null && v.diasSemCota > 7 ? "alerta" : X.consorcio_fila.n > 0 ? "atencao" : "neutro"}
                     nota={`Idade média ${num(X.consorcio_fila.idade_media_dias, 0)} dias · mais antiga de ${dataBR(X.consorcio_fila.mais_antiga)} · última cota aberta há ${v.diasSemCota ?? "—"} dias`} />
              <Linha rotulo="Propostas declinadas depois do aceite" valor={`${num(A.consorcio.declinadas)} de ${num(A.consorcio.aceites)}`} nota={brlCurto(A.consorcio.declinadas_credito)} />
            </div>
          </Kpi>

          <Kpi titulo="War Room" valor={`${num(A.war_room.vendas)} vendas`}
               ajuda="Vendas com 'War Room' no nome do produto (o produto ainda não está cadastrado, por isso a receita cai em 'sem BU'). Negócios novos e R1 da BU War Room (chave interna 'solar')."
               sub={<>{brl(A.war_room.liquido)} líquido · {num(A.war_room.negocios_novos)} negócios novos · {num(A.war_room.r1_atendidas)} R1 atendidas</>} />

          <Kpi titulo="Pós-venda: clientes sem reunião" valor={pct(p100(X.pos_venda_coorte.sem_reuniao, X.pos_venda_coorte.clientes), 0)}
               tom={(p100(X.pos_venda_coorte.sem_reuniao, X.pos_venda_coorte.clientes) ?? 0) > 50 ? "alerta" : (p100(X.pos_venda_coorte.sem_reuniao, X.pos_venda_coorte.clientes) ?? 0) > 25 ? "atencao" : "ok"}
               ajuda="Clientes que entraram no Pós-venda desde 09/10/2026 (início da agenda própria) e há mais de 7 dias, sem nenhuma reunião não cancelada."
               sub={<>{num(X.pos_venda_coorte.sem_reuniao)} de {num(X.pos_venda_coorte.clientes)} clientes desde {dataBR(X.pos_venda_coorte.desde)}</>}>
            <div className="pt-1">
              <Linha rotulo="Reuniões realizadas no mês" valor={num(A.pos_venda.realizadas)} />
              <Linha rotulo="No-show · agendadas vencidas sem desfecho" valor={`${num(A.pos_venda.no_show)} · ${num(A.pos_venda.vencidas)}`} tom={A.pos_venda.vencidas > 10 ? "atencao" : "neutro"} />
            </div>
          </Kpi>
        </div>
      </Secao>

      {/* 6. Time */}
      <Secao numero={6} titulo="Time" pergunta="O time comercial está produzindo e a venda está concentrada em poucas pessoas?">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Kpi titulo="Contratos por closer de R1 (Incorporador)" valor={pct(v.concentracao, 0)}
               tom={v.concentracao != null && v.concentracao > 70 ? "atencao" : "neutro"}
               ajuda="Contratos líquidos de estorno por closer de R1 (por isso a soma fica abaixo do número oficial da seção 2). Atribuição conforme a regra vigente."
               sub="dos contratos com os 2 closers que mais vendem">
            <div className="pt-1">
              {v.closersR1.map((c) => (
                <Linha key={c.nome} rotulo={c.nome} valor={`${num(c.contratos_liquidos)} · ${pct(c.conversao_pct, 0)}`} nota={`${num(c.atendidos)} atendidos`} />
              ))}
              {v.closersR1SemProducao > 0 && <p className="text-xs text-amber-600 pt-1">{v.closersR1SemProducao} closer(s) de R1 ativo(s) sem contrato no mês</p>}
              <p className="text-xs text-muted-foreground pt-1">Closers de R2 (parceria) ainda não têm produção medida aqui.</p>
            </div>
          </Kpi>

          <Kpi titulo="Closers do Consórcio" valor={`${num(A.consorcio.vendas)} vendas`} sub={`${num(A.consorcio.closers_atendidos)} reuniões atendidas`}>
            <div className="pt-1">
              {v.closersConsorcio.map((c) => (
                <Linha key={c.nome} rotulo={c.nome} valor={`${num(c.vendas_consorcio)} · ${pct(c.conversao_pct, 0)}`} nota={`${num(c.atendidos)} atendidos · ${brlCurto(c.credito)}`} />
              ))}
            </div>
          </Kpi>

          <Kpi titulo="Tamanho do time" valor={`${num(X.sdrs_ativos)} SDRs`} sub={`${num(v.closersAtivosTotal)} closers ativos`}>
            <div className="pt-1">
              {X.closers_ativos.map((c) => (
                <Linha key={c.bu + c.tipo} rotulo={`Closers ${nomeBU(c.bu)} (${c.tipo.toUpperCase()})`} valor={num(c.n)} />
              ))}
              {X.payout_sdr && (
                <Linha rotulo={`Payout de SDR ${mesCurto(X.payout_sdr.ano_mes)}/${X.payout_sdr.ano_mes.slice(2, 4)}`} valor={brlCurto(X.payout_sdr.total)}
                       nota={`${num(X.payout_sdr.sdrs)} SDRs · ${X.payout_sdr.status.includes("DRAFT") ? "rascunho, não final" : X.payout_sdr.status}`}
                       tom={X.payout_sdr.status.includes("DRAFT") ? "atencao" : "neutro"} />
              )}
            </div>
          </Kpi>
        </div>
      </Secao>

      {/* 7. Riscos */}
      <Secao numero={7} titulo="Riscos e confiabilidade" pergunta="Algum dado está quebrado ou algo pode parar a receita ou este painel?">
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <CardContent className="px-4 py-3 space-y-0.5">
              {X.saude.gateways.map((g) => {
                const d = diasDesde(g.ultima_venda);
                return <Linha key={g.source} rotulo={`Venda pela ${nomeGateway(g.source)}`} valor={d == null ? "—" : d === 0 ? "hoje" : `há ${d} dia(s)`}
                              tom={d != null && d > 2 ? "alerta" : "ok"} nota={d != null && d > 2 ? "Integração parada ou produto migrado. Conferir." : undefined} />;
              })}
              <Linha rotulo="Produtos vendidos sem cadastro" valor={num(X.saude.produtos_nao_cadastrados)} tom={X.saude.produtos_nao_cadastrados > 0 ? "atencao" : "ok"} nota="Receita deles cai em 'sem BU'" />
              <Linha rotulo="Receita sem BU no mês" valor={brlCurto(A.receita.por_bu.sem_bu)} tom={A.receita.por_bu.sem_bu > 5000 ? "atencao" : "ok"} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-4 py-3 space-y-0.5">
              <p className="text-xs text-muted-foreground pb-1">Dívidas conhecidas (já mapeadas, com dono)</p>
              {X.saude.crons_com_falha_24h.map((c) => (
                <Linha key={c.job} rotulo={`Rotina ${c.job}`} valor={`${num(c.falhas)} falhas em ${num(c.execucoes)}`} nota="últimas 24 h" />
              ))}
              <Linha rotulo="Vendas de alto ticket ligadas a um negócio do CRM" valor={pct(p100(X.saude.vinculo_alto_ticket_30d.vinculadas, X.saude.vinculo_alto_ticket_30d.vendas), 0)}
                     nota={`${num(X.saude.vinculo_alto_ticket_30d.vinculadas)} de ${num(X.saude.vinculo_alto_ticket_30d.vendas)} nos últimos 30 dias`} />
              <Linha rotulo="API da Meta (meta-ads-sync, v21.0)" valor={`para em ${v.diasApiMeta} dias`} tom={v.diasApiMeta < 45 ? "alerta" : "atencao"} nota="21/01/2027: sem migrar, param investimento, CPA e ROAS" />
              <Linha rotulo="Webhook do MCF Pay (Asaas)" valor="sem validação de assinatura" tom="atencao" nota="Grava a receita do MCF Pay" />
            </CardContent>
          </Card>
        </div>
        <Card className="border-dashed">
          <CardContent className="px-4 py-3 text-sm">
            <p className="font-medium flex items-center gap-2 pb-1"><CircleDashed className="h-4 w-4" /> O que este painel ainda não mostra</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
              <li>Caixa: saldo no banco, contas a pagar, a receber e parcelas futuras não estão no sistema.</li>
              <li>Lucro real: faltam a alíquota de imposto confirmada, a comissão de closer, o custo de entrega e os custos fixos de 2026.</li>
              <li>Receita do Consórcio: a comissão das cartas não é registrada; só aparece o volume de crédito.</li>
              <li>Produção dos closers de R2 e satisfação do parceiro (NPS, cancelamento) ainda não têm fonte.</li>
            </ul>
          </CardContent>
        </Card>
      </Secao>

      <p className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Fonte: função ceo_painel (banco), com as mesmas réguas do Painel Comercial, da TV e do Painel de Marketing. Metas na tabela ceo_metas.</p>
    </div>
  );
}

function nomeBU(bu: string) {
  return ({ incorporador: "Incorporador", consorcio: "Consórcio", solar: "War Room", credito: "Crédito", sem_bu: "sem BU", pos_venda: "Pós-venda" } as Record<string, string>)[bu] ?? bu;
}
function nomeGateway(s: string) {
  return ({ hubla: "Hubla", kiwify: "Kiwify", mcfpay: "MCF Pay" } as Record<string, string>)[s] ?? s;
}

// ---------- contas da tela ----------
function calcular(d: Painel) {
  const A = d.atual, B = d.anterior_mesmo_periodo, P = d.periodo, X = d.extras;
  if (!A || !P || !X) return null;
  const meta = (k: string) => d.metas?.[k]?.valor ?? null;
  const hoje = new Date();

  const impostoPct = meta("imposto_receita_pct") ?? 18;
  const metaA010 = meta("a010_compradores_dia");
  const metaContratosDia = meta("contratos_dia_util");
  const tetoMidia = meta("midia_teto_semana");
  const cpaMax = meta("cpa_a010_max");
  const empate = meta("parceria_empate_pct");
  const metaConvR1 = meta("conv_r1_contrato_min");
  const metaA010R1a = meta("coorte_a010_r1a_min");

  // série: meses fechados + mês corrente (parcial)
  const meses = [...(d.serie ?? []).map((s) => ({ mes: s.mes, b: s.bloco, parcial: false })), { mes: P.ini.slice(0, 7), b: A, parcial: true }];
  const diasDe = (b: Bloco) => Math.round((new Date(b.fim + "T12:00:00").getTime() - new Date(b.ini + "T12:00:00").getTime()) / 86_400_000) + 1;
  const fimMaisDias = (b: Bloco, dias: number) => new Date(b.fim + "T23:59:59").getTime() + dias * 86_400_000 <= hoje.getTime();
  const metricas: Record<string, (b: Bloco) => number | null> = {
    receita: (b) => b.receita.liquida,
    parcerias: (b) => b.vendas.parcerias,
    ticket: (b) => div(b.vendas.parcerias_valor, b.vendas.parcerias),
    contratos: (b) => b.vendas.contratos_oficial.total,
    estorno: (b) => p100(b.vendas.caucoes_estornadas, b.vendas.caucoes_bruto),
    a010parceria: (b) => p100(b.coorte_a010.parceria, b.coorte_a010.n),
    custoParceria: (b) => div(b.midia.conversao_com_fator, b.funil.anuncio.parcerias),
    a010dia: (b) => div(b.vendas.compradores_a010, diasDe(b)),
    cpa: (b) => div(b.midia.conversao_bruto, b.funil.anuncio.a010),
    pctAnuncio: (b) => p100(b.midia.liq_total_anuncio, b.midia.liq_total_bu),
    a010r1a: (b) => p100(b.coorte_a010.r1a, b.coorte_a010.n),
    noshow: (b) => p100(b.no_show.no_show, b.no_show.no_show + b.no_show.realizadas),
    r1contrato: (b) => p100(b.vendas.caucoes_bruto, b.vendas.r1_realizadas),
    caucaoParceria: (b) => p100(b.coorte_caucao.parceria, b.coorte_caucao.n),
  };
  const serie = (k: string) => meses.map((m) => ({ mes: mesCurto(m.mes), v: metricas[k](m.b), parcial: m.parcial }));
  const media6 = (k: string) => media((d.serie ?? []).map((s) => metricas[k](s.bloco)));
  // último mês com maturação suficiente (coortes)
  const ultimoMaduro = (k: string, dias: number) => {
    const ok = meses.filter((m) => fimMaisDias(m.b, dias));
    const m = ok[ok.length - 1];
    return m ? { mes: m.mes, v: metricas[k](m.b), b: m.b } : null;
  };

  // 1. dinheiro
  const receitaDia = div(A.receita.liquida, P.dias);
  const projecaoReceita = receitaDia == null ? null : receitaDia * P.dias_mes;
  const imposto = A.receita.liquida * (impostoPct / 100);
  const fixosMes = (X.custos_fixos.equipe ?? 0) + (X.custos_fixos.escritorio ?? 0);
  const fixos = fixosMes * (P.dias / P.dias_mes);
  const sobra = A.receita.liquida - imposto - A.midia.total_com_fator - fixos;
  const margem = p100(sobra, A.receita.liquida);
  const fixosDesatualizados = !X.custos_fixos.mes_referencia ||
    (new Date(P.ini).getTime() - new Date(X.custos_fixos.mes_referencia).getTime()) > 62 * 86_400_000;
  const totalInc = A.receita.mix_incorporador.parceria_50k + A.receita.mix_incorporador.contrato + A.receita.mix_incorporador.a010 + A.receita.mix_incorporador.outros;
  const pctParceria = p100(A.receita.mix_incorporador.parceria_50k, totalInc);
  const recAnt = B?.receita.liquida ?? null;
  const varReceita = recAnt ? ((A.receita.liquida - recAnt) / recAnt) * 100 : null;
  const tomReceita: Tom = varReceita == null ? "neutro" : varReceita < -15 ? "alerta" : varReceita < -5 ? "atencao" : "ok";

  // 2. vendas
  const ticket = div(A.vendas.parcerias_valor, A.vendas.parcerias);
  const ticketMedio6 = media6("ticket");
  const projecaoParcerias = A.vendas.parcerias / P.dias * P.dias_mes;
  const metaContratosHoje = metaContratosDia == null ? null : metaContratosDia * X.calendario.dias_uteis_decorridos;
  const metaContratosMes = metaContratosDia == null ? null : metaContratosDia * X.calendario.dias_uteis_mes;
  const atingContratos = p100(A.vendas.contratos_oficial.total, metaContratosHoje);
  const contratosLiquidos = A.vendas.contratos_oficial.total - A.vendas.caucoes_estornadas;
  const tomContratos: Tom = atingContratos == null ? "neutro" : atingContratos < 90 ? "alerta" : atingContratos < 100 ? "atencao" : "ok";
  const estornoMaduro = ultimoMaduro("estorno", 30);

  // 3. máquina
  const a010Maduro = ultimoMaduro("a010parceria", 14);
  const a010Parceria = a010Maduro;
  const a010Parceria14 = a010Maduro ? p100(a010Maduro.b.coorte_a010.parceria_14d, a010Maduro.b.coorte_a010.n) : null;
  const custoParceria = div(A.midia.conversao_com_fator, A.funil.anuncio.parcerias);
  const ticketPosImposto = ticket == null ? null : ticket * (1 - impostoPct / 100);
  const retornoParceria = div(A.vendas.parcerias_midia_valor, A.midia.conversao_com_fator);

  const passagem = (nome: string, k: string, opts: { inverso?: boolean; meta?: number | null; maturar?: number; nota: string }) => {
    const usarMaduro = opts.maturar != null;
    const base = opts.maturar != null ? ultimoMaduro(k, opts.maturar) : { mes: P.ini.slice(0, 7), v: metricas[k](A), b: A };
    const val = base?.v ?? null;
    const med = media6(k);
    const desvio = val == null || med == null ? null : (opts.inverso ? med - val : val - med); // negativo = pior
    const tom: Tom = desvio == null ? "neutro" : desvio < -5 ? "alerta" : desvio < -2 ? "atencao" : "ok";
    return { nome, v: val, media: med, meta: opts.meta ?? null, desvio, tom,
             nota: `${opts.nota}${usarMaduro && base ? ` · coorte de ${mesCurto(base.mes)}` : ""}` };
  };
  const passagens = [
    passagem("Comprador A010 → R1 agendada", "a010r1a", { meta: metaA010R1a, maturar: 14, nota: "coorte, pessoa" }),
    passagem("No-show da R1", "noshow", { inverso: true, nota: "linha da agenda, mês atual" }),
    passagem("R1 realizada → contrato", "r1contrato", { meta: metaConvR1, nota: "negócio, mês atual" }),
    passagem("Contrato → parceria", "caucaoParceria", { maturar: 30, nota: "coorte, pessoa" }),
  ];
  const piores = passagens.filter((p) => p.desvio != null && p.desvio < -2).sort((a, b) => (a.desvio ?? 0) - (b.desvio ?? 0));
  const gargalo = piores[0] ?? null;

  // 4. topo
  const a010Dia = div(A.vendas.compradores_a010, P.dias);
  const tomA010: Tom = a010Dia == null || metaA010 == null ? "neutro" : a010Dia < metaA010 * 0.7 ? "alerta" : a010Dia < metaA010 ? "atencao" : "ok";
  const midiaSemana = A.midia.total_bruto / P.dias * 7;
  const cpaBruto = div(A.midia.conversao_bruto, A.funil.anuncio.a010);
  const pctAnuncio = p100(A.midia.liq_total_anuncio, A.midia.liq_total_bu);

  // 5. BUs
  const diasSemCota = diasDesde(X.consorcio_fila.ultima_cota_aberta);

  // 6. time
  const closersR1 = X.closers.filter((c) => c.bu === "incorporador" && c.tipo === "r1" && c.contratos_liquidos > 0)
    .sort((a, b) => b.contratos_liquidos - a.contratos_liquidos);
  const totR1 = closersR1.reduce((s, c) => s + c.contratos_liquidos, 0);
  const concentracao = totR1 ? p100(closersR1.slice(0, 2).reduce((s, c) => s + c.contratos_liquidos, 0), totR1) : null;
  const closersR1SemProducao = X.closers_ativos.filter((c) => c.bu === "incorporador" && c.tipo === "r1").reduce((s, c) => s + c.sem_producao, 0);
  const closersConsorcio = X.closers.filter((c) => c.bu === "consorcio" && c.atendidos > 0).sort((a, b) => b.vendas_consorcio - a.vendas_consorcio);
  const closersAtivosTotal = X.closers_ativos.reduce((s, c) => s + c.n, 0);

  // 7. riscos fixos
  const diasApiMeta = Math.max(0, Math.ceil((new Date("2027-01-21T00:00:00").getTime() - hoje.getTime()) / 86_400_000));

  // alertas do topo (só o que pede decisão; dívidas conhecidas ficam na seção 7)
  const alertas: { tom: Tom; texto: string }[] = [];
  if (varReceita != null && varReceita < -10)
    alertas.push({ tom: varReceita < -20 ? "alerta" : "atencao", texto: `Receita líquida ${num(Math.abs(varReceita), 0)}% abaixo dos mesmos dias do mês anterior (${brlCurto(A.receita.liquida)} contra ${brlCurto(recAnt)}).` });
  if (atingContratos != null && atingContratos < 90)
    alertas.push({ tom: "alerta", texto: `Contratos em ${pct(atingContratos, 0)} da meta até hoje (${num(A.vendas.contratos_oficial.total)} de ${num(metaContratosHoje)}).` });
  if (a010Parceria?.v != null && empate != null && a010Parceria.v < empate)
    alertas.push({ tom: "alerta", texto: `Comprador A010 → parceria em ${pct(a010Parceria.v)} (coorte de ${mesCurto(a010Parceria.mes)}), abaixo do empate de ${pct(empate, 2)}.` });
  if (a010Dia != null && metaA010 != null && a010Dia < metaA010 * 0.7)
    alertas.push({ tom: "atencao", texto: `Topo do funil: ${num(a010Dia, 1)} compradores de A010 por dia, contra a meta de ${num(metaA010)}.` });
  if (gargalo && gargalo.tom === "alerta")
    alertas.push({ tom: "atencao", texto: `${gargalo.nome} em ${pct(gargalo.v)}, contra a média de 6 meses de ${pct(gargalo.media)}.` });
  if (diasSemCota != null && diasSemCota > 7 && X.consorcio_fila.n > 0)
    alertas.push({ tom: "alerta", texto: `Consórcio: nenhuma cota aberta há ${diasSemCota} dias, com ${num(X.consorcio_fila.n)} propostas (${brlCurto(X.consorcio_fila.credito)}) na fila.` });
  for (const g of X.saude.gateways) {
    const dd = diasDesde(g.ultima_venda);
    if (dd != null && dd > 2) alertas.push({ tom: "atencao", texto: `Nenhuma venda pela ${nomeGateway(g.source)} há ${dd} dias.` });
  }
  if (diasApiMeta < 45) alertas.push({ tom: "alerta", texto: `A API da Meta usada nos números de mídia para em ${diasApiMeta} dias (21/01/2027).` });

  return {
    impostoPct, metaA010, tetoMidia, cpaMax, empate,
    serie, alertas,
    receitaDia, projecaoReceita, imposto, fixos, sobra, margem, fixosDesatualizados, pctParceria, tomReceita,
    ticket, ticketMedio6, projecaoParcerias, metaContratosHoje, metaContratosMes, atingContratos, contratosLiquidos, tomContratos, estornoMaduro,
    a010Parceria, a010Parceria14, custoParceria, ticketPosImposto, retornoParceria, passagens, gargalo,
    a010Dia, tomA010, midiaSemana, cpaBruto, pctAnuncio,
    diasSemCota, closersR1, concentracao, closersR1SemProducao, closersConsorcio, closersAtivosTotal, diasApiMeta,
  };
}