import { format } from "date-fns";
import { Undo2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";
import { useDesfazerForaFunil } from "@/hooks/useConsorcioForaFunil";
import type { CotaResiduoItem } from "@/hooks/useConsorcioCotasContratadas";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CotaResiduoItem[];
}

function fmt(value?: string | null): string {
  if (!value) return "—";
  try {
    return format(value.length <= 10 ? new Date(`${value}T12:00:00`) : new Date(value), "dd/MM/yyyy");
  } catch {
    return value;
  }
}

/**
 * Vendas reconhecidas como fora do funil: o alerta não zera escondendo — a cota
 * continua na tela, com motivo, autor e a opção de desfazer (trilha preservada).
 */
export function ForaFunilListaModal({ open, onOpenChange, items }: Props) {
  const desfazer = useDesfazerForaFunil();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            Vendas reconhecidas como fora do funil
            <Badge variant="outline">
              {items.length} registro{items.length === 1 ? "" : "s"}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            Cotas contratadas que a equipe reconheceu como vendas que não passaram por R1 de
            Consórcio. Saem das pendências, continuam auditáveis aqui e não alteram nenhum
            número do painel. Desfazer devolve a cota às pendências e fica registrado.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-auto border rounded-md flex-1">
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma venda reconhecida como fora do funil neste período.
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Grupo/Cota</TableHead>
                  <TableHead>Contratação</TableHead>
                  <TableHead className="text-right">Crédito</TableHead>
                  <TableHead>Motivo do reconhecimento</TableHead>
                  <TableHead>Reconhecido por</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((i) => (
                  <TableRow key={i.cardId}>
                    <TableCell className="text-sm">{i.cliente}</TableCell>
                    <TableCell className="text-xs">
                      {[i.grupo, i.cota].filter(Boolean).join("/") || "—"}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{fmt(i.dataContratacao)}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {i.valorCredito != null ? formatCurrency(i.valorCredito) : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{i.foraFunil?.motivo || "—"}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {i.foraFunil?.porNome || "usuário"}
                      {i.foraFunil?.em ? ` · ${fmt(i.foraFunil.em)}` : ""}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!i.foraFunil?.id || desfazer.isPending}
                        onClick={() => i.foraFunil?.id && desfazer.mutate(i.foraFunil.id)}
                      >
                        <Undo2 className="h-3.5 w-3.5 mr-1" />
                        Desfazer
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
