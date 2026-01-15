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

      // Buscar reuniões R1 (meeting_slots com meeting_type = 'r1')
      const { data: r1Meetings } = await supabase
        .from('meeting_slots')
        .select(`
          id,
          scheduled_at,
          status,
          meeting_type,
          notes,
          closer_notes,
          booked_by,
          closer:closers(
            id,
            name,
            email,
            employee_id
          )
        `)
        .eq('deal_id', dealId)
        .eq('meeting_type', 'r1')
        .order('scheduled_at', { ascending: false })
        .limit(1);

      let r1Meeting: LeadJourneyMeeting | null = null;
      
      if (r1Meetings && r1Meetings.length > 0) {
        const meeting = r1Meetings[0];
        
        // Buscar quem agendou (booked_by)
        let bookedBy: { name: string; email: string } | null = null;
        if (meeting.booked_by) {
          const { data: booker } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', meeting.booked_by)
            .single();
          
          if (booker) {
            bookedBy = {
              name: booker.full_name || booker.email,
              email: booker.email
            };
          }
        }

        const closer = meeting.closer as any;
        r1Meeting = {
          id: meeting.id,
          scheduledAt: meeting.scheduled_at,
          status: meeting.status || 'scheduled',
          meetingType: 'r1',
          closer: {
            id: closer?.id || '',
            name: closer?.name || 'Não atribuído',
            email: closer?.email || '',
            employeeId: closer?.employee_id || null
          },
          bookingNotes: meeting.notes,
          closerNotes: meeting.closer_notes,
          bookedBy
        };
      }

      // Buscar reuniões R2 (meeting_slots com meeting_type = 'r2')
      const { data: r2Meetings } = await supabase
        .from('meeting_slots')
        .select(`
          id,
          scheduled_at,
          status,
          meeting_type,
          notes,
          closer_notes,
          booked_by,
          closer:closers(
            id,
            name,
            email,
            employee_id
          )
        `)
        .eq('deal_id', dealId)
        .eq('meeting_type', 'r2')
        .order('scheduled_at', { ascending: false })
        .limit(1);

      let r2Meeting: LeadJourneyMeeting | null = null;
      
      if (r2Meetings && r2Meetings.length > 0) {
        const meeting = r2Meetings[0];
        
        // Buscar quem agendou (booked_by)
        let bookedBy: { name: string; email: string } | null = null;
        if (meeting.booked_by) {
          const { data: booker } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', meeting.booked_by)
            .single();
          
          if (booker) {
            bookedBy = {
              name: booker.full_name || booker.email,
              email: booker.email
            };
          }
        }

        const closer = meeting.closer as any;
        r2Meeting = {
          id: meeting.id,
          scheduledAt: meeting.scheduled_at,
          status: meeting.status || 'scheduled',
          meetingType: 'r2',
          closer: {
            id: closer?.id || '',
            name: closer?.name || 'Não atribuído',
            email: closer?.email || '',
            employeeId: closer?.employee_id || null
          },
          bookingNotes: meeting.notes,
          closerNotes: meeting.closer_notes,
          bookedBy
        };
      }

      return { sdr, r1Meeting, r2Meeting };
    },
    enabled: !!dealId
  });
};
