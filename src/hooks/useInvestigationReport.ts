import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfDay, endOfDay } from 'date-fns';

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
      if (!closerId || !date) return { attendees: [], metrics: computeMetrics([]) };

      const dayStart = startOfDay(date).toISOString();
      const dayEnd = endOfDay(date).toISOString();

      // Fetch slots for this closer on this day
      const { data: slots, error: slotsErr } = await supabase
        .from('meeting_slots')
        .select('id, scheduled_at, status, lead_type, closer_id')
        .eq('closer_id', closerId)
        .gte('scheduled_at', dayStart)
        .lte('scheduled_at', dayEnd)
        .order('scheduled_at');

      if (slotsErr) throw slotsErr;
      if (!slots || slots.length === 0) return { attendees: [], metrics: computeMetrics([]) };

      const slotIds = slots.map(s => s.id);

      // Fetch attendees
      const { data: attendees, error: attErr } = await supabase
        .from('meeting_slot_attendees')
        .select('id, attendee_name, attendee_phone, status, contract_paid_at, is_partner, notes, closer_notes, booked_by, booked_at, deal_id, contact_id')
        .in('meeting_slot_id', slotIds);

      if (attErr) throw attErr;

      // Get closer name
      const { data: closer } = await supabase
        .from('closers')
        .select('name')
        .eq('id', closerId)
        .single();

      // Get contact emails and SDR names from deals
      const dealIds = (attendees || []).map(a => a.deal_id).filter(Boolean) as string[];
      let dealsMap: Record<string, { contact_email: string | null; sdr_name: string | null }> = {};
      
      if (dealIds.length > 0) {
        const { data: deals } = await supabase
          .from('crm_deals')
          .select('id, contact:crm_contacts(email), owner:profiles!crm_deals_owner_id_fkey(full_name)')
          .in('id', dealIds);

        if (deals) {
          for (const d of deals) {
            dealsMap[d.id] = {
              contact_email: (d.contact as any)?.email || null,
              sdr_name: (d.owner as any)?.full_name || null,
            };
          }
        }
      }

      // Also try to get SDR from booked_by profile
      const bookedByIds = (attendees || []).map(a => a.booked_by).filter(Boolean) as string[];
      let bookedByMap: Record<string, string> = {};
      if (bookedByIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', bookedByIds);
        if (profiles) {
          for (const p of profiles) {
            bookedByMap[p.id] = p.full_name || '';
          }
        }
      }

      // Map slots by id
      const slotMap = Object.fromEntries(slots.map(s => [s.id, s]));

      // Build result - need to get meeting_slot_id from attendees
      // Re-fetch with meeting_slot_id
      const { data: attendeesWithSlot } = await supabase
        .from('meeting_slot_attendees')
        .select('id, attendee_name, attendee_phone, status, contract_paid_at, is_partner, notes, closer_notes, booked_by, booked_at, deal_id, contact_id, meeting_slot_id')
        .in('meeting_slot_id', slotIds);

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
        };
      });

      result.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));

      return {
        attendees: result,
        metrics: computeMetrics(result),
      };
    },
    enabled: !!closerId && !!date,
  });
}

export function useInvestigationByLead(searchTerm: string) {
  return useQuery({
    queryKey: ['investigation-lead', searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 3) return { attendees: [], metrics: computeMetrics([]) };

      // Search attendees by name or phone
      const { data: attendees, error } = await supabase
        .from('meeting_slot_attendees')
        .select('id, attendee_name, attendee_phone, status, contract_paid_at, is_partner, notes, closer_notes, booked_by, booked_at, deal_id, contact_id, meeting_slot_id')
        .or(`attendee_name.ilike.%${searchTerm}%,attendee_phone.ilike.%${searchTerm}%`)
        .order('booked_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      if (!attendees || attendees.length === 0) return { attendees: [], metrics: computeMetrics([]) };

      // Get slots
      const slotIds = [...new Set(attendees.map(a => a.meeting_slot_id))];
      const { data: slots } = await supabase
        .from('meeting_slots')
        .select('id, scheduled_at, status, lead_type, closer_id')
        .in('id', slotIds);

      const slotMap = Object.fromEntries((slots || []).map(s => [s.id, s]));

      // Get closer names
      const closerIds = [...new Set((slots || []).map(s => s.closer_id))];
      const { data: closers } = await supabase
        .from('closers')
        .select('id, name')
        .in('id', closerIds);
      const closerMap = Object.fromEntries((closers || []).map(c => [c.id, c.name]));

      // Get deals info
      const dealIds = attendees.map(a => a.deal_id).filter(Boolean) as string[];
      let dealsMap: Record<string, { contact_email: string | null; sdr_name: string | null }> = {};
      if (dealIds.length > 0) {
        const { data: deals } = await supabase
          .from('crm_deals')
          .select('id, contact:crm_contacts(email), owner:profiles!crm_deals_owner_id_fkey(full_name)')
          .in('id', dealIds);
        if (deals) {
          for (const d of deals) {
            dealsMap[d.id] = {
              contact_email: (d.contact as any)?.email || null,
              sdr_name: (d.owner as any)?.full_name || null,
            };
          }
        }
      }

      // booked_by names
      const bookedByIds = attendees.map(a => a.booked_by).filter(Boolean) as string[];
      let bookedByMap: Record<string, string> = {};
      if (bookedByIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', bookedByIds);
        if (profiles) {
          for (const p of profiles) {
            bookedByMap[p.id] = p.full_name || '';
          }
        }
      }

      const result: InvestigationAttendee[] = attendees.map(att => {
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
          closer_name: slot ? (closerMap[slot.closer_id] || '') : '',
          closer_id: slot?.closer_id || '',
          slot_status: slot?.status || null,
          contact_email: deal?.contact_email || null,
          sdr_name: sdrFromBookedBy || deal?.sdr_name || null,
          lead_type: slot?.lead_type || null,
        };
      });

      result.sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at));

      return {
        attendees: result,
        metrics: computeMetrics(result),
      };
    },
    enabled: searchTerm.length >= 3,
  });
}
