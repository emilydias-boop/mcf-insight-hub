import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Theme = 'dark' | 'light';
type FontSize = 'small' | 'medium' | 'large';

interface AppearancePreferences {
  theme: Theme;
  font_size: FontSize;
}

export function useAppearancePreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery({
    queryKey: ['appearance-preferences', user?.id],
    queryFn: async (): Promise<AppearancePreferences | null> => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('dashboard_preferences')
        .select('theme, font_size')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        return { theme: 'dark', font_size: 'small' };
      }

      return {
        theme: (data.theme as Theme) || 'dark',
        font_size: (data.font_size as FontSize) || 'small',
      };
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const updatePreferences = useMutation({
    mutationFn: async (newPrefs: Partial<AppearancePreferences>) => {
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
      queryClient.invalidateQueries({ queryKey: ['appearance-preferences', user?.id] });
    },
  });

  return {
    preferences,
    isLoading,
    updatePreferences: updatePreferences.mutate,
    isUpdating: updatePreferences.isPending,
  };
}
