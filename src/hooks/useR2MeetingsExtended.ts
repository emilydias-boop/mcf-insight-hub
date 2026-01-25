import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfDay, endOfDay } from 'date-fns';
import { R2MeetingRow, R2StatusOption, R2ThermometerOption } from '@/types/r2Agenda';

export function useR2MeetingsExtended(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['r2-meetings-extended', format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      // Fetch meetings with extended attendee data
      const { data: meetings, error: meetingsError } = await supabase
        .from('meeting_slots')
        .select(`
          id,
          scheduled_at,
          status,
          created_at,
          meeting_type,
          notes,
          booked_by,
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
            partner_name,
            video_status,
            r2_status_id,
            thermometer_ids,
            r2_confirmation,
            r2_observations,
            meeting_link,
            updated_by,
            updated_at,
            is_decision_maker,
            decision_maker_type,
            deal:crm_deals(
              id,
              name,
              owner_id,
              origin_id,
              custom_fields,
              origin:crm_origins(name),
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

      if (meetingsError) throw meetingsError;

      // Fetch all status options
      const { data: statusOptions } = await supabase
        .from('r2_status_options')
        .select('*')
        .eq('is_active', true);

      // Fetch all thermometer options
      const { data: thermometerOptions } = await supabase
        .from('r2_thermometer_options')
        .select('*')
        .eq('is_active', true);

      const statusMap = (statusOptions || []).reduce((acc, s) => {
        acc[s.id] = s as R2StatusOption;
        return acc;
      }, {} as Record<string, R2StatusOption>);

      const thermometerMap = (thermometerOptions || []).reduce((acc, t) => {
        acc[t.id] = t as R2ThermometerOption;
        return acc;
      }, {} as Record<string, R2ThermometerOption>);

      // Collect all deal_ids from R2 meetings to find R1 closers
      const dealIds = (meetings || []).flatMap(m => {
        const attendeesArr = ((m as Record<string, unknown>).attendees || []) as Array<Record<string, unknown>>;
        return attendeesArr.map(a => a.deal_id as string).filter(Boolean);
      });

      // Fetch R1 meetings for those deals to get R1 closers
      let r1CloserMap: Record<string, { id: string; name: string; scheduled_at: string | null }> = {};
      if (dealIds.length > 0) {
        const { data: r1Meetings } = await supabase
          .from('meeting_slots')
          .select(`
            id,
            scheduled_at,
            closer:closers!meeting_slots_closer_id_fkey(id, name),
            attendees:meeting_slot_attendees(deal_id)
          `)
          .eq('meeting_type', 'r1')
          .limit(500);

        // Map deal_id -> R1 closer with scheduled_at
        (r1Meetings || []).forEach((r1: Record<string, unknown>) => {
          const r1Closer = r1.closer as { id: string; name: string } | null;
          const r1ScheduledAt = r1.scheduled_at as string | null;
          const r1Attendees = (r1.attendees || []) as Array<{ deal_id: string | null }>;
          r1Attendees.forEach(att => {
            if (att.deal_id && r1Closer && dealIds.includes(att.deal_id)) {
              r1CloserMap[att.deal_id] = { ...r1Closer, scheduled_at: r1ScheduledAt };
            }
          });
        });
      }

      // Collect all booked_by IDs and SDR emails
      const bookedByIds = (meetings || [])
        .map(m => (m as Record<string, unknown>).booked_by as string)
        .filter(Boolean);
      
      const sdrEmails = (meetings || []).flatMap(m => {
        const attendeesArr = ((m as Record<string, unknown>).attendees || []) as Array<Record<string, unknown>>;
        return attendeesArr.map(a => {
          const deal = a.deal as { owner_id?: string } | null;
          return deal?.owner_id;
        }).filter(Boolean) as string[];
      });

      // Fetch profiles for booked_by users (by UUID)
      let profilesById: Record<string, { id: string; name: string | null }> = {};
      if (bookedByIds.length > 0) {
        const { data: bookedByProfiles, error: bookedByError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', bookedByIds);
        
        if (!bookedByError && bookedByProfiles) {
          bookedByProfiles.forEach(p => {
            profilesById[p.id] = { id: p.id, name: p.full_name };
          });
        }
      }

      // Fetch profiles for SDRs by email (owner_id is email)
      let profilesByEmail: Record<string, { email: string; name: string | null }> = {};
      if (sdrEmails.length > 0) {
        const { data: sdrProfiles, error: sdrError } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('email', sdrEmails);
        
        if (!sdrError && sdrProfiles) {
          sdrProfiles.forEach(p => {
            if (p.email) {
              profilesByEmail[p.email] = { email: p.email, name: p.full_name };
            }
          });
        }
      }

      // Enrich attendees with status and thermometer objects, and map column names
      return (meetings || []).map(meeting => {
        const meetingObj = meeting as Record<string, unknown>;
        const attendeesArr = (meetingObj.attendees || []) as Array<Record<string, unknown>>;
        const bookedById = meetingObj.booked_by as string | null;

        // Find SDR from first attendee's deal
        let sdr: { email: string; name: string | null } | null = null;
        let r1Closer: { id: string; name: string; scheduled_at: string | null } | null = null;

        if (attendeesArr.length > 0) {
          const firstAtt = attendeesArr[0];
          const deal = firstAtt.deal as { owner_id?: string } | null;
          if (deal?.owner_id) {
            sdr = profilesByEmail[deal.owner_id] || { email: deal.owner_id, name: null };
          }
          const dealId = firstAtt.deal_id as string | null;
          if (dealId && r1CloserMap[dealId]) {
            r1Closer = r1CloserMap[dealId];
          }
        }

        return {
          ...meetingObj,
          sdr,
          r1_closer: r1Closer,
          booked_by: bookedById ? profilesById[bookedById] || { id: bookedById, name: null } : null,
          attendees: attendeesArr.map(att => {
            const thermIds = (att.thermometer_ids as string[]) || [];
            const statusId = att.r2_status_id as string | null;
            
            return {
              ...att,
              // Map database column names to expected property names
              name: att.attendee_name as string | null,
              phone: att.attendee_phone as string | null,
              email: null, // email doesn't exist in meeting_slot_attendees
              thermometer_ids: thermIds,
              r2_status: statusId ? statusMap[statusId] : null,
              thermometers: thermIds
                .map(id => thermometerMap[id])
                .filter(Boolean),
            };
          }),
        };
      }) as R2MeetingRow[];
    }
  });
}
