import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { GRWallet, GRWalletEntry, GREntryStatus } from '@/types/gr-types';

// Hook para buscar carteira do GR logado
export const useMyGRWallet = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['my-gr-wallet', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('gr_wallets')
        .select('*')
        .eq('gr_user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as GRWallet | null;
    },
    enabled: !!user?.id,
  });
};

// Hook para buscar todas as carteiras (gestor)
export const useAllGRWallets = () => {
  return useQuery({
    queryKey: ['all-gr-wallets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gr_wallets')
        .select(`
          *,
          profiles:gr_user_id (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      return (data || []).map((w: any) => ({
        ...w,
        gr_name: w.profiles?.full_name,
        gr_email: w.profiles?.email,
      })) as GRWallet[];
    },
  });
};

// Hook para buscar entradas da carteira
export const useGRWalletEntries = (walletId?: string, status?: GREntryStatus) => {
  return useQuery({
    queryKey: ['gr-wallet-entries', walletId, status],
    queryFn: async () => {
      let query = supabase
        .from('gr_wallet_entries')
        .select(`
          *,
          wallet:wallet_id (
            id,
            gr_user_id,
            bu
          )
        `)
        .order('entry_date', { ascending: false });
      
      if (walletId) {
        query = query.eq('wallet_id', walletId);
      }
      
      if (status) {
        query = query.eq('status', status);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as GRWalletEntry[];
    },
    enabled: !!walletId || walletId === undefined, // Se não passar walletId, busca tudo (gestor)
  });
};

// Hook para criar carteira
export const useCreateGRWallet = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { gr_user_id: string; bu?: string; max_capacity?: number }) => {
      const { data: result, error } = await supabase
        .from('gr_wallets')
        .insert({
          gr_user_id: data.gr_user_id,
          bu: data.bu || 'incorporador',
          max_capacity: data.max_capacity || 50,
        })
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-gr-wallets'] });
      toast.success('Carteira criada com sucesso');
    },
    onError: (error: any) => {
      toast.error(`Erro ao criar carteira: ${error.message}`);
    },
  });
};

// Hook para atualizar carteira (abrir/fechar, capacidade)
export const useUpdateGRWallet = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<GRWallet> & { id: string }) => {
      const { data: result, error } = await supabase
        .from('gr_wallets')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-gr-wallets'] });
      queryClient.invalidateQueries({ queryKey: ['my-gr-wallet'] });
      toast.success('Carteira atualizada');
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar carteira: ${error.message}`);
    },
  });
};

// Hook para atualizar entrada na carteira
export const useUpdateGREntry = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<GRWalletEntry> & { id: string }) => {
      const { data: result, error } = await supabase
        .from('gr_wallet_entries')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gr-wallet-entries'] });
      toast.success('Cliente atualizado');
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });
};

// Hook para criar entrada manual
export const useCreateGREntry = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Omit<GRWalletEntry, 'id' | 'created_at' | 'updated_at'>) => {
      const { data: result, error } = await supabase
        .from('gr_wallet_entries')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gr-wallet-entries'] });
      queryClient.invalidateQueries({ queryKey: ['all-gr-wallets'] });
      toast.success('Cliente adicionado à carteira');
    },
    onError: (error: any) => {
      toast.error(`Erro ao adicionar cliente: ${error.message}`);
    },
  });
};
