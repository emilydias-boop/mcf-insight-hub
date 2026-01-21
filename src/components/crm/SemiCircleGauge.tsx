import { useMemo } from 'react';

interface SemiCircleGaugeProps {
  value: number; // 0-100
  label: string;
  sublabel: string;
  color?: string;
  size?: number;
}

export function SemiCircleGauge({ 
  value, 
  label, 
  sublabel, 
  color = '#3B82F6',
  size = 120 
}: SemiCircleGaugeProps) {
  const { gaugeColor, strokeDasharray, strokeDashoffset } = useMemo(() => {
    // Determine color based on percentage
    let gaugeColor: string;
    if (value <= 30) {
      gaugeColor = '#EF4444'; // Red
    } else if (value <= 60) {
      gaugeColor = '#F59E0B'; // Yellow/Amber
    } else {
      gaugeColor = '#10B981'; // Green
    }

    // SVG arc calculations
    const radius = 40;
    const circumference = Math.PI * radius; // Half circle
    const offset = circumference - (value / 100) * circumference;

    return {
      gaugeColor,
      strokeDasharray: `${circumference} ${circumference}`,
      strokeDashoffset: offset,
    };
  }, [value]);

  return (
    <div 
      className="flex flex-col items-center p-4 rounded-xl bg-card border shadow-sm"
      style={{ minWidth: size + 40 }}
    >
      <div className="relative" style={{ width: size, height: size / 2 + 20 }}>
        <svg
          viewBox="0 0 100 60"
          className="w-full h-full"
          style={{ overflow: 'visible' }}
        >
          {/* Background arc */}
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Foreground arc (value) */}
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke={gaugeColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            style={{ 
              transition: 'stroke-dashoffset 0.5s ease-in-out',
              transformOrigin: 'center',
            }}
          />
          {/* Percentage text */}
          <text
            x="50"
            y="45"
            textAnchor="middle"
            className="fill-foreground font-bold"
            style={{ fontSize: '14px' }}
          >
            {value.toFixed(1)}%
          </text>
        </svg>
      </div>
      
      {/* Label */}
      <div className="text-center mt-1">
        <p 
          className="font-semibold text-sm truncate max-w-[120px]"
          style={{ color }}
        >
          {label}
        </p>
        <p className="text-xs text-muted-foreground">
          {sublabel}
        </p>
      </div>
    </div>
  );
}
