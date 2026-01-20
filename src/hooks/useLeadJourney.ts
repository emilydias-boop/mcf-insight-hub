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

      // Buscar informações do deal para pegar o owner (SDR)
      const { data: deal } = await supabase
        .from('crm_deals')
        .select('owner_id')
        .eq('id', dealId)
        .single();

      let sdr: LeadJourneySDR | null = null;
      
      // Buscar SDR pela owner_id (email)
      if (deal?.owner_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('email', deal.owner_id)
          .single();
        
        if (profile) {
          // Buscar employee vinculado
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

      // Processar R1 meetings
      const r1AttendeeData = attendeeData?.filter((a: any) => 
        a.meeting_slots?.meeting_type === 'r1'
      );

      let r1Meeting: LeadJourneyMeeting | null = null;
      
      if (r1AttendeeData && r1AttendeeData.length > 0) {
        const attendeeRecord = r1AttendeeData[0] as any;
        const meeting = attendeeRecord.meeting_slots;
        
        // Buscar quem agendou (booked_by)
        let bookedBy: { name: string; email: string } | null = null;
        if (attendeeRecord.booked_by) {
          const { data: booker } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', attendeeRecord.booked_by)
            .single();
          
          if (booker) {
            bookedBy = {
              name: booker.full_name || booker.email,
              email: booker.email
            };
          }
        }

        const closer = meeting?.closer as any;
        r1Meeting = {
          id: meeting?.id || attendeeRecord.meeting_slot_id,
          scheduledAt: meeting?.scheduled_at,
          status: attendeeRecord.status || meeting?.status || 'scheduled',
          meetingType: 'r1',
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
      }

      // Processar R2 meetings
      const r2AttendeeData = attendeeData?.filter((a: any) => 
        a.meeting_slots?.meeting_type === 'r2'
      );

      let r2Meeting: LeadJourneyMeeting | null = null;
      
      if (r2AttendeeData && r2AttendeeData.length > 0) {
        const attendeeRecord = r2AttendeeData[0] as any;
        const meeting = attendeeRecord.meeting_slots;
        
        // Buscar quem agendou (booked_by)
        let bookedBy: { name: string; email: string } | null = null;
        if (attendeeRecord.booked_by) {
          const { data: booker } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', attendeeRecord.booked_by)
            .single();
          
          if (booker) {
            bookedBy = {
              name: booker.full_name || booker.email,
              email: booker.email
            };
          }
        }

        const closer = meeting?.closer as any;
        r2Meeting = {
          id: meeting?.id || attendeeRecord.meeting_slot_id,
          scheduledAt: meeting?.scheduled_at,
          status: attendeeRecord.status || meeting?.status || 'scheduled',
          meetingType: 'r2',
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
      }

      return { sdr, r1Meeting, r2Meeting };
    },
    enabled: !!dealId
  });
};
