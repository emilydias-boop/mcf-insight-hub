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
          ),
          meeting_slots (id)
        `)
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false });

      // Priorizar deal que TEM reunião agendada
      const dealWithMeeting = deals?.find(d => (d.meeting_slots as any[])?.length > 0);
      const deal = dealWithMeeting || deals?.[0];
      if (!deal) return null;

      // 4. Buscar reuniões do deal (sem relação profiles que não existe)
      const { data: meetings } = await supabase
        .from('meeting_slots')
        .select(`
          id,
          scheduled_at,
          status,
          lead_type,
          closer_id,
          booked_by,
          closers (name)
        `)
        .eq('deal_id', deal.id)
        .order('scheduled_at', { ascending: true });

      // 5. Buscar perfil do SDR separadamente se tiver booked_by
      const firstMeeting = meetings?.[0];
      let sdrProfile: { full_name?: string; email?: string } | null = null;
      if (firstMeeting?.booked_by) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', firstMeeting.booked_by)
          .maybeSingle();
        sdrProfile = profile;
      }

      // 6. Extrair SDR com lógica de prioridade e filtro de closers
      let sdrName: string | null = null;
      let sdrEmail: string | null = null;

      // Prioridade 1: booked_by da primeira reunião (quem agendou)
      if (sdrProfile?.email) {
        // Verificar se não é um closer
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
        
        // Só usar se NÃO for closer
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
