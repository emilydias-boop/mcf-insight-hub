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
        // Determinar método de match baseado nos parâmetros
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

      // 3. Buscar deals do contato (pegamos o mais recente, priorizando os com reuniões)
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
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false });

      // Priorizar deal que TEM reunião agendada
      const dealWithMeeting = deals?.find(d => (d.meeting_slots as any[])?.length > 0);
      const deal = dealWithMeeting || deals?.[0];
      if (!deal) return null;

      // 4. Buscar reuniões do deal COM dados do SDR que agendou (booked_by)
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

      // 5. Extrair SDR: priorizar booked_by da reunião, depois custom_fields, depois deal_activities
      const customFields = deal.custom_fields as Record<string, any> | null;
      const firstMeeting = meetings?.[0];
      const bookedByProfile = firstMeeting?.profiles as { full_name?: string; email?: string } | null;
      
      let sdrName = bookedByProfile?.full_name || customFields?.user_name || null;
      let sdrEmail = bookedByProfile?.email || customFields?.user_email || null;

      // 6. Fallback: buscar SDR na deal_activities se ainda não encontrou
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

      // 7. Separar Reunião 01 e R2
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
