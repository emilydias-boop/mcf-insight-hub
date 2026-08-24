import { useEffect, useState } from "react";
import { FileWarning } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MOTIVO_MIN, useReconhecerForaFunil } from "@/hooks/useConsorcioForaFunil";
import type { CotaResiduoItem } from "@/hooks/useConsorcioCotasContratadas";

interface Props {
  item: CotaResiduoItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReconhecido?: () => void;
}

/**
 * Reconhece que a venda desta cota não passou pelo funil de R1 de Consórcio.
 * O motivo é obrigatório (mínimo validado também no banco) — é o que separa
 * reconhecimento de "sumir com o incômodo".
 */
export function ReconhecerForaFunilModal({ item, open, onOpenChange, onReconhecido }: Props) {
  const [motivo, setMotivo] = useState("");
  const reconhecer = useReconhecerForaFunil();

  useEffect(() => {
    if (open) setMotivo("");
  }, [open, item?.cardId]);

  const curto = motivo.trim().length < MOTIVO_MIN;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileWarning className="h-4 w-4" />
            Reconhecer venda fora do funil
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            A cota sai das pendências do alerta e passa para o bloco de vendas reconhecidas,
            com registro de quem reconheceu e quando. Não muda nenhum número: Consórcio
            Efetivado, Produção Gerada, Cotas Contratadas, Vendas Realizadas e Ticket Médio
            continuam idênticos. Nenhum SDR é atribuído.
          </DialogDescription>
        </DialogHeader>

        {item && (
          <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
            <div className="font-medium text-sm">{item.cliente}</div>
            <div className="text-muted-foreground">
              {[item.grupo, item.cota].filter(Boolean).join("/") || "sem grupo/cota"}
              {item.vendedorName ? ` · Vendedor: ${item.vendedorName}` : ""}
            </div>
            <div className="text-muted-foreground">{item.motivo}</div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="motivo-fora-funil" className="text-xs">
            Motivo (obrigatório, mínimo {MOTIVO_MIN} caracteres)
          </Label>
          <Textarea
            id="motivo-fora-funil"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            placeholder="Ex.: venda vinda de indicação de gerente de relacionamento, sem passagem por R1 de Consórcio."
          />
          <p className="text-[11px] text-muted-foreground">
            {motivo.trim().length}/{MOTIVO_MIN} caracteres
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!item || curto || reconhecer.isPending}
            onClick={() => {
              if (!item) return;
              reconhecer.mutate(
                { cardId: item.cardId, motivo },
                {
                  onSuccess: () => {
                    onReconhecido?.();
                    onOpenChange(false);
                  },
                },
              );
            }}
          >
            {reconhecer.isPending ? "Registrando…" : "Reconhecer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
