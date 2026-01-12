import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface IncorporadorMeeting {
  scheduledAt: string | null;
  closerName: string | null;
  status: string | null;
  leadType: string | null;
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

// Helper: encontrar contato que tem reunião agendada
const findContactWithMeetings = async (contacts: { id: string; name: string }[]) => {
  for (const contact of contacts) {
    const { data: deals } = await supabase
      .from('crm_deals')
      .select('id, meeting_slots(id)')
      .eq('contact_id', contact.id)
      .limit(5);
    
    const dealWithMeeting = deals?.find(d => (d.meeting_slots as any[])?.length > 0);
    if (dealWithMeeting) {
      return contact;
    }
  }
  return null;
};

// Helper: encontrar contato que tem qualquer deal
const findContactWithAnyDeal = async (contacts: { id: string; name: string }[]) => {
  for (const contact of contacts) {
    const { count } = await supabase
      .from('crm_deals')
      .select('id', { count: 'exact', head: true })
      .eq('contact_id', contact.id);
    
    if (count && count > 0) {
      return contact;
    }
  }
  return null;
};

// Helper: buscar contato priorizando os que têm deals com reuniões
const findBestContact = async (
  contacts: { id: string; name: string }[]
): Promise<{ id: string; name: string } | null> => {
  if (!contacts || contacts.length === 0) return null;
  
  // 1. Priorizar contato que tem deal COM reunião
  const contactWithMeeting = await findContactWithMeetings(contacts);
  if (contactWithMeeting) return contactWithMeeting;
  
  // 2. Fallback: contato que tem qualquer deal
  const contactWithDeal = await findContactWithAnyDeal(contacts);
  if (contactWithDeal) return contactWithDeal;
  
  // 3. Fallback final: primeiro contato
  return contacts[0];
};

export const useIncorporadorLeadJourney = (email: string | null, phone: string | null) => {
  return useQuery({
    queryKey: ['incorporador-lead-journey', email, phone],
    queryFn: async (): Promise<IncorporadorLeadJourney | null> => {
      if (!email && !phone) return null;

      let contact: { id: string; name: string } | null = null;
      let matchMethod: 'email' | 'phone' | 'email_prefix' | null = null;

      // 1. Tentar buscar por email exato (buscar TODOS, não apenas 1)
      if (email) {
        const { data: contacts } = await supabase
          .from('crm_contacts')
          .select('id, name')
          .ilike('email', email);
        
        if (contacts && contacts.length > 0) {
          contact = await findBestContact(contacts);
          if (contact) matchMethod = 'email';
        }
      }

      // 2. Se não encontrou, tentar por telefone
      if (!contact && phone) {
        const phoneSuffix = getPhoneSuffix(phone);
        
        if (phoneSuffix.length >= 8) {
          const { data: contacts } = await supabase
            .from('crm_contacts')
            .select('id, name')
            .ilike('phone', `%${phoneSuffix}`);
          
          if (contacts && contacts.length > 0) {
            contact = await findBestContact(contacts);
            if (contact) matchMethod = 'phone';
          }
        }
      }

      // 3. Se não encontrou, tentar por prefixo do email (antes do @)
      if (!contact && email) {
        const emailPrefix = email.split('@')[0];
        if (emailPrefix && emailPrefix.length >= 3) {
          const { data: contacts } = await supabase
            .from('crm_contacts')
            .select('id, name')
            .ilike('email', `${emailPrefix}@%`);
          
          if (contacts && contacts.length > 0) {
            contact = await findBestContact(contacts);
            if (contact) matchMethod = 'email_prefix';
          }
        }
      }

      if (!contact) return null;

      // 2. Buscar deals do contato (pegamos o mais recente, priorizando os com reuniões)
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
          ),
          meeting_slots (id)
        `)
        .eq('contact_id', contact.id)
        .order('created_at', { ascending: false });

      // Priorizar deal que TEM reunião agendada
      const dealWithMeeting = deals?.find(d => (d.meeting_slots as any[])?.length > 0);
      const deal = dealWithMeeting || deals?.[0];
      if (!deal) return null;

      // 3. Buscar reuniões do deal COM dados do SDR que agendou (booked_by)
      const { data: meetings } = await supabase
        .from('meeting_slots')
        .select(`
          id,
          scheduled_at,
          status,
          lead_type,
          closer_id,
          booked_by,
          closers (name),
          profiles!meeting_slots_booked_by_fkey (full_name, email)
        `)
        .eq('deal_id', deal.id)
        .order('scheduled_at', { ascending: true });

      // 4. Extrair SDR: priorizar booked_by da reunião, depois custom_fields, depois deal_activities
      const customFields = deal.custom_fields as Record<string, any> | null;
      const firstMeeting = meetings?.[0];
      const bookedByProfile = firstMeeting?.profiles as { full_name?: string; email?: string } | null;
      
      let sdrName = bookedByProfile?.full_name || customFields?.user_name || null;
      let sdrEmail = bookedByProfile?.email || customFields?.user_email || null;

      // 5. Fallback: buscar SDR na deal_activities se ainda não encontrou
      if (!sdrName && !sdrEmail) {
        const { data: activity } = await supabase
          .from('deal_activities')
          .select('metadata')
          .eq('deal_id', deal.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        const metadata = activity?.metadata as Record<string, any> | null;
        sdrName = metadata?.deal_user_name || null;
        sdrEmail = metadata?.deal_user || metadata?.owner_email || null;
      }

      // 5. Separar Reunião 01 e R2
      const meeting01Data = meetings?.find(m => m.lead_type !== 'R2');
      const meeting02Data = meetings?.find(m => m.lead_type === 'R2');

      // Type assertion para closers
      const getCloserName = (meeting: any): string | null => {
        if (!meeting?.closers) return null;
        if (Array.isArray(meeting.closers)) {
          return meeting.closers[0]?.name || null;
        }
        return (meeting.closers as { name?: string })?.name || null;
      };

      const meeting01: IncorporadorMeeting | null = meeting01Data ? {
        scheduledAt: meeting01Data.scheduled_at,
        closerName: getCloserName(meeting01Data),
        status: meeting01Data.status,
        leadType: meeting01Data.lead_type,
      } : null;

      const meeting02: IncorporadorMeeting | null = meeting02Data ? {
        scheduledAt: meeting02Data.scheduled_at,
        closerName: getCloserName(meeting02Data),
        status: meeting02Data.status,
        leadType: meeting02Data.lead_type,
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
