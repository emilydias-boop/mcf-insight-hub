import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GR_PRODUCTS } from '@/types/gr-types';

// Hook para distribuição por produto
export const useGRProductDistribution = (walletId: string) => {
  return useQuery({
    queryKey: ['gr-product-distribution', walletId],
    queryFn: async () => {
      const { data: entries, error } = await supabase
        .from('gr_wallet_entries')
        .select('recommended_products, product_purchased')
        .eq('wallet_id', walletId);
      
      if (error) throw error;
      if (!entries || entries.length === 0) return [];
      
      // Count products
      const productCounts: Record<string, number> = {};
      
      entries.forEach(entry => {
        // Count purchased product first
        if (entry.product_purchased) {
          productCounts[entry.product_purchased] = (productCounts[entry.product_purchased] || 0) + 1;
        } else if (entry.recommended_products && entry.recommended_products.length > 0) {
          // If no purchase, count first recommended
          const firstRecommended = entry.recommended_products[0];
          productCounts[firstRecommended] = (productCounts[firstRecommended] || 0) + 1;
        }
      });
      
      const total = Object.values(productCounts).reduce((sum, count) => sum + count, 0);
      
      return Object.entries(productCounts)
        .map(([code, count]) => ({
          code,
          name: GR_PRODUCTS.find(p => p.code === code)?.name || code,
          count,
          percentage: total > 0 ? (count / total) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count);
    },
    enabled: !!walletId,
  });
};

// Hook para agenda do GR
export const useGRAgenda = (walletId: string, grUserId: string) => {
  return useQuery({
    queryKey: ['gr-agenda', walletId, grUserId],
    queryFn: async () => {
      // Get entries for customer names
      const { data: entries, error: entriesError } = await supabase
        .from('gr_wallet_entries')
        .select('id, customer_name')
        .eq('wallet_id', walletId);
      
      if (entriesError) throw entriesError;
      
      const entryMap = new Map(entries?.map(e => [e.id, e.customer_name]) || []);
      const entryIds = entries?.map(e => e.id) || [];
      
      if (entryIds.length === 0) return [];
      
      // Get actions that are meetings
      const { data: actions, error: actionsError } = await supabase
        .from('gr_actions')
        .select('*')
        .in('entry_id', entryIds)
        .in('action_type', ['reuniao_agendada', 'reuniao_realizada'])
        .order('created_at', { ascending: false });
      
      if (actionsError) throw actionsError;
      
      const now = new Date();
      
      return actions?.map(action => {
        // Safely extract scheduled_at from metadata
        const metadata = action.metadata as Record<string, unknown> | null;
        const metadataScheduledAt = metadata?.scheduled_at;
        const scheduledAt = typeof metadataScheduledAt === 'string'
          ? new Date(metadataScheduledAt)
          : new Date(action.created_at);
        
        let type: 'scheduled' | 'completed' | 'pending' = 'scheduled';
        
        if (action.action_type === 'reuniao_realizada') {
          type = 'completed';
        } else if (scheduledAt < now) {
          type = 'pending';
        }
        
        return {
          id: action.id,
          entry_id: action.entry_id,
          customer_name: entryMap.get(action.entry_id) || 'Cliente',
          description: action.description || 'Reunião',
          scheduled_at: scheduledAt.toISOString(),
          completed_at: action.action_type === 'reuniao_realizada' 
            ? action.created_at 
            : null,
          type,
        };
      }) || [];
    },
    enabled: !!walletId && !!grUserId,
  });
};

// Hook para dados financeiros
export const useGRFinancialData = (walletId: string) => {
  return useQuery({
    queryKey: ['gr-financial-data', walletId],
    queryFn: async () => {
      const { data: entries, error } = await supabase
        .from('gr_wallet_entries')
        .select('*')
        .eq('wallet_id', walletId)
        .not('purchase_value', 'is', null);
      
      if (error) throw error;
      
      // Group by product
      const byProduct: Record<string, { total: number; count: number }> = {};
      
      entries?.forEach(entry => {
        const product = entry.product_purchased || 'outro';
        if (!byProduct[product]) {
          byProduct[product] = { total: 0, count: 0 };
        }
        byProduct[product].total += entry.purchase_value || 0;
        byProduct[product].count += 1;
      });
      
      return {
        entries: entries || [],
        byProduct: Object.entries(byProduct).map(([code, data]) => ({
          code,
          name: GR_PRODUCTS.find(p => p.code === code)?.name || code,
          total: data.total,
          count: data.count,
        })),
      };
    },
    enabled: !!walletId,
  });
};

// Hook para log de auditoria
export const useGRAuditLog = (walletId: string) => {
  return useQuery({
    queryKey: ['gr-audit-log', walletId],
    queryFn: async () => {
      // Get transfers
      const { data: transfers, error: transfersError } = await supabase
        .from('gr_transfers_log')
        .select('*')
        .or(`from_wallet_id.eq.${walletId},to_wallet_id.eq.${walletId}`)
        .order('created_at', { ascending: false });
      
      if (transfersError) throw transfersError;
      
      // Get status change actions
      const { data: entries, error: entriesError } = await supabase
        .from('gr_wallet_entries')
        .select('id')
        .eq('wallet_id', walletId);
      
      if (entriesError) throw entriesError;
      
      const entryIds = entries?.map(e => e.id) || [];
      
      let statusActions: any[] = [];
      if (entryIds.length > 0) {
        const { data: actions, error: actionsError } = await supabase
          .from('gr_actions')
          .select('*')
          .in('entry_id', entryIds)
          .eq('action_type', 'status_change')
          .order('created_at', { ascending: false });
        
        if (!actionsError && actions) {
          statusActions = actions;
        }
      }
      
      // Combine and format
      const transferLogs = transfers?.map(t => ({
        id: t.id,
        type: 'transfer' as const,
        description: t.from_wallet_id === walletId 
          ? `Lead transferido para outro GR`
          : `Lead recebido de outro GR`,
        details: t.reason,
        performed_by_name: null as string | null,
        created_at: t.created_at,
      })) || [];
      
      const statusLogs = statusActions.map(a => {
        const metadata = a.metadata as Record<string, unknown> | null;
        return {
          id: a.id,
          type: 'status_change' as const,
          description: a.description || 'Status alterado',
          details: metadata?.from_status 
            ? `De "${metadata.from_status}" para "${metadata.to_status}"`
            : null,
          performed_by_name: null as string | null,
          created_at: a.created_at,
        };
      });
      
      // Sort all by date
      return [...transferLogs, ...statusLogs]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
    enabled: !!walletId,
  });
};
