import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface MoonProgressProps {
  value: number;
  max: number;
  color: string;
  size?: number;
  strokeWidth?: number;
  animate?: boolean;
  className?: string;
}

export function MoonProgress({
  value,
  max,
  color,
  size = 180,
  strokeWidth = 12,
  animate = true,
  className,
}: MoonProgressProps) {
  const [animatedProgress, setAnimatedProgress] = useState(animate ? 0 : value);
  
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min((animatedProgress / max) * 100, 100);
  const offset = circumference - (progress / 100) * circumference;
  const isComplete = progress >= 100;

  useEffect(() => {
    if (!animate) {
      setAnimatedProgress(value);
      return;
    }

    // Animate from 0 to value
    const duration = 1500;
    const startTime = performance.now();
    const startValue = 0;
    const endValue = value;

    const animateValue = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentValue = startValue + (endValue - startValue) * easeOut;
      
      setAnimatedProgress(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animateValue);
      }
    };

    requestAnimationFrame(animateValue);
  }, [value, animate]);

  return (
    <div 
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          className="opacity-30"
        />
        
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(
            "transition-all duration-300",
            isComplete && "drop-shadow-[0_0_12px_var(--glow-color)]"
          )}
          style={{
            '--glow-color': color,
          } as React.CSSProperties}
        />
      </svg>
      
      {/* Glow effect when complete */}
      {isComplete && (
        <div 
          className="absolute inset-0 rounded-full animate-pulse opacity-20"
          style={{ 
            background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
          }}
        />
      )}
    </div>
  );
}
