import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Phone, Check } from 'lucide-react';
import { CALL_OUTCOMES, isAnsweredOutcome, isQualifiedOutcome, outcomeMeta } from '@/lib/callOutcomes';

interface PostCallModalProps {
  open: boolean;
  onClose: () => void;
  /** Fluxo legado Twilio: grava na tabela calls */
  callId?: string | null;
  /** Fluxo Sonax: grava o outcome no metadata da atividade click_to_call */
  activityId?: string | null;
  /** Deal usado para registrar a timeline quando não há callId */
  dealId?: string | null;
  onSave: () => void;
}

export function PostCallModal({ open, onClose, callId, activityId, dealId, onSave }: PostCallModalProps) {
  const [outcome, setOutcome] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const saveToActivity = async (id: string) => {
    const { data } = await supabase
      .from('deal_activities')
      .select('metadata')
      .eq('id', id)
      .maybeSingle();
    const meta = (((data as any)?.metadata) || {}) as Record<string, unknown>;
    const { error } = await supabase
      .from('deal_activities')
      .update({
        metadata: {
          ...meta,
          outcome,
          answered: isAnsweredOutcome(outcome),
          qualified: isQualifiedOutcome(outcome),
          outcome_notes: notes || null,
          outcome_at: new Date().toISOString(),
        } as any,
      })
      .eq('id', id);
    if (error) throw error;
  };

  const saveToCall = async (id: string) => {
    const { error } = await (supabase as any)
      .from('calls')
      .update({ outcome, notes, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;

    const { data: callData } = await (supabase as any)
      .from('calls')
      .select('deal_id, duration_seconds, to_number')
      .eq('id', id)
      .single();

    const targetDeal = callData?.deal_id || dealId;
    if (targetDeal) {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      await supabase.from('deal_activities').insert({
        deal_id: targetDeal,
        activity_type: 'call',
        description: `Ligação (${formatDuration(callData?.duration_seconds || 0)}) - ${outcomeMeta(outcome)?.label || outcome}`,
        user_id: currentUser?.id,
        metadata: {
          call_id: id,
          outcome,
          answered: isAnsweredOutcome(outcome),
          qualified: isQualifiedOutcome(outcome),
          duration_seconds: callData?.duration_seconds,
          to_number: callData?.to_number,
          notes,
        },
      });
    }
  };

  const handleSave = async () => {
    if (!outcome) return;
    if (!callId && !activityId) return;

    setIsSaving(true);
    try {
      if (activityId) await saveToActivity(activityId);
      else if (callId) await saveToCall(callId);

      toast.success('Resultado da ligação salvo!');
      onSave();
      handleClose();
    } catch (error) {
      console.error('Error saving call outcome:', error);
      toast.error('Erro ao salvar resultado');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setOutcome('');
    setNotes('');
    onClose();
  };

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            Resultado da Ligação
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="outcome">Como foi a ligação?</Label>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger id="outcome">
                <SelectValue placeholder="Selecione o resultado" />
              </SelectTrigger>
              <SelectContent>
                {CALL_OUTCOMES.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className={opt.color}>{opt.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Adicione detalhes importantes da conversa..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleClose}>
            Pular
          </Button>
          <Button onClick={handleSave} disabled={!outcome || isSaving}>
            <Check className="h-4 w-4 mr-2" />
            {isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
