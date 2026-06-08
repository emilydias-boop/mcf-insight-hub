import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, History } from 'lucide-react';
import CargoSelect from './CargoSelect';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth } from 'date-fns';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
  currentCargoId: string | null;
}

export default function ChangeCargoRetroativoDialog({ open, onOpenChange, employeeId, employeeName, currentCargoId }: Props) {
  const qc = useQueryClient();
  const [cargoId, setCargoId] = useState<string | null>(currentCargoId);
  const [validFrom, setValidFrom] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [motivo, setMotivo] = useState<string>('');
  const [updatePlans, setUpdatePlans] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);

  // Lista meses afetados (de validFrom até hoje)
  const monthsAffected = (() => {
    if (!validFrom) return [] as string[];
    const start = startOfMonth(new Date(validFrom + 'T12:00:00'));
    const end = startOfMonth(new Date());
    const out: string[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      out.push(format(cur, 'MM/yyyy'));
      cur.setMonth(cur.getMonth() + 1);
    }
    return out;
  })();

  const isRetroactive = validFrom && new Date(validFrom + 'T12:00:00') < startOfMonth(new Date());

  const handleSubmit = async () => {
    if (!cargoId) {
      toast.error('Selecione o cargo novo');
      return;
    }
    if (!validFrom) {
      toast.error('Informe a data de início');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('apply_retroactive_cargo_change', {
        p_employee_id: employeeId,
        p_cargo_catalogo_id: cargoId,
        p_valid_from: validFrom,
        p_motivo: motivo || null,
        p_update_comp_plans: updatePlans,
      });
      if (error) throw error;
      toast.success(`Cargo alterado. Meses afetados: ${(data as any)?.months_affected?.join(', ') || '—'}`);
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['employee'] });
      qc.invalidateQueries({ queryKey: ['employee_cargo_history'] });
      qc.invalidateQueries({ queryKey: ['sdr_comp_plan'] });
      qc.invalidateQueries({ queryKey: ['sdr-comp-plans'] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao alterar cargo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" /> Alterar cargo (retroativo)
          </DialogTitle>
          <DialogDescription>
            {employeeName} — escolha o novo cargo e a partir de quando vale.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Novo cargo</Label>
            <CargoSelect
              cargoId={cargoId}
              cargoTexto={null}
              onChange={(id) => setCargoId(id)}
              showInfo={true}
            />
          </div>

          <div>
            <Label>A partir de</Label>
            <Input
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
            />
          </div>

          <div>
            <Label>Motivo (opcional)</Label>
            <Textarea
              rows={2}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: Promoção retroativa N2 — performance maio"
            />
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="update-plans"
              checked={updatePlans}
              onCheckedChange={(v) => setUpdatePlans(v === true)}
            />
            <div>
              <Label htmlFor="update-plans" className="cursor-pointer">
                Atualizar planos de comissão a partir desta data
              </Label>
              <p className="text-xs text-muted-foreground">
                Substitui OTE / Fixo / Variável dos meses afetados pelos valores do cargo novo (status volta para PENDING para reaprovação).
              </p>
            </div>
          </div>

          {isRetroactive && monthsAffected.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Esta alteração é retroativa. Meses afetados: <b>{monthsAffected.join(', ')}</b>. Payouts já LOCKED não serão alterados.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading || !cargoId}>
            {loading ? 'Aplicando...' : 'Aplicar alteração'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}