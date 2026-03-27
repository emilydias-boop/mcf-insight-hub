import { useState, useCallback } from 'react';
import { StateAnalysis } from '@/hooks/useCarrinhoAnalysisReport';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Simplified SVG paths for Brazilian states (centered viewBox)
const BRAZIL_STATES: Record<string, { path: string; labelX: number; labelY: number }> = {
  AC: { path: 'M95,280 L125,275 L130,295 L100,300Z', labelX: 112, labelY: 288 },
  AM: { path: 'M100,200 L200,180 L220,220 L210,260 L160,270 L120,260 L95,280 L80,240Z', labelX: 155, labelY: 230 },
  RR: { path: 'M160,130 L200,120 L210,160 L200,180 L165,185Z', labelX: 182, labelY: 155 },
  AP: { path: 'M270,140 L300,120 L310,155 L290,175 L265,170Z', labelX: 288, labelY: 150 },
  PA: { path: 'M200,180 L270,140 L265,170 L290,175 L340,200 L330,240 L290,260 L250,250 L220,260 L210,260 L220,220Z', labelX: 270, labelY: 215 },
  MA: { path: 'M340,200 L380,190 L390,220 L370,245 L330,240Z', labelX: 360, labelY: 218 },
  TO: { path: 'M330,240 L370,245 L365,300 L340,320 L310,300 L290,260Z', labelX: 332, labelY: 280 },
  RO: { path: 'M120,260 L160,270 L210,260 L220,260 L200,310 L170,320 L130,295Z', labelX: 170, labelY: 290 },
  MT: { path: 'M200,310 L220,260 L250,250 L290,260 L310,300 L300,350 L260,370 L220,360 L200,340Z', labelX: 255, labelY: 310 },
  PI: { path: 'M380,190 L410,195 L415,240 L395,265 L370,245Z', labelX: 395, labelY: 225 },
  CE: { path: 'M410,195 L445,180 L455,210 L435,225 L415,240Z', labelX: 435, labelY: 208 },
  RN: { path: 'M455,210 L475,200 L478,215 L460,222Z', labelX: 467, labelY: 212 },
  PB: { path: 'M445,222 L478,215 L480,230 L450,232Z', labelX: 462, labelY: 225 },
  PE: { path: 'M415,240 L435,225 L460,222 L450,232 L480,230 L478,245 L430,252Z', labelX: 450, labelY: 240 },
  AL: { path: 'M470,250 L485,245 L488,258 L475,262Z', labelX: 478, labelY: 254 },
  SE: { path: 'M465,262 L480,258 L482,272 L468,270Z', labelX: 474, labelY: 265 },
  BA: { path: 'M370,245 L395,265 L415,240 L430,252 L478,245 L470,250 L475,262 L468,270 L482,272 L470,320 L430,360 L390,350 L365,300Z', labelX: 420, labelY: 300 },
  GO: { path: 'M310,300 L340,320 L365,300 L390,350 L370,380 L340,385 L320,370 L300,350Z', labelX: 340, labelY: 345 },
  DF: { path: 'M345,348 L358,345 L360,355 L347,358Z', labelX: 352, labelY: 352 },
  MG: { path: 'M370,380 L390,350 L430,360 L470,320 L470,370 L450,400 L410,415 L380,410Z', labelX: 420, labelY: 380 },
  MS: { path: 'M220,360 L260,370 L300,350 L320,370 L310,400 L280,420 L250,410 L230,390Z', labelX: 270, labelY: 390 },
  ES: { path: 'M470,370 L490,365 L492,390 L475,395Z', labelX: 480, labelY: 380 },
  RJ: { path: 'M410,415 L450,400 L470,410 L460,425 L430,430Z', labelX: 445, labelY: 418 },
  SP: { path: 'M310,400 L340,385 L370,380 L380,410 L410,415 L430,430 L400,445 L350,440 L320,430Z', labelX: 365, labelY: 420 },
  PR: { path: 'M280,420 L310,400 L320,430 L350,440 L340,460 L300,465 L275,450Z', labelX: 310, labelY: 442 },
  SC: { path: 'M300,465 L340,460 L345,480 L310,490Z', labelX: 322, labelY: 475 },
  RS: { path: 'M275,450 L300,465 L310,490 L345,480 L340,510 L310,530 L280,520 L260,490Z', labelX: 300, labelY: 498 },
};

function getLossColor(taxaPerda: number): string {
  if (taxaPerda <= 0) return 'hsl(120, 60%, 45%)';
  if (taxaPerda >= 100) return 'hsl(0, 70%, 45%)';
  const hue = 120 - (taxaPerda / 100) * 120;
  return `hsl(${hue}, 65%, 48%)`;
}

interface BrazilMapProps {
  stateData: StateAnalysis[];
  onStateClick?: (uf: string) => void;
  selectedState?: string;
}

export function BrazilMap({ stateData, onStateClick, selectedState }: BrazilMapProps) {
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const stateMap = new Map(stateData.map(s => [s.uf, s]));

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }, []);

  const hoveredData = hoveredState ? stateMap.get(hoveredState) : null;

  return (
    <div className="relative">
      <svg
        viewBox="60 100 460 460"
        className="w-full max-w-[500px] mx-auto"
        onMouseMove={handleMouseMove}
      >
        {Object.entries(BRAZIL_STATES).map(([uf, { path, labelX, labelY }]) => {
          const data = stateMap.get(uf);
          const taxa = data?.taxaPerda ?? -1;
          const fill = taxa < 0 ? 'hsl(var(--muted))' : getLossColor(taxa);
          const isSelected = selectedState === uf;
          const isHovered = hoveredState === uf;

          return (
            <g key={uf}>
              <path
                d={path}
                fill={fill}
                stroke={isSelected ? 'hsl(var(--primary))' : isHovered ? 'hsl(var(--foreground))' : 'hsl(var(--border))'}
                strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 0.8}
                className="cursor-pointer transition-all duration-150"
                onMouseEnter={() => setHoveredState(uf)}
                onMouseLeave={() => setHoveredState(null)}
                onClick={() => onStateClick?.(uf)}
                opacity={data ? 1 : 0.4}
              />
              <text
                x={labelX}
                y={labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                className="pointer-events-none select-none"
                fill={data ? 'white' : 'hsl(var(--muted-foreground))'}
                fontSize="9"
                fontWeight="600"
              >
                {uf}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hoveredState && hoveredData && (
        <div
          className="fixed z-50 pointer-events-none bg-popover border border-border rounded-lg shadow-lg px-3 py-2 text-sm"
          style={{ left: tooltipPos.x + 12, top: tooltipPos.y - 10 }}
        >
          <div className="font-bold text-foreground mb-1">{hoveredState}</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
            <span className="text-muted-foreground">Contratos:</span>
            <span className="font-medium text-right">{hoveredData.contratos}</span>
            <span className="text-muted-foreground">Agendados:</span>
            <span className="font-medium text-right">{hoveredData.agendados}</span>
            <span className="text-muted-foreground">Realizados:</span>
            <span className="font-medium text-right text-green-600">{hoveredData.realizados}</span>
            <span className="text-muted-foreground">Perdidos:</span>
            <span className="font-medium text-right text-red-600">{hoveredData.perdidos}</span>
            <span className="text-muted-foreground">Taxa perda:</span>
            <span className="font-bold text-right" style={{ color: getLossColor(hoveredData.taxaPerda) }}>
              {hoveredData.taxaPerda.toFixed(0)}%
            </span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-2 mt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ background: 'hsl(120, 60%, 45%)' }} />
          <span>Baixa perda</span>
        </div>
        <div className="w-16 h-3 rounded" style={{ background: 'linear-gradient(to right, hsl(120, 60%, 45%), hsl(60, 65%, 48%), hsl(0, 70%, 45%))' }} />
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ background: 'hsl(0, 70%, 45%)' }} />
          <span>Alta perda</span>
        </div>
      </div>
    </div>
  );
}
