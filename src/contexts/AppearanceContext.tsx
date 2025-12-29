import React, { createContext, useContext, useEffect, useState } from 'react';

type FontSize = 'small' | 'medium' | 'large';
type Theme = 'dark' | 'light';

interface AppearanceContextType {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const AppearanceContext = createContext<AppearanceContextType | undefined>(undefined);

const FONT_SIZE_KEY = 'font-size-preference';
const THEME_KEY = 'theme-preference';

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [fontSize, setFontSizeState] = useState<FontSize>(() => {
    const saved = localStorage.getItem(FONT_SIZE_KEY);
    return (saved as FontSize) || 'small';
  });

  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return (saved as Theme) || 'dark';
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
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <AppearanceContext.Provider value={{ fontSize, setFontSize, theme, setTheme, toggleTheme }}>
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
