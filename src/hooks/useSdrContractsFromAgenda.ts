import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export interface AgendaContractItem {
  id: string;
  leadName: string;
  contractPaidAt: string;
  contactEmail: string | null;
  contactPhone: string | null;
  closerName: string | null;
}

/**
 * Busca a lista detalhada de contratos pagos da Agenda para um SDR,
 * usando a mesma lógica da RPC get_sdr_metrics_from_agenda.
 */
export const useSdrContractsFromAgenda = (sdrId: string | undefined, anoMes: string | undefined) => {
  return useQuery({
    queryKey: ['sdr-agenda-contracts-list', sdrId, anoMes],
    queryFn: async (): Promise<AgendaContractItem[]> => {
      if (!sdrId || !anoMes) return [];

      // 1. Buscar email do SDR
      const { data: sdr } = await supabase
        .from('sdr')
        .select('email')
        .eq('id', sdrId)
        .single();

      if (!sdr?.email) return [];

      // 2. Buscar profile id do SDR pelo email (booked_by é profile id)
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', sdr.email)
        .maybeSingle();

      if (!profile?.id) return [];

      // 3. Período do mês
      const [year, month] = anoMes.split('-').map(Number);
      const monthDate = new Date(year, month - 1, 1);
      const startDate = format(startOfMonth(monthDate), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(monthDate), 'yyyy-MM-dd');

      // 4. Buscar attendees com contract_paid_at no período
      // Mesma lógica da RPC: status != cancelled, meeting_type = r1, is_partner = false, booked_by = profile.id
      const { data: attendees, error } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          attendee_name,
          attendee_phone,
          contract_paid_at,
          meeting_slots!inner (
            meeting_type,
            closer_id,
            closers (
              name
            )
          ),
          crm_deals (
            name,
            crm_contacts (
              email,
              phone
            )
          )
        `)
        .eq('booked_by', profile.id)
        .eq('is_partner', false)
        .neq('status', 'cancelled')
        .eq('meeting_slots.meeting_type', 'r1')
        .not('contract_paid_at', 'is', null)
        .gte('contract_paid_at', `${startDate}T00:00:00`)
        .lte('contract_paid_at', `${endDate}T23:59:59`)
        .order('contract_paid_at', { ascending: false });

      if (error) {
        console.error('[useSdrContractsFromAgenda] Error:', error);
        return [];
      }

      return (attendees || []).map((att: any) => ({
        id: att.id,
        leadName: att.attendee_name || att.crm_deals?.name || 'Lead sem nome',
        contractPaidAt: att.contract_paid_at,
        contactEmail: att.crm_deals?.crm_contacts?.email || null,
        contactPhone: att.attendee_phone || att.crm_deals?.crm_contacts?.phone || null,
        closerName: att.meeting_slots?.closers?.name || null,
      }));
    },
    enabled: !!sdrId && !!anoMes,
    staleTime: 60_000,
  });
};
