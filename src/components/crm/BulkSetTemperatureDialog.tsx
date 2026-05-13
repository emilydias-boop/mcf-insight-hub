import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Thermometer } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  LeadTemperature,
  TEMPERATURE_META,
} from './LeadTemperatureSelector';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDealIds: string[];
  onSuccess: () => void;
}

const ORDER: Exclude<LeadTemperature, null>[] = ['quente', 'morno', 'frio'];

export const BulkSetTemperatureDialog = ({
  open,
  onOpenChange,
  selectedDealIds,
  onSuccess,
}: Props) => {
  const qc = useQueryClient();
  const [picked, setPicked] = useState<LeadTemperature>('quente');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setPicked('quente');
      setSaving(false);
    }
  }, [open]);

  const handleApply = async () => {
    if (selectedDealIds.length === 0) return;
    setSaving(true);
    try {
      // Filtra IDs locais (manual-...) que não estão no banco
      const ids = selectedDealIds.filter((id) => !id.startsWith('manual-'));
      if (ids.length === 0) {
        toast.warning('Nenhum lead válido selecionado');
        setSaving(false);
        return;
      }
      const { error } = await supabase
        .from('crm_deals')
        .update({ lead_temperature: picked })
        .in('id', ids);

      if (error) throw error;

      toast.success(
        picked
          ? `Temperatura "${TEMPERATURE_META[picked].label}" aplicada em ${ids.length} lead(s)`
          : `Classificação removida de ${ids.length} lead(s)`,
      );
      qc.invalidateQueries({ queryKey: ['crm-deals'] });
      qc.invalidateQueries({ queryKey: ['crm-deal'] });
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      toast.error('Erro ao classificar leads: ' + (e?.message || ''));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Thermometer className="h-5 w-5" /> Definir temperatura em massa
          </DialogTitle>
          <DialogDescription>
            Aplicar uma classificação de temperatura a {selectedDealIds.length} lead(s) selecionado(s).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-2">
            {ORDER.map((t) => {
              const meta = TEMPERATURE_META[t];
              const active = picked === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPicked(t)}
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-all',
                    active
                      ? `${meta.bg} ring-2 ${meta.ring}`
                      : 'border-border bg-muted/30 hover:bg-muted',
                  )}
                >
                  <span className={cn('h-3 w-3 rounded-full', meta.dot)} />
                  {meta.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setPicked(null)}
              className={cn(
                'flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-all',
                picked === null
                  ? 'border-foreground/40 bg-muted ring-2 ring-foreground/30'
                  : 'border-border bg-muted/30 hover:bg-muted',
              )}
            >
              <span className="h-3 w-3 rounded-full border border-muted-foreground" />
              Remover
            </button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleApply} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Aplicando...
              </>
            ) : (
              `Aplicar em ${selectedDealIds.length} lead(s)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
