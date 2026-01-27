import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay } from 'date-fns';
import type { Json } from '@/integrations/supabase/types';

export interface QualificationFilters {
  startDate: Date;
  endDate: Date;
  closerId?: string;
  status?: string;
}

export interface R2QualificationReportRow {
  id: string;
  leadName: string | null;
  phone: string | null;
  email: string | null;
  scheduledAt: string;
  status: string;
  closerName: string | null;
  sdrName: string | null;
  salesChannel: string | null;
  // Qualification fields
  estado: string | null;
  profissao: string | null;
  renda: string | null;
  idade: string | null;
  jaConstroi: string | null;
  terreno: string | null;
  imovel: string | null;
  tempoMcf: string | null;
  temSocio: boolean | null;
  nomeSocio: string | null;
}

interface CustomFields {
  estado?: string;
  profissao?: string;
  renda?: string;
  idade?: string;
  ja_constroi?: string;
  terreno?: string;
  possui_imovel?: string;
  tempo_conhece_mcf?: string;
  tem_socio?: boolean;
  nome_socio?: string;
  canal_vendas?: string;
}

export function useR2QualificationReport(filters: QualificationFilters) {
  return useQuery({
    queryKey: ['r2-qualification-report', filters.startDate.toISOString(), filters.endDate.toISOString(), filters.closerId, filters.status],
    queryFn: async () => {
      let query = supabase
        .from('meeting_slots')
        .select(`
          id,
          scheduled_at,
          status,
          closer:closers!meeting_slots_closer_id_fkey(id, name),
          attendees:meeting_slot_attendees(
            id,
            attendee_name,
            attendee_phone,
            status,
            deal:crm_deals(
              id,
              name,
              owner_profile_id,
              custom_fields,
              contact:crm_contacts(name, email, phone),
              owner:profiles!crm_deals_owner_profile_id_fkey(id, full_name)
            )
          )
        `)
        .eq('meeting_type', 'r2')
        .gte('scheduled_at', startOfDay(filters.startDate).toISOString())
        .lte('scheduled_at', endOfDay(filters.endDate).toISOString())
        .order('scheduled_at', { ascending: false });

      if (filters.closerId) {
        query = query.eq('closer_id', filters.closerId);
      }

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transform and flatten data
      const rows: R2QualificationReportRow[] = (data || []).flatMap((meeting) => {
        const meetingCloser = meeting.closer as { id: string; name: string } | null;
        
        return (meeting.attendees || []).map((att) => {
          const deal = att.deal as {
            id: string;
            name: string | null;
            owner_profile_id: string | null;
            custom_fields: Json;
            contact: { name: string | null; email: string | null; phone: string | null } | null;
            owner: { id: string; full_name: string | null } | null;
          } | null;
          
          const customFields = (deal?.custom_fields as CustomFields) || {};
          const ownerData = deal?.owner || null;
          
          return {
            id: att.id,
            leadName: att.attendee_name || deal?.contact?.name || deal?.name || null,
            phone: att.attendee_phone || deal?.contact?.phone || null,
            email: deal?.contact?.email || null,
            scheduledAt: meeting.scheduled_at,
            status: att.status || meeting.status,
            closerName: meetingCloser?.name || null,
            sdrName: ownerData?.full_name || null,
            salesChannel: customFields.canal_vendas || null,
            // Qualification fields
            estado: customFields.estado || null,
            profissao: customFields.profissao || null,
            renda: customFields.renda || null,
            idade: customFields.idade || null,
            jaConstroi: customFields.ja_constroi || null,
            terreno: customFields.terreno || null,
            imovel: customFields.possui_imovel || null,
            tempoMcf: customFields.tempo_conhece_mcf || null,
            temSocio: customFields.tem_socio ?? null,
            nomeSocio: customFields.nome_socio || null,
          } as R2QualificationReportRow;
        });
      });

      return rows;
    },
  });
}

export function useR2Closers() {
  return useQuery({
    queryKey: ['r2-closers-for-report'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('closers')
        .select('id, name')
        .eq('is_active', true)
        .eq('meeting_type', 'r2')
        .order('name');

      if (error) throw error;
      return data || [];
    },
  });
}
