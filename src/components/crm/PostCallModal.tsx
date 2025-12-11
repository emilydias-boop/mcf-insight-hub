import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Phone, Check } from 'lucide-react';

const OUTCOME_OPTIONS = [
  { value: 'sem_contato', label: '📵 Sem contato', color: 'text-gray-500' },
  { value: 'ocupado', label: '📞 Ocupado', color: 'text-yellow-500' },
  { value: 'caixa_postal', label: '📬 Caixa postal', color: 'text-gray-500' },
  { value: 'numero_errado', label: '❌ Número errado', color: 'text-red-500' },
  { value: 'interessado', label: '✅ Interessado', color: 'text-green-500' },
  { value: 'nao_interessado', label: '👎 Não interessado', color: 'text-red-500' },
  { value: 'agendou_r1', label: '📅 Agendou R1', color: 'text-blue-500' },
  { value: 'agendou_r2', label: '📅 Agendou R2', color: 'text-blue-500' },
  { value: 'follow_up', label: '🔄 Follow-up', color: 'text-orange-500' },
  { value: 'outro', label: '📝 Outro', color: 'text-gray-500' },
];

interface PostCallModalProps {
  open: boolean;
  onClose: () => void;
  callId: string | null;
  onSave: () => void;
}

export function PostCallModal({ open, onClose, callId, onSave }: PostCallModalProps) {
  const [outcome, setOutcome] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!callId) return;
    
    setIsSaving(true);
    try {
      // Update call record with outcome and notes (using type assertion)
      const { error } = await (supabase as any)
        .from('calls')
        .update({ 
          outcome, 
          notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', callId);

      if (error) throw error;

      // Get call details for activity logging
      const { data: callData } = await (supabase as any)
        .from('calls')
        .select('deal_id, duration_seconds, to_number')
        .eq('id', callId)
        .single();

      // Add to deal timeline if deal exists
      if (callData?.deal_id) {
        await supabase.from('deal_activities').insert({
          deal_id: callData.deal_id,
          activity_type: 'call',
          description: `Ligação (${formatDuration(callData.duration_seconds || 0)}) - ${OUTCOME_OPTIONS.find(o => o.value === outcome)?.label || outcome}`,
          metadata: {
            call_id: callId,
            outcome,
            duration_seconds: callData.duration_seconds,
            to_number: callData.to_number,
            notes
          }
        });
      }

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
                {OUTCOME_OPTIONS.map(opt => (
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
