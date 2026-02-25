import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

export interface R2NoShowLead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  
  // R2 original
  meeting_id: string;
  scheduled_at: string;
  closer_id: string;
  closer_name: string;
  closer_color: string | null;
  
  // Histórico do funil
  sdr_name: string | null;
  r1_closer_id: string | null;
  r1_closer_name: string | null;
  r1_date: string | null;
  
  // Qualificação
  lead_profile: string | null;
  already_builds: boolean | null;
  r1_qualification_note: string | null;
  
  // Deal info
  deal_id: string | null;
  deal?: {
    name: string;
    custom_fields: Record<string, unknown> | null;
    origin_name: string | null;
  } | null;
}

export type DateFilterType = 'day' | 'week' | 'month' | 'custom';

interface UseR2NoShowLeadsParams {
  dateFilter: DateFilterType;
  selectedDate: Date;
  customRange?: { start: Date; end: Date };
  closerFilter?: string | 'all';
}

export function useR2NoShowLeads({
  dateFilter,
  selectedDate,
  customRange,
  closerFilter = 'all',
}: UseR2NoShowLeadsParams) {
  return useQuery({
    queryKey: ['r2-noshow-leads', dateFilter, selectedDate.toISOString(), customRange, closerFilter],
    queryFn: async (): Promise<R2NoShowLead[]> => {
      // Calculate date range
      let rangeStart: Date;
      let rangeEnd: Date;
      
      switch (dateFilter) {
        case 'day':
          rangeStart = startOfDay(selectedDate);
          rangeEnd = endOfDay(selectedDate);
          break;
        case 'week':
          rangeStart = startOfWeek(selectedDate, { weekStartsOn: 6 }); // Sábado
          rangeEnd = endOfWeek(selectedDate, { weekStartsOn: 6 });
          break;
        case 'month':
          rangeStart = startOfMonth(selectedDate);
          rangeEnd = endOfMonth(selectedDate);
          break;
        case 'custom':
          if (!customRange) {
            rangeStart = startOfDay(selectedDate);
            rangeEnd = endOfDay(selectedDate);
          } else {
            rangeStart = startOfDay(customRange.start);
            rangeEnd = endOfDay(customRange.end);
          }
          break;
      }

      // Query R2 meetings with no_show attendees
      let query = supabase
        .from('meeting_slots')
        .select(`
          id,
          scheduled_at,
          notes,
          closer:closers!meeting_slots_closer_id_fkey (
            id,
            name,
            color
          ),
          meeting_slot_attendees!inner (
            id,
            deal_id,
            status,
            attendee_name,
            attendee_phone,
            already_builds,
            booked_by,
            deal:crm_deals (
              id,
              name,
              custom_fields,
              origin:crm_origins (
                name
              ),
              contact:crm_contacts (
                name,
                email,
                phone
              )
            )
          )
        `)
        .eq('meeting_type', 'r2')
        .gte('scheduled_at', rangeStart.toISOString())
        .lte('scheduled_at', rangeEnd.toISOString())
        .eq('meeting_slot_attendees.status', 'no_show');

      if (closerFilter && closerFilter !== 'all') {
        query = query.eq('closer_id', closerFilter);
      }

      const { data: meetings, error } = await query;

      if (error) throw error;
      if (!meetings) return [];

      // Collect all no_show attendee IDs to check for rescheduled children
      const noShowAttendeeIds: string[] = [];
      meetings.forEach((m) => {
        const attendees = m.meeting_slot_attendees as Array<{ id: string }>;
        attendees?.forEach((att) => {
          noShowAttendeeIds.push(att.id);
        });
      });

      // Query for any attendees that have these no_show IDs as parent (meaning they were rescheduled)
      let rescheduledParentIds = new Set<string>();
      if (noShowAttendeeIds.length > 0) {
        const { data: childAttendees } = await supabase
          .from('meeting_slot_attendees')
          .select('parent_attendee_id')
          .in('parent_attendee_id', noShowAttendeeIds);

        if (childAttendees) {
          rescheduledParentIds = new Set(
            childAttendees.map(c => c.parent_attendee_id).filter(Boolean) as string[]
          );
        }
      }

      // Collect booked_by IDs to get SDR names
      const bookedByIds = new Set<string>();
      meetings.forEach((m) => {
        const attendees = m.meeting_slot_attendees as Array<{ booked_by?: string | null }>;
        attendees?.forEach((att) => {
          if (att.booked_by) bookedByIds.add(att.booked_by);
        });
      });

      // Fetch profiles for SDR names
      let profileMap = new Map<string, { id: string; email: string | null }>();
      if (bookedByIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', Array.from(bookedByIds));

        profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);
      }

      // Collect deal_ids to find R1 meetings
      const dealIds = new Set<string>();
      meetings.forEach((m) => {
        const attendees = m.meeting_slot_attendees as Array<{ deal_id?: string | null }>;
        attendees?.forEach((att) => {
          if (att.deal_id) dealIds.add(att.deal_id);
        });
      });

      // Fetch R1 meetings for these deals to get R1 closer info
      let r1Map = new Map<string, { closer_id: string | null; closer_name: string | null; date: string | null }>();
      if (dealIds.size > 0) {
        const { data: r1Meetings } = await supabase
          .from('meeting_slots')
          .select(`
            scheduled_at,
            closer:closers!meeting_slots_closer_id_fkey (
              id,
              name
            ),
            meeting_slot_attendees!inner (
              deal_id
            )
          `)
          .eq('meeting_type', 'r1')
          .in('meeting_slot_attendees.deal_id', Array.from(dealIds));

        // Map deal_id to R1 info
        r1Meetings?.forEach((r1) => {
          const attendees = r1.meeting_slot_attendees as Array<{ deal_id?: string | null }>;
          attendees?.forEach((att) => {
            if (att.deal_id && !r1Map.has(att.deal_id)) {
              const closerObj = r1.closer as { id?: string; name?: string } | null;
              r1Map.set(att.deal_id, {
                closer_id: closerObj?.id || null,
                closer_name: closerObj?.name || null,
                date: r1.scheduled_at,
              });
            }
          });
        });
      }

      // Check which deals already have a completed R2 (should be excluded from no-show list)
      let dealsWithCompletedR2 = new Set<string>();
      if (dealIds.size > 0) {
        const { data: completedR2 } = await supabase
          .from('meeting_slot_attendees')
          .select('deal_id, meeting_slot:meeting_slots!inner(meeting_type)')
          .in('deal_id', Array.from(dealIds))
          .in('status', ['completed', 'contract_paid'])
          .eq('meeting_slot.meeting_type', 'r2');

        dealsWithCompletedR2 = new Set(
          (completedR2 || []).map(a => a.deal_id).filter(Boolean) as string[]
        );
      }

      // Transform to R2NoShowLead format, EXCLUDING already rescheduled no-shows
      const leads: R2NoShowLead[] = [];
      
      meetings.forEach((m) => {
        const closerObj = m.closer as { id: string; name: string; color: string | null } | null;
        const attendees = m.meeting_slot_attendees as Array<{
          id: string;
          deal_id?: string | null;
          attendee_name?: string | null;
          attendee_phone?: string | null;
          already_builds?: boolean | null;
          booked_by?: string | null;
          deal?: {
            id: string;
            name: string;
            custom_fields?: Record<string, unknown> | null;
            origin?: { name: string } | null;
            contact?: {
              name: string;
              email?: string | null;
              phone?: string | null;
            } | null;
          } | null;
        }>;
        
        attendees?.forEach((att) => {
          // Skip if this no_show has already been rescheduled (has a child attendee)
          if (rescheduledParentIds.has(att.id)) {
            return;
          }

          // Skip if deal already has a completed R2
          if (att.deal_id && dealsWithCompletedR2.has(att.deal_id)) {
            return;
          }

          // Skip if deal has reembolso_solicitado flag (refunded leads)
          const customFields = att.deal?.custom_fields as Record<string, unknown> | null;
          if (customFields?.reembolso_solicitado === true) {
            return;
          }

          const sdrProfile = att.booked_by ? profileMap.get(att.booked_by) : null;
          const r1Info = att.deal_id ? r1Map.get(att.deal_id) : null;
          
          // Extract SDR name from email if available
          const sdrName = sdrProfile?.email 
            ? sdrProfile.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
            : null;
          
          leads.push({
            id: att.id,
            name: att.attendee_name || att.deal?.contact?.name || att.deal?.name || 'Lead',
            phone: att.attendee_phone || att.deal?.contact?.phone || null,
            email: att.deal?.contact?.email || null,
            
            meeting_id: m.id,
            scheduled_at: m.scheduled_at,
            closer_id: closerObj?.id || '',
            closer_name: closerObj?.name || '',
            closer_color: closerObj?.color || null,
            
            sdr_name: sdrName,
            r1_closer_id: r1Info?.closer_id || null,
            r1_closer_name: r1Info?.closer_name || null,
            r1_date: r1Info?.date || null,
            
            lead_profile: null,
            already_builds: att.already_builds || null,
            r1_qualification_note: null,
            
            deal_id: att.deal_id || null,
            deal: att.deal ? {
              name: att.deal.name,
              custom_fields: att.deal.custom_fields || null,
              origin_name: att.deal.origin?.name || null,
            } : null,
          });
        });
      });

      // Sort by scheduled_at descending (most recent first)
      leads.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());

      return leads;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to count no-shows (for badge), excluding those that have been rescheduled
 */
export function useR2NoShowsCount() {
  return useQuery({
    queryKey: ['r2-noshow-count'],
    queryFn: async (): Promise<number> => {
      // Count no-shows from last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // Step 1: Get IDs of all no_show attendees in the last 30 days
      const { data: noShowAttendees, error } = await supabase
        .from('meeting_slot_attendees')
        .select('id, meeting_slot:meeting_slots!inner(meeting_type, scheduled_at)')
        .eq('status', 'no_show')
        .eq('meeting_slot.meeting_type', 'r2')
        .gte('meeting_slot.scheduled_at', thirtyDaysAgo.toISOString());

      if (error) throw error;
      if (!noShowAttendees || noShowAttendees.length === 0) return 0;

      const noShowIds = noShowAttendees.map(a => a.id);

      // Step 2: Find which of these have been rescheduled (have a child attendee)
      const { data: childAttendees } = await supabase
        .from('meeting_slot_attendees')
        .select('parent_attendee_id')
        .in('parent_attendee_id', noShowIds);

      const rescheduledParentIds = new Set(
        (childAttendees || []).map(c => c.parent_attendee_id).filter(Boolean)
      );

      // Step 2.5: Get deal_ids of no-shows and check for refunded deals
      const { data: noShowAttendeeDeals } = await supabase
        .from('meeting_slot_attendees')
        .select('id, deal_id')
        .in('id', noShowIds);

      const dealIdsToCheck = noShowAttendeeDeals?.filter(a => a.deal_id).map(a => a.deal_id as string) || [];
      let refundedDealIds = new Set<string>();
      
      if (dealIdsToCheck.length > 0) {
        const { data: refundedDeals } = await supabase
          .from('crm_deals')
          .select('id, custom_fields')
          .in('id', dealIdsToCheck);
        
        refundedDealIds = new Set(
          refundedDeals?.filter(d => (d.custom_fields as Record<string, unknown>)?.reembolso_solicitado === true).map(d => d.id) || []
        );
      }

      // Map no-show IDs to their deal_ids for filtering
      const noShowsWithRefundedDeals = new Set(
        noShowAttendeeDeals?.filter(a => a.deal_id && refundedDealIds.has(a.deal_id)).map(a => a.id) || []
      );

      // Step 2.6: Check which deals already have a completed R2
      const allDealIds = noShowAttendeeDeals?.filter(a => a.deal_id).map(a => a.deal_id as string) || [];
      let completedR2DealIds = new Set<string>();
      if (allDealIds.length > 0) {
        const { data: completedR2 } = await supabase
          .from('meeting_slot_attendees')
          .select('deal_id, meeting_slot:meeting_slots!inner(meeting_type)')
          .in('deal_id', allDealIds)
          .in('status', ['completed', 'contract_paid'])
          .eq('meeting_slot.meeting_type', 'r2');

        completedR2DealIds = new Set(
          (completedR2 || []).map(a => a.deal_id).filter(Boolean) as string[]
        );
      }

      const noShowsWithCompletedR2 = new Set(
        noShowAttendeeDeals?.filter(a => a.deal_id && completedR2DealIds.has(a.deal_id)).map(a => a.id) || []
      );

      // Step 3: Count = total - rescheduled - refunded_deals - completed_r2
      return noShowIds.length - rescheduledParentIds.size - noShowsWithRefundedDeals.size - noShowsWithCompletedR2.size;
    },
    staleTime: 5 * 60 * 1000,
  });
}
