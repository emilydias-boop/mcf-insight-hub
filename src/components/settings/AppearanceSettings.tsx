import { useAppearance } from '@/contexts/AppearanceContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AppearanceSettings() {
  const { fontSize, setFontSize, theme, setTheme } = useAppearance();

  const fontSizes = [
    { value: 'small' as const, label: 'Pequeno', size: 'text-sm' },
    { value: 'medium' as const, label: 'Médio', size: 'text-base' },
    { value: 'large' as const, label: 'Grande', size: 'text-lg' },
  ];

  const themes = [
    { value: 'light' as const, label: 'Claro', icon: Sun },
    { value: 'dark' as const, label: 'Escuro', icon: Moon },
  ];

  return (
    <div className="space-y-6">
      {/* Theme Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Tema</CardTitle>
          <CardDescription>Escolha entre o tema claro ou escuro</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            {themes.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all min-w-[100px]',
                  theme === value
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-muted-foreground/50'
                )}
              >
                <Icon className={cn('h-6 w-6', theme === value ? 'text-primary' : 'text-muted-foreground')} />
                <span className={cn('text-sm font-medium', theme === value ? 'text-primary' : 'text-muted-foreground')}>
                  {label}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Font Size Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Tamanho da Fonte</CardTitle>
          <CardDescription>Ajuste o tamanho do texto em toda a aplicação</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            {fontSizes.map(({ value, label, size }) => (
              <button
                key={value}
                onClick={() => setFontSize(value)}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all min-w-[100px]',
                  fontSize === value
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-muted-foreground/50'
                )}
              >
                <span className={cn(size, 'font-bold', fontSize === value ? 'text-primary' : 'text-muted-foreground')}>
                  A
                </span>
                <span className={cn('text-sm font-medium', fontSize === value ? 'text-primary' : 'text-muted-foreground')}>
                  {label}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
