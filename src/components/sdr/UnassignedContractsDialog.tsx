import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UnassignedContractItem } from "@/hooks/useUnassignedContracts";

interface UnassignedContractsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: UnassignedContractItem[];
  /** Quando informado, filtra a lista por segmento. */
  segment?: 'A' | 'B' | null;
  context: 'closers' | 'sdrs';
}

const formatDate = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const formatValue = (v?: number | null) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function UnassignedContractsDialog({
  open,
  onOpenChange,
  items,
  segment,
  context,
}: UnassignedContractsDialogProps) {
  const list = segment ? items.filter((i) => i.segment === segment) : items;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            Contratos não atribuídos{segment ? ` — Lead ${segment}` : ''}
          </DialogTitle>
          <DialogDescription>
            {list.length} contrato(s)/caução(ões) pagos no período que a atribuição por{' '}
            {context === 'closers' ? 'Closer' : 'SDR'} não consegue vincular.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-auto rounded-md border border-border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Lead / Negócio</TableHead>
                <TableHead className="text-center">Pagamento</TableHead>
                <TableHead className="text-center">Segmento</TableHead>
                <TableHead className="text-center">Valor</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Sugestão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    Nenhum contrato não atribuído no período.
                  </TableCell>
                </TableRow>
              )}
              {list.map((item, idx) => (
                <TableRow key={`${item.deal_id ?? 'no-deal'}-${idx}`}>
                  <TableCell className="font-medium">{item.reference}</TableCell>
                  <TableCell className="text-center whitespace-nowrap">{formatDate(item.paid_at)}</TableCell>
                  <TableCell className="text-center">
                    {item.segment ? (
                      <Badge variant="outline">Lead {item.segment}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">sem segmento</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center whitespace-nowrap">{formatValue(item.value)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.reason || item.source}</TableCell>
                  <TableCell className="text-sm">
                    {item.suggested ? item.suggested : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}