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
      return data as AssetHistory[];
    },
    enabled: !!assetId,
  });
};
