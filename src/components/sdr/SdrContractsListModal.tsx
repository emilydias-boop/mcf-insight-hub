import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2 } from "lucide-react";
import { useSdrContractsFromAgenda } from "@/hooks/useSdrContractsFromAgenda";

interface SdrContractsListModalProps {
  open: boolean;
  onClose: () => void;
  sdrId: string | undefined;
  sdrName: string;
  anoMes: string | undefined; // "YYYY-MM"
}

export function SdrContractsListModal({ open, onClose, sdrId, sdrName, anoMes }: SdrContractsListModalProps) {
  const { data: contracts = [], isLoading } = useSdrContractsFromAgenda(sdrId, anoMes);

  const monthLabel = anoMes
    ? format(new Date(`${anoMes}-01T00:00:00`), "MMMM 'de' yyyy", { locale: ptBR })
    : "";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-amber-500" />
            Contratos de {sdrName}
          </DialogTitle>
          <DialogDescription>
            {monthLabel && <span className="capitalize">{monthLabel}</span>}
            {!isLoading && (
              <span className="ml-2">
                · <Badge variant="secondary">{contracts.length} contrato{contracts.length === 1 ? "" : "s"}</Badge>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-2 px-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando contratos...
            </div>
          ) : contracts.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Nenhum contrato pago atribuído a este SDR no período.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Closer</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead className="text-right">Pago em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.leadName}</TableCell>
                    <TableCell className="text-muted-foreground">{c.closerName || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.contactEmail && <div>{c.contactEmail}</div>}
                      {c.contactPhone && <div>{c.contactPhone}</div>}
                      {!c.contactEmail && !c.contactPhone && "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs whitespace-nowrap">
                      {format(new Date(c.contractPaidAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}