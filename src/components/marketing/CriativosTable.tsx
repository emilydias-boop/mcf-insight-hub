import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, ImageOff } from "lucide-react";
import { useFunilAnuncios, formatBRL, formatInt, type FunilAnuncioRow, type Nivel, type ModeloData, type ModeloToque } from "@/hooks/useMarketingFunil";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CriativosTableProps { from: string; to: string; data: ModeloData; toque: ModeloToque }
type NumericKey = { [K in keyof FunilAnuncioRow]: FunilAnuncioRow[K] extends number | null ? K : never }[keyof FunilAnuncioRow];
type SortKey = NumericKey | "nome" | "status";
type MetricFormat = "money" | "integer" | "percent" | "roas";

const levels: { value: Nivel; label: string }[] = [
  { value: "criativo", label: "Criativo" }, { value: "ad", label: "Anúncio" },
  { value: "adset", label: "Conjunto" }, { value: "campaign", label: "Campanha" },
];
const columns: { key: NumericKey; label: string; format: MetricFormat; cost?: boolean }[] = [
  { key: "investimento", label: "Investimento", format: "money" },
  { key: "ctr", label: "CTR", format: "percent" },
  { key: "cpm", label: "CPM", format: "money", cost: true },
  { key: "taxa_lpv_checkout", label: "LPV→Checkout", format: "percent" },
  { key: "entradas", label: "Entradas", format: "integer" },
  { key: "custo_entrada", label: "Custo/entrada", format: "money", cost: true },
  { key: "r1_realizadas", label: "R1 realizadas", format: "integer" },
  { key: "contratos", label: "Contratos", format: "integer" },
  { key: "custo_contrato", label: "Custo/contrato", format: "money", cost: true },
  { key: "parcerias", label: "Parcerias", format: "integer" },
  { key: "custo_parceria", label: "Custo/parceria", format: "money", cost: true },
  { key: "liq_total", label: "Líquido", format: "money" },
  { key: "roas_liquido", label: "ROAS", format: "roas" },
];
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
const divide = (a: number, b: number) => b > 0 ? a / b : null;
const decimal = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const metricText = (value: number | null, kind: MetricFormat): string => {
  if (value === null) return "—";
  if (kind === "money") return formatBRL(value);
  if (kind === "integer") return formatInt(value);
  return `${decimal(value)}${kind === "percent" ? "%" : "x"}`;
};
const smallSample = (row: FunilAnuncioRow) => row.investimento < 5000 || row.entradas < 20;
const roasColor = (value: number | null) => value === null ? "text-muted-foreground"
  : value >= 1.5 ? "text-emerald-400" : value >= 1 ? "text-amber-400" : "text-red-400";
const statusText = (status: string | null) => status === "ACTIVE" ? "Ativo"
  : ["PAUSED", "CAMPAIGN_PAUSED", "ADSET_PAUSED"].includes(status ?? "") ? "Pausado" : status ?? "—";
const numericCell = "whitespace-nowrap px-[12px] py-[12px] text-right tabular-nums";

function Hint({ text, children }: { text: string; children: ReactNode }) {
  return <Tooltip><TooltipTrigger asChild><span tabIndex={0} className="inline-flex items-center gap-[4px]">{children}</span></TooltipTrigger>
    <TooltipContent side="top" sideOffset={6} className="min-w-[220px] max-w-[340px] whitespace-normal px-3 py-2 text-[11px] leading-[1.45]">{text}</TooltipContent>
  </Tooltip>;
}

function Thumbnail({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return <div className="flex h-[44px] w-[44px] shrink-0 items-center justify-center overflow-hidden rounded-[4px] bg-muted">
    {src && !failed ? <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      : <ImageOff aria-label="Miniature indisponível" className="h-[18px] w-[18px] text-muted-foreground" />}
  </div>;
}

function Metrics({ row, total = false }: { row: FunilAnuncioRow; total?: boolean }) {
  return <>{columns.map(column => {
    const value = row[column.key];
    const uncertain = !total && smallSample(row) && (column.cost || column.format === "roas");
    const color = uncertain ? "text-muted-foreground" : column.format === "roas" ? roasColor(value) : value === null ? "text-muted-foreground" : "";
    const text = <span className={color}>{metricText(value, column.format)}</span>;
    return <TableCell key={column.key} className={numericCell}>
      {uncertain ? <Hint text="Amostra pequena — ainda não dá para concluir">{text}</Hint> : text}
    </TableCell>;
  })}</>;
}

function sumRows(rows: FunilAnuncioRow[]): FunilAnuncioRow {
  const sum = (key: NumericKey) => rows.reduce((acc, row) => acc + (row[key] ?? 0), 0);
  const investment = sum("investimento"), impressions = sum("impressoes"), clicks = sum("cliques_link");
  const lpv = sum("lpv"), checkout = sum("checkout_iniciado"), entradas = sum("entradas");
  const r1 = sum("r1_realizadas"), contracts = sum("contratos"), partners = sum("parcerias"), liquid = sum("liq_total");
  const ctr = divide(clicks * 100, impressions), cpm = divide(investment * 1000, impressions);
  return {
    nivel_id: "total", nome: "TOTAL", campanha: null, conjunto: null, conta: "", status: null, thumbnail_url: null,
    investimento: investment, impressoes: impressions, cliques_link: clicks, lpv, checkout_iniciado: checkout,
    compras_pixel: sum("compras_pixel"), video_3s: sum("video_3s"), thruplays: sum("thruplays"), leads: sum("leads"),
    entradas, r1_agendadas: sum("r1_agendadas"), r1_realizadas: r1, contratos: contracts,
    r2_realizadas: sum("r2_realizadas"), parcerias: partners, liq_total: liquid, liq_parceria: sum("liq_parceria"),
    ctr, cpm, cpc: divide(investment, clicks), taxa_lpv_checkout: divide(checkout * 100, lpv),
    custo_entrada: divide(investment, entradas), custo_r1_realizada: divide(investment, r1),
    custo_contrato: divide(investment, contracts), custo_parceria: divide(investment, partners), roas_liquido: divide(liquid, investment),
  };
}

// Quote every cell and neutralize spreadsheet formulas in text supplied by ad names.
const csvCell = (value: string) => `"${(/^[\s]*[=+@-]/.test(value) ? `'${value}` : value).replace(/"/g, '""')}"`;
function exportCsv(rows: FunilAnuncioRow[], nivel: Nivel, data: ModeloData, toque: ModeloToque, from: string, to: string) {
  const thumbnails = nivel === "criativo" || nivel === "ad";
  const header = [...(thumbnails ? ["Miniatura"] : []), "Nome", "Campanha", "Conjunto", "Conta", "Status", ...columns.map(c => c.label)];
  const lines = rows.map(row => [
    ...(thumbnails ? [row.thumbnail_url ?? ""] : []), row.nome, row.campanha ?? "", row.conjunto ?? "", row.conta ?? "", statusText(row.status),
    ...columns.map(column => metricText(row[column.key], column.format)),
  ].map(csvCell).join(";"));
  const blob = new Blob(["\uFEFF", header.map(csvCell).join(";"), "\r\n", lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `marketing-${nivel}-${data}-${toque}-${from}_a_${to}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function CriativosTable({ from, to, data: modeloData, toque }: CriativosTableProps) {
  const [nivel, setNivel] = useState<Nivel>("criativo");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; direction: "desc" | "asc" }>({ key: "investimento", direction: "desc" });
  const [limit, setLimit] = useState(30);
  const { data, isLoading, error } = useFunilAnuncios({ from, to, nivel, data: modeloData, toque });
  useEffect(() => setLimit(30), [from, to, nivel, search, sort]);
  const filtered = useMemo(() => {
    const needle = normalize(search.trim());
    return (data ?? []).filter(row => normalize(row.nome ?? "").includes(needle)).sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      if (av === null) return bv === null ? 0 : 1;
      if (bv === null) return -1;
      const comparison = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "pt-BR");
      return sort.direction === "desc" ? -comparison : comparison;
    });
  }, [data, search, sort]);
  const totals = useMemo(() => sumRows(filtered), [filtered]);
  // Highlights describe the entire current level, independently of name search and pagination.
  const bestCost = useMemo(() => (data ?? []).filter(r => r.contratos >= 10 && r.custo_contrato !== null)
    .sort((a, b) => (a.custo_contrato ?? Infinity) - (b.custo_contrato ?? Infinity))[0], [data]);
  const bestRoas = useMemo(() => (data ?? []).filter(r => r.investimento >= 20000 && r.roas_liquido !== null)
    .sort((a, b) => (b.roas_liquido ?? -Infinity) - (a.roas_liquido ?? -Infinity))[0], [data]);
  const worstSpend = useMemo(() => (data ?? []).filter(r => r.investimento >= 20000 && r.roas_liquido !== null && r.roas_liquido < 1)
    .sort((a, b) => b.investimento - a.investimento)[0], [data]);
  const hasThumbnails = nivel === "criativo" || nivel === "ad";
  const highlights = [
    { label: "Menor custo por contrato", row: bestCost, value: metricText(bestCost?.custo_contrato ?? null, "money"), criterion: "Contratos ≥ 10", empty: "—" },
    { label: "Maior ROAS", row: bestRoas, value: metricText(bestRoas?.roas_liquido ?? null, "roas"), criterion: "Investimento ≥ R$ 20.000", empty: "—" },
    { label: "Maior gasto com ROAS < 1", row: worstSpend, value: worstSpend ? `${formatBRL(worstSpend.investimento)} · ${metricText(worstSpend.roas_liquido, "roas")}` : "", criterion: "Investimento ≥ R$ 20.000", empty: "Nenhum", warning: true },
  ];
  const sortHeader = (key: SortKey, label: string, numeric = false) => <TableHead key={key} scope="col"
    aria-sort={sort.key === key ? sort.direction === "asc" ? "ascending" : "descending" : "none"}
    className={`sticky top-0 z-20 bg-card px-[12px] py-[10px] ${numeric ? "text-right" : "text-left"}`}>
    <Button variant="ghost" className="h-[32px] gap-[6px] whitespace-nowrap px-[4px] text-[12px]" onClick={() => setSort(current => ({ key, direction: current.key === key && current.direction === "desc" ? "asc" : "desc" }))}>
      {label}{sort.key === key ? sort.direction === "desc" ? <ArrowDown className="h-[12px] w-[12px]" /> : <ArrowUp className="h-[12px] w-[12px]" /> : <ArrowUpDown className="h-[12px] w-[12px]" />}
    </Button>
  </TableHead>;

  return <TooltipProvider delayDuration={200}>
    <Card className="min-w-0 text-foreground">
      <CardHeader className="space-y-[8px] p-[20px]">
        <CardTitle className="text-[18px] tracking-normal">Anúncios e criativos</CardTitle>
        <CardDescription className="text-[12px] leading-[1.6]">{modeloData === "venda"
          ? `Cada venda conta no dia em que aconteceu e é creditada ao ${toque === "primeiro" ? "1º anúncio que a pessoa clicou" : "último anúncio antes da compra"}. Por isso um criativo pausado ainda pode ter parceria hoje.`
          : `Vendas das pessoas que clicaram pela 1ª vez no período, creditadas ao ${toque === "primeiro" ? "1º" : "último"} anúncio. Bom para medir o retorno do que foi gasto no período.`}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-[20px] p-[20px] pt-0">
        <div className="flex flex-wrap items-center gap-[12px]">
          <Tabs value={nivel} onValueChange={value => { if (levels.some(level => level.value === value)) setNivel(value as Nivel); }} className="min-w-0 max-w-full">
            <TabsList aria-label="Nível dos anúncios" className="h-[40px] gap-[2px] p-[4px]">
              {levels.map(level => {
                const trigger = <TabsTrigger value={level.value} className="h-[32px] px-[12px] text-[12px]">{level.label}</TabsTrigger>;
                return level.value === "criativo" ? <Tooltip key={level.value}><TooltipTrigger asChild>{trigger}</TooltipTrigger><TooltipContent side="top" sideOffset={6} className="max-w-[340px] whitespace-normal text-[11px] leading-[1.45]">Junta o mesmo criativo rodando em vários conjuntos/campanhas (pelo nome do anúncio).</TooltipContent></Tooltip> : <span key={level.value}>{trigger}</span>;
              })}
            </TabsList>
          </Tabs>
          <Input aria-label="Buscar por nome" placeholder="Buscar por nome" value={search} onChange={event => setSearch(event.target.value)} className="h-[40px] min-w-[160px] flex-1 text-[12px] md:max-w-[320px]" />
          <Button variant="outline" onClick={() => exportCsv(filtered, nivel, modeloData, toque, from, to)} disabled={isLoading || !!error || !filtered.length} className="h-[40px] gap-[8px] px-[12px] text-[12px]">
            <Download className="h-[14px] w-[14px]" />Exportar CSV
          </Button>
        </div>
        {isLoading ? <div role="status" aria-label="Carregando anúncios" className="space-y-[16px]">
          <div className="grid gap-[12px] md:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-[110px] w-full" />)}</div>
          <Skeleton className="h-[320px] w-full" />
        </div> : error ? <Alert variant="destructive" className="p-[16px]"><AlertDescription className="text-[13px]">{typeof error === "object" && "message" in error ? String(error.message) : String(error)}</AlertDescription></Alert>
          : !data?.length ? <p className="py-[32px] text-center text-[14px] text-muted-foreground">Nenhum anúncio com gasto ou conversão no período</p>
          : <>
            <div className="grid gap-[12px] md:grid-cols-3">
              {highlights.map(item => <div key={item.label} className="min-w-0 space-y-[8px] border-l-2 border-border py-[8px] pl-[12px]">
                <p className="text-[12px] text-muted-foreground">{item.label}</p>
                <p title={item.row?.nome} className="line-clamp-2 break-words text-[13px] font-medium">{item.row?.nome ?? item.empty}</p>
                {item.row && <p className={`text-[16px] font-semibold tabular-nums ${item.warning ? "text-amber-400" : ""}`}>{item.value}</p>}
                <p className="text-[11px] text-muted-foreground">{item.criterion}</p>
              </div>)}
            </div>
            <div className="min-w-0 [&>div]:max-h-[640px] [&>div]:overscroll-contain">
              <Table className="min-w-[1900px] border-separate border-spacing-0 text-[12px]">
                <TableHeader><TableRow>
                  {hasThumbnails && <TableHead scope="col" className="sticky left-0 top-0 z-30 w-[68px] min-w-[68px] bg-card px-[12px] text-[11px]">Miniatura</TableHead>}
                  {sortHeader("nome", "Nome")}{sortHeader("status", "Status")}
                  {columns.map(column => sortHeader(column.key, column.label, true))}
                </TableRow></TableHeader>
                <TableBody>
                  {!filtered.length && <TableRow><TableCell colSpan={columns.length + 2 + (hasThumbnails ? 1 : 0)} className="py-[32px] text-center text-muted-foreground">Nenhum anúncio com gasto ou conversão no período</TableCell></TableRow>}
                  {filtered.slice(0, limit).map((row, index) => <TableRow key={`${row.nivel_id}-${index}`}>
                    {hasThumbnails && <TableCell className="sticky left-0 z-10 bg-card px-[12px] py-[12px]"><Thumbnail src={row.thumbnail_url} /></TableCell>}
                    <TableCell className="min-w-[240px] max-w-[320px] px-[12px] py-[12px]">
                      <p title={row.nome} className="line-clamp-2 break-words font-medium leading-[1.5]">{row.nome}</p>
                      {(row.campanha || row.conjunto) && <p className="mt-[4px] line-clamp-2 break-words text-[11px] text-muted-foreground">{[row.campanha, row.conjunto].filter(Boolean).join(" · ")}</p>}
                      {normalize(row.conta ?? "").includes("distribuicao") && <Hint text="Conta de divulgação: não é avaliada por custo por venda"><Badge variant="outline" className="mt-[4px] px-[6px] py-[2px] text-[10px] font-normal">divulgação</Badge></Hint>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-[12px] py-[12px]">
                      <span className={`inline-flex items-center gap-[6px] ${row.status !== "ACTIVE" ? "text-muted-foreground" : ""}`}>
                        {row.status === "ACTIVE" ? <span aria-hidden="true" className="h-[6px] w-[6px] rounded-full bg-emerald-400" />
                          : statusText(row.status) === "Pausado" ? <span aria-hidden="true" className="h-[6px] w-[6px] rounded-full bg-muted-foreground" /> : null}
                        {statusText(row.status)}
                      </span>
                    </TableCell>
                    <Metrics row={row} />
                  </TableRow>)}
                </TableBody>
                <TableFooter><TableRow>
                  {hasThumbnails && <TableCell className="sticky left-0 z-10 bg-muted" />}
                  <TableCell className="px-[12px] py-[12px] font-semibold">TOTAL</TableCell><TableCell />
                  <Metrics row={totals} total />
                </TableRow></TableFooter>
              </Table>
            </div>
            {filtered.length > limit && <div className="flex justify-center"><Button variant="outline" onClick={() => setLimit(current => current + 30)} className="h-[40px] px-[16px] text-[12px]">Mostrar mais 30</Button></div>}
          </>}
      </CardContent>
    </Card>
  </TooltipProvider>;
}