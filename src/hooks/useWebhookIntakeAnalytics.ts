import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WebhookLeadDetail {
  deal_id: string;
  deal_name: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  stage_name: string;
  stage_id: string;
  owner_name: string;
  owner_id: string | null;
  value: number;
  tags: string[];
  created_at: string;
  updated_at: string;
  custom_fields: Record<string, any>;
}

export interface WebhookIntakeKPIs {
  total: number;
  withOwner: number;
  withoutOwner: number;
  advanced: number; // left initial stage
  byStage: Record<string, { count: number; stageName: string }>;
}

export interface WebhookIntakeData {
  leads: WebhookLeadDetail[];
  kpis: WebhookIntakeKPIs;
  owners: string[];
  stages: string[];
}

export const useWebhookIntakeAnalytics = (
  slug: string | null,
  startDate?: Date,
  endDate?: Date
) => {
  return useQuery({
    queryKey: ['webhook-intake-analytics', slug, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async (): Promise<WebhookIntakeData> => {
      if (!slug) return { leads: [], kpis: { total: 0, withOwner: 0, withoutOwner: 0, advanced: 0, byStage: {} }, owners: [], stages: [] };

      let query = supabase
        .from('crm_deals')
        .select(`
          id, name, value, stage_id, owner_id, owner_profile_id, tags, custom_fields, created_at, updated_at,
          crm_contacts (name, phone, email),
          crm_stages (stage_name, stage_order),
          profiles:owner_profile_id (full_name)
        `)
        .eq('data_source', 'webhook')
        .filter('custom_fields->>lead_channel', 'eq', slug);

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query = query.lte('created_at', end.toISOString());
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      const leads: WebhookLeadDetail[] = (data || []).map((d: any) => ({
        deal_id: d.id,
        deal_name: d.name,
        contact_name: d.crm_contacts?.name || '-',
        contact_phone: d.crm_contacts?.phone || '-',
        contact_email: d.crm_contacts?.email || '-',
        stage_name: d.crm_stages?.stage_name || 'Sem estágio',
        stage_id: d.stage_id || '',
        owner_name: d.profiles?.full_name || 'Sem dono',
        owner_id: d.owner_profile_id,
        value: d.value || 0,
        tags: d.tags || [],
        created_at: d.created_at,
        updated_at: d.updated_at,
        custom_fields: d.custom_fields || {},
      }));

      // Find the minimum stage_order to determine initial stage
      const stageOrders = (data || [])
        .map((d: any) => d.crm_stages?.stage_order)
        .filter((o: any) => o !== null && o !== undefined);
      const minOrder = stageOrders.length > 0 ? Math.min(...stageOrders) : 0;

      // KPIs
      const byStage: Record<string, { count: number; stageName: string }> = {};
      let withOwner = 0;
      let advanced = 0;

      for (const d of data || []) {
        const stageName = (d as any).crm_stages?.stage_name || 'Sem estágio';
        const stageId = d.stage_id || 'none';
        const stageOrder = (d as any).crm_stages?.stage_order ?? 0;

        if (!byStage[stageId]) {
          byStage[stageId] = { count: 0, stageName };
        }
        byStage[stageId].count++;

        if (d.owner_profile_id) withOwner++;
        if (stageOrder > minOrder) advanced++;
      }

      const uniqueOwners = [...new Set(leads.map(l => l.owner_name).filter(n => n !== 'Sem dono'))];
      const uniqueStages = [...new Set(leads.map(l => l.stage_name))];

      return {
        leads,
        kpis: {
          total: leads.length,
          withOwner,
          withoutOwner: leads.length - withOwner,
          advanced,
          byStage,
        },
        owners: uniqueOwners,
        stages: uniqueStages,
      };
    },
    enabled: !!slug,
  });
};
