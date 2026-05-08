import { useState, useEffect } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Settings2, Loader2 } from "lucide-react";
import { SdrMonthPayout } from "@/types/sdr-fechamento";

interface PayoutConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payout: SdrMonthPayout;
}

type FormState = {
  dias_uteis_mes: string;
  dias_uteis_trabalhados: string;
  meta_agendadas_ajustada: string;
  meta_realizadas_ajustada: string;
  meta_tentativas_ajustada: string;
};

const toNum = (v: string): number | null => {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

export function PayoutConfigDialog({ open, onOpenChange, payout }: PayoutConfigDialogProps) {
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormState>({
    dias_uteis_mes: "",
    dias_uteis_trabalhados: "",
    meta_agendadas_ajustada: "",
    meta_realizadas_ajustada: "",
    meta_tentativas_ajustada: "",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      dias_uteis_mes: payout.dias_uteis_mes != null ? String(payout.dias_uteis_mes) : "",
      dias_uteis_trabalhados: (payout as any).dias_uteis_trabalhados != null ? String((payout as any).dias_uteis_trabalhados) : "",
      meta_agendadas_ajustada: (payout as any).meta_agendadas_ajustada != null ? String((payout as any).meta_agendadas_ajustada) : "",
      meta_realizadas_ajustada: (payout as any).meta_realizadas_ajustada != null ? String((payout as any).meta_realizadas_ajustada) : "",
      meta_tentativas_ajustada: (payout as any).meta_tentativas_ajustada != null ? String((payout as any).meta_tentativas_ajustada) : "",
    });
  }, [open, payout]);

  const save = useMutation({
    mutationFn: async () => {
      const overrides: Record<string, number | null> = {
        dias_uteis_mes: toNum(form.dias_uteis_mes),
        dias_uteis_trabalhados: toNum(form.dias_uteis_trabalhados),
        meta_agendadas_ajustada: toNum(form.meta_agendadas_ajustada),
        meta_realizadas_ajustada: toNum(form.meta_realizadas_ajustada),
        meta_tentativas_ajustada: toNum(form.meta_tentativas_ajustada),
      };
      // Mantém apenas os campos efetivamente preenchidos (não-null)
      const cleaned: Record<string, number> = {};
      Object.entries(overrides).forEach(([k, v]) => {
        if (v != null) cleaned[k] = v;
      });

      // Salva tanto os campos diretos (efeito imediato) quanto a coluna
      // `config_overrides`, que é reaplicada após o "Salvar e Recalcular"
      // para não ser sobrescrita pelo cálculo automático.
      const updates: Record<string, any> = {
        ...overrides,
        config_overrides: Object.keys(cleaned).length > 0 ? cleaned : null,
      };
      const { error } = await supabase
        .from("sdr_month_payout")
        .update(updates)
        .eq("id", payout.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sdr-payout-detail"] });
      queryClient.invalidateQueries({ queryKey: ["sdr-payouts", payout.ano_mes] });
      toast.success("Configuração salva. Indicadores atualizados.");
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(`Erro ao salvar: ${err.message}`);
    },
  });

  const reset = () =>
    setForm({
      dias_uteis_mes: "",
      dias_uteis_trabalhados: "",
      meta_agendadas_ajustada: "",
      meta_realizadas_ajustada: "",
      meta_tentativas_ajustada: "",
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Configuração específica do fechamento
          </DialogTitle>
          <DialogDescription>
            Ajustes individuais aplicados apenas a este colaborador neste mês. Deixe em branco para usar o padrão.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-2">DIAS ÚTEIS</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dum" className="text-xs">Dias úteis do mês</Label>
                <Input
                  id="dum"
                  type="number"
                  min={1}
                  max={31}
                  placeholder="Padrão"
                  value={form.dias_uteis_mes}
                  onChange={(e) => setForm((f) => ({ ...f, dias_uteis_mes: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dut" className="text-xs">Dias que contam para meta</Label>
                <Input
                  id="dut"
                  type="number"
                  min={0}
                  max={31}
                  placeholder="Padrão (todos)"
                  value={form.dias_uteis_trabalhados}
                  onChange={(e) => setForm((f) => ({ ...f, dias_uteis_trabalhados: e.target.value }))}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Reduzir dias trabalhados aplica pro-rata no fixo e nas metas.
            </p>
          </div>

          <Separator />

          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-2">METAS PERSONALIZADAS (sobrescreve cálculo padrão)</h4>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ma" className="text-xs">Meta agendamentos</Label>
                <Input
                  id="ma"
                  type="number"
                  min={0}
                  placeholder="Padrão (meta diária × dias)"
                  value={form.meta_agendadas_ajustada}
                  onChange={(e) => setForm((f) => ({ ...f, meta_agendadas_ajustada: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mr" className="text-xs">Meta reuniões realizadas</Label>
                <Input
                  id="mr"
                  type="number"
                  min={0}
                  placeholder="Padrão (70% das agendadas)"
                  value={form.meta_realizadas_ajustada}
                  onChange={(e) => setForm((f) => ({ ...f, meta_realizadas_ajustada: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mt" className="text-xs">Meta tentativas de ligação</Label>
                <Input
                  id="mt"
                  type="number"
                  min={0}
                  placeholder="Padrão (84/dia × dias)"
                  value={form.meta_tentativas_ajustada}
                  onChange={(e) => setForm((f) => ({ ...f, meta_tentativas_ajustada: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" type="button" onClick={reset} disabled={save.isPending}>
            Limpar overrides
          </Button>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}