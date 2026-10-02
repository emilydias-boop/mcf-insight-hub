import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronRight } from "lucide-react";

type Numeric = number | string;

export interface SolarSdrRow {
  sdr_id: string | null;
  name: string;
  email: string | null;
  na_bu: boolean;
  agendamentos: Numeric;
  agendadas: Numeric;
  realizadas: Numeric;
  no_show: Numeric;
  pendentes: Numeric;
  vendas: Numeric;
}

export interface SolarCloserRow {
  closer_id: string;
  name: string;
  email: string | null;
  is_active: boolean;
  agendadas: Numeric;
  realizadas: Numeric;
  no_show: Numeric;
  pendentes: Numeric;
  vendas: Numeric;
}

const numberValue = (value: Numeric | null | undefined) => Number(value ?? 0);
const rate = (value: number, total: number) => total > 0 ? (value / total) * 100 : 0;

function NameCell({ name, email, badge }: { name: string; email: string | null; badge?: string }) {
  return (
    <TableCell className="font-medium">
      <div className="flex flex-col">
        <span className="text-foreground inline-flex items-center gap-2">
          {name}
          {badge && <Badge variant="outline" className="text-[10px] font-normal">{badge}</Badge>}
        </span>
        {email && <span className="text-xs text-muted-foreground">{email.split("@")[0]}</span>}
      </div>
    </TableCell>
  );
}

interface SolarSdrSummaryTableProps {
  data: SolarSdrRow[];
  isLoading?: boolean;
  metaAgendamentoDia: number | null;
  onRowClick?: (row: SolarSdrRow) => void;
}

export function SolarSdrSummaryTable({ data, isLoading, metaAgendamentoDia, onRowClick }: SolarSdrSummaryTableProps) {
  if (isLoading) return <TableLoading />;
  if (data.length === 0) return <EmptyTable label="Nenhum SDR com atividade no período." />;

  const totals = data.reduce((acc, row) => ({
    agendamentos: acc.agendamentos + numberValue(row.agendamentos),
    agendadas: acc.agendadas + numberValue(row.agendadas),
    realizadas: acc.realizadas + numberValue(row.realizadas),
    noShow: acc.noShow + numberValue(row.no_show),
    vendas: acc.vendas + numberValue(row.vendas),
  }), { agendamentos: 0, agendadas: 0, realizadas: 0, noShow: 0, vendas: 0 });

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-muted/50">
              <TableHead className="text-muted-foreground font-medium">SDR</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">Meta</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">Agendamento</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">Reuniões Agendadas</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">Reuniões Realizadas</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium">No-show</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium whitespace-nowrap">Vendas Realizadas</TableHead>
              <TableHead className="text-muted-foreground text-center font-medium whitespace-nowrap">Conv. Vendas/Reunião</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => {
              const agendadas = numberValue(row.agendadas);
              const realizadas = numberValue(row.realizadas);
              const noShow = numberValue(row.no_show);
              const vendas = numberValue(row.vendas);
              return (
                <TableRow key={row.sdr_id ?? row.email ?? row.name} className="transition-colors hover:bg-muted/30">
                  <NameCell name={row.name} email={row.email} badge={row.na_bu ? undefined : "fora da BU"} />
                  <TableCell className="text-center text-muted-foreground">{metaAgendamentoDia == null ? "sem meta" : `${metaAgendamentoDia}/dia`}</TableCell>
                  <TableCell className="text-center"><Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">{numberValue(row.agendamentos)}</Badge></TableCell>
                  <TableCell className="text-center"><Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">{agendadas}</Badge></TableCell>
                  <TableCell className="text-center"><span className="text-green-400 font-medium">{realizadas}</span></TableCell>
                  <TableCell className="text-center"><div className="flex flex-col items-center"><span className="text-red-400 font-medium">{noShow}</span>{agendadas > 0 && <span className="text-xs text-red-400">({rate(noShow, agendadas).toFixed(1)}%)</span>}</div></TableCell>
                  <TableCell className="text-center"><Badge variant="outline" className="bg-teal-500/10 text-teal-400 border-teal-500/30">{vendas}</Badge></TableCell>
                  <TableCell className="text-center"><span className="font-medium">{rate(vendas, realizadas).toFixed(1)}%</span></TableCell>
                  <TableCell>{onRowClick && <ChevronRight className="h-4 w-4 text-muted-foreground" />}</TableCell>
                </TableRow>
              );
            })}
            <TableRow className="bg-muted/30 font-semibold border-t-2 border-border hover:bg-muted/30">
              <TableCell className="text-foreground">Total</TableCell>
              <TableCell />
              <TableCell className="text-center"><Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">{totals.agendamentos}</Badge></TableCell>
              <TableCell className="text-center"><Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">{totals.agendadas}</Badge></TableCell>
              <TableCell className="text-center"><span className="text-green-400">{totals.realizadas}</span></TableCell>
              <TableCell className="text-center"><div className="flex flex-col items-center"><span className="text-red-400">{totals.noShow}</span>{totals.agendadas > 0 && <span className="text-xs text-red-400">({rate(totals.noShow, totals.agendadas).toFixed(1)}%)</span>}</div></TableCell>
              <TableCell className="text-center"><Badge variant="outline" className="bg-teal-500/10 text-teal-400 border-teal-500/30">{totals.vendas}</Badge></TableCell>
              <TableCell className="text-center">{rate(totals.vendas, totals.realizadas).toFixed(1)}%</TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <p className="px-4 py-2 text-xs text-muted-foreground">
        Vendas Realizadas conta a entrada do negócio na etapa “Venda realizada” do funil Solar, pela data registrada no histórico da movimentação.
      </p>
    </div>
  );
}

export function SolarCloserSummaryTable({ data, isLoading, closerTargets }: { data: SolarCloserRow[]; isLoading?: boolean; closerTargets: Record<string, number> | null }) {
  if (isLoading) return <TableLoading />;
  if (data.length === 0) return <EmptyTable label="Nenhum Closer com atividade no período." />;
  const totals = data.reduce((acc, row) => ({
    agendadas: acc.agendadas + numberValue(row.agendadas), realizadas: acc.realizadas + numberValue(row.realizadas),
    noShow: acc.noShow + numberValue(row.no_show), pendentes: acc.pendentes + numberValue(row.pendentes), vendas: acc.vendas + numberValue(row.vendas),
  }), { agendadas: 0, realizadas: 0, noShow: 0, pendentes: 0, vendas: 0 });
  return (
    <div className="rounded-md border border-border overflow-hidden"><div className="overflow-x-auto"><Table>
      <TableHeader className="bg-muted/50"><TableRow className="hover:bg-muted/50">
        <TableHead className="text-muted-foreground font-medium">Closer</TableHead><TableHead className="text-muted-foreground text-center font-medium">Meta</TableHead>
        <TableHead className="text-muted-foreground text-center font-medium">Reuniões Agendadas</TableHead><TableHead className="text-muted-foreground text-center font-medium">Reuniões Realizadas</TableHead>
        <TableHead className="text-muted-foreground text-center font-medium">No-show</TableHead><TableHead className="text-muted-foreground text-center font-medium">Pendentes</TableHead>
        <TableHead className="text-muted-foreground text-center font-medium">Vendas Realizadas</TableHead><TableHead className="text-muted-foreground text-center font-medium">Conv. Vendas/Reunião</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {data.map((row) => { const ag = numberValue(row.agendadas); const re = numberValue(row.realizadas); const ns = numberValue(row.no_show); const vd = numberValue(row.vendas); const meta = closerTargets?.[row.closer_id]; return (
          <TableRow key={row.closer_id} className="transition-colors hover:bg-muted/30"><NameCell name={row.name} email={row.email} badge={row.is_active ? undefined : "inativo"} />
            <TableCell className="text-center text-muted-foreground">{meta == null ? "sem meta" : meta}</TableCell>
            <TableCell className="text-center"><Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">{ag}</Badge></TableCell>
            <TableCell className="text-center text-green-400 font-medium">{re}</TableCell>
            <TableCell className="text-center"><span className="text-red-400">{ns}</span>{ag > 0 && <span className="text-xs text-red-400 ml-1">({rate(ns, ag).toFixed(1)}%)</span>}</TableCell>
            <TableCell className="text-center text-amber-400">{numberValue(row.pendentes)}</TableCell><TableCell className="text-center"><Badge variant="outline" className="bg-teal-500/10 text-teal-400 border-teal-500/30">{vd}</Badge></TableCell>
            <TableCell className="text-center">{rate(vd, re).toFixed(1)}%</TableCell></TableRow>); })}
        <TableRow className="bg-muted/30 font-semibold border-t-2 border-border hover:bg-muted/30"><TableCell>Total</TableCell><TableCell />
          <TableCell className="text-center"><Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">{totals.agendadas}</Badge></TableCell><TableCell className="text-center text-green-400">{totals.realizadas}</TableCell>
          <TableCell className="text-center text-red-400">{totals.noShow}</TableCell><TableCell className="text-center text-amber-400">{totals.pendentes}</TableCell>
          <TableCell className="text-center"><Badge variant="outline" className="bg-teal-500/10 text-teal-400 border-teal-500/30">{totals.vendas}</Badge></TableCell><TableCell className="text-center">{rate(totals.vendas, totals.realizadas).toFixed(1)}%</TableCell></TableRow>
      </TableBody>
    </Table></div></div>
  );
}

function TableLoading() {
  return <div className="space-y-2 p-4">{[1, 2, 3, 4, 5].map((item) => <Skeleton key={item} className="h-12 w-full" />)}</div>;
}

function EmptyTable({ label }: { label: string }) {
  return <div className="flex items-center justify-center py-8 text-muted-foreground"><p>{label}</p></div>;
}