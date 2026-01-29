import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, format } from 'date-fns';

export interface ContractReportFilters {
  startDate: Date;
  endDate: Date;
  closerId?: string;
  originId?: string;
}

export interface ContractReportRow {
  id: string;
  closerName: string;
  closerEmail: string;
  meetingDate: string;
  meetingType: string;
  leadName: string;
  leadPhone: string;
  sdrEmail: string;
  sdrName: string;
  originName: string;
  currentStage: string;
  contractPaidAt: string;
  salesChannel: 'a010' | 'bio' | 'live';
  contactEmail: string | null;
  contactTags: string[];
  customFields: {
    profissao?: string;
    renda?: string;
    estado?: string;
    [key: string]: unknown;
  };
}

export const useContractReport = (
  filters: ContractReportFilters,
  allowedCloserIds: string[] | null // null = all closers (admin/manager)
) => {
  return useQuery({
    queryKey: ['contract-report', filters, allowedCloserIds],
    queryFn: async (): Promise<ContractReportRow[]> => {
      const startISO = format(filters.startDate, 'yyyy-MM-dd') + 'T00:00:00';
      const endISO = format(filters.endDate, 'yyyy-MM-dd') + 'T23:59:59';
      
      // Query meeting_slot_attendees with status = 'contract_paid'
      // Filter by contract_paid_at (payment date), not scheduled_at (meeting date)
      let query = supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          attendee_name,
          attendee_phone,
          status,
          deal_id,
          contract_paid_at,
          meeting_slots!inner (
            id,
            scheduled_at,
            meeting_type,
            closer_id,
            closers (
              id,
              name,
              email,
              color
            )
          ),
          crm_deals (
            id,
            name,
            owner_id,
            custom_fields,
            origin_id,
            stage_id,
            contact_id,
            crm_origins (
              id,
              name,
              display_name
            ),
            crm_stages (
              id,
              stage_name
            ),
            crm_contacts (
              id,
              email,
              phone,
              tags
            )
          )
        `)
        .eq('status', 'contract_paid')
        .gte('contract_paid_at', startISO)
        .lte('contract_paid_at', endISO);
      
      // Filter by specific closer if provided
      if (filters.closerId) {
        query = query.eq('meeting_slots.closer_id', filters.closerId);
      }
      
      // Filter by allowed closers (for gestor/coordenador)
      if (allowedCloserIds && allowedCloserIds.length > 0) {
        query = query.in('meeting_slots.closer_id', allowedCloserIds);
      } else if (allowedCloserIds && allowedCloserIds.length === 0) {
        // No allowed closers means no access
        return [];
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      if (!data) return [];
      
      // Sort by payment date (DESC - most recent first)
      const sortedData = [...data].sort((a: any, b: any) => {
        const dateA = a.contract_paid_at || '';
        const dateB = b.contract_paid_at || '';
        return dateB.localeCompare(dateA);
      });
      
      // Fetch SDR names from profiles based on owner_id (email)
      const sdrEmails = [...new Set(
        sortedData
          .map((row: any) => row.crm_deals?.owner_id)
          .filter(Boolean)
      )];
      
      let sdrNameMap: Record<string, string> = {};
      
      if (sdrEmails.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('email', sdrEmails);
        
        if (profiles) {
          sdrNameMap = profiles.reduce((acc: Record<string, string>, p: any) => {
            if (p.email) acc[p.email] = p.name || p.email;
            return acc;
          }, {});
        }
      }
      
      // Collect all contact emails to check for A010 purchases
      const contactEmails = sortedData
        .map((row: any) => row.crm_deals?.crm_contacts?.email || row.attendee_email)
        .filter(Boolean) as string[];
      
      // Fetch A010 buyers from hubla_transactions
      let a010Emails = new Set<string>();
      if (contactEmails.length > 0) {
        const { data: hublaData } = await supabase
          .from('hubla_transactions')
          .select('customer_email')
          .ilike('product_name', '%a010%')
          .in('customer_email', contactEmails);
        
        if (hublaData) {
          a010Emails = new Set(hublaData.map(h => h.customer_email?.toLowerCase() || ''));
        }
      }
      
      // Helper to detect sales channel
      const detectSalesChannel = (email: string | null, tags: string[]): 'a010' | 'bio' | 'live' => {
        // Check A010 first (highest priority)
        if (email && a010Emails.has(email.toLowerCase())) {
          return 'a010';
        }
        
        // Check BIO tags
        const normalizedTags = tags.map(t => t.toLowerCase());
        if (normalizedTags.some(t => t.includes('bio') || t.includes('instagram'))) {
          return 'bio';
        }
        
        // Default to LIVE
        return 'live';
      };
      
      // Transform data
      return sortedData.map((row: any) => {
        const slot = row.meeting_slots;
        const closer = slot?.closers;
        const deal = row.crm_deals;
        const origin = deal?.crm_origins;
        const stage = deal?.crm_stages;
        const contact = deal?.crm_contacts;
        const customFields = deal?.custom_fields || {};
        const sdrEmail = deal?.owner_id || '';
        
        const contactEmail = contact?.email || null;
        const contactPhone = contact?.phone || row.attendee_phone || null;
        const contactTags: string[] = Array.isArray(contact?.tags) ? contact.tags : [];
        const salesChannel = detectSalesChannel(contactEmail, contactTags);
        
        return {
          id: row.id,
          closerName: closer?.name || 'N/A',
          closerEmail: closer?.email || '',
          meetingDate: slot?.scheduled_at || '',
          meetingType: slot?.meeting_type || 'r1',
          leadName: row.attendee_name || 'N/A',
          leadPhone: row.attendee_phone || '',
          sdrEmail,
          sdrName: sdrNameMap[sdrEmail] || sdrEmail,
          originName: origin?.display_name || origin?.name || 'N/A',
          currentStage: stage?.stage_name || 'N/A',
          contractPaidAt: row.contract_paid_at || slot?.scheduled_at || '',
          salesChannel,
          contactEmail,
          contactTags,
          customFields,
        };
      });
    },
    enabled: filters.startDate instanceof Date && filters.endDate instanceof Date,
    staleTime: 2 * 60 * 1000,
  });
};

// Helper to get default filter dates (current month)
export const getDefaultContractReportFilters = (): ContractReportFilters => ({
  startDate: startOfMonth(new Date()),
  endDate: endOfMonth(new Date()),
});
