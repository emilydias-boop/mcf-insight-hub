import { CalendarClock, UserCog } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { AgendadorEditor } from "@/components/crm/AgendadorEditor";
import type { CotaResiduoItem } from "@/hooks/useConsorcioCotasContratadas";

interface Props {
  item: CotaResiduoItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCorrigido?: () => void;
}

/**
 * Informa quem agendou a reunião de consórcio que existe, está elegível e
 * ficou sem `booked_by` — o único elo que falta para a venda ser creditada.
 * A gravação passa pela RPC auditada `corrigir_agendador_reuniao`.
 */
export function InformarAgendadorModal({ item, open, onOpenChange, onCorrigido }: Props) {
  const ag = item?.agendamento || null;
  const dia = ag?.dia
    ? new Date(ag.dia).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-4 w-4" />
            Informar quem agendou a reunião
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            A reunião de consórcio deste cliente existe e está elegível, mas ficou sem agendador
            registrado. Ao informar quem agendou, a venda passa a ser creditada a essa pessoa.
          </DialogDescription>
        </DialogHeader>

        {item && (
          <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
            <div className="font-medium text-sm">{item.cliente}</div>
            <div className="text-muted-foreground">
              {[item.grupo, item.cota].filter(Boolean).join("/") || "sem grupo/cota"}
              {item.vendedorName ? ` · Vendedor: ${item.vendedorName}` : ""}
            </div>
            {ag && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" />
                Reunião {dia ? `de ${dia}` : "de consórcio"}
                {ag.closerName ? ` com ${ag.closerName}` : ""}
              </div>
            )}
          </div>
        )}

        {ag ? (
          <AgendadorEditor
            attendeeId={ag.attendeeId}
            autoEditar
            onSalvo={() => {
              onCorrigido?.();
              onOpenChange(false);
            }}
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            Não foi possível localizar a reunião a corrigir. Abra a Agenda R1 do dia para ajustar.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}