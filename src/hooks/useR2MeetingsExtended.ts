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
            is_reschedule,
            parent_attendee_id,
            deal:crm_deals(
              id,
              name,
              owner_id,
              origin_id,
              contact_id,
              custom_fields,
              origin:crm_origins(name),
              contact:crm_contacts(
                id,
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

      // Collect contact emails/phones to check for A010 purchases
      const contactEmails: string[] = [];
      const contactPhones: string[] = [];
      (meetings || []).forEach(m => {
        const attendeesArr = ((m as Record<string, unknown>).attendees || []) as Array<Record<string, unknown>>;
        attendeesArr.forEach(att => {
          const deal = att.deal as { contact?: { email?: string; phone?: string } } | null;
          if (deal?.contact?.email) contactEmails.push(deal.contact.email.toLowerCase());
          if (deal?.contact?.phone) contactPhones.push(deal.contact.phone);
        });
      });

      // Fetch A010 confirmed purchases from hubla_transactions
      let a010Emails = new Set<string>();
      let a010Phones = new Set<string>();
      
      if (contactEmails.length > 0 || contactPhones.length > 0) {
        const { data: a010Sales } = await supabase
          .from('hubla_transactions')
          .select('customer_email, customer_phone')
          .ilike('product_name', '%A010%')
          .in('sale_status', ['paid', 'completed']);
        
        if (a010Sales) {
          a010Emails = new Set(a010Sales.map(t => t.customer_email?.toLowerCase()).filter(Boolean) as string[]);
          a010Phones = new Set(a010Sales.map(t => t.customer_phone).filter(Boolean) as string[]);
        }
      }

      const statusMap = (statusOptions || []).reduce((acc, s) => {
        acc[s.id] = s as R2StatusOption;
        return acc;
      }, {} as Record<string, R2StatusOption>);

      const thermometerMap = (thermometerOptions || []).reduce((acc, t) => {
        acc[t.id] = t as R2ThermometerOption;
        return acc;
      }, {} as Record<string, R2ThermometerOption>);

      // Collect all deal_ids from R2 meetings to find R1 closers and notes
      const dealIds = (meetings || []).flatMap(m => {
        const attendeesArr = ((m as Record<string, unknown>).attendees || []) as Array<Record<string, unknown>>;
        return attendeesArr.map(a => a.deal_id as string).filter(Boolean);
      });

      // Fetch R1 meetings for those deals to get R1 closers and qualification notes
      let r1CloserMap: Record<string, { id: string; name: string; scheduled_at: string | null }> = {};
      let r1NotesMap: Record<string, string> = {};
      let r1SdrMap: Record<string, string> = {}; // deal_id -> booked_by UUID from R1
      
      if (dealIds.length > 0) {
        // Query R1 attendees directly by deal_id (no arbitrary limit)
        const { data: r1Attendees } = await supabase
          .from('meeting_slot_attendees')
          .select(`
            deal_id,
            notes,
            booked_by,
            created_at,
            meeting_slot:meeting_slots!inner(
              id,
              scheduled_at,
              meeting_type,
              closer:closers!meeting_slots_closer_id_fkey(id, name)
            )
          `)
          .in('deal_id', dealIds)
          .eq('meeting_slot.meeting_type', 'r1')
          .order('created_at', { ascending: false });

        // Process attendee-centric results
        (r1Attendees || []).forEach((att: Record<string, unknown>) => {
          const dealId = att.deal_id as string | null;
          if (!dealId) return;
          
          const slot = att.meeting_slot as { id: string; scheduled_at: string | null; closer: { id: string; name: string } | null } | null;
          
          // Closer R1: first match wins (most recent due to order)
          if (slot?.closer && !r1CloserMap[dealId]) {
            r1CloserMap[dealId] = { ...slot.closer, scheduled_at: slot.scheduled_at };
          }
          // R1 note: first match wins (most recent)
          if (att.notes && !r1NotesMap[dealId]) {
            r1NotesMap[dealId] = att.notes as string;
          }
          // SDR from R1 booked_by: first match wins (most recent = último agendamento)
          if (att.booked_by && !r1SdrMap[dealId]) {
            r1SdrMap[dealId] = att.booked_by as string;
          }
        });
      }

      // Collect all booked_by IDs (from R2 meetings AND R1 SDRs)
      const r1SdrUuids = Object.values(r1SdrMap).filter(Boolean);
      const bookedByIds = [
        ...(meetings || [])
          .map(m => (m as Record<string, unknown>).booked_by as string)
          .filter(Boolean),
        ...r1SdrUuids,
      ];
      
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

        // Find SDR from R1 booked_by, fallback to deal.owner_id
        let sdr: { email: string; name: string | null } | null = null;
        let r1Closer: { id: string; name: string; scheduled_at: string | null } | null = null;

        if (attendeesArr.length > 0) {
          const firstAtt = attendeesArr[0];
          const dealId = firstAtt.deal_id as string | null;
          
          // SDR: prefer R1 booked_by (UUID) over deal.owner_id
          if (dealId && r1SdrMap[dealId]) {
            const sdrProfile = profilesById[r1SdrMap[dealId]];
            sdr = sdrProfile 
              ? { email: r1SdrMap[dealId], name: sdrProfile.name }
              : { email: r1SdrMap[dealId], name: null };
          } else {
            const deal = firstAtt.deal as { owner_id?: string } | null;
            if (deal?.owner_id) {
              sdr = profilesByEmail[deal.owner_id] || { email: deal.owner_id, name: null };
            }
          }
          
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
          const attDealId = att.deal_id as string | null;
          const deal = att.deal as { contact?: { email?: string; phone?: string } } | null;
          
          // Check if contact has A010 purchase
          const contactEmail = deal?.contact?.email?.toLowerCase();
          const contactPhone = deal?.contact?.phone;
          const isA010 = 
            (contactEmail && a010Emails.has(contactEmail)) ||
            (contactPhone && a010Phones.has(contactPhone));
          
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
            // R1 qualification note from SDR
            r1_qualification_note: attDealId ? r1NotesMap[attDealId] || null : null,
            // Sales channel based on A010 purchase
            sales_channel: isA010 ? 'A010' : 'LIVE',
          };
        }),
        };
      }) as R2MeetingRow[];
    }
  });
}
