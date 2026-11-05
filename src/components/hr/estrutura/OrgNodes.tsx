import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { iniciais } from '@/lib/estruturaOrg';

export type OrgCardData = {
  titulo: string;
  subtitulo?: string;
  linhas?: string[];
  cor: number;
  nivel: number; // profundidade
  avatar?: { nome: string; url: string | null } | null;
  responsavel?: boolean;
  vago?: boolean;
  badges?: { texto: string; tipo: 'vago' | 'interino' | 'req' | 'setor' }[];
  filhos: number;
  recolhido: boolean;
  onToggle?: () => void;
  estado: 'normal' | 'dim' | 'hl';
};

export const NODE_W = 240;
export const nodeH = (d: Pick<OrgCardData, 'linhas' | 'badges'>) => 92 + (d.linhas?.length ?? 0) * 16 + (d.badges?.length ? 22 : 0);

const corVar = (n: number) => `hsl(var(--org-${n}))`;

export const OrgCard = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as OrgCardData;
  const topo = d.nivel === 0;
  return (
    <div
      className={cn(
        'relative rounded-lg border bg-card text-card-foreground shadow-sm transition-all',
        d.vago && 'border-dashed border-2',
        d.estado === 'dim' && 'opacity-30',
        d.estado === 'hl' && 'ring-2 ring-primary shadow-lg',
        selected && 'ring-2 ring-ring',
      )}
      style={{ width: NODE_W, borderLeft: `4px solid ${corVar(d.cor)}` }}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground !w-2 !h-2 !border-0" />
      <div className="p-3 space-y-1">
        <div className="flex items-start gap-2">
          {d.avatar && (
            <Avatar className={cn('shrink-0', topo ? 'h-10 w-10' : 'h-8 w-8')}>
              {d.avatar.url && <AvatarImage src={d.avatar.url} alt={d.avatar.nome} />}
              <AvatarFallback className="text-xs">{iniciais(d.avatar.nome)}</AvatarFallback>
            </Avatar>
          )}
          <div className="min-w-0 flex-1">
            <div className={cn('truncate leading-tight', topo ? 'font-bold text-base' : 'font-semibold text-sm')} title={d.titulo}>
              {d.titulo}
              {d.responsavel && <Star className="inline h-3.5 w-3.5 ml-1 -mt-0.5 fill-primary text-primary" aria-label="Responsável pelo setor" />}
            </div>
            {d.subtitulo && <div className="truncate text-xs text-muted-foreground" title={d.subtitulo}>{d.subtitulo}</div>}
          </div>
        </div>
        {d.linhas?.map((l, i) => <div key={i} className="truncate text-xs text-muted-foreground" title={l}>{l}</div>)}
        {!!d.badges?.length && (
          <div className="flex flex-wrap gap-1 pt-1">
            {d.badges.map((b, i) => (
              <Badge key={i} variant={b.tipo === 'vago' ? 'outline' : b.tipo === 'req' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0"
                style={b.tipo === 'setor' ? { borderColor: corVar(d.cor), color: corVar(d.cor) } : undefined}>
                {b.texto}
              </Badge>
            ))}
          </div>
        )}
      </div>
      {d.filhos > 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); d.onToggle?.(); }}
          className="nodrag absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-0.5 rounded-full border bg-background px-2 py-0.5 text-[10px] font-medium shadow-sm hover:bg-accent"
          aria-label={d.recolhido ? 'Expandir ramo' : 'Recolher ramo'}
        >
          {d.recolhido ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {d.filhos}
        </button>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground !w-2 !h-2 !border-0" />
    </div>
  );
});
OrgCard.displayName = 'OrgCard';

export const OrgGrupo = memo(({ data }: NodeProps) => {
  const d = data as { titulo: string; cor: number; dim?: boolean };
  return (
    <div className={cn('h-full w-full rounded-xl border-2 border-dashed', d.dim && 'opacity-30')}
      style={{ borderColor: corVar(d.cor), background: `hsl(var(--org-${d.cor}) / 0.06)` }}>
      <div className="px-3 py-1 text-xs font-semibold" style={{ color: corVar(d.cor) }}>{d.titulo}</div>
    </div>
  );
});
OrgGrupo.displayName = 'OrgGrupo';

export const nodeTypes = { card: OrgCard, grupo: OrgGrupo };
