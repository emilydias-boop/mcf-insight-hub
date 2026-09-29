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
  effDate: string;
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

interface CaucaoEfetivaRow {
  attendee_id: string;
  deal_id: string | null;
  lead_name: string | null;
  eff_date: string;
  fonte: string | null;
  contract_paid_at: string | null;
  refunded_at: string | null;
  closer_id: string | null;
  closer_name: string | null;
  closer_bu: string | null;
  sdr_id: string | null;
  sdr_email: string | null;
  sdr_name: string | null;
  segment: string | null;
  valor: number | null;
  origin_id: string | null;
}

interface CaucaoOrfaRow {
  transaction_id: string;
  tx_date: string;
  sale_date: string | null;
  customer_name: string | null;
  customer_email: string | null;
  product_name: string | null;
  net_value: number | null;
  linked_deal_id: string | null;
  source: string | null;
}

const ATTENDEE_BATCH = 150;

export const useContractReport = (
  filters: ContractReportFilters,
  allowedCloserIds: string[] | null, // null = all closers (admin/manager)
  bu?: string // optional BU filter to restrict results to a specific business unit
) => {
  return useQuery({
    queryKey: ['contract-report', filters, allowedCloserIds, bu],
    queryFn: async (): Promise<ContractReportRow[]> => {
      if (allowedCloserIds && allowedCloserIds.length === 0) return [];

      const p_from = format(filters.startDate, 'yyyy-MM-dd');
      const p_to = format(filters.endDate, 'yyyy-MM-dd');

      // Passo 1: fonte única (mesma do Painel Comercial) — 1 linha por negócio com contrato pago
      const { data: caucoesRaw, error: caucoesError } = await (supabase.rpc as any)('caucoes_efetivas', {
        p_from,
        p_to,
        p_bu: bu ?? null,
      });
      if (caucoesError) throw caucoesError;

      let caucoes = (caucoesRaw || []) as CaucaoEfetivaRow[];
      if (filters.closerId) caucoes = caucoes.filter(c => c.closer_id === filters.closerId);
      if (allowedCloserIds) caucoes = caucoes.filter(c => !!c.closer_id && allowedCloserIds.includes(c.closer_id));
      if (filters.originId) caucoes = caucoes.filter(c => c.origin_id === filters.originId);

      // Passo 2: detalhes dos attendees (a RPC já decidiu quem entra)
      const attendeeIds = [...new Set(caucoes.map(c => c.attendee_id).filter(Boolean))];
      const detailsById = new Map<string, any>();
      for (let i = 0; i < attendeeIds.length; i += ATTENDEE_BATCH) {
        const lote = attendeeIds.slice(i, i + ATTENDEE_BATCH);
        const { data: detalhes, error } = await supabase
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
          .in('id', lote);
        if (error) throw error;
        (detalhes || []).forEach((d: any) => detailsById.set(d.id, d));
      }

      // E-mail do closer atribuído (numa única query)
      const closerIds = [...new Set(caucoes.map(c => c.closer_id).filter(Boolean))] as string[];
      const closerEmailMap: Record<string, string> = {};
      if (closerIds.length > 0) {
        const { data: closersData } = await supabase
          .from('closers')
          .select('id, email')
          .in('id', closerIds);
        (closersData || []).forEach((c: any) => { closerEmailMap[c.id] = c.email || ''; });
      }

      const sortedData = caucoes
        .map(c => ({ caucao: c, row: detailsById.get(c.attendee_id) || {} }))
        .sort((a, b) => (b.caucao.eff_date || '').localeCompare(a.caucao.eff_date || ''));
      const detailRows = sortedData.map(s => s.row);

      // Fetch SDR profiles from booked_by UUIDs (priority) and owner_id emails (fallback)
      const bookedByIds = [...new Set(
        detailRows
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
        detailRows
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
      const contactEmails = detailRows
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
      const meetingRows: ContractReportRow[] = sortedData.map(({ caucao, row }: { caucao: CaucaoEfetivaRow; row: any }) => {
        const slot = row.meeting_slots;
        const deal = row.crm_deals;
        const origin = deal?.crm_origins;
        const stage = deal?.crm_stages;
        const contact = deal?.crm_contacts;
        const customFields = deal?.custom_fields || {};
        
        const bookedByProfile = row.booked_by ? bookedByMap[row.booked_by] : null;
        const sdrEmail = caucao.sdr_email || bookedByProfile?.email || deal?.owner_id || '';
        const sdrName = caucao.sdr_name || bookedByProfile?.full_name || sdrNameMap[sdrEmail] || sdrEmail;
        
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
          id: caucao.attendee_id,
          dealId: caucao.deal_id || row.deal_id || null,
          closerName: caucao.closer_name || 'N/A',
          closerEmail: (caucao.closer_id && closerEmailMap[caucao.closer_id]) || '',
          meetingDate: slot?.scheduled_at || '',
          meetingType: slot?.meeting_type || 'r1',
          leadName: row.attendee_name || caucao.lead_name || 'N/A',
          leadPhone: row.attendee_phone || '',
          sdrEmail,
          sdrName,
          originName: origin?.display_name || origin?.name || 'N/A',
          currentStage: stage?.stage_name || 'N/A',
          contractPaidAt: caucao.contract_paid_at || '',
          effDate: caucao.eff_date || '',
          dealCreatedAt: deal?.created_at || '',
          salesChannel,
          contactEmail,
          contactId: deal?.contact_id || null,
          contactTags,
          isRefunded: caucao.refunded_at != null,
          originId: caucao.origin_id || origin?.id || null,
          customFields,
        };
      });
      
      // "Compra Direta": só quando não há filtro de BU — fonte única caucoes_orfas
      let unlinkedRows: ContractReportRow[] = [];
      if (!bu) {
        const { data: orfas, error: orfasError } = await (supabase.rpc as any)('caucoes_orfas', { p_from, p_to });
        if (orfasError) throw orfasError;
        unlinkedRows = ((orfas || []) as CaucaoOrfaRow[]).map((h) => ({
          id: `hubla-${h.transaction_id}`,
          dealId: h.linked_deal_id || null,
          closerName: 'Compra Direta',
          closerEmail: '',
          meetingDate: '',
          meetingType: 'direct',
          leadName: h.customer_name || 'N/A',
          leadPhone: '',
          sdrEmail: '',
          sdrName: 'N/A',
          originName: 'Compra Direta',
          currentStage: 'N/A',
          contractPaidAt: h.sale_date || h.tx_date || '',
          effDate: h.tx_date || '',
          dealCreatedAt: '',
          salesChannel: detectSalesChannel(h.customer_email, []),
          contactEmail: h.customer_email || null,
          contactId: null,
          contactTags: [],
          isRefunded: false,
          originId: null,
          customFields: {},
        }));
      }

      return [...meetingRows, ...unlinkedRows].sort((a, b) =>
        (b.effDate || '').localeCompare(a.effDate || '')
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
