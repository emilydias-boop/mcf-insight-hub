import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { normalizePhoneNumber } from '@/lib/phoneUtils';
import { startOfDay, endOfDay } from 'date-fns';

export interface CloserR2Metrics {
  aprovados: number;     // Leads aprovados no R2 pelo closer
  vendas: number;        // Leads que compraram parceria
  taxaConversao: number; // vendas/aprovados * 100
}

export function useCloserR2Metrics(closerId: string | null, startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['closer-r2-metrics', closerId, startDate.toISOString(), endDate.toISOString()],
    queryFn: async (): Promise<CloserR2Metrics> => {
      if (!closerId) {
        return { aprovados: 0, vendas: 0, taxaConversao: 0 };
      }

      // 1. Fetch R2 status options to find "Aprovado"
      const { data: statusOptions } = await supabase
        .from('r2_status_options')
        .select('id, name')
        .eq('is_active', true);
      
      const aprovadoStatusId = statusOptions?.find(s => 
        s.name.toLowerCase().includes('aprovado') || 
        s.name.toLowerCase().includes('approved')
      )?.id;

      if (!aprovadoStatusId) {
        return { aprovados: 0, vendas: 0, taxaConversao: 0 };
      }

      // 2. Fetch approved R2 attendees for this closer
      const { data: approvedAttendees, error: attendeesError } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          attendee_name,
          attendee_phone,
          carrinho_status,
          deal:crm_deals(
            id,
            contact:crm_contacts(
              email,
              phone
            )
          ),
          meeting_slot:meeting_slots!inner(
            id,
            scheduled_at,
            meeting_type,
            closer_id
          )
        `)
        .eq('r2_status_id', aprovadoStatusId)
        .eq('meeting_slot.meeting_type', 'r2')
        .eq('meeting_slot.closer_id', closerId)
        .gte('meeting_slot.scheduled_at', startOfDay(startDate).toISOString())
        .lte('meeting_slot.scheduled_at', endOfDay(endDate).toISOString());

      if (attendeesError) {
        console.error('Error fetching closer approved attendees:', attendeesError);
        throw attendeesError;
      }

      const aprovados = approvedAttendees?.length || 0;

      if (aprovados === 0) {
        return { aprovados: 0, vendas: 0, taxaConversao: 0 };
      }

      // 3. Fetch partnership sales for the period
      const { data: sales, error: salesError } = await supabase
        .from('hubla_transactions')
        .select('customer_email, customer_phone')
        .eq('product_category', 'parceria')
        .gte('sale_date', startOfDay(startDate).toISOString())
        .lte('sale_date', endOfDay(endDate).toISOString());

      if (salesError) {
        console.error('Error fetching sales:', salesError);
        throw salesError;
      }

      // Create sets for quick lookup
      const soldEmails = new Set(
        sales?.map(s => s.customer_email?.toLowerCase()).filter(Boolean) || []
      );
      const soldPhones = new Set(
        sales?.map(s => normalizePhoneNumber(s.customer_phone)).filter(p => p && p.length >= 10) || []
      );

      // 4. Count sales
      let vendas = 0;
      approvedAttendees?.forEach((att: any) => {
        const deal = att.deal;
        const contact = deal?.contact;
        const email = contact?.email?.toLowerCase();
        const phone = normalizePhoneNumber(att.attendee_phone || contact?.phone);
        
        const hasSold = 
          (email && soldEmails.has(email)) ||
          (phone && phone.length >= 10 && Array.from(soldPhones).some(sp => 
            sp.includes(phone) || phone.includes(sp)
          )) ||
          att.carrinho_status === 'comprou';

        if (hasSold) {
          vendas++;
        }
      });

      const taxaConversao = aprovados > 0 ? (vendas / aprovados) * 100 : 0;

      return { aprovados, vendas, taxaConversao };
    },
    enabled: !!closerId,
    refetchInterval: 30000,
  });
}
