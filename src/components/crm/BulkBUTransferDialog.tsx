import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Building2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBUTransfer, BU_TRANSFER_OPTIONS, TargetBU } from "@/hooks/useBUTransfer";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDealIds: string[];
  onSuccess?: () => void;
}

export const BulkBUTransferDialog = ({
  open,
  onOpenChange,
  selectedDealIds,
  onSuccess,
}: Props) => {
  const [targetBU, setTargetBU] = useState<TargetBU | "">("");
  const [sdrProfileId, setSdrProfileId] = useState<string>("auto");
  const mutation = useBUTransfer();

  const { data: sdrs = [], isLoading: loadingSdrs } = useQuery({
    queryKey: ["bu-transfer-sdrs", targetBU],
    enabled: open && !!targetBU,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, squad, access_status, user_roles!inner(role)")
        .eq("access_status", "ativo")
        .contains("squad", [targetBU])
        .eq("user_roles.role", "sdr");
      if (error) throw error;
      return (data || []) as Array<{ id: string; email: string; full_name: string | null }>;
    },
  });

  const sortedSdrs = useMemo(
    () =>
      [...sdrs].sort((a, b) =>
        (a.full_name || a.email).localeCompare(b.full_name || b.email)
      ),
    [sdrs]
  );

  const handleConfirm = async () => {
    if (!targetBU) return;
    await mutation.mutateAsync({
      dealIds: selectedDealIds,
      targetBU: targetBU as TargetBU,
      targetSdrProfileId: sdrProfileId === "auto" ? null : sdrProfileId,
    });
    setTargetBU("");
    setSdrProfileId("auto");
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Transferir Leads entre BUs
          </DialogTitle>
          <DialogDescription>
            Transferir {selectedDealIds.length} lead{selectedDealIds.length > 1 ? "s" : ""} para
            outra BU. Se o contato já existir na BU destino, o lead existente é atualizado (tags,
            origem e etapa) — sem duplicar. Caso contrário, um novo lead é criado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>BU destino</Label>
            <Select value={targetBU} onValueChange={(v) => setTargetBU(v as TargetBU)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a BU destino" />
              </SelectTrigger>
              <SelectContent>
                {BU_TRANSFER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>SDR responsável</Label>
            <Select
              value={sdrProfileId}
              onValueChange={setSdrProfileId}
              disabled={!targetBU}
            >
              <SelectTrigger>
                <SelectValue placeholder="Distribuir automaticamente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  Distribuir automaticamente (SDR menos carregado)
                </SelectItem>
                {loadingSdrs ? (
                  <div className="flex items-center justify-center py-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : sortedSdrs.length === 0 && targetBU ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    Nenhum SDR ativo encontrado para esta BU
                  </div>
                ) : (
                  sortedSdrs.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name || s.email}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              O deal original na BU de origem permanece intacto.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!targetBU || mutation.isPending || selectedDealIds.length === 0}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Transferindo...
              </>
            ) : (
              `Transferir ${selectedDealIds.length} lead${selectedDealIds.length > 1 ? "s" : ""}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};