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

      let contact: { id: string; name: string } | null = null;
      let matchMethod: 'email' | 'phone' | 'email_prefix' | null = null;

      // 1. Tentar buscar por email exato
      if (email) {
        const { data } = await supabase
          .from('crm_contacts')
          .select('id, name')
          .ilike('email', email)
          .limit(1)
          .maybeSingle();
        
        if (data) {
          contact = data;
          matchMethod = 'email';
        }
      }

      // 2. Se não encontrou, tentar por telefone
      if (!contact && phone) {
        const phoneSuffix = getPhoneSuffix(phone);
        
        if (phoneSuffix.length >= 8) {
          // Buscar por telefone que termina com os últimos 8-9 dígitos
          const { data } = await supabase
            .from('crm_contacts')
            .select('id, name')
            .ilike('phone', `%${phoneSuffix}`)
            .limit(1)
            .maybeSingle();
          
          if (data) {
            contact = data;
            matchMethod = 'phone';
          }
        }
      }

      // 3. Se não encontrou, tentar por prefixo do email (antes do @)
      if (!contact && email) {
        const emailPrefix = email.split('@')[0];
        if (emailPrefix && emailPrefix.length >= 3) {
          const { data } = await supabase
            .from('crm_contacts')
            .select('id, name')
            .ilike('email', `${emailPrefix}@%`)
            .limit(1)
            .maybeSingle();
          
          if (data) {
            contact = data;
            matchMethod = 'email_prefix';
          }
        }
      }

      if (!contact) return null;

      // 2. Buscar deals do contato (pegamos o mais recente para incorporador)
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
        .eq('contact_id', contact.id)
        .order('created_at', { ascending: false })
        .limit(1);

      const deal = deals?.[0];
      if (!deal) return null;

      // 3. Extrair SDR do custom_fields
      const customFields = deal.custom_fields as Record<string, any> | null;
      const sdrEmail = customFields?.user_email || null;
      const sdrName = customFields?.user_name || null;

      // 4. Buscar reuniões do deal
      const { data: meetings } = await supabase
        .from('meeting_slots')
        .select(`
          id,
          scheduled_at,
          status,
          lead_type,
          closer_id,
          closers (name)
        `)
        .eq('deal_id', deal.id)
        .order('scheduled_at', { ascending: true });

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
