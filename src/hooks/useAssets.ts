import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  Asset, 
  AssetWithAssignment, 
  CreateAssetInput, 
  UpdateAssetInput,
  AssetStats,
  AssetStatus,
  AssetType
} from '@/types/patrimonio';
import { toast } from 'sonner';

// Fetch all assets with optional filters
interface AssetFilters {
  status?: AssetStatus;
  tipo?: AssetType;
  search?: string;
}

export const useAssets = (filters?: AssetFilters) => {
  return useQuery({
    queryKey: ['assets', filters],
    queryFn: async () => {
      let query = supabase
        .from('assets')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.tipo) {
        query = query.eq('tipo', filters.tipo);
      }
      if (filters?.search) {
        query = query.or(`numero_patrimonio.ilike.%${filters.search}%,marca.ilike.%${filters.search}%,modelo.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Asset[];
    },
  });
};

// Fetch single asset with current assignment
export const useAsset = (id: string | undefined) => {
  return useQuery({
    queryKey: ['asset', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data: asset, error: assetError } = await supabase
        .from('assets')
        .select('*')
        .eq('id', id)
        .single();

      if (assetError) throw assetError;

      // Fetch current active assignment
      const { data: assignment } = await supabase
        .from('asset_assignments')
        .select(`
          *,
          employee:employees(id, nome_completo, email_pessoal, departamento, cargo)
        `)
        .eq('asset_id', id)
        .eq('status', 'ativo')
        .maybeSingle();

      return {
        ...asset,
        current_assignment: assignment,
      } as AssetWithAssignment;
    },
    enabled: !!id,
  });
};

// Fetch asset stats for dashboard
export const useAssetStats = () => {
  return useQuery({
    queryKey: ['asset-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assets')
        .select('status');

      if (error) throw error;

      const stats: AssetStats = {
        total: data.length,
        em_estoque: data.filter(a => a.status === 'em_estoque').length,
        em_uso: data.filter(a => a.status === 'em_uso').length,
        em_manutencao: data.filter(a => a.status === 'em_manutencao').length,
        devolvido: data.filter(a => a.status === 'devolvido').length,
        baixado: data.filter(a => a.status === 'baixado').length,
      };

      return stats;
    },
  });
};

// Asset mutations
export const useAssetMutations = () => {
  const queryClient = useQueryClient();

  const createAsset = useMutation({
    mutationFn: async (input: CreateAssetInput) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('assets')
        .insert({
          ...input,
          numero_patrimonio: 'AUTO', // Will be overwritten by DB trigger
          status: 'em_estoque',
          created_by: userData.user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Register history event
      await supabase.from('asset_history').insert({
        asset_id: data.id,
        tipo_evento: 'comprado',
        descricao: 'Equipamento cadastrado no sistema',
        dados_novos: data,
        created_by: userData.user?.id,
      });

      return data as Asset;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset-stats'] });
      toast.success('Equipamento cadastrado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao cadastrar: ${error.message}`);
    },
  });

  const updateAsset = useMutation({
    mutationFn: async ({ id, ...input }: UpdateAssetInput & { id: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      // Get current data for history
      const { data: oldData } = await supabase
        .from('assets')
        .select('*')
        .eq('id', id)
        .single();

      const { data, error } = await supabase
        .from('assets')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Register history if status changed
      if (oldData?.status !== data.status) {
        const eventType = data.status === 'em_manutencao' ? 'manutencao' 
          : data.status === 'baixado' ? 'baixa' 
          : data.status === 'devolvido' ? 'devolucao'
          : null;

        if (eventType) {
          await supabase.from('asset_history').insert({
            asset_id: id,
            tipo_evento: eventType,
            descricao: `Status alterado para ${data.status}`,
            dados_anteriores: oldData,
            dados_novos: data,
            created_by: userData.user?.id,
          });
        }
      }

      return data as Asset;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset'] });
      queryClient.invalidateQueries({ queryKey: ['asset-stats'] });
      toast.success('Equipamento atualizado!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  const deleteAsset = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('assets')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset-stats'] });
      toast.success('Equipamento removido!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover: ${error.message}`);
    },
  });

  return {
    createAsset,
    updateAsset,
    deleteAsset,
  };
};
