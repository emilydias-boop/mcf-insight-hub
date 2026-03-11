import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DateRange } from 'react-day-picker';

export interface NaoComprouLead {
  id: string;
  attendee_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  closer_r2_name: string | null;
  closer_r2_id: string | null;
  r2_date: string | null;
  closer_notes: string | null;
  r2_observations: string | null;
  lead_profile: string | null;
  carrinho_updated_at: string | null;
  deal_id: string | null;
  // R1 info
  r1_closer_name: string | null;
  r1_date: string | null;
  // Call history
  total_calls: number;
  first_call_at: string | null;
  last_call_at: string | null;
  // Notes
  attendee_notes: string[];
}

interface UseNaoComprouReportOptions {
  dateRange?: DateRange;
  closerR2Id?: string;
}

export function useNaoComprouReport(options: UseNaoComprouReportOptions = {}) {
  const { dateRange, closerR2Id } = options;

  const query = useQuery({
    queryKey: ['nao-comprou-report', dateRange?.from?.toISOString(), dateRange?.to?.toISOString(), closerR2Id],
    queryFn: async (): Promise<NaoComprouLead[]> => {
      // 1. Fetch attendees with carrinho_status = 'nao_comprou' from R2 meetings
      let attendeeQuery = supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          attendee_name,
          deal_id,
          closer_notes,
          r2_observations,
          lead_profile,
          carrinho_updated_at,
          notes,
          meeting_slot_id,
          contact_id,
          meeting_slots!inner (
            id,
            scheduled_at,
            meeting_type,
            closer_id,
            closers (
              id,
              name
            )
          )
        `)
        .eq('carrinho_status', 'nao_comprou')
        .eq('meeting_slots.meeting_type', 'r2')
        .order('carrinho_updated_at', { ascending: false });

      if (dateRange?.from) {
        attendeeQuery = attendeeQuery.gte('carrinho_updated_at', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        const endDate = new Date(dateRange.to);
        endDate.setHours(23, 59, 59, 999);
        attendeeQuery = attendeeQuery.lte('carrinho_updated_at', endDate.toISOString());
      }

      const { data: attendees, error } = await attendeeQuery;
      if (error) throw error;
      if (!attendees || attendees.length === 0) return [];

      // Filter by closer R2 if specified
      let filtered = attendees;
      if (closerR2Id) {
        filtered = attendees.filter((a: any) => a.meeting_slots?.closer_id === closerR2Id);
      }

      // 2. Collect deal_ids and contact_ids for batch lookups
      const dealIds = [...new Set(filtered.map((a: any) => a.deal_id).filter(Boolean))] as string[];
      const contactIds = [...new Set(filtered.map((a: any) => a.contact_id).filter(Boolean))] as string[];

      // 3. Batch fetch contacts
      const contactMap = new Map<string, { name: string | null; email: string | null; phone: string | null }>();
      if (contactIds.length > 0) {
        const batchSize = 200;
        for (let i = 0; i < contactIds.length; i += batchSize) {
          const batch = contactIds.slice(i, i + batchSize);
          const { data: contacts } = await supabase
            .from('crm_contacts')
            .select('id, name, email, phone')
            .in('id', batch);
          contacts?.forEach(c => contactMap.set(c.id.toLowerCase().trim(), c));
        }
      }

      // 4. Batch fetch calls per deal
      const callsMap = new Map<string, { total: number; first: string | null; last: string | null }>();
      if (dealIds.length > 0) {
        const batchSize = 200;
        for (let i = 0; i < dealIds.length; i += batchSize) {
          const batch = dealIds.slice(i, i + batchSize);
          const { data: calls } = await supabase
            .from('calls')
            .select('deal_id, started_at')
            .in('deal_id', batch)
            .order('started_at', { ascending: true });
          calls?.forEach(call => {
            const key = call.deal_id?.toLowerCase().trim();
            if (!key) return;
            const existing = callsMap.get(key);
            if (!existing) {
              callsMap.set(key, { total: 1, first: call.started_at, last: call.started_at });
            } else {
              existing.total++;
              existing.last = call.started_at;
            }
          });
        }
      }

      // 5. Batch fetch attendee notes
      const attendeeIds = filtered.map((a: any) => a.id);
      const notesMap = new Map<string, string[]>();
      if (attendeeIds.length > 0) {
        const batchSize = 200;
        for (let i = 0; i < attendeeIds.length; i += batchSize) {
          const batch = attendeeIds.slice(i, i + batchSize);
          const { data: notes } = await supabase
            .from('attendee_notes')
            .select('attendee_id, note')
            .in('attendee_id', batch);
          notes?.forEach(n => {
            const key = n.attendee_id.toLowerCase().trim();
            if (!notesMap.has(key)) notesMap.set(key, []);
            notesMap.get(key)!.push(n.note);
          });
        }
      }

      // 6. Try to find R1 info for each deal
      const r1Map = new Map<string, { closer_name: string | null; date: string | null }>();
      if (dealIds.length > 0) {
        const batchSize = 200;
        for (let i = 0; i < dealIds.length; i += batchSize) {
          const batch = dealIds.slice(i, i + batchSize);
          const { data: r1Slots } = await supabase
            .from('meeting_slots')
            .select('deal_id, scheduled_at, closers(name)')
            .in('deal_id', batch)
            .eq('meeting_type', 'r1')
            .order('scheduled_at', { ascending: false });
          r1Slots?.forEach((slot: any) => {
            const key = slot.deal_id?.toLowerCase().trim();
            if (key && !r1Map.has(key)) {
              r1Map.set(key, {
                closer_name: slot.closers?.name || null,
                date: slot.scheduled_at,
              });
            }
          });
        }
      }

      // 7. Map results
      return filtered.map((att: any) => {
        const slot = att.meeting_slots;
        const contactKey = att.contact_id?.toLowerCase().trim();
        const contact = contactKey ? contactMap.get(contactKey) : null;
        const dealKey = att.deal_id?.toLowerCase().trim();
        const calls = dealKey ? callsMap.get(dealKey) : null;
        const r1 = dealKey ? r1Map.get(dealKey) : null;
        const notes = notesMap.get(att.id.toLowerCase().trim()) || [];

        return {
          id: att.id,
          attendee_name: att.attendee_name,
          contact_name: contact?.name || att.attendee_name,
          contact_email: contact?.email || null,
          contact_phone: contact?.phone || null,
          closer_r2_name: slot?.closers?.name || null,
          closer_r2_id: slot?.closer_id || null,
          r2_date: slot?.scheduled_at || null,
          closer_notes: att.closer_notes,
          r2_observations: att.r2_observations,
          lead_profile: att.lead_profile,
          carrinho_updated_at: att.carrinho_updated_at,
          deal_id: att.deal_id,
          r1_closer_name: r1?.closer_name || null,
          r1_date: r1?.date || null,
          total_calls: calls?.total || 0,
          first_call_at: calls?.first || null,
          last_call_at: calls?.last || null,
          attendee_notes: notes,
        } as NaoComprouLead;
      });
    },
  });

  return query;
}

export function useNaoComprouClosers() {
  return useQuery({
    queryKey: ['nao-comprou-closers'],
    queryFn: async () => {
      const { data } = await supabase
        .from('closers')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
  });
}
