import { useState } from "react";
import { FunilSafras } from "@/components/marketing/FunilSafras";
import { CriativosTable } from "@/components/marketing/CriativosTable";
import { useCanaisPeriodo, CANAL_LABELS, formatInt, type Grao } from "@/hooks/useMarketingFunil";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

const MIN_DATE = "2025-12-01";
type Preset = "90dias" | "mes" | "mes-passado" | "2026" | "personalizado";
const presets: { value: Preset; label: string }[] = [
  { value: "90dias", label: "Últimos 90 dias" },
  { value: "mes", label: "Este mês" },
  { value: "mes-passado", label: "Mês passado" },
  { value: "2026", label: "2026" },
  { value: "personalizado", label: "Personalizado" },
];

// Read the civil date in Brasília; UTC below is only a calendar arithmetic
// container, never a conversion of the user's date or a timestamp sent to an RPC.
function todayBrasilia(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function calendarDate(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}
function presetPeriod(preset: Exclude<Preset, "personalizado">) {
  const today = todayBrasilia();
  const [year, month, day] = today.split("-").map(Number);
  if (preset === "mes") return { from: calendarDate(year, month, 1), to: today };
  if (preset === "mes-passado") return { from: calendarDate(year, month - 1, 1), to: calendarDate(year, month, 0) };
  if (preset === "2026") return { from: "2026-01-01", to: "2026-12-31" };
  return { from: calendarDate(year, month, day - 89), to: today };
}
function clampDate(date: string) { return date && date < MIN_DATE ? MIN_DATE : date; }
const percentage = (value: number, total: number) => total > 0 ? value / total * 100 : null;
const formatPercent = (value: number | null) => value === null ? "—" : `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const numericCell = "whitespace-nowrap px-[12px] py-[12px] text-right tabular-nums";

function CanaisPeriodo({ from, to }: { from: string; to: string }) {
  const { data, isLoading, error } = useCanaisPeriodo({ from, to });
  const rows = data ?? [];
  const totals = rows.reduce((acc, row) => ({
    entradas: acc.entradas + row.entradas,
    r1_realizadas: acc.r1_realizadas + row.r1_realizadas,
    contratos: acc.contratos + row.contratos,
    parcerias: acc.parcerias + row.parcerias,
  }), { entradas: 0, r1_realizadas: 0, contratos: 0, parcerias: 0 });

  return <Card className="min-w-0">
    <CardHeader className="space-y-[8px] p-[20px]">
      <CardTitle className="text-[18px] tracking-normal">De onde vieram as conversões do período</CardTitle>
      <CardDescription className="text-[12px] leading-[1.6]">Aqui é por data do evento: conta o contrato/parceria que aconteceu no período, atribuído ao canal de origem da pessoa (primeiro toque). Use para saber a participação de cada canal; para custo, use as abas anteriores.</CardDescription>
    </CardHeader>
    <CardContent className="p-[20px] pt-0">
      {isLoading ? <div role="status" aria-label="Carregando canais" className="space-y-[12px]">
        {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-[40px] w-full" />)}
      </div> : error ? <Alert variant="destructive" className="p-[16px]"><AlertDescription className="text-[13px]">{typeof error === "object" && "message" in error ? String(error.message) : String(error)}</AlertDescription></Alert>
        : !rows.length ? <p className="py-[32px] text-center text-[14px] text-muted-foreground">Sem dados no período</p>
        : <Table className="min-w-[900px] text-[12px]">
          <TableHeader><TableRow>
            <TableHead scope="col" className="px-[12px] py-[12px] text-[12px]">Canal</TableHead>
            {["Entradas", "R1 realizadas", "Contratos", "% dos contratos", "Parcerias", "% das parcerias"].map(label => <TableHead key={label} scope="col" className={`${numericCell} text-[12px]`}>{label}</TableHead>)}
          </TableRow></TableHeader>
          <TableBody>{rows.map((row, index) => {
            const contractShare = percentage(row.contratos, totals.contratos);
            return <TableRow key={`${row.canal}-${row.origem ?? ""}-${index}`}>
              <TableCell className="min-w-[200px] px-[12px] py-[12px]">{row.origem ? `Formulário orgânico · ${row.origem}` : CANAL_LABELS[row.canal] ?? row.canal}</TableCell>
              <TableCell className={numericCell}>{formatInt(row.entradas)}</TableCell>
              <TableCell className={numericCell}>{formatInt(row.r1_realizadas)}</TableCell>
              <TableCell className={numericCell}>{formatInt(row.contratos)}</TableCell>
              <TableCell className={numericCell}>
                <div className="ml-auto w-[100px] space-y-[6px]">
                  <span>{formatPercent(contractShare)}</span>
                  <progress aria-label={`Participação nos contratos: ${CANAL_LABELS[row.canal] ?? row.canal}`} value={contractShare ?? 0} max={100} className="block h-[4px] w-full overflow-hidden rounded-[2px] border-0 bg-muted [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary" />
                </div>
              </TableCell>
              <TableCell className={numericCell}>{formatInt(row.parcerias)}</TableCell>
              <TableCell className={numericCell}>{formatPercent(percentage(row.parcerias, totals.parcerias))}</TableCell>
            </TableRow>;
          })}</TableBody>
          <TableFooter><TableRow>
            <TableCell className="px-[12px] py-[12px] font-semibold">TOTAL</TableCell>
            <TableCell className={numericCell}>{formatInt(totals.entradas)}</TableCell>
            <TableCell className={numericCell}>{formatInt(totals.r1_realizadas)}</TableCell>
            <TableCell className={numericCell}>{formatInt(totals.contratos)}</TableCell>
            <TableCell className={numericCell}>{formatPercent(percentage(totals.contratos, totals.contratos))}</TableCell>
            <TableCell className={numericCell}>{formatInt(totals.parcerias)}</TableCell>
            <TableCell className={numericCell}>{formatPercent(percentage(totals.parcerias, totals.parcerias))}</TableCell>
          </TableRow></TableFooter>
        </Table>}
    </CardContent>
  </Card>;
}

export default function MarketingMCF() {
  const [preset, setPreset] = useState<Preset>("90dias");
  const [period, setPeriod] = useState(() => presetPeriod("90dias"));
  const [grao, setGrao] = useState<Grao>("month");
  const [tab, setTab] = useState("funil");
  const [wasClamped, setWasClamped] = useState(false);
  const from = clampDate(period.from), to = clampDate(period.to);
  const validPeriod = !!from && !!to && from <= to;
  const choosePreset = (value: Preset) => {
    setPreset(value);
    if (value !== "personalizado") {
      const next = presetPeriod(value);
      setPeriod({ from: clampDate(next.from), to: clampDate(next.to) });
      setWasClamped(next.from < MIN_DATE || next.to < MIN_DATE);
    }
  };
  const changeDate = (key: "from" | "to", value: string) => {
    setWasClamped(!!value && value < MIN_DATE);
    setPeriod(current => ({ ...current, [key]: clampDate(value) }));
  };

  return <section className="min-w-0 space-y-[24px] p-[16px] text-foreground md:p-[24px]">
    <header className="flex flex-wrap items-start justify-between gap-[16px]">
      <div className="min-w-0 space-y-[8px]">
        <h1 className="text-[26px] font-semibold leading-tight tracking-normal">Marketing MCF</h1>
        <p className="text-[13px] leading-[1.6] text-muted-foreground">Do anúncio à parceria: quanto custa e quanto volta cada etapa (BU Incorporador, Meta Ads)</p>
      </div>
      <p className="max-w-[320px] text-[11px] leading-[1.6] text-muted-foreground">Custos da Meta atualizados todo dia às 06h10; vendas e agenda a cada hora.</p>
    </header>

    <div className="space-y-[12px] border-y border-border py-[16px]">
      <div className="flex flex-wrap items-center justify-between gap-[16px]">
        <div role="group" aria-label="Período" className="flex flex-wrap gap-[6px]">
          {presets.map(item => <Button key={item.value} variant={preset === item.value ? "secondary" : "ghost"} aria-pressed={preset === item.value} onClick={() => choosePreset(item.value)} className="h-[36px] px-[12px] text-[12px]">{item.label}</Button>)}
        </div>
        <div className="flex items-center gap-[8px]">
          <span id="marketing-agrupamento" className="text-[12px] text-muted-foreground">Agrupamento</span>
          <Select value={grao} onValueChange={value => { if (value === "month" || value === "week" || value === "day") setGrao(value); }} disabled={tab !== "funil"}>
            <SelectTrigger aria-labelledby="marketing-agrupamento" className="h-[36px] w-[120px] px-[10px] text-[12px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="month" className="py-[8px] text-[12px]">Mês</SelectItem><SelectItem value="week" className="py-[8px] text-[12px]">Semana</SelectItem><SelectItem value="day" className="py-[8px] text-[12px]">Dia</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
      {preset === "personalizado" && <div className="flex flex-wrap gap-[12px]">
        <label className="space-y-[6px] text-[12px] text-muted-foreground">De<Input type="date" min={MIN_DATE} value={from} onChange={event => changeDate("from", event.target.value)} className="h-[38px] w-[180px] px-[10px] text-[12px] text-foreground" /></label>
        <label className="space-y-[6px] text-[12px] text-muted-foreground">Até<Input type="date" min={MIN_DATE} value={to} onChange={event => changeDate("to", event.target.value)} className="h-[38px] w-[180px] px-[10px] text-[12px] text-foreground" /></label>
      </div>}
      {(wasClamped || period.from < MIN_DATE || period.to < MIN_DATE) && <p className="text-[11px] text-muted-foreground">Custos da Meta começam em 01/12/2025</p>}
    </div>

    <Tabs value={tab} onValueChange={setTab} className="min-w-0 space-y-[20px]">
      <TabsList aria-label="Visões de marketing" className="h-auto w-fit max-w-full flex-wrap gap-[4px] p-[4px]">
        <TabsTrigger value="funil" className="h-[36px] px-[12px] text-[12px]">Funil por safra</TabsTrigger>
        <TabsTrigger value="criativos" className="h-[36px] px-[12px] text-[12px]">Anúncios e criativos</TabsTrigger>
        <TabsTrigger value="canais" className="h-[36px] px-[12px] text-[12px]">Canais</TabsTrigger>
      </TabsList>
      {!validPeriod ? <Alert className="p-[16px]"><AlertDescription className="text-[13px]">{!from || !to ? "Selecione as duas datas do período." : "A data inicial deve ser anterior ou igual à data final."}</AlertDescription></Alert> : <>
        <TabsContent value="funil" className="m-0"><FunilSafras from={from} to={to} grao={grao} /></TabsContent>
        <TabsContent value="criativos" className="m-0"><CriativosTable from={from} to={to} /></TabsContent>
        <TabsContent value="canais" className="m-0"><CanaisPeriodo from={from} to={to} /></TabsContent>
      </>}
    </Tabs>
  </section>;
}