import type { ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Info } from "lucide-react";
import { useFunilSafras, useFunilContratos, produtoContratoLabel, formatBRL, formatInt, type FunilSafraRow, type FunilContratoRow, type Grao, type ModeloData, type ModeloToque, type ModeloOrigem } from "@/hooks/useMarketingFunil";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface FunilSafrasProps {
  from: string;
  to: string;
  grao: Grao;
  data: ModeloData;
  toque: ModeloToque;
  origem: ModeloOrigem;
}

const numericFields = [
  "investimento", "investimento_awareness", "lpv", "checkout_iniciado",
  "entradas", "entradas_a010", "entradas_anamnese", "entradas_outras", "r1_agendadas", "r1_realizadas", "contratos", "parcerias", "liq_total",
] as const;
type Totals = Record<(typeof numericFields)[number], number>;

const ratio = (numerator: number, denominator: number) => denominator > 0 ? numerator / denominator : null;
const cost = (investment: number, count: number) => {
  const value = ratio(investment, count);
  return value === null ? "—" : formatBRL(value);
};
const formatRoas = (value: number | null) => value === null ? "—" : `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x`;
const passage = (count: number, previous: number, label: string) => {
  const value = ratio(count, previous);
  return value === null ? "—" : `${(value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% ${label}`;
};

function Hint({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex items-center gap-[4px] align-middle">
          {children ?? <Info aria-label={text} className="h-[13px] w-[13px] shrink-0 text-muted-foreground" />}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className="min-w-[220px] max-w-[340px] whitespace-normal px-3 py-2 text-[11px] leading-[1.45]">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function Roas({ investment, liquid }: { investment: number; liquid: number }) {
  const value = ratio(liquid, investment);
  const color = value === null ? "text-muted-foreground" : value >= 1.5 ? "text-emerald-400" : value >= 1 ? "text-amber-400" : "text-red-400";
  return <span className={`font-semibold tabular-nums ${color}`}>{formatRoas(value)}</span>;
}

function periodLabel(period: string, grain: Grao) {
  const start = parseISO(period.slice(0, 10));
  if (Number.isNaN(start.getTime())) return period;
  return grain === "month" ? format(start, "MMM/yy", { locale: ptBR })
    : grain === "week" ? `semana de ${format(start, "dd/MM")}` : format(start, "dd/MM");
}

const numericCell = "whitespace-nowrap px-[12px] py-[12px] text-right tabular-nums";

function isMaturing(period: string, grain: Grao): boolean {
  const [year, month, day] = period.slice(0, 10).split("-").map(Number);
  const start = Date.UTC(year, month - 1, day);
  const end = grain === "month" ? Date.UTC(year, month, 0)
    : grain === "week" ? start + 6 * 86_400_000 : start;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => Number(parts.find(item => item.type === type)?.value);
  const today = Date.UTC(part("year"), part("month") - 1, part("day"));
  return Number.isFinite(end) && today - end < 60 * 86_400_000;
}

function MetricCells({ row, origem, brutos, reembolsados }: { row: Totals; origem: ModeloOrigem; brutos: number; reembolsados: number }) {
  return (
    <>
      <TableCell className={numericCell}>{formatBRL(row.investimento)}</TableCell>
      <TableCell className={numericCell}>{formatInt(row.lpv)}</TableCell>
      <TableCell className={numericCell}>{formatInt(row.checkout_iniciado)}</TableCell>
      <TableCell className={numericCell}>{formatInt(row.entradas)}</TableCell>
      <TableCell className={numericCell}>{formatInt(row.entradas_a010)}</TableCell>
      <TableCell className={numericCell}>{formatInt(row.entradas_anamnese)}</TableCell>
      <TableCell className={numericCell}>{formatInt(row.entradas_outras)}</TableCell>
      {origem === "anuncio" && <TableCell className={numericCell}>{cost(row.investimento, row.entradas)}</TableCell>}
      <TableCell className={numericCell}>{formatInt(row.r1_agendadas)}</TableCell>
      <TableCell className={numericCell}>{formatInt(row.r1_realizadas)}</TableCell>
      <TableCell className={numericCell}>{formatInt(row.contratos)}</TableCell>
      <TableCell className={numericCell}>{formatInt(brutos)}</TableCell>
      <TableCell className={numericCell}>{formatInt(reembolsados)}</TableCell>
      {origem === "anuncio" && <TableCell className={numericCell}>{cost(row.investimento, row.contratos)}</TableCell>}
      <TableCell className={numericCell}>{formatInt(row.parcerias)}</TableCell>
      {origem === "anuncio" && <TableCell className={numericCell}>{cost(row.investimento, row.parcerias)}</TableCell>}
      <TableCell className={numericCell}>{formatBRL(row.liq_total)}</TableCell>
      {origem === "anuncio" && <TableCell className={numericCell}><Roas investment={row.investimento} liquid={row.liq_total} /></TableCell>}
    </>
  );
}

export function FunilSafras({ from, to, grao, data: modeloData, toque, origem }: FunilSafrasProps) {
  const { data, isLoading, error } = useFunilSafras({ from, to, grao, data: modeloData, toque, origem });
  const anuncios = useFunilSafras({ from: origem === "todas" ? from : null, to: origem === "todas" ? to : null, grao, data: modeloData, toque, origem: "anuncio" });
  const contratos = useFunilContratos({ from, to, grao, data: modeloData, origem });

  if (isLoading || contratos.isLoading || (origem === "todas" && anuncios.isLoading)) return (
    <div role="status" aria-label="Carregando safras" className="space-y-[20px]">
      <div className="grid grid-cols-2 gap-[12px] md:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-[112px] w-full" />)}
      </div>
      <Skeleton className="h-[240px] w-full" />
      <Skeleton className="h-[280px] w-full" />
    </div>
  );

  const queryError = error ?? contratos.error ?? (origem === "todas" ? anuncios.error : null);
  if (queryError) {
    const message = typeof queryError === "object" && "message" in queryError ? String(queryError.message) : String(queryError);
    return <Alert variant="destructive" className="p-[16px]"><AlertDescription className="text-[13px]">{message}</AlertDescription></Alert>;
  }
  if (!data?.length) return <p className="py-[32px] text-center text-[14px] text-muted-foreground">Sem dados no período</p>;

  const rows: FunilSafraRow[] = [...data].sort((a, b) => b.periodo.localeCompare(a.periodo));
  const totals = Object.fromEntries(numericFields.map(field => [field, rows.reduce((sum, row) => sum + row[field], 0)])) as Totals;
  const contratosRows: FunilContratoRow[] = contratos.data ?? [];
  const contratosTotais = {
    brutos: contratosRows.reduce((sum, r) => sum + r.brutos, 0),
    reembolsados: contratosRows.reduce((sum, r) => sum + r.reembolsados, 0),
    liquidos: contratosRows.reduce((sum, r) => sum + r.liquidos, 0),
  };
  const contratosPorProduto = Array.from(
    contratosRows.reduce((map, r) => {
      const item = map.get(r.produto) ?? { brutos: 0, reembolsados: 0, liquidos: 0 };
      item.brutos += r.brutos; item.reembolsados += r.reembolsados; item.liquidos += r.liquidos;
      map.set(r.produto, item);
      return map;
    }, new Map<string, { brutos: number; reembolsados: number; liquidos: number }>()),
  ).map(([produto, v]) => ({ produto, ...v })).sort((a, b) => b.brutos - a.brutos);
  const contratosPorPeriodo = new Map(contratosRows.map(r => [r.periodo, r]));
  const stageDetail = (field: "entradas" | "r1_agendadas" | "r1_realizadas" | "contratos" | "parcerias", label: string) => {
    if (origem === "anuncio") return `${label} ${cost(totals.investimento, totals[field])}`;
    const adCount = (anuncios.data ?? []).reduce((sum, row) => sum + row[field], 0);
    const share = ratio(adCount, totals[field]);
    return share === null ? "— de anúncio" : `${(share * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% de anúncio`;
  };
  const kpis = [
    { label: "Investimento", value: formatBRL(totals.investimento), detail: <Hint text="Conta Distribuição de Conteúdo. Não gera clique para checkout, por isso não entra no custo por venda."><span>+ {formatBRL(totals.investimento_awareness)} em divulgação</span></Hint> },
    { label: "Entradas", value: formatInt(totals.entradas), detail: <><div>A010 {formatInt(totals.entradas_a010)} · Anamnese {formatInt(totals.entradas_anamnese)} · Outras {formatInt(totals.entradas_outras)}</div><div>{stageDetail("entradas", "custo")}</div></> },
    { label: "R1 agendadas", value: formatInt(totals.r1_agendadas), detail: stageDetail("r1_agendadas", "custo por R1 agendada") },
    { label: "R1 realizadas", value: formatInt(totals.r1_realizadas), detail: stageDetail("r1_realizadas", "custo por R1") },
    { label: "Contratos", value: formatInt(totals.contratos), detail: (
      <>
        <div>Bruto {formatInt(contratosTotais.brutos)} · Reembolsados {formatInt(contratosTotais.reembolsados)}</div>
        {contratosPorProduto.map(p => (
          <div key={p.produto}>
            {produtoContratoLabel(p.produto)}: {formatInt(p.liquidos)}
            {p.reembolsados > 0 ? ` (${formatInt(p.brutos)} − ${formatInt(p.reembolsados)} reemb.)` : ""}
          </div>
        ))}
        <div>{stageDetail("contratos", "custo por contrato")}</div>
      </>
    ), hint: "Contrato novo = 1º contrato da pessoa (parcelas mensais do A000 e recompras não contam de novo, só entram no líquido em R$). Bruto = todos os contratos novos do período; Reembolsados = estornados (MCF Pay/Hubla); o número grande é o líquido. O Painel Comercial mostra o bruto." },
    { label: "Parcerias", value: formatInt(totals.parcerias), detail: stageDetail("parcerias", "custo por parceria") },
    { label: "ROAS líquido", value: origem === "todas" ? "—" : formatRoas(ratio(totals.liq_total, totals.investimento)), detail: origem === "todas" ? "ROAS só em Só anúncio" : `${formatBRL(totals.liq_total)} recebidos`, hint: "Dinheiro líquido que entrou no período (vendas de quem veio de anúncio, já descontados os estornos) ÷ investimento do período." },
  ];
  const stages = [
    { label: "Entradas", count: totals.entradas, rate: null },
    { label: "R1 agendada", count: totals.r1_agendadas, rate: passage(totals.r1_agendadas, totals.entradas, "das entradas") },
    { label: "R1 realizada", count: totals.r1_realizadas, rate: passage(totals.r1_realizadas, totals.r1_agendadas, "das agendadas") },
    { label: "Contrato", count: totals.contratos, rate: passage(totals.contratos, totals.r1_realizadas, "das R1") },
    { label: "Parceria", count: totals.parcerias, rate: passage(totals.parcerias, totals.contratos, "dos contratos") },
  ];
  const maximum = Math.max(1, ...stages.map(stage => stage.count));
  const headers = [
    { label: "Investimento" }, { label: "LPV", hint: "Dado da Meta (pixel)" },
    { label: "Checkout iniciado", hint: "Dado da Meta (pixel)" },
    { label: "Entradas", hint: "Pessoas que entraram no período: compra de A010, formulário de anamnese (sem A010) ou outro produto de entrada (Guia, Planilha, A011, Lucrômetro…). Cada pessoa conta 1 vez por período." },
    { label: "A010" }, { label: "Anamnese", hint: "Negócio com tag ANAMNESE criado no período, sem A010 (mesma régua da Visão Diária)" }, { label: "Outras" },
    { label: "Custo/entrada" }, { label: "R1 agendadas", hint: "Pessoas que tiveram uma R1 marcada no período (pela data em que foi marcada)" }, { label: "R1 realizadas", hint: "Pessoas com R1 feita no período (completed, contrato pago ou reembolsado)" }, { label: "Contratos" },
    { label: "Custo/contrato" }, { label: "Parcerias" }, { label: "Custo/parceria" },
    { label: "Líquido recebido" }, { label: "ROAS" },
  ].filter(header => origem === "anuncio" || !["Custo/entrada", "Custo/contrato", "Custo/parceria", "ROAS"].includes(header.label));

  return (
    <TooltipProvider delayDuration={200}>
      <section className="min-w-0 space-y-[20px] text-foreground">
        <div className="grid grid-cols-2 gap-[12px] md:grid-cols-4 xl:grid-cols-7">
          {kpis.map(kpi => (
            <Card key={kpi.label} className="min-w-0">
              <CardContent className="space-y-[8px] p-[16px]">
                <div className="flex items-center gap-[6px] text-[12px] text-muted-foreground">{kpi.label}{kpi.hint && <Hint text={kpi.hint} />}</div>
                <p className="break-words text-[20px] font-semibold leading-tight tabular-nums">{kpi.value}</p>
                <div className="text-[11px] leading-[1.45] text-muted-foreground">{kpi.detail}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="min-w-0">
          <CardHeader className="space-y-[8px] p-[20px]">
            <CardTitle className="text-[18px] tracking-normal">{modeloData === "venda" ? "Funil por data da venda" : "Funil por safra (data do 1º clique)"}</CardTitle>
            <CardDescription className="text-[12px] leading-[1.6]">{modeloData === "venda"
              ? `Cada etapa conta no dia em que aconteceu e é creditada ao ${toque === "primeiro" ? "1º anúncio que a pessoa clicou" : "último anúncio antes daquela etapa"}.${origem === "anuncio" ? " Só entram pessoas que vieram de anúncio." : ""}`
              : "Pessoas agrupadas pelo período do 1º anúncio que clicaram; tudo o que fizeram depois (A010, R1, contrato, parceria) conta nesse período, mesmo meses depois. Safras recentes ainda vão crescer."}{origem === "todas" && " Mostrando a BU inteira (todas as origens); custos e ROAS só aparecem em Só anúncio."}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-[24px] p-[20px] pt-0">
            <div className="space-y-[16px]">
              {stages.map(stage => (
                <div key={stage.label} className="space-y-[6px]">
                  <div className="flex flex-wrap items-baseline justify-between gap-[8px] text-[13px]">
                    <span className="font-medium">{stage.label} <span className="ml-[8px] tabular-nums">{formatInt(stage.count)}</span></span>
                    {stage.rate && <span className="text-[11px] text-muted-foreground tabular-nums">{stage.rate}</span>}
                  </div>
                  <progress aria-label={stage.label} value={stage.count} max={maximum} className="block h-[12px] w-full overflow-hidden rounded-[4px] border-0 bg-muted [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary" />
                </div>
              ))}
            </div>

            {from < "2026-01-01" && <Alert className="p-[12px]"><AlertDescription className="text-[12px] leading-[1.5]">Antes de jan/26 a agenda de R1 está incompleta; R1 e taxas desse período não são confiáveis.</AlertDescription></Alert>}

            <Table className="min-w-[1250px] text-[12px]">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col" className="px-[12px] py-[12px] text-[12px]">Período</TableHead>
                  {headers.map(header => <TableHead key={header.label} scope="col" className="whitespace-nowrap px-[12px] py-[12px] text-right text-[12px]">{header.hint ? <Hint text={header.hint}><span className="inline-flex items-center gap-[4px]">{header.label}<Info className="h-[12px] w-[12px]" /></span></Hint> : header.label}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(row => (
                  <TableRow key={row.periodo}>
                    <TableCell className="whitespace-nowrap px-[12px] py-[12px]">
                      {periodLabel(row.periodo, grao)}
                      {modeloData === "safra" && isMaturing(row.periodo, grao) && <Hint text="Parte das pessoas dessa safra ainda está no meio do funil"><Badge variant="outline" className="ml-[6px] px-[6px] py-[2px] text-[10px] font-normal">em maturação</Badge></Hint>}
                    </TableCell>
                    <MetricCells row={row} origem={origem} brutos={contratosPorPeriodo.get(row.periodo)?.brutos ?? 0} reembolsados={contratosPorPeriodo.get(row.periodo)?.reembolsados ?? 0} />
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="hover:bg-muted/50">
                  <TableCell className="whitespace-nowrap px-[12px] py-[12px] font-semibold">TOTAL</TableCell>
                  <MetricCells row={totals} origem={origem} brutos={contratosTotais.brutos} reembolsados={contratosTotais.reembolsados} />
                </TableRow>
              </TableFooter>
            </Table>
            <p className="text-[11px] leading-[1.5] text-muted-foreground">Leads (checkout abandonado) só passaram a ser registrados em 19/04/26 e Kiwify em 16/06/26. Para comparar meses, use Entradas.</p>
          </CardContent>
        </Card>
      </section>
    </TooltipProvider>
  );
}
