import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, format, subHours, addHours } from 'date-fns';

export interface ContractReportFilters {
  startDate: Date;
  endDate: Date;
  closerId?: string;
  originId?: string;
}

export interface ContractReportRow {
  id: string;
  dealId: string | null;
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
  dealCreatedAt: string;
  salesChannel: 'a010' | 'bio' | 'live';
  contactEmail: string | null;
  contactId: string | null;
  contactTags: string[];
  isRefunded: boolean;
  originId: string | null;
  customFields: {
    profissao?: string;
    renda?: string;
    estado?: string;
    [key: string]: unknown;
  };
}

export const useContractReport = (
  filters: ContractReportFilters,
  allowedCloserIds: string[] | null, // null = all closers (admin/manager)
  bu?: string // optional BU filter to restrict results to a specific business unit
) => {
  return useQuery({
    queryKey: ['contract-report', filters, allowedCloserIds, bu],
    queryFn: async (): Promise<ContractReportRow[]> => {
      // If BU is specified, fetch allowed origin_ids from bu_origin_mapping
      let buOriginIds: string[] | null = null;
      if (bu) {
        const { data: mappings } = await supabase
          .from('bu_origin_mapping')
          .select('entity_id, entity_type')
          .eq('bu', bu);
        
        if (mappings && mappings.length > 0) {
          // Get origin IDs directly mapped
          const directOriginIds = mappings
            .filter(m => m.entity_type === 'origin')
            .map(m => m.entity_id);
          
          // Get origins belonging to mapped groups
          const groupIds = mappings
            .filter(m => m.entity_type === 'group')
            .map(m => m.entity_id);
          
          if (groupIds.length > 0) {
            const { data: groupOrigins } = await supabase
              .from('crm_origins')
              .select('id')
              .in('group_id', groupIds);
            
            if (groupOrigins) {
              directOriginIds.push(...groupOrigins.map(o => o.id));
            }
          }
          
          buOriginIds = directOriginIds;
          
          // If no origins mapped for this BU, return empty
          if (buOriginIds.length === 0) return [];
        }
      }
      // Corrigir fuso horário BRT (UTC-3): somar 3h em ambos os extremos
      // Ex: filtrar "05/03 BRT" = buscar de 05/03 03:00 UTC até 06/03 02:59 UTC (janela 24h exata)
      const BRT_OFFSET_HOURS = 3;
      const startISO = addHours(new Date(format(filters.startDate, 'yyyy-MM-dd') + 'T00:00:00'), BRT_OFFSET_HOURS).toISOString();
      const endISO = addHours(new Date(format(filters.endDate, 'yyyy-MM-dd') + 'T23:59:59'), BRT_OFFSET_HOURS).toISOString();
      
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
          is_partner,
          booked_by,
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
            created_at,
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
        .not('contract_paid_at', 'is', null)
        .eq('is_partner', false)
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
      
      // Filter by BU origin_ids if specified
      let filteredData = data;
      if (buOriginIds) {
        filteredData = data.filter((row: any) => {
          const originId = row.crm_deals?.origin_id;
          return originId && buOriginIds.includes(originId);
        });
      }
      
      // Collect linked attendee IDs to avoid duplicates
      const linkedAttendeeIds = new Set(
        filteredData.map((row: any) => row.id).filter(Boolean)
      );
      
      // Fetch unlinked Hubla A000 transactions (contracts without meetings)
      const { data: unlinkedHubla } = await supabase
        .from('hubla_transactions')
        .select('id, sale_date, customer_name, customer_email, customer_phone, product_name, net_value, source, linked_attendee_id')
        .eq('product_category', 'contrato')
        .is('linked_attendee_id', null)
        .gte('sale_date', startISO)
        .lte('sale_date', endISO)
        .order('sale_date', { ascending: false });
      
      // Sort by payment date (DESC - most recent first)
      const sortedData = [...filteredData].sort((a: any, b: any) => {
        const dateA = a.contract_paid_at || '';
        const dateB = b.contract_paid_at || '';
        return dateB.localeCompare(dateA);
      });
      
      // Fetch SDR profiles from booked_by UUIDs (priority) and owner_id emails (fallback)
      const bookedByIds = [...new Set(
        sortedData
          .map((row: any) => row.booked_by)
          .filter(Boolean)
      )];
      
      let bookedByMap: Record<string, { full_name: string; email: string }> = {};
      
      if (bookedByIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', bookedByIds);
        
        if (profiles) {
          bookedByMap = profiles.reduce((acc: Record<string, { full_name: string; email: string }>, p: any) => {
            if (p.id) acc[p.id] = { full_name: p.full_name || p.email, email: p.email };
            return acc;
          }, {});
        }
      }
      
      // Fallback: fetch SDR names from profiles based on owner_id (email)
      const sdrEmails = [...new Set(
        sortedData
          .map((row: any) => row.crm_deals?.owner_id)
          .filter(Boolean)
      )];
      
      let sdrNameMap: Record<string, string> = {};
      
      if (sdrEmails.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('email', sdrEmails);
        
        if (profiles) {
          sdrNameMap = profiles.reduce((acc: Record<string, string>, p: any) => {
            if (p.email) acc[p.email] = p.full_name || p.email;
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
      
      // Transform meeting-based data
      const meetingRows: ContractReportRow[] = sortedData.map((row: any) => {
        const slot = row.meeting_slots;
        const closer = slot?.closers;
        const deal = row.crm_deals;
        const origin = deal?.crm_origins;
        const stage = deal?.crm_stages;
        const contact = deal?.crm_contacts;
        const customFields = deal?.custom_fields || {};
        
        const bookedByProfile = row.booked_by ? bookedByMap[row.booked_by] : null;
        const sdrEmail = bookedByProfile?.email || deal?.owner_id || '';
        const sdrName = bookedByProfile?.full_name || sdrNameMap[sdrEmail] || sdrEmail;
        
        const contactEmail = contact?.email || null;
        const contactPhone = contact?.phone || row.attendee_phone || null;
        const contactTags: string[] = Array.isArray(contact?.tags)
          ? contact.tags.map((t: any) => {
              if (typeof t === 'string') {
                if (t.startsWith('{')) {
                  try { const p = JSON.parse(t); return p?.name || t; } catch { return t; }
                }
                return t;
              }
              return t?.name || String(t);
            }).filter(Boolean)
          : [];
        const salesChannel = detectSalesChannel(contactEmail, contactTags);
        
        return {
          id: row.id,
          dealId: row.deal_id || null,
          closerName: closer?.name || 'N/A',
          closerEmail: closer?.email || '',
          meetingDate: slot?.scheduled_at || '',
          meetingType: slot?.meeting_type || 'r1',
          leadName: row.attendee_name || 'N/A',
          leadPhone: row.attendee_phone || '',
          sdrEmail,
          sdrName,
          originName: origin?.display_name || origin?.name || 'N/A',
          currentStage: stage?.stage_name || 'N/A',
          contractPaidAt: row.contract_paid_at || slot?.scheduled_at || '',
          dealCreatedAt: deal?.created_at || '',
          salesChannel,
          contactEmail,
          contactId: deal?.contact_id || null,
          contactTags,
          isRefunded: row.status === 'refunded',
          originId: origin?.id || null,
          customFields,
        };
      });
      
      // Transform unlinked Hubla transactions (direct purchases without meetings)
      const unlinkedRows: ContractReportRow[] = (unlinkedHubla || []).map((h: any) => ({
        id: `hubla-${h.id}`,
        dealId: null,
        closerName: 'Compra Direta',
        closerEmail: '',
        meetingDate: '',
        meetingType: 'direct',
        leadName: h.customer_name || 'N/A',
        leadPhone: h.customer_phone || '',
        sdrEmail: '',
        sdrName: 'N/A',
        originName: 'Compra Direta',
        currentStage: 'N/A',
        contractPaidAt: h.sale_date || '',
        dealCreatedAt: '',
        salesChannel: detectSalesChannel(h.customer_email, []),
        contactEmail: h.customer_email || null,
        contactId: null,
        contactTags: [],
        isRefunded: false,
        originId: null,
        customFields: {},
      }));
      
      // Merge and sort all rows by payment date (DESC)
      // When BU filter is active, exclude unlinked rows (no origin to verify BU)
      const allRows = buOriginIds 
        ? meetingRows 
        : [...meetingRows, ...unlinkedRows];
      return allRows.sort((a, b) => 
        (b.contractPaidAt || '').localeCompare(a.contractPaidAt || '')
      );
    },
    enabled: filters.startDate instanceof Date && filters.endDate instanceof Date,
   staleTime: 10 * 60 * 1000,
   gcTime: 30 * 60 * 1000,
   refetchOnWindowFocus: false,
   refetchOnReconnect: false,
   placeholderData: (previousData) => previousData,
  });
};

// Helper to get default filter dates (current month)
export const getDefaultContractReportFilters = (): ContractReportFilters => ({
  startDate: startOfMonth(new Date()),
  endDate: endOfMonth(new Date()),
});
