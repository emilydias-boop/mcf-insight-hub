import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCustomWeekStart, getCustomWeekEnd } from '@/lib/dateHelpers';
import { normalizePhoneNumber } from '@/lib/phoneUtils';
import { startOfDay, endOfDay } from 'date-fns';

export interface SDRR2Metrics {
  sdrEmail: string;
  sdrName: string;
  leadsAprovados: number;  // Leads do SDR que foram aprovados no R2
  vendasRealizadas: number; // Leads do SDR que compraram parceria
  taxaConversao: number;   // vendasRealizadas / leadsAprovados * 100
}

export function useSDRR2Metrics(weekDate: Date, sdrEmailFilter?: string) {
  const weekStart = getCustomWeekStart(weekDate);
  const weekEnd = getCustomWeekEnd(weekDate);

  return useQuery({
    queryKey: ['sdr-r2-metrics', weekStart.toISOString(), weekEnd.toISOString()],
    queryFn: async (): Promise<SDRR2Metrics[]> => {
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
        console.warn('R2 "Aprovado" status not found');
        return [];
      }

      // 2. Fetch approved R2 attendees with deal and contact info
      const { data: approvedAttendees, error: attendeesError } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          attendee_name,
          attendee_phone,
          carrinho_status,
          deal:crm_deals(
            id,
            owner_id,
            original_sdr_email,
            contact:crm_contacts(
              email,
              phone
            )
          ),
          meeting_slot:meeting_slots!inner(
            id,
            scheduled_at,
            meeting_type
          )
        `)
        .eq('r2_status_id', aprovadoStatusId)
        .eq('meeting_slot.meeting_type', 'r2')
        .gte('meeting_slot.scheduled_at', startOfDay(weekStart).toISOString())
        .lte('meeting_slot.scheduled_at', endOfDay(weekEnd).toISOString());

      if (attendeesError) {
        console.error('Error fetching approved attendees:', attendeesError);
        throw attendeesError;
      }

      if (!approvedAttendees || approvedAttendees.length === 0) {
        return [];
      }

      // 3. Collect emails and phones for matching with sales
      const emailsSet = new Set<string>();
      const phonesSet = new Set<string>();
      
      approvedAttendees.forEach((att: any) => {
        const deal = att.deal;
        const contact = deal?.contact;
        
        const email = contact?.email?.toLowerCase();
        if (email) emailsSet.add(email);
        
        const phone = normalizePhoneNumber(att.attendee_phone || contact?.phone);
        if (phone && phone.length >= 10) phonesSet.add(phone);
      });

      // 4. Fetch partnership sales for the week
      const { data: sales, error: salesError } = await supabase
        .from('hubla_transactions')
        .select('customer_email, customer_phone')
        .eq('product_category', 'parceria')
        .gte('sale_date', startOfDay(weekStart).toISOString())
        .lte('sale_date', endOfDay(weekEnd).toISOString());

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

      // 5. Aggregate by SDR
      const sdrMap = new Map<string, SDRR2Metrics>();

      approvedAttendees.forEach((att: any) => {
        const deal = att.deal;
        if (!deal) return;
        
        // Get SDR email - prefer original_sdr_email, fallback to owner_id
        const sdrEmail = deal.original_sdr_email || deal.owner_id;
        if (!sdrEmail) return;

        // Initialize SDR entry if needed
        if (!sdrMap.has(sdrEmail)) {
          // Extract name from email (before @)
          const sdrName = sdrEmail.split('@')[0]
            .split('.')
            .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
          
          sdrMap.set(sdrEmail, {
            sdrEmail,
            sdrName,
            leadsAprovados: 0,
            vendasRealizadas: 0,
            taxaConversao: 0
          });
        }

        const stats = sdrMap.get(sdrEmail)!;
        stats.leadsAprovados++;

        // Check if this lead made a purchase
        const contact = deal.contact;
        const email = contact?.email?.toLowerCase();
        const phone = normalizePhoneNumber(att.attendee_phone || contact?.phone);
        
        const hasSold = 
          (email && soldEmails.has(email)) ||
          (phone && phone.length >= 10 && Array.from(soldPhones).some(sp => 
            sp.includes(phone) || phone.includes(sp)
          )) ||
          att.carrinho_status === 'comprou';

        if (hasSold) {
          stats.vendasRealizadas++;
        }
      });

      // 6. Calculate conversion rates and sort by leads
      let result = Array.from(sdrMap.values());
      result.forEach(stats => {
        stats.taxaConversao = stats.leadsAprovados > 0
          ? (stats.vendasRealizadas / stats.leadsAprovados) * 100
          : 0;
      });

      // Filter by specific SDR if provided
      if (sdrEmailFilter) {
        result = result.filter(s => s.sdrEmail.toLowerCase() === sdrEmailFilter.toLowerCase());
      }

      // Sort by leads approved (descending)
      result.sort((a, b) => b.leadsAprovados - a.leadsAprovados);

      return result;
    },
    refetchInterval: 30000,
  });
}