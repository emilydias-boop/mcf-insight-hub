import type { ReactNode } from "react";
import { addDays, differenceInCalendarDays, endOfMonth, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Info } from "lucide-react";
import { useFunilSafras, formatBRL, formatInt, type FunilSafraRow, type Grao } from "@/hooks/useMarketingFunil";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface FunilSafrasProps {
  from: string;
  to: string;
  grao: Grao;
}

const numericFields = [
  "investimento", "investimento_awareness", "lpv", "checkout_iniciado",
  "entradas", "r1_realizadas", "contratos", "parcerias", "liq_total",
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

function periodInfo(period: string, grain: Grao, today: Date) {
  const start = parseISO(period.slice(0, 10));
  if (Number.isNaN(start.getTime())) return { label: period, maturing: false };
  const end = grain === "month" ? endOfMonth(start) : grain === "week" ? addDays(start, 6) : start;
  const label = grain === "month" ? format(start, "MMM/yy", { locale: ptBR })
    : grain === "week" ? `semana de ${format(start, "dd/MM")}` : format(start, "dd/MM");
  return { label, maturing: differenceInCalendarDays(today, end) < 90 };
}

const numericCell = "whitespace-nowrap px-[12px] py-[12px] text-right tabular-nums";

function MetricCells({ row }: { row: Totals }) {
  return (
    <>
      <TableCell className={numericCell}>{formatBRL(row.investimento)}</TableCell>
      <TableCell className={numericCell}>{formatInt(row.lpv)}</TableCell>
      <TableCell className={numericCell}>{formatInt(row.checkout_iniciado)}</TableCell>
      <TableCell className={numericCell}>{formatInt(row.entradas)}</TableCell>
      <TableCell className={numericCell}>{cost(row.investimento, row.entradas)}</TableCell>
      <TableCell className={numericCell}>{formatInt(row.r1_realizadas)}</TableCell>
      <TableCell className={numericCell}>{formatInt(row.contratos)}</TableCell>
      <TableCell className={numericCell}>{cost(row.investimento, row.contratos)}</TableCell>
      <TableCell className={numericCell}>{formatInt(row.parcerias)}</TableCell>
      <TableCell className={numericCell}>{cost(row.investimento, row.parcerias)}</TableCell>
      <TableCell className={numericCell}>{formatBRL(row.liq_total)}</TableCell>
      <TableCell className={numericCell}><Roas investment={row.investimento} liquid={row.liq_total} /></TableCell>
    </>
  );
}

export function FunilSafras({ from, to, grao }: FunilSafrasProps) {
  const { data, isLoading, error } = useFunilSafras({ from, to, grao });

  if (isLoading) return (
    <div role="status" aria-label="Carregando safras" className="space-y-[20px]">
      <div className="grid grid-cols-2 gap-[12px] md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[112px] w-full" />)}
      </div>
      <Skeleton className="h-[240px] w-full" />
      <Skeleton className="h-[280px] w-full" />
    </div>
  );

  if (error) {
    const message = typeof error === "object" && "message" in error ? String(error.message) : String(error);
    return <Alert variant="destructive" className="p-[16px]"><AlertDescription className="text-[13px]">{message}</AlertDescription></Alert>;
  }
  if (!data?.length) return <p className="py-[32px] text-center text-[14px] text-muted-foreground">Sem dados no período</p>;

  const rows: FunilSafraRow[] = [...data].sort((a, b) => b.periodo.localeCompare(a.periodo));
  const totals = Object.fromEntries(numericFields.map(field => [field, rows.reduce((sum, row) => sum + row[field], 0)])) as Totals;
  // Use the reporting timezone without converting date-only periods through UTC.
  const todayParts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => todayParts.find(item => item.type === type)?.value ?? "";
  const today = parseISO(`${part("year")}-${part("month")}-${part("day")}`);
  const kpis = [
    { label: "Investimento", value: formatBRL(totals.investimento), detail: <Hint text="Conta Distribuição de Conteúdo. Não gera clique para checkout, por isso não entra no custo por venda."><span>+ {formatBRL(totals.investimento_awareness)} em divulgação</span></Hint> },
    { label: "Entradas A010", value: formatInt(totals.entradas), detail: `custo ${cost(totals.investimento, totals.entradas)}` },
    { label: "R1 realizadas", value: formatInt(totals.r1_realizadas), detail: `custo por R1 ${cost(totals.investimento, totals.r1_realizadas)}` },
    { label: "Contratos", value: formatInt(totals.contratos), detail: `custo por contrato ${cost(totals.investimento, totals.contratos)}` },
    { label: "Parcerias", value: formatInt(totals.parcerias), detail: `custo por parceria ${cost(totals.investimento, totals.parcerias)}` },
    { label: "ROAS líquido", value: formatRoas(ratio(totals.liq_total, totals.investimento)), detail: `${formatBRL(totals.liq_total)} recebidos`, hint: "Dinheiro líquido já recebido das pessoas dessas safras ÷ investimento. Safras recentes ainda vão crescer." },
  ];
  const stages = [
    { label: "Entradas", count: totals.entradas, rate: null },
    { label: "R1 realizada", count: totals.r1_realizadas, rate: passage(totals.r1_realizadas, totals.entradas, "das entradas") },
    { label: "Contrato", count: totals.contratos, rate: passage(totals.contratos, totals.r1_realizadas, "das R1") },
    { label: "Parceria", count: totals.parcerias, rate: passage(totals.parcerias, totals.contratos, "dos contratos") },
  ];
  const maximum = Math.max(1, ...stages.map(stage => stage.count));
  const headers = [
    { label: "Investimento" }, { label: "LPV", hint: "Dado da Meta (pixel)" },
    { label: "Checkout iniciado", hint: "Dado da Meta (pixel)" },
    { label: "Entradas", hint: "Compradores de A010 cujo primeiro anúncio foi nesse período" },
    { label: "Custo/entrada" }, { label: "R1 realizadas" }, { label: "Contratos" },
    { label: "Custo/contrato" }, { label: "Parcerias" }, { label: "Custo/parceria" },
    { label: "Líquido recebido" }, { label: "ROAS" },
  ];

  return (
    <TooltipProvider delayDuration={200}>
      <section className="min-w-0 space-y-[20px] text-foreground">
        <div className="grid grid-cols-2 gap-[12px] md:grid-cols-3 xl:grid-cols-6">
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
            <CardTitle className="text-[18px] tracking-normal">Funil por safra</CardTitle>
            <CardDescription className="text-[12px] leading-[1.6]">Safra = pessoas agrupadas pelo período do primeiro anúncio que clicaram. A010, R1, contrato e parceria contam nessa safra, mesmo meses depois.</CardDescription>
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
                {rows.map(row => {
                  const period = periodInfo(row.periodo, grao, today);
                  return (
                    <TableRow key={row.periodo}>
                      <TableCell className="whitespace-nowrap px-[12px] py-[12px]">
                        <span className="inline-flex items-center gap-[8px]">
                          {period.label}
                          {period.maturing && <Hint text="Parte das pessoas dessa safra ainda está no meio do funil (R1, contrato, parceria)."><Badge variant="outline" className="px-[6px] py-[2px] text-[10px] font-normal text-muted-foreground">em maturação</Badge></Hint>}
                        </span>
                      </TableCell>
                      <MetricCells row={row} />
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow className="hover:bg-muted/50">
                  <TableCell className="whitespace-nowrap px-[12px] py-[12px] font-semibold">TOTAL</TableCell>
                  <MetricCells row={totals} />
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