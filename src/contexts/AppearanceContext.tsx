import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type FontSize = 'small' | 'medium' | 'large';
type Theme = 'dark' | 'light';

interface AppearanceContextType {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isLoading: boolean;
}

const AppearanceContext = createContext<AppearanceContextType | undefined>(undefined);

const FONT_SIZE_KEY = 'font-size-preference';
const THEME_KEY = 'theme-preference';

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  
  // Initialize from localStorage for immediate rendering
  const [fontSize, setFontSizeState] = useState<FontSize>(() => {
    const saved = localStorage.getItem(FONT_SIZE_KEY);
    return (saved as FontSize) || 'small';
  });

  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return (saved as Theme) || 'dark';
  });

  // Check auth status
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch preferences from database when authenticated
  const { data: dbPreferences, isLoading } = useQuery({
    queryKey: ['appearance-preferences', userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('dashboard_preferences')
        .select('theme, font_size')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  // Sync from database when preferences are loaded
  useEffect(() => {
    if (dbPreferences) {
      const dbTheme = (dbPreferences.theme as Theme) || 'dark';
      const dbFontSize = (dbPreferences.font_size as FontSize) || 'small';
      
      setThemeState(dbTheme);
      setFontSizeState(dbFontSize);
      
      // Update localStorage cache
      localStorage.setItem(THEME_KEY, dbTheme);
      localStorage.setItem(FONT_SIZE_KEY, dbFontSize);
    }
  }, [dbPreferences]);

  // Mutation to save preferences
  const savePreferences = useMutation({
    mutationFn: async (prefs: { theme?: Theme; font_size?: FontSize }) => {
      if (!userId) return;

      const { error } = await supabase
        .from('dashboard_preferences')
        .upsert({
          user_id: userId,
          ...prefs,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appearance-preferences', userId] });
    },
  });

  // Apply font size class to html element
  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove('font-small', 'font-medium', 'font-large');
    html.classList.add(`font-${fontSize}`);
    localStorage.setItem(FONT_SIZE_KEY, fontSize);
  }, [fontSize]);

  // Apply theme class to html element
  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove('dark', 'light');
    html.classList.add(theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const setFontSize = (size: FontSize) => {
    setFontSizeState(size);
    localStorage.setItem(FONT_SIZE_KEY, size);
    if (userId) {
      savePreferences.mutate({ font_size: size });
    }
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_KEY, newTheme);
    if (userId) {
      savePreferences.mutate({ theme: newTheme });
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };

  return (
    <AppearanceContext.Provider value={{ fontSize, setFontSize, theme, setTheme, toggleTheme, isLoading }}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (context === undefined) {
    throw new Error('useAppearance must be used within an AppearanceProvider');
  }
  return context;
}
