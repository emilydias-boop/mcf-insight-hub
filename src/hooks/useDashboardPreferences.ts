import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DashboardPreferences } from "@/types/dashboard";
import { DEFAULT_PREFERENCES } from "@/lib/dashboardTemplates";
import { useAuth } from "@/contexts/AuthContext";

export function useDashboardPreferences() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery({
    queryKey: ['dashboard-preferences', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('dashboard_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      // Se não existir preferências, retornar as padrões
      if (!data) {
        return {
          ...DEFAULT_PREFERENCES,
          user_id: user.id,
        } as unknown as DashboardPreferences;
      }

      return data as DashboardPreferences;
    },
    enabled: !!user?.id,
  });

  const updatePreferences = useMutation({
    mutationFn: async (newPrefs: Partial<DashboardPreferences>) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('dashboard_preferences')
        .upsert({
          user_id: user.id,
          ...newPrefs,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-preferences'] });
      toast({
        title: 'Preferências salvas',
        description: 'Suas preferências do dashboard foram atualizadas com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao salvar preferências',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    preferences,
    isLoading,
    updatePreferences: updatePreferences.mutate,
    isUpdating: updatePreferences.isPending,
  };
}
