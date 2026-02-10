import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/formatters";
import { Loader2 } from "lucide-react";

interface ConsorcioRevenueGoalsEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TARGET_FIELDS = [
  { key: "setor_efeito_alavanca_semana", label: "Efeito Alavanca - Semana" },
  { key: "setor_efeito_alavanca_mes", label: "Efeito Alavanca - Mês" },
  { key: "setor_efeito_alavanca_ano", label: "Efeito Alavanca - Ano" },
  { key: "setor_credito_semana", label: "Crédito - Semana" },
  { key: "setor_credito_mes", label: "Crédito - Mês" },
  { key: "setor_credito_ano", label: "Crédito - Ano" },
];

export function ConsorcioRevenueGoalsEditModal({
  open,
  onOpenChange,
  currentTargets,
}: ConsorcioRevenueGoalsEditModalProps) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      const initial: Record<string, string> = {};
      TARGET_FIELDS.forEach(({ key }) => {
        initial[key] = (currentTargets[key] || 0).toString();
      });
      setValues(initial);
    }
  }, [open, currentTargets]);

  const upsertMutation = useMutation({
    mutationFn: async (targets: { target_type: string; target_value: number }[]) => {
      // Use a fixed week range for setor targets (they're not week-specific)
      const weekStart = "2000-01-01";
      const weekEnd = "2099-12-31";

      for (const t of targets) {
        // Try to find existing
        const { data: existing } = await supabase
          .from("team_targets")
          .select("id")
          .eq("target_type", t.target_type as any)
          .eq("week_start", weekStart)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from("team_targets")
            .update({ target_value: t.target_value })
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("team_targets")
            .insert({
              target_type: t.target_type as any,
              target_name: t.target_type,
              target_value: t.target_value,
              current_value: 0,
              week_start: weekStart,
              week_end: weekEnd,
            });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["setores-dashboard"] });
      toast.success("Metas atualizadas com sucesso");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Erro ao salvar metas: " + error.message);
    },
  });

  const handleSave = () => {
    const targets = TARGET_FIELDS.map(({ key }) => ({
      target_type: key,
      target_value: parseFloat(values[key] || "0") || 0,
    }));
    upsertMutation.mutate(targets);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Metas BU Consórcio</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-2">Efeito Alavanca (Valor em Carta)</h4>
            <div className="space-y-2">
              {TARGET_FIELDS.filter(f => f.key.includes("efeito_alavanca")).map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2">
                  <Label className="text-xs w-24 shrink-0">{label.split(" - ")[1]}</Label>
                  <div className="relative flex-1">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={values[key] || ""}
                      onChange={(e) => setValues(prev => ({ ...prev, [key]: e.target.value }))}
                      className="pl-8 h-8 text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-2">Crédito (Comissão)</h4>
            <div className="space-y-2">
              {TARGET_FIELDS.filter(f => f.key.includes("credito")).map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2">
                  <Label className="text-xs w-24 shrink-0">{label.split(" - ")[1]}</Label>
                  <div className="relative flex-1">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={values[key] || ""}
                      onChange={(e) => setValues(prev => ({ ...prev, [key]: e.target.value }))}
                      className="pl-8 h-8 text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={upsertMutation.isPending} size="sm">
            {upsertMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
