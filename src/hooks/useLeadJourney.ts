import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LeadJourneySDR {
  name: string;
  email: string;
  userId: string | null;
  employeeId: string | null;
}

export interface LeadJourneyMeeting {
  id: string;
  scheduledAt: string;
  status: string;
  meetingType: 'r1' | 'r2';
  closer: {
    id: string;
    name: string;
    email: string;
    employeeId: string | null;
  };
  bookingNotes: string | null;
  closerNotes: string | null;
  bookedBy: {
    name: string;
    email: string;
  } | null;
}

export interface LeadJourney {
  sdr: LeadJourneySDR | null;
  r1Meeting: LeadJourneyMeeting | null;
  r2Meeting: LeadJourneyMeeting | null;
}

export const useLeadJourney = (dealId: string | null) => {
  return useQuery({
    queryKey: ['lead-journey', dealId],
    queryFn: async (): Promise<LeadJourney> => {
      if (!dealId) {
        return { sdr: null, r1Meeting: null, r2Meeting: null };
      }

      // Buscar reuniões via meeting_slot_attendees (para funcionar com slots compartilhados)
      const { data: attendeeData } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          meeting_slot_id,
          status,
          notes,
          booked_by,
          meeting_slots!inner(
            id,
            scheduled_at,
            status,
            meeting_type,
            closer_notes,
            closer:closers(
              id,
              name,
              email,
              employee_id
            )
          )
        `)
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false });

      // Helper to fetch bookedBy profile
      const fetchBookedBy = async (bookedById: string | null): Promise<{ name: string; email: string } | null> => {
        if (!bookedById) return null;
        const { data: booker } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', bookedById)
          .single();
        if (booker) {
          return { name: booker.full_name || booker.email, email: booker.email };
        }
        return null;
      };

      // Helper to build meeting object
      const buildMeeting = async (attendeeRecord: any, meetingType: 'r1' | 'r2'): Promise<LeadJourneyMeeting> => {
        const meeting = attendeeRecord.meeting_slots;
        const bookedBy = await fetchBookedBy(attendeeRecord.booked_by);
        const closer = meeting?.closer as any;
        return {
          id: meeting?.id || attendeeRecord.meeting_slot_id,
          scheduledAt: meeting?.scheduled_at,
          status: attendeeRecord.status || meeting?.status || 'scheduled',
          meetingType,
          closer: {
            id: closer?.id || '',
            name: closer?.name || 'Não atribuído',
            email: closer?.email || '',
            employeeId: closer?.employee_id || null
          },
          bookingNotes: attendeeRecord.notes,
          closerNotes: meeting?.closer_notes,
          bookedBy
        };
      };

      // Processar R1 e R2
      const r1Attendees = attendeeData?.filter((a: any) => a.meeting_slots?.meeting_type === 'r1');
      const r2Attendees = attendeeData?.filter((a: any) => a.meeting_slots?.meeting_type === 'r2');

      const r1Meeting = r1Attendees && r1Attendees.length > 0
        ? await buildMeeting(r1Attendees[0], 'r1')
        : null;

      const r2Meeting = r2Attendees && r2Attendees.length > 0
        ? await buildMeeting(r2Attendees[0], 'r2')
        : null;

      // Derivar SDR: prioridade para quem agendou a R1 (booked_by)
      let sdr: LeadJourneySDR | null = null;

      if (r1Meeting?.bookedBy) {
        // SDR = quem agendou a R1
        const bookedById = (r1Attendees as any[])[0].booked_by as string;
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('id', bookedById)
          .single();

        if (profile) {
          const { data: employee } = await supabase
            .from('employees')
            .select('id')
            .eq('user_id', profile.id)
            .single();

          sdr = {
            name: profile.full_name || profile.email,
            email: profile.email,
            userId: profile.id,
            employeeId: employee?.id || null
          };
        } else {
          sdr = {
            name: r1Meeting.bookedBy.name,
            email: r1Meeting.bookedBy.email,
            userId: null,
            employeeId: null
          };
        }
      } else {
        // Fallback: usar deal.owner_id
        const { data: deal } = await supabase
          .from('crm_deals')
          .select('owner_id')
          .eq('id', dealId)
          .single();

        if (deal?.owner_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('email', deal.owner_id)
            .single();

          if (profile) {
            const { data: employee } = await supabase
              .from('employees')
              .select('id')
              .eq('user_id', profile.id)
              .single();

            sdr = {
              name: profile.full_name || deal.owner_id,
              email: deal.owner_id,
              userId: profile.id,
              employeeId: employee?.id || null
            };
          } else {
            sdr = {
              name: deal.owner_id,
              email: deal.owner_id,
              userId: null,
              employeeId: null
            };
          }
        }
      }

      return { sdr, r1Meeting, r2Meeting };
    },
    enabled: !!dealId
  });
};
