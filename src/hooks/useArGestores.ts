import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useArGestores() {
  return useQuery({
    queryKey: ['ar-gestores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ar_gestores' as any)
        .select('user_id');
      if (error) throw error;
      return ((data as any[]) || []).map(r => r.user_id as string);
    },
  });
}

export function useCanManageAr() {
  const { user, role, loading } = useAuth();
  const { data: gestores, isLoading } = useArGestores();
  const isAdmin = role === 'admin';
  const isDelegate = !!user && !!gestores?.includes(user.id);
  return { canManage: isAdmin || isDelegate, isAdmin, loading: loading || isLoading };
}

export function useAddArGestor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (user_id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('ar_gestores' as any)
        .insert({ user_id, created_by: user?.id ?? null } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ar-gestores'] }),
  });
}

export function useRemoveArGestor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (user_id: string) => {
      const { error } = await supabase
        .from('ar_gestores' as any)
        .delete()
        .eq('user_id', user_id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ar-gestores'] }),
  });
}

/** All profiles (for admin picker) */
export function useAllProfiles() {
  return useQuery({
    queryKey: ['all-profiles-basic'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name', { ascending: true });
      if (error) throw error;
      return (data ?? []).map(p => ({
        id: p.id,
        full_name: p.full_name || p.email || '(sem nome)',
        email: p.email || '',
      }));
    },
  });
}