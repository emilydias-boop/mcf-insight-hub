import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useUpdateR2MeetingStatus } from '@/hooks/useR2AgendaData';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Loader2 } from 'lucide-react';

const REFUND_REASONS = [
  { value: 'insatisfacao_produto', label: 'Insatisfação com o produto' },
  { value: 'problema_financeiro', label: 'Problema financeiro' },
  { value: 'expectativa_nao_atendida', label: 'Expectativa não atendida' },
  { value: 'atendimento', label: 'Problema com atendimento' },
  { value: 'mudanca_planos', label: 'Mudança de planos' },
  { value: 'outro', label: 'Outro' },
];

interface RefundModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId?: string;
  attendeeId?: string;
  dealId: string | null;
  dealName?: string;
  originId?: string;
  currentCustomFields?: Record<string, any>;
  meetingType?: 'r1' | 'r2';
  onSuccess?: () => void;
}

export function RefundModal({
  open,
  onOpenChange,
  meetingId,
  attendeeId,
  dealId,
  dealName,
  originId,
  currentCustomFields,
  meetingType = 'r2',
  onSuccess,
}: RefundModalProps) {
  const [selectedReason, setSelectedReason] = useState('');
  const [justification, setJustification] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const queryClient = useQueryClient();
  const updateMeetingStatus = useUpdateR2MeetingStatus();

  const handleConfirm = async () => {
    if (!selectedReason) {
      toast.error('Selecione um motivo para o reembolso');
      return;
    }

    if (!justification.trim()) {
      toast.error('Informe uma justificativa para o reembolso');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Update meeting/attendee status based on meeting type (skip if no meetingId)
      if (meetingId && meetingType === 'r1') {
        // For R1: update the specific attendee status to 'refunded'
        if (attendeeId) {
          const { error: attendeeError } = await supabase
            .from('meeting_slot_attendees')
            .update({ status: 'refunded' })
            .eq('id', attendeeId);
          
          if (attendeeError) {
            console.error('Error updating attendee status:', attendeeError);
            throw attendeeError;
          }
        }
      } else if (meetingId) {
        // For R2: update ONLY the individual attendee, NOT the slot
        if (attendeeId) {
          // Fetch the "Reembolso" status ID from r2_status_options
          const { data: reembolsoStatus } = await supabase
            .from('r2_status_options')
            .select('id')
            .ilike('name', '%reembolso%')
            .limit(1)
            .single();

          // Update attendee status to 'refunded'
          const { error: attendeeError } = await supabase
            .from('meeting_slot_attendees')
            .update({ 
              status: 'refunded',
              // Also update r2_status_id so KPIs update correctly
              ...(reembolsoStatus?.id ? { r2_status_id: reembolsoStatus.id } : {})
            })
            .eq('id', attendeeId);
          
          if (attendeeError) {
            console.error('Error updating attendee status:', attendeeError);
            throw attendeeError;
          }
        } else {
          // Fallback: update meeting slot status if no attendeeId
          await updateMeetingStatus.mutateAsync({ 
            meetingId, 
            status: 'refunded' 
          });
        }
      }

      // 2. If we have a dealId, mark it as lost with refund flags
      if (dealId) {
        // Find a lost stage for this origin
        let lostStageId: string | null = null;
        
        if (originId) {
          const { data: localStage } = await supabase
            .from('crm_stages')
            .select('id')
            .eq('origin_id', originId)
            .or('stage_name.ilike.%sem interesse%,stage_name.ilike.%perdido%')
            .limit(1)
            .single();
          
          if (localStage) {
            lostStageId = localStage.id;
          }
        }

        // Fallback to global lost stage
        if (!lostStageId) {
          const { data: globalStage } = await supabase
            .from('crm_stages')
            .select('id')
            .is('origin_id', null)
            .or('stage_name.ilike.%sem interesse%,stage_name.ilike.%perdido%')
            .limit(1)
            .single();
          
          if (globalStage) {
            lostStageId = globalStage.id;
          }
        }

        const reasonLabel = REFUND_REASONS.find(r => r.value === selectedReason)?.label || selectedReason;

        // Update deal with refund flags
        const updateData: any = {
          custom_fields: {
            ...(currentCustomFields || {}),
            reembolso_solicitado: true,
            reembolso_em: new Date().toISOString(),
            motivo_reembolso: reasonLabel,
            justificativa_reembolso: justification.trim(),
            motivo_sem_interesse: 'Reembolso',
          }
        };

        if (lostStageId) {
          updateData.stage_id = lostStageId;
        }

        const { error: updateError } = await supabase
          .from('crm_deals')
          .update(updateData)
          .eq('id', dealId);

        if (updateError) {
          console.error('Error updating deal:', updateError);
        }

        // Register activity
        await supabase.from('deal_activities').insert({
          deal_id: dealId,
          activity_type: 'loss_marked',
          description: `⚠️ REEMBOLSO SOLICITADO\nMotivo: ${reasonLabel}\nJustificativa: ${justification.trim()}`,
          metadata: { 
            reason: selectedReason,
            reason_label: reasonLabel,
            justification: justification.trim(),
            via: 'r2_agenda',
            refunded_at: new Date().toISOString()
          }
        });
      }

      toast.warning('Lead marcado como REEMBOLSO e movido para perdidos');
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['r2-pending-leads'] });
      queryClient.invalidateQueries({ queryKey: ['r2-meetings-extended'] });
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      queryClient.invalidateQueries({ queryKey: ['r2-carrinho-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['r2-carrinho-data'] });
      queryClient.invalidateQueries({ queryKey: ['r2-fora-carrinho-data'] });
      
      // Reset form
      setSelectedReason('');
      setJustification('');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error processing refund:', error);
      toast.error('Erro ao processar reembolso');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <AlertTriangle className="h-5 w-5" />
            Solicitar Reembolso
          </DialogTitle>
          <DialogDescription>
            {dealName ? (
              <>Registrar reembolso para <strong>{dealName}</strong>. O lead será marcado como perdido.</>
            ) : (
              <>Registrar reembolso. O lead será marcado como perdido.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="refund-reason">Motivo do reembolso *</Label>
            <Select value={selectedReason} onValueChange={setSelectedReason}>
              <SelectTrigger id="refund-reason">
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {REFUND_REASONS.map((reason) => (
                  <SelectItem key={reason.value} value={reason.value}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="refund-justification">Justificativa *</Label>
            <Textarea
              id="refund-justification"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Descreva os detalhes do reembolso..."
              rows={4}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            className="bg-orange-600 hover:bg-orange-700"
            onClick={handleConfirm}
            disabled={isSubmitting || !selectedReason || !justification.trim()}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              'Confirmar Reembolso'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
