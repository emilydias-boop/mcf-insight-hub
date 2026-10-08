import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { VendaRealizadaItem } from "@/hooks/useConsorcioProducaoGerada";

const PERNA: Record<VendaRealizadaItem["perna"], string> = {
  A: "Proposta aceita",
  B: "Venda avulsa",
  C: "Cota histórica",
};

const moeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const dataBr = (d: string) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");

/** Lista exata do número Vendas Realizadas: uma linha por cliente × mês. */
export function VendasRealizadasLista({
  itens,
  isLoading,
  onAbrirLead,
}: {
  itens: VendaRealizadaItem[];
  isLoading: boolean;
  onAbrirLead?: (dealId: string) => void;
}) {
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  return (
    <div className="rounded-md border border-border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead className="text-right">Produção Gerada</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                Nenhuma venda no período.
              </TableCell>
            </TableRow>
          )}
          {itens.map((v) => (
            <TableRow
              key={v.key}
              className={v.dealId && onAbrirLead ? "cursor-pointer hover:bg-muted/30" : undefined}
              onClick={v.dealId && onAbrirLead ? () => onAbrirLead(v.dealId!) : undefined}
            >
              <TableCell className="font-medium">{v.nome || "—"}</TableCell>
              <TableCell>{dataBr(v.dataAncora)}</TableCell>
              <TableCell>
                <Badge variant="outline">{PERNA[v.perna]}</Badge>
              </TableCell>
              <TableCell className="text-right">{moeda(v.credito)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
