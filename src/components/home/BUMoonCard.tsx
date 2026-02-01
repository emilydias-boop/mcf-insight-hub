import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { MoonProgress } from './MoonProgress';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

interface BUMoonCardProps {
  name: string;
  icon: LucideIcon;
  value: number;
  target: number;
  color: string;
  href: string;
  isLoading?: boolean;
}

const formatCurrency = (value: number) => {
  if (value >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `R$ ${(value / 1_000).toFixed(0)}k`;
  }
  return `R$ ${value.toFixed(0)}`;
};

export function BUMoonCard({
  name,
  icon: Icon,
  value,
  target,
  color,
  href,
  isLoading = false,
}: BUMoonCardProps) {
  const percentage = target > 0 ? Math.min((value / target) * 100, 100) : 0;

  return (
    <Link to={href} className="block group">
      <Card className={cn(
        "relative overflow-hidden transition-all duration-300",
        "hover:shadow-lg hover:shadow-primary/10 hover:scale-[1.02]",
        "bg-card border-border/50"
      )}>
        <CardContent className="p-6 flex flex-col items-center gap-4">
          {/* Moon Progress with Icon */}
          <div className="relative">
            <MoonProgress
              value={isLoading ? 0 : value}
              max={target}
              color={color}
              size={160}
              strokeWidth={10}
              animate={!isLoading}
            />
            
            {/* Icon in center */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div 
                className={cn(
                  "p-4 rounded-full transition-all duration-300",
                  "bg-background/80 backdrop-blur-sm",
                  "group-hover:scale-110"
                )}
                style={{ color }}
              >
                <Icon className="w-8 h-8" />
              </div>
            </div>
          </div>

          {/* BU Name */}
          <h3 className="text-lg font-semibold text-foreground">{name}</h3>

          {/* Values */}
          <div className="text-center space-y-1">
            <p className="text-2xl font-bold" style={{ color }}>
              {isLoading ? '...' : formatCurrency(value)}
            </p>
            <p className="text-sm text-muted-foreground">
              Meta: {formatCurrency(target)}
            </p>
          </div>

          {/* Progress percentage */}
          <div className={cn(
            "px-3 py-1 rounded-full text-sm font-medium",
            percentage >= 100 
              ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
              : "bg-muted text-muted-foreground"
          )}>
            {isLoading ? '...' : `${percentage.toFixed(0)}%`}
          </div>
        </CardContent>

        {/* Decorative gradient on hover */}
        <div 
          className={cn(
            "absolute inset-0 opacity-0 transition-opacity duration-300",
            "group-hover:opacity-5 pointer-events-none"
          )}
          style={{
            background: `radial-gradient(circle at center, ${color} 0%, transparent 70%)`,
          }}
        />
      </Card>
    </Link>
  );
}
