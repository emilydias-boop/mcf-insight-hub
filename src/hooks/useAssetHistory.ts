import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AssetHistory } from '@/types/patrimonio';

// Fetch history for an asset
export const useAssetHistory = (assetId: string | undefined) => {
  return useQuery({
    queryKey: ['asset-history', assetId],
    queryFn: async () => {
      if (!assetId) return [];
      
      const { data, error } = await supabase
        .from('asset_history')
        .select('*')
        .eq('asset_id', assetId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profile names for created_by users
      const userIds = [...new Set((data || []).map(d => d.created_by).filter(Boolean))] as string[];
      let profilesMap: Record<string, { full_name: string | null; email: string | null }> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);
        
        if (profiles) {
          profilesMap = Object.fromEntries(profiles.map(p => [p.id, { full_name: p.full_name, email: p.email }]));
        }
      }

      return (data || []).map(h => ({
        ...h,
        profile: h.created_by ? profilesMap[h.created_by] || null : null,
      })) as AssetHistory[];
    },
    enabled: !!assetId,
  });
};
