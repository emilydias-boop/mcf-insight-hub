import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { CarrinhoConfig } from '@/hooks/useCarrinhoConfig';
import { getCarrinhoMetricBoundaries } from '@/lib/carrinhoWeekBoundaries';

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

export function useR2ForaDoCarrinhoData(weekStart: Date, weekEnd: Date, carrinhoConfig?: CarrinhoConfig) {
  return useQuery({
    queryKey: ['r2-fora-carrinho-data', format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd')],
    queryFn: async (): Promise<R2ForaDoCarrinhoAttendee[]> => {
      const boundaries = getCarrinhoMetricBoundaries(weekStart, weekEnd, carrinhoConfig);

      // ===== STEP 1: Fetch status options =====
      const { data: statusOptions } = await supabase
        .from('r2_status_options')
        .select('id, name, color')
        .eq('is_active', true);

      const foraStatusIds = statusOptions
        ?.filter(s => FORA_DO_CARRINHO_STATUSES.some(name =>
          s.name.toLowerCase() === name.toLowerCase()
        ))
        .map(s => s.id) || [];

      if (foraStatusIds.length === 0) return [];

      const statusMap = new Map<string, { id: string; name: string; color: string }>();
      (statusOptions || []).forEach(s => statusMap.set(s.id, s));

      // ===== STEP 2: Fetch R2 attendees in operational window (Sex-Sex) =====
      const { data: r2Attendees } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          attendee_name,
          attendee_phone,
          r2_status_id,
          deal_id,
          contact_id,
          meeting_slot:meeting_slots!inner(
            id,
            scheduled_at,
            meeting_type,
            closer:closers!meeting_slots_closer_id_fkey(
              id,
              name,
              color
            )
          )
        `)
        .eq('meeting_slot.meeting_type', 'r2')
        .gte('meeting_slot.scheduled_at', boundaries.r2Meetings.start.toISOString())
        .lte('meeting_slot.scheduled_at', boundaries.r2Meetings.end.toISOString());

      if (!r2Attendees) return [];

      // Filter only "fora do carrinho" statuses
      const foraAttendees = r2Attendees.filter((att: any) =>
        att.r2_status_id && foraStatusIds.includes(att.r2_status_id)
      );

      // Fetch deal info for motivo
      const allDealIds = foraAttendees.map((a: any) => a.deal_id).filter(Boolean);
      const { data: deals } = allDealIds.length > 0
        ? await supabase
            .from('crm_deals')
            .select('id, name, custom_fields, contact:crm_contacts(phone)')
            .in('id', allDealIds)
        : { data: null };

      const dealMap = new Map<string, any>();
      if (deals) deals.forEach(d => dealMap.set(d.id, d));

      const result: R2ForaDoCarrinhoAttendee[] = [];

      for (const att of foraAttendees) {
        const slot = (att as any).meeting_slot;
        const closerData = Array.isArray(slot?.closer) ? slot.closer[0] : slot?.closer;
        const status = statusMap.get(att.r2_status_id!);
        const deal = (att as any).deal_id ? dealMap.get((att as any).deal_id) : null;
        const customFields = deal?.custom_fields as Record<string, unknown> | null | undefined;

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
          closer_name: closerData?.name || null,
          closer_color: closerData?.color || null,
          scheduled_at: slot.scheduled_at,
          deal_name: deal?.name || null,
          contact_phone: contactPhone || null,
          meeting_id: slot.id,
        });
      }

      return result.sort((a, b) =>
        new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()
      );
    },
  });
}
