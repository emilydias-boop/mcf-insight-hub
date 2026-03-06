import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay } from 'date-fns';

export interface InvestigationAttendee {
  id: string;
  attendee_name: string | null;
  attendee_phone: string | null;
  status: string | null;
  contract_paid_at: string | null;
  is_partner: boolean | null;
  notes: string | null;
  closer_notes: string | null;
  booked_by: string | null;
  booked_at: string | null;
  deal_id: string | null;
  scheduled_at: string;
  closer_name: string;
  closer_id: string;
  slot_status: string | null;
  contact_email: string | null;
  sdr_name: string | null;
  lead_type: string | null;
  // Enriched fields
  deal_name: string | null;
  deal_stage: string | null;
  deal_stage_color: string | null;
  deal_created_at: string | null;
  origin_name: string | null;
  contact_tags: string[] | null;
  contact_organization: string | null;
  contact_created_at: string | null;
}

export interface LeadProfile {
  name: string | null;
  email: string | null;
  phone: string | null;
  organization: string | null;
  tags: string[] | null;
  created_at: string | null;
  origin_name: string | null;
}

export interface LeadFinancials {
  purchase_count: number;
  total_invested: number;
  products: string[];
}

export interface InvestigationMetrics {
  total: number;
  completed: number;
  noShow: number;
  contractPaid: number;
  scheduled: number;
  cancelled: number;
}

function computeMetrics(attendees: InvestigationAttendee[]): InvestigationMetrics {
  const nonPartner = attendees.filter(a => !a.is_partner);
  return {
    total: nonPartner.length,
    completed: nonPartner.filter(a => a.status === 'completed').length,
    noShow: nonPartner.filter(a => a.status === 'no_show').length,
    contractPaid: nonPartner.filter(a => a.status === 'contract_paid').length,
    scheduled: nonPartner.filter(a => ['scheduled', 'invited', 'rescheduled'].includes(a.status || '')).length,
    cancelled: nonPartner.filter(a => a.status === 'cancelled').length,
  };
}

export function useInvestigationByCloser(closerId: string | null, date: Date | null) {
  return useQuery({
    queryKey: ['investigation-closer', closerId, date?.toISOString()],
    queryFn: async () => {
      if (!closerId || !date) return { attendees: [], metrics: computeMetrics([]), leadProfile: null, financials: null };

      const dayStart = startOfDay(date).toISOString();
      const dayEnd = endOfDay(date).toISOString();

      const { data: slots, error: slotsErr } = await supabase
        .from('meeting_slots')
        .select('id, scheduled_at, status, lead_type, closer_id')
        .eq('closer_id', closerId)
        .gte('scheduled_at', dayStart)
        .lte('scheduled_at', dayEnd)
        .order('scheduled_at');

      if (slotsErr) throw slotsErr;
      if (!slots || slots.length === 0) return { attendees: [], metrics: computeMetrics([]), leadProfile: null, financials: null };

      const slotIds = slots.map(s => s.id);

      const [{ data: attendeesWithSlot }, { data: closer }] = await Promise.all([
        supabase
          .from('meeting_slot_attendees')
          .select('id, attendee_name, attendee_phone, status, contract_paid_at, is_partner, notes, closer_notes, booked_by, booked_at, deal_id, contact_id, meeting_slot_id')
          .in('meeting_slot_id', slotIds),
        supabase
          .from('closers')
          .select('name')
          .eq('id', closerId)
          .single(),
      ]);

      const dealIds = (attendeesWithSlot || []).map(a => a.deal_id).filter(Boolean) as string[];
      const bookedByIds = (attendeesWithSlot || []).map(a => a.booked_by).filter(Boolean) as string[];

      const [dealsMap, bookedByMap] = await Promise.all([
        fetchDealsEnriched(dealIds),
        fetchProfileNames(bookedByIds),
      ]);

      const slotMap = Object.fromEntries(slots.map(s => [s.id, s]));

      const result: InvestigationAttendee[] = (attendeesWithSlot || []).map(att => {
        const slot = slotMap[att.meeting_slot_id];
        const deal = att.deal_id ? dealsMap[att.deal_id] : null;
        const sdrFromBookedBy = att.booked_by ? bookedByMap[att.booked_by] : null;

        return {
          id: att.id,
          attendee_name: att.attendee_name,
          attendee_phone: att.attendee_phone,
          status: att.status,
          contract_paid_at: att.contract_paid_at,
          is_partner: att.is_partner,
          notes: att.notes,
          closer_notes: att.closer_notes,
          booked_by: att.booked_by,
          booked_at: att.booked_at,
          deal_id: att.deal_id,
          scheduled_at: slot?.scheduled_at || '',
          closer_name: closer?.name || '',
          closer_id: closerId,
          slot_status: slot?.status || null,
          contact_email: deal?.contact_email || null,
          sdr_name: sdrFromBookedBy || deal?.sdr_name || null,
          lead_type: slot?.lead_type || null,
          deal_name: deal?.deal_name || null,
          deal_stage: deal?.deal_stage || null,
          deal_stage_color: deal?.deal_stage_color || null,
          deal_created_at: deal?.deal_created_at || null,
          origin_name: deal?.origin_name || null,
          contact_tags: null,
          contact_organization: null,
          contact_created_at: null,
        };
      });

      result.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));

      return {
        attendees: result,
        metrics: computeMetrics(result),
        leadProfile: null as LeadProfile | null,
        financials: null as LeadFinancials | null,
      };
    },
    enabled: !!closerId && !!date,
  });
}

export function useInvestigationByLead(searchTerm: string) {
  return useQuery({
    queryKey: ['investigation-lead', searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 3) return { attendees: [], metrics: computeMetrics([]), leadProfile: null, financials: null };

      // Search attendees by name or phone
      const { data: attendees, error } = await supabase
        .from('meeting_slot_attendees')
        .select('id, attendee_name, attendee_phone, status, contract_paid_at, is_partner, notes, closer_notes, booked_by, booked_at, deal_id, contact_id, meeting_slot_id')
        .or(`attendee_name.ilike.%${searchTerm}%,attendee_phone.ilike.%${searchTerm}%`)
        .order('booked_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      if (!attendees || attendees.length === 0) return { attendees: [], metrics: computeMetrics([]), leadProfile: null, financials: null };

      // Get all related data in parallel
      const slotIds = [...new Set(attendees.map(a => a.meeting_slot_id))];
      const dealIds = attendees.map(a => a.deal_id).filter(Boolean) as string[];
      const contactIds = [...new Set(attendees.map(a => a.contact_id).filter(Boolean) as string[])];
      const bookedByIds = attendees.map(a => a.booked_by).filter(Boolean) as string[];

      const [slotsResult, dealsMap, bookedByMap, contactsMap] = await Promise.all([
        supabase.from('meeting_slots').select('id, scheduled_at, status, lead_type, closer_id').in('id', slotIds),
        fetchDealsEnriched(dealIds),
        fetchProfileNames(bookedByIds),
        fetchContacts(contactIds),
      ]);

      const slots = slotsResult.data || [];
      const slotMap = Object.fromEntries(slots.map(s => [s.id, s]));

      // Get closer names
      const closerIds = [...new Set(slots.map(s => s.closer_id))];
      const { data: closers } = await supabase.from('closers').select('id, name').in('id', closerIds);
      const closerMap = Object.fromEntries((closers || []).map(c => [c.id, c.name]));

      // Build lead profile from first contact found
      let leadProfile: LeadProfile | null = null;
      if (contactIds.length > 0) {
        const firstContact = contactsMap[contactIds[0]];
        if (firstContact) {
          // Get origin name for contact
          let originName: string | null = null;
          if (firstContact.origin_id) {
            const { data: origin } = await supabase.from('crm_origins').select('name').eq('id', firstContact.origin_id).single();
            originName = origin?.name || null;
          }
          leadProfile = {
            name: firstContact.name,
            email: firstContact.email,
            phone: firstContact.phone,
            organization: firstContact.organization_name,
            tags: firstContact.tags,
            created_at: firstContact.created_at,
            origin_name: originName,
          };
        }
      }

      // Get Hubla financials by email/phone
      const financials = await fetchHublaFinancials(leadProfile?.email || null, leadProfile?.phone || null);

      const result: InvestigationAttendee[] = attendees.map(att => {
        const slot = slotMap[att.meeting_slot_id];
        const deal = att.deal_id ? dealsMap[att.deal_id] : null;
        const sdrFromBookedBy = att.booked_by ? bookedByMap[att.booked_by] : null;
        const contact = att.contact_id ? contactsMap[att.contact_id] : null;

        return {
          id: att.id,
          attendee_name: att.attendee_name,
          attendee_phone: att.attendee_phone,
          status: att.status,
          contract_paid_at: att.contract_paid_at,
          is_partner: att.is_partner,
          notes: att.notes,
          closer_notes: att.closer_notes,
          booked_by: att.booked_by,
          booked_at: att.booked_at,
          deal_id: att.deal_id,
          scheduled_at: slot?.scheduled_at || '',
          closer_name: slot ? (closerMap[slot.closer_id] || '') : '',
          closer_id: slot?.closer_id || '',
          slot_status: slot?.status || null,
          contact_email: deal?.contact_email || contact?.email || null,
          sdr_name: sdrFromBookedBy || deal?.sdr_name || null,
          lead_type: slot?.lead_type || null,
          deal_name: deal?.deal_name || null,
          deal_stage: deal?.deal_stage || null,
          deal_stage_color: deal?.deal_stage_color || null,
          deal_created_at: deal?.deal_created_at || null,
          origin_name: deal?.origin_name || null,
          contact_tags: contact?.tags || null,
          contact_organization: contact?.organization_name || null,
          contact_created_at: contact?.created_at || null,
        };
      });

      result.sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at));

      return {
        attendees: result,
        metrics: computeMetrics(result),
        leadProfile,
        financials,
      };
    },
    enabled: searchTerm.length >= 3,
  });
}

// --- Helper functions ---

interface EnrichedDealInfo {
  contact_email: string | null;
  sdr_name: string | null;
  deal_name: string | null;
  deal_stage: string | null;
  deal_stage_color: string | null;
  deal_created_at: string | null;
  origin_name: string | null;
}

async function fetchDealsEnriched(dealIds: string[]): Promise<Record<string, EnrichedDealInfo>> {
  if (dealIds.length === 0) return {};

  const { data: deals } = await supabase
    .from('crm_deals')
    .select('id, name, created_at, contact:crm_contacts(email), owner:profiles!crm_deals_owner_id_fkey(full_name), stage:crm_stages(name, color), origin:crm_origins(name)')
    .in('id', dealIds);

  const map: Record<string, EnrichedDealInfo> = {};
  if (deals) {
    for (const d of deals) {
      map[d.id] = {
        contact_email: (d.contact as any)?.email || null,
        sdr_name: (d.owner as any)?.full_name || null,
        deal_name: d.name,
        deal_stage: (d.stage as any)?.name || null,
        deal_stage_color: (d.stage as any)?.color || null,
        deal_created_at: d.created_at,
        origin_name: (d.origin as any)?.name || null,
      };
    }
  }
  return map;
}

async function fetchProfileNames(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', ids);
  const map: Record<string, string> = {};
  if (profiles) {
    for (const p of profiles) {
      map[p.id] = p.full_name || '';
    }
  }
  return map;
}

interface ContactInfo {
  name: string | null;
  email: string | null;
  phone: string | null;
  organization_name: string | null;
  tags: string[] | null;
  created_at: string | null;
  origin_id: string | null;
}

async function fetchContacts(contactIds: string[]): Promise<Record<string, ContactInfo>> {
  if (contactIds.length === 0) return {};
  const { data } = await supabase
    .from('crm_contacts')
    .select('id, name, email, phone, organization_name, tags, created_at, origin_id')
    .in('id', contactIds);
  const map: Record<string, ContactInfo> = {};
  if (data) {
    for (const c of data) {
      map[c.id] = {
        name: c.name,
        email: c.email,
        phone: c.phone,
        organization_name: c.organization_name,
        tags: c.tags,
        created_at: c.created_at,
        origin_id: c.origin_id,
      };
    }
  }
  return map;
}

async function fetchHublaFinancials(email: string | null, phone: string | null): Promise<LeadFinancials | null> {
  if (!email && !phone) return null;

  const conditions: string[] = [];
  if (email) conditions.push(`customer_email.ilike.${email}`);
  if (phone) {
    const phoneSuffix = phone.replace(/\D/g, '').slice(-9);
    if (phoneSuffix.length >= 9) conditions.push(`customer_phone.ilike.%${phoneSuffix}`);
  }

  if (conditions.length === 0) return null;

  const { data } = await supabase
    .from('hubla_transactions')
    .select('product_price, product_name')
    .or(conditions.join(','));

  if (!data || data.length === 0) return null;

  const products = [...new Set(data.map(t => t.product_name).filter(Boolean))];
  return {
    purchase_count: data.length,
    total_invested: data.reduce((sum, t) => sum + (t.product_price || 0), 0),
    products,
  };
}
