import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TransferParams {
  attendeeId: string;
  targetCloserId: string;
  targetDate: Date;
  targetTime: string; // "HH:mm"
  reason?: string;
  // Original slot info for audit
  originalSlotId: string;
  originalCloserId?: string;
  originalCloserName?: string;
  originalScheduledAt?: string;
}

export function useTransferR2Attendee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      attendeeId,
      targetCloserId,
      targetDate,
      targetTime,
      reason,
      originalSlotId,
      originalCloserId,
      originalCloserName,
      originalScheduledAt,
    }: TransferParams) => {
      // 1. Build target datetime
      const [hours, minutes] = targetTime.split(':');
      const targetDateTime = new Date(targetDate);
      targetDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      const targetDateTimeStr = targetDateTime.toISOString();

      // 2. Check if target slot already exists
      const { data: existingSlot } = await supabase
        .from('meeting_slots')
        .select('id')
        .eq('closer_id', targetCloserId)
        .eq('scheduled_at', targetDateTimeStr)
        .eq('meeting_type', 'r2')
        .in('status', ['scheduled', 'rescheduled'])
        .maybeSingle();

      let targetSlotId = existingSlot?.id;

      // 3. If no slot exists, create one
      if (!targetSlotId) {
        const { data: newSlot, error: slotError } = await supabase
          .from('meeting_slots')
          .insert({
            closer_id: targetCloserId,
            scheduled_at: targetDateTimeStr,
            duration_minutes: 30,
            status: 'scheduled',
            meeting_type: 'r2',
            notes: reason ? `Transferência: ${reason}` : null,
          })
          .select()
          .single();

        if (slotError) throw slotError;
        targetSlotId = newSlot.id;
      }

      // 4. Get attendee info for audit log
      const { data: attendee } = await supabase
        .from('meeting_slot_attendees')
        .select('deal_id, attendee_name, status')
        .eq('id', attendeeId)
        .single();

      // 5. Update the attendee to point to the new slot
      const { error: updateError } = await supabase
        .from('meeting_slot_attendees')
        .update({ meeting_slot_id: targetSlotId })
        .eq('id', attendeeId);

      if (updateError) throw updateError;

      // 6. Get target closer name for audit
      const { data: targetCloser } = await supabase
        .from('closers')
        .select('name')
        .eq('id', targetCloserId)
        .single();

      // 7. Log the movement to attendee_movement_logs
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: userProfile } = user ? await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle() : { data: null };

      const { data: userRoles } = user ? await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .limit(1) : { data: null };

      await supabase
        .from('attendee_movement_logs')
        .insert({
          attendee_id: attendeeId,
          movement_type: 'transfer',
          from_slot_id: originalSlotId,
          from_closer_id: originalCloserId || null,
          from_closer_name: originalCloserName || null,
          from_scheduled_at: originalScheduledAt || null,
          to_slot_id: targetSlotId,
          to_closer_id: targetCloserId,
          to_closer_name: targetCloser?.name || null,
          to_scheduled_at: targetDateTimeStr,
          previous_status: attendee?.status || null,
          reason: reason || null,
          moved_by: user?.id || null,
          moved_by_name: userProfile?.full_name || null,
          moved_by_role: userRoles?.[0]?.role || null,
        });

      // 8. Also log to deal_activities if deal is linked
      if (attendee?.deal_id) {
        await supabase
          .from('deal_activities')
          .insert({
            deal_id: attendee.deal_id,
            activity_type: 'attendee_transferred',
            description: `Lead transferido de ${originalCloserName || 'anterior'} para ${targetCloser?.name || 'novo closer'}`,
            metadata: {
              from_slot_id: originalSlotId,
              to_slot_id: targetSlotId,
              from_closer: originalCloserName,
              to_closer: targetCloser?.name,
              from_date: originalScheduledAt,
              to_date: targetDateTimeStr,
              reason,
            },
          });
      }

      // 9. Check if original slot is now empty
      const { count } = await supabase
        .from('meeting_slot_attendees')
        .select('*', { count: 'exact', head: true })
        .eq('meeting_slot_id', originalSlotId);

      // If empty, mark original slot as canceled
      if (count === 0) {
        await supabase
          .from('meeting_slots')
          .update({ status: 'canceled' })
          .eq('id', originalSlotId);
      }

      return { success: true, targetSlotId };
    },
    onSuccess: () => {
      // Invalidate all R2 agenda caches
      queryClient.invalidateQueries({ queryKey: ['r2-agenda-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['r2-meetings-extended'] });
      queryClient.invalidateQueries({ queryKey: ['r2-carrinho-data'] });
      queryClient.invalidateQueries({ queryKey: ['r2-carrinho-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['r2-fora-carrinho-data'] });
      queryClient.invalidateQueries({ queryKey: ['r2-noshow-count'] });
      queryClient.invalidateQueries({ queryKey: ['r2-noshow-leads'] });
      queryClient.invalidateQueries({ queryKey: ['r2-pending-leads'] });
      toast.success('Participante transferido com sucesso!');
    },
    onError: (error: any) => {
      console.error('Transfer error:', error);
      toast.error(`Erro ao transferir: ${error.message}`);
    },
  });
}
