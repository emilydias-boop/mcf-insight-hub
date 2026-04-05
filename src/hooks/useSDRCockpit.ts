import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type LeadState = 'novo' | 'em_ligacao' | 'nao_atendeu' | 'qualificado' | 'agendando' | 'agendado' | 'retorno' | 'perdido';

export interface QueueDeal {
  id: string;
  name: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  stageName: string;
  stageId: string | null;
  stageMovedAt: string | null;
  nextActionDate: string | null;
  nextActionType: string | null;
  nextActionNote: string | null;
  activityCount: number;
  isOverdue: boolean;
  isNew: boolean;
  isStalledOver4h: boolean;
  hoursInStage: number;
  originName: string | null;
  originId: string | null;
  customFields: Record<string, any> | null;
}

export interface SelectedDealData extends QueueDeal {
  contactId: string | null;
  dealValue: number | null;
  activities: any[];
  callAttempts: number;
}

export const useSDRQueue = (limit = 50, offset = 0) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['sdr-cockpit-queue', user?.email, limit, offset],
    queryFn: async () => {
      if (!user?.email) return [];

      const { data, error } = await supabase.rpc('get_sdr_cockpit_queue', {
        p_owner_id: user.email,
        p_limit: limit,
        p_offset: offset,
      });

      if (error) throw error;

      const now = new Date();

      const mapped: QueueDeal[] = (data || []).map((row: any) => {
        const stageMovedAt = row.stage_moved_at ? new Date(row.stage_moved_at) : null;
        const hoursInStage = stageMovedAt ? (now.getTime() - stageMovedAt.getTime()) / (1000 * 60 * 60) : 999;

        return {
          id: row.deal_id,
          name: row.contact_name || 'Lead',
          contactName: row.contact_name || null,
          contactPhone: row.contact_phone || null,
          contactEmail: null,
          stageName: row.stage_name || 'Desconhecido',
          stageId: null,
          stageMovedAt: row.stage_moved_at,
          nextActionDate: row.next_action_date,
          nextActionType: row.next_action_type || null,
          nextActionNote: null,
          activityCount: row.activity_count || 0,
          isOverdue: row.urgency === 'overdue',
          isNew: (row.activity_count || 0) === 0,
          isStalledOver4h: row.urgency === 'stale' || row.urgency === 'urgent',
          hoursInStage,
          originName: null,
          originId: null,
          customFields: null,
        };
      });

      return mapped;
    },
    enabled: !!user?.email,
    refetchInterval: 60000,
  });
};

export const useSelectedDeal = (dealId: string | null) => {
  return useQuery({
    queryKey: ['sdr-cockpit-deal', dealId],
    queryFn: async () => {
      if (!dealId) return null;

      const { data: deal, error } = await supabase
        .from('crm_deals')
        .select(`
          id, name, stage_id, stage_moved_at, next_action_type, next_action_date, next_action_note,
          custom_fields, origin_id, contact_id, value,
          crm_contacts ( id, name, phone, email ),
          crm_stages ( id, stage_name ),
          crm_origins ( id, name )
        `)
        .eq('id', dealId)
        .single();

      if (error) throw error;

      // Get activities
      const { data: activities } = await supabase
        .from('deal_activities')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false })
        .limit(30);

      // Count call attempts with nao_atendeu
      const callAttempts = (activities || []).filter(
        a => a.activity_type === 'call_result' && 
             (a.metadata as any)?.result === 'nao_atendeu'
      ).length;

      const contact = (deal as any).crm_contacts;
      const stage = (deal as any).crm_stages;
      const origin = (deal as any).crm_origins;
      const stageMovedAt = deal.stage_moved_at ? new Date(deal.stage_moved_at) : null;
      const now = new Date();
      const hoursInStage = stageMovedAt ? (now.getTime() - stageMovedAt.getTime()) / (1000 * 60 * 60) : 999;
      const nextDate = deal.next_action_date ? new Date(deal.next_action_date) : null;
      const actCount = (activities || []).length;

      return {
        id: deal.id,
        name: deal.name || contact?.name || 'Lead',
        contactName: contact?.name || null,
        contactPhone: contact?.phone || null,
        contactEmail: contact?.email || null,
        contactId: deal.contact_id,
        stageName: stage?.stage_name || 'Desconhecido',
        stageId: deal.stage_id,
        stageMovedAt: deal.stage_moved_at,
        nextActionDate: deal.next_action_date,
        nextActionType: deal.next_action_type,
        nextActionNote: deal.next_action_note,
        activityCount: actCount,
        isOverdue: !!(nextDate && nextDate < now),
        isNew: actCount === 0,
        isStalledOver4h: hoursInStage >= 4 && actCount > 0,
        hoursInStage,
        originName: origin?.name || null,
        originId: deal.origin_id,
        customFields: deal.custom_fields as Record<string, any> | null,
        dealValue: deal.value ?? null,
        activities: activities || [],
        callAttempts,
      } as SelectedDealData;
    },
    enabled: !!dealId,
  });
};
