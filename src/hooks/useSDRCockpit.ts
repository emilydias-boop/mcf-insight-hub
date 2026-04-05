import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Stages to exclude from SDR cockpit
const EXCLUDED_STAGE_NAMES = [
  'r1 realizada',
  'contrato pago',
  'r2 agendada',
  'r2 realizada',
  'venda realizada',
  'sem interesse',
];

export type LeadState = 'novo' | 'em_ligacao' | 'nao_atendeu' | 'qualificado' | 'agendando' | 'agendado' | 'retorno' | 'perdido';

export interface QueueDeal {
  id: string;
  name: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  stageName: string;
  stageId: string;
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

      // Get stages to exclude
      const { data: stages } = await supabase
        .from('crm_stages')
        .select('id, stage_name');

      const excludedIds = (stages || [])
        .filter(s => EXCLUDED_STAGE_NAMES.includes(s.stage_name.toLowerCase()))
        .map(s => s.id);

      // Main query
      const { data: deals, error } = await supabase
        .from('crm_deals')
        .select(`
          id, name, stage_id, stage_moved_at, next_action_type, next_action_date, next_action_note, 
          custom_fields, origin_id,
          crm_contacts ( id, name, phone, email ),
          crm_stages ( id, stage_name ),
          crm_origins ( id, name )
        `)
        .eq('owner_id', user.email)
        .not('stage_id', 'in', `(${excludedIds.join(',')})`)
        .order('stage_moved_at', { ascending: true, nullsFirst: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      const now = new Date();

      // Get activity counts in batch
      const dealIds = (deals || []).map(d => d.id);
      const { data: activityCounts } = await supabase
        .from('deal_activities')
        .select('deal_id')
        .in('deal_id', dealIds);

      const countMap: Record<string, number> = {};
      (activityCounts || []).forEach(a => {
        countMap[a.deal_id] = (countMap[a.deal_id] || 0) + 1;
      });

      const mapped: QueueDeal[] = (deals || []).map((deal: any) => {
        const contact = deal.crm_contacts;
        const stage = deal.crm_stages;
        const origin = deal.crm_origins;
        const stageMovedAt = deal.stage_moved_at ? new Date(deal.stage_moved_at) : null;
        const hoursInStage = stageMovedAt ? (now.getTime() - stageMovedAt.getTime()) / (1000 * 60 * 60) : 999;
        const actCount = countMap[deal.id] || 0;
        const nextDate = deal.next_action_date ? new Date(deal.next_action_date) : null;

        return {
          id: deal.id,
          name: deal.name || contact?.name || 'Lead',
          contactName: contact?.name || null,
          contactPhone: contact?.phone || null,
          contactEmail: contact?.email || null,
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
        };
      });

      // Sort by priority
      mapped.sort((a, b) => {
        // 1. Overdue first
        if (a.isOverdue && !b.isOverdue) return -1;
        if (!a.isOverdue && b.isOverdue) return 1;
        // 2. New leads (no activities)
        if (a.isNew && !b.isNew) return -1;
        if (!a.isNew && b.isNew) return 1;
        // 3. Stalled 4h+
        if (a.isStalledOver4h && !b.isStalledOver4h) return -1;
        if (!a.isStalledOver4h && b.isStalledOver4h) return 1;
        // 4. stage_moved_at ASC
        const aTime = a.stageMovedAt ? new Date(a.stageMovedAt).getTime() : Infinity;
        const bTime = b.stageMovedAt ? new Date(b.stageMovedAt).getTime() : Infinity;
        return aTime - bTime;
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
          custom_fields, origin_id, contact_id,
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
        dealValue: null,
        activities: activities || [],
        callAttempts,
      } as SelectedDealData;
    },
    enabled: !!dealId,
  });
};
