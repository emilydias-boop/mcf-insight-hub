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
import { Loader2 } from "lucide-react";

export interface BURevenueSection {
  prefix: string;
  label: string;
}

interface BURevenueGoalsEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  sections: BURevenueSection[];
}

const PERIOD_SUFFIXES = [
  { suffix: "semana", label: "Semana" },
  { suffix: "mes", label: "Mês" },
  { suffix: "ano", label: "Ano" },
];

export function BURevenueGoalsEditModal({
  open,
  onOpenChange,
  title,
  sections,
}: BURevenueGoalsEditModalProps) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [loadingTargets, setLoadingTargets] = useState(false);

  // Build all target keys from sections
  const allKeys = sections.flatMap(s =>
    PERIOD_SUFFIXES.map(p => `${s.prefix}_${p.suffix}`)
  );

  useEffect(() => {
    if (open) {
      setLoadingTargets(true);
      supabase
        .from("team_targets")
        .select("target_type, target_value")
        .like("target_type", "setor_%" as any)
        .then(({ data }) => {
          const initial: Record<string, string> = {};
          allKeys.forEach(key => {
            const found = data?.find((t: any) => t.target_type === key);
            initial[key] = (found?.target_value || 0).toString();
          });
          setValues(initial);
          setLoadingTargets(false);
        });
    }
  }, [open]);

  const upsertMutation = useMutation({
    mutationFn: async (targets: { target_type: string; target_value: number }[]) => {
      const weekStart = "2000-01-01";
      const weekEnd = "2099-12-31";

      for (const t of targets) {
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
    const targets = allKeys.map(key => ({
      target_type: key,
      target_value: parseFloat(values[key] || "0") || 0,
    }));
    upsertMutation.mutate(targets);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Metas {title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {sections.map(section => (
            <div key={section.prefix}>
              {sections.length > 1 && (
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                  {section.label}
                </h4>
              )}
              <div className="space-y-2">
                {PERIOD_SUFFIXES.map(period => {
                  const key = `${section.prefix}_${period.suffix}`;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <Label className="text-xs w-24 shrink-0">{period.label}</Label>
                      <div className="relative flex-1">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          R$
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={values[key] || ""}
                          onChange={(e) =>
                            setValues(prev => ({ ...prev, [key]: e.target.value }))
                          }
                          className="pl-8 h-8 text-sm"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={upsertMutation.isPending} size="sm">
            {upsertMutation.isPending && (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            )}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
