import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfDay, endOfDay } from 'date-fns';

export interface R2Meeting {
  id: string;
  scheduled_at: string;
  status: string;
  created_at: string;
  meeting_type: string;
  notes: string | null;
  closer: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  attendees: Array<{
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    status: string;
    deal_id: string | null;
    lead_profile: string | null;
    already_builds: boolean | null;
    deal?: {
      id: string;
      name: string;
      contact?: {
        name: string;
        email: string | null;
        phone: string | null;
        tags: string[] | null;
      } | null;
    } | null;
  }>;
}

export function useR2AgendaMeetings(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['r2-agenda-meetings', format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meeting_slots')
        .select(`
          id,
          scheduled_at,
          status,
          created_at,
          meeting_type,
          notes,
          closer:closers!meeting_slots_closer_id_fkey(
            id,
            name,
            color
          ),
          attendees:meeting_slot_attendees(
            id,
            attendee_name,
            attendee_phone,
            status,
            deal_id,
            already_builds,
            lead_profile,
            is_reschedule,
            parent_attendee_id,
            deal:crm_deals(
              id,
              name,
              contact:crm_contacts(
                name,
                email,
                phone,
                tags
              )
            )
          )
        `)
        .eq('meeting_type', 'r2')
        .gte('scheduled_at', startOfDay(startDate).toISOString())
        .lte('scheduled_at', endOfDay(endDate).toISOString())
        .order('scheduled_at', { ascending: true });

      if (error) throw error;
      
      // Map database column names to expected property names
      return (data || []).map(meeting => ({
        ...meeting,
        attendees: (meeting.attendees || []).map((att: Record<string, unknown>) => ({
          ...att,
          name: att.attendee_name as string | null,
          phone: att.attendee_phone as string | null,
          email: null,
        })),
      })) as unknown as R2Meeting[];
    }
  });
}

export function useR2MeetingsByCloser(closerId: string, startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['r2-meetings-by-closer', closerId, format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meeting_slots')
        .select(`
          id,
          scheduled_at,
          status,
          created_at,
          meeting_type,
          notes,
          closer:closers!meeting_slots_closer_id_fkey(
            id,
            name,
            color
          ),
          attendees:meeting_slot_attendees(
            id,
            attendee_name,
            attendee_phone,
            status,
            deal_id,
            already_builds,
            lead_profile,
            is_reschedule,
            parent_attendee_id
          )
        `)
        .eq('meeting_type', 'r2')
        .eq('closer_id', closerId)
        .gte('scheduled_at', startOfDay(startDate).toISOString())
        .lte('scheduled_at', endOfDay(endDate).toISOString())
        .order('scheduled_at', { ascending: true });

      if (error) throw error;
      
      // Map database column names to expected property names
      return (data || []).map(meeting => ({
        ...meeting,
        attendees: (meeting.attendees || []).map((att: Record<string, unknown>) => ({
          ...att,
          name: att.attendee_name as string | null,
          phone: att.attendee_phone as string | null,
          email: null,
        })),
      })) as unknown as R2Meeting[];
    },
    enabled: !!closerId
  });
}
