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
          closer:closers!meeting_slots_closer_id_fkey(
            id,
            name,
            color
          ),
          attendees:meeting_slot_attendees(
            id,
            name,
            email,
            phone,
            status,
            deal_id,
            lead_type,
            already_builds,
            partner_name,
            lead_profile,
            video_status,
            r2_status_id,
            thermometer_ids,
            r2_confirmation,
            r2_observations,
            meeting_link,
            updated_by,
            updated_at,
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

      // Enrich attendees with status and thermometer objects
      return (meetings || []).map(meeting => {
        const meetingObj = meeting as Record<string, unknown>;
        const attendeesArr = (meetingObj.attendees || []) as Array<Record<string, unknown>>;
        
        return {
          ...meetingObj,
          attendees: attendeesArr.map(att => {
            const thermIds = (att.thermometer_ids as string[]) || [];
            const statusId = att.r2_status_id as string | null;
            
            return {
              ...att,
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
