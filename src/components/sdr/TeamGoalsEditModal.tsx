import { useState, useEffect } from "react";
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
import { SdrTargetType, SDR_TARGET_CONFIGS, SdrTarget, useUpsertSdrTargets } from "@/hooks/useSdrTeamTargets";

interface TeamGoalsEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingTargets: SdrTarget[];
}

export function TeamGoalsEditModal({ open, onOpenChange, existingTargets }: TeamGoalsEditModalProps) {
  const [values, setValues] = useState<Record<SdrTargetType, number>>({} as Record<SdrTargetType, number>);
  const upsertMutation = useUpsertSdrTargets();

  // Initialize values from existing targets
  useEffect(() => {
    const initial: Record<string, number> = {};
    SDR_TARGET_CONFIGS.forEach(config => {
      const existing = existingTargets.find(t => t.target_type === config.type);
      initial[config.type] = existing?.target_value ?? 0;
    });
    setValues(initial as Record<SdrTargetType, number>);
  }, [existingTargets, open]);

  const handleChange = (type: SdrTargetType, value: string) => {
    const numValue = parseInt(value) || 0;
    setValues(prev => ({ ...prev, [type]: Math.max(0, numValue) }));
  };

  const handleSave = async () => {
    await upsertMutation.mutateAsync(values);
    onOpenChange(false);
  };

  const dayConfigs = SDR_TARGET_CONFIGS.filter(c => c.period === 'day');
  const weekConfigs = SDR_TARGET_CONFIGS.filter(c => c.period === 'week');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar Metas da Equipe</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6 py-4">
          {/* Day targets */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Metas do Dia
            </h3>
            {dayConfigs.map(config => (
              <div key={config.type} className="space-y-1">
                <Label htmlFor={config.type} className="text-sm">
                  {config.label}
                </Label>
                <Input
                  id={config.type}
                  type="number"
                  min={0}
                  value={values[config.type] ?? 0}
                  onChange={(e) => handleChange(config.type, e.target.value)}
                  className="h-9"
                />
              </div>
            ))}
          </div>

          {/* Week targets */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Metas da Semana
            </h3>
            {weekConfigs.map(config => (
              <div key={config.type} className="space-y-1">
                <Label htmlFor={config.type} className="text-sm">
                  {config.label}
                </Label>
                <Input
                  id={config.type}
                  type="number"
                  min={0}
                  value={values[config.type] ?? 0}
                  onChange={(e) => handleChange(config.type, e.target.value)}
                  className="h-9"
                />
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={upsertMutation.isPending}>
            {upsertMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar Metas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
