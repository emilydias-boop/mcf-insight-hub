import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface IncorporadorMeeting {
  scheduledAt: string | null;
  closerName: string | null;
  status: string | null;
  leadType: string | null;
  meetingType: string | null;
}

export interface IncorporadorLeadJourney {
  // SDR
  sdrName: string | null;
  sdrEmail: string | null;
  
  // Reunião 01
  meeting01: IncorporadorMeeting | null;
  
  // R2 (segunda reunião)
  meeting02: IncorporadorMeeting | null;
  
  // Status do Deal
  dealId: string | null;
  dealName: string | null;
  dealStage: string | null;
  dealStageColor: string | null;
  originName: string | null;
  createdAt: string | null;
  
  // Método de busca usado
  matchMethod: 'email' | 'phone' | 'email_prefix' | null;
}

// Normaliza telefone para comparação
const normalizePhone = (phone: string | null): string => {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
};

// Extrai os últimos 9 dígitos do telefone (número sem DDD do país)
const getPhoneSuffix = (phone: string | null): string => {
  const normalized = normalizePhone(phone);
  return normalized.slice(-9);
};

export const useIncorporadorLeadJourney = (email: string | null, phone: string | null) => {
  return useQuery({
    queryKey: ['incorporador-lead-journey', email, phone],
    queryFn: async (): Promise<IncorporadorLeadJourney | null> => {
      if (!email && !phone) return null;

      let contactId: string | null = null;
      let matchMethod: 'email' | 'phone' | 'email_prefix' | null = null;
      const phoneSuffix = getPhoneSuffix(phone);

      // 1. Usar RPC otimizada para buscar contato com mais reuniões/deals
      const { data: rpcResult } = await supabase.rpc('get_contact_with_meetings', {
        p_email: email || null,
        p_phone_suffix: phoneSuffix.length >= 8 ? phoneSuffix : null
      });

      if (rpcResult && rpcResult.length > 0) {
        contactId = rpcResult[0].contact_id;
        if (email) {
          matchMethod = 'email';
        } else if (phoneSuffix.length >= 8) {
          matchMethod = 'phone';
        }
      }

      // 2. Fallback: tentar busca por prefixo do email se não encontrou
      if (!contactId && email) {
        const emailPrefix = email.split('@')[0];
        if (emailPrefix && emailPrefix.length >= 3) {
          const { data: contacts } = await supabase
            .from('crm_contacts')
            .select('id')
            .ilike('email', `${emailPrefix}@%`)
            .limit(1);
          
          if (contacts && contacts.length > 0) {
            contactId = contacts[0].id;
            matchMethod = 'email_prefix';
          }
        }
      }

      if (!contactId) return null;

      // 3. Buscar lista de closers para filtrar SDRs
      const { data: closers } = await supabase
        .from('closers')
        .select('email')
        .eq('is_active', true);

      const closerEmails = new Set(
        closers?.map(c => c.email?.toLowerCase()).filter(Boolean) || []
      );

      // 4. Buscar deals do contato (pegamos o mais recente, priorizando os com reuniões)
      const { data: deals } = await supabase
        .from('crm_deals')
        .select(`
          id,
          name,
          stage_id,
          custom_fields,
          created_at,
          crm_stages!crm_deals_stage_id_fkey (
            stage_name,
            color
          ),
          crm_origins!crm_deals_origin_id_fkey (
            name
          )
        `)
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false });

      // Buscar attendees para cada deal para priorizar deals com reuniões
      let dealWithMeeting: typeof deals extends (infer T)[] | null ? T : never = null;
      if (deals && deals.length > 0) {
        for (const deal of deals) {
          const { data: attendeeCheck } = await supabase
            .from('meeting_slot_attendees')
            .select('id')
            .eq('deal_id', deal.id)
            .limit(1);
          
          if (attendeeCheck && attendeeCheck.length > 0) {
            dealWithMeeting = deal;
            break;
          }
        }
      }

      const deal = dealWithMeeting || deals?.[0];
      if (!deal) return null;

      // 5. CORRIGIDO: Buscar reuniões via meeting_slot_attendees (não meeting_slots.deal_id)
      const { data: attendees } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          status,
          deal_id,
          meeting_slot_id,
          created_at,
          meeting_slots!inner (
            id,
            scheduled_at,
            status,
            meeting_type,
            lead_type,
            closer_id,
            booked_by,
            closers (
              id,
              name,
              email
            )
          )
        `)
        .eq('deal_id', deal.id)
        .order('created_at', { ascending: true });

      // 6. Buscar perfil do SDR separadamente se tiver booked_by na primeira reunião
      const firstAttendee = attendees?.[0];
      const firstSlot = firstAttendee?.meeting_slots as any;
      let sdrProfile: { full_name?: string; email?: string } | null = null;
      
      if (firstSlot?.booked_by) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', firstSlot.booked_by)
          .maybeSingle();
        sdrProfile = profile;
      }

      // 7. Extrair SDR com lógica de prioridade e filtro de closers
      let sdrName: string | null = null;
      let sdrEmail: string | null = null;

      // Prioridade 1: booked_by da primeira reunião (quem agendou)
      if (sdrProfile?.email) {
        if (!closerEmails.has(sdrProfile.email.toLowerCase())) {
          sdrName = sdrProfile.full_name || null;
          sdrEmail = sdrProfile.email;
        }
      }

      // Prioridade 2: Buscar nas deal_activities quem moveu para R1 Agendada
      if (!sdrEmail) {
        const { data: r1Activity } = await supabase
          .from('deal_activities')
          .select('metadata')
          .eq('deal_id', deal.id)
          .or('to_stage.ilike.%Reunião 01 Agendada%,to_stage.ilike.%R1 Agendada%')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        
        const r1Meta = r1Activity?.metadata as Record<string, any> | null;
        const activityOwnerEmail = r1Meta?.owner_email || r1Meta?.deal_user;
        
        if (activityOwnerEmail && !closerEmails.has(activityOwnerEmail.toLowerCase())) {
          sdrEmail = activityOwnerEmail;
          sdrName = r1Meta?.deal_user_name || null;
        }
      }

      // Prioridade 3: custom_fields apenas se NÃO for closer
      if (!sdrEmail) {
        const customFields = deal.custom_fields as Record<string, any> | null;
        const ownerEmail = customFields?.user_email;
        
        if (ownerEmail && !closerEmails.has(ownerEmail.toLowerCase())) {
          sdrEmail = ownerEmail;
          sdrName = customFields?.user_name || null;
        }
      }

      // 8. CORRIGIDO: Separar Reunião 01 e R2 usando meeting_type (não lead_type)
      // meeting_type = 'r1' ou 'r2'
      const r1Attendee = attendees?.find(a => {
        const slot = a.meeting_slots as any;
        return slot?.meeting_type === 'r1';
      });
      
      const r2Attendee = attendees?.find(a => {
        const slot = a.meeting_slots as any;
        return slot?.meeting_type === 'r2';
      });

      // Fallback: se não tiver meeting_type definido, usar ordem cronológica
      const fallbackR1 = !r1Attendee && !r2Attendee && attendees?.[0] ? attendees[0] : null;
      const fallbackR2 = !r1Attendee && !r2Attendee && attendees?.[1] ? attendees[1] : null;

      // Helper para extrair dados do closer
      const getCloserFromSlot = (slot: any): string | null => {
        if (!slot?.closers) return null;
        if (Array.isArray(slot.closers)) {
          return slot.closers[0]?.name || null;
        }
        return slot.closers?.name || null;
      };

      // Construir meeting01
      const r1SlotData = (r1Attendee?.meeting_slots || fallbackR1?.meeting_slots) as any;
      const meeting01: IncorporadorMeeting | null = r1SlotData ? {
        scheduledAt: r1SlotData.scheduled_at,
        closerName: getCloserFromSlot(r1SlotData),
        status: r1Attendee?.status || fallbackR1?.status || r1SlotData.status,
        leadType: r1SlotData.lead_type,
        meetingType: r1SlotData.meeting_type,
      } : null;

      // Construir meeting02
      const r2SlotData = (r2Attendee?.meeting_slots || fallbackR2?.meeting_slots) as any;
      const meeting02: IncorporadorMeeting | null = r2SlotData ? {
        scheduledAt: r2SlotData.scheduled_at,
        closerName: getCloserFromSlot(r2SlotData),
        status: r2Attendee?.status || fallbackR2?.status || r2SlotData.status,
        leadType: r2SlotData.lead_type,
        meetingType: r2SlotData.meeting_type,
      } : null;

      // Type assertion para stage e origin
      const stage = deal.crm_stages as { stage_name?: string; color?: string } | null;
      const origin = deal.crm_origins as { name?: string } | null;

      return {
        sdrName,
        sdrEmail,
        meeting01,
        meeting02,
        dealId: deal.id,
        dealName: deal.name,
        dealStage: stage?.stage_name || null,
        dealStageColor: stage?.color || null,
        originName: origin?.name || null,
        createdAt: deal.created_at,
        matchMethod,
      };
    },
    enabled: !!(email || phone),
  });
};
