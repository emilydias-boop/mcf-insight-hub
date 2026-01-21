import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCustomWeekStart, getCustomWeekEnd } from '@/lib/dateHelpers';
import { format, startOfDay, endOfDay } from 'date-fns';

export interface R2ForaDoCarrinhoAttendee {
  id: string;
  attendee_name: string | null;
  attendee_phone: string | null;
  r2_status_id: string | null;
  r2_status_name: string;
  r2_status_color: string;
  motivo: string | null;
  closer_name: string | null;
  closer_color: string | null;
  scheduled_at: string;
  deal_name: string | null;
  contact_phone: string | null;
  meeting_id: string;
}

const FORA_DO_CARRINHO_STATUSES = ['Reembolso', 'Desistente', 'Reprovado', 'Próxima Semana', 'Cancelado'];

export function useR2ForaDoCarrinhoData(weekDate: Date) {
  const weekStart = getCustomWeekStart(weekDate);
  const weekEnd = getCustomWeekEnd(weekDate);

  return useQuery({
    queryKey: ['r2-fora-carrinho-data', format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd')],
    queryFn: async (): Promise<R2ForaDoCarrinhoAttendee[]> => {
      // First get the status options to map IDs to names/colors
      const { data: statusOptions } = await supabase
        .from('r2_status_options')
        .select('id, name, color')
        .eq('is_active', true);

      // Get the IDs for "fora do carrinho" statuses
      const foraStatusIds = statusOptions
        ?.filter(s => FORA_DO_CARRINHO_STATUSES.some(name => 
          s.name.toLowerCase() === name.toLowerCase()
        ))
        .map(s => s.id) || [];

      if (foraStatusIds.length === 0) {
        return [];
      }

      // Get R2 meetings in the week with their attendees
      const { data: meetings } = await supabase
        .from('meeting_slots')
        .select(`
          id,
          scheduled_at,
          closer:closers(
            id,
            name,
            color
          ),
          attendees:meeting_slot_attendees(
            id,
            attendee_name,
            attendee_phone,
            r2_status_id,
            deal_id
          )
        `)
        .eq('meeting_type', 'r2')
        .gte('scheduled_at', startOfDay(weekStart).toISOString())
        .lte('scheduled_at', endOfDay(weekEnd).toISOString());

      if (!meetings) return [];

      // Get deal IDs to fetch deal info
      const dealIds = meetings
        .flatMap(m => m.attendees?.map(a => a.deal_id).filter(Boolean) || []);

      // Fetch deals with custom_fields and contacts
      const { data: deals } = dealIds.length > 0 
        ? await supabase
            .from('crm_deals')
            .select(`
              id,
              name,
              custom_fields,
              contact:crm_contacts(
                phone
              )
            `)
            .in('id', dealIds)
        : { data: null };

      const dealMap = new Map<string, {
        id: string;
        name: string | null;
        custom_fields: unknown;
        contact: { phone: string | null } | { phone: string | null }[] | null;
      }>();
      
      if (deals) {
        deals.forEach(d => {
          dealMap.set(d.id, d);
        });
      }

      const statusMap = new Map<string, { id: string; name: string; color: string }>();
      (statusOptions || []).forEach(s => {
        statusMap.set(s.id, s);
      });

      // Flatten and filter attendees
      const result: R2ForaDoCarrinhoAttendee[] = [];

      for (const meeting of meetings) {
        const closer = Array.isArray(meeting.closer) ? meeting.closer[0] : meeting.closer;
        
        for (const att of meeting.attendees || []) {
          // Only include if has a "fora do carrinho" status
          if (!att.r2_status_id || !foraStatusIds.includes(att.r2_status_id)) {
            continue;
          }

          const status = statusMap.get(att.r2_status_id);
          const deal = att.deal_id ? dealMap.get(att.deal_id) : null;
          const customFields = deal?.custom_fields as Record<string, unknown> | null | undefined;

          // Extract motivo from custom_fields
          const motivo = (customFields?.justificativa_reembolso as string | undefined) 
            || (customFields?.motivo_sem_interesse as string | undefined)
            || (customFields?.motivo_desistencia as string | undefined)
            || (customFields?.motivo_reprovado as string | undefined)
            || null;

          const contactData = deal?.contact;
          const contactPhone = Array.isArray(contactData) 
            ? contactData[0]?.phone 
            : contactData?.phone;

          result.push({
            id: att.id,
            attendee_name: att.attendee_name,
            attendee_phone: att.attendee_phone,
            r2_status_id: att.r2_status_id,
            r2_status_name: status?.name || 'Desconhecido',
            r2_status_color: status?.color || '#6B7280',
            motivo,
            closer_name: closer?.name || null,
            closer_color: closer?.color || null,
            scheduled_at: meeting.scheduled_at,
            deal_name: deal?.name || null,
            contact_phone: contactPhone || null,
            meeting_id: meeting.id,
          });
        }
      }

      // Sort by scheduled_at descending
      return result.sort((a, b) => 
        new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()
      );
    },
  });
}
