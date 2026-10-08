import { Badge } from '@/components/ui/badge';
import { History } from 'lucide-react';
import { cn } from '@/lib/utils';

export const HARVEY_TAG = 'Migrado do Harvey';
// #C8FF00
export const harveyTagStyle = { backgroundColor: 'hsl(73 100% 50%)', color: 'hsl(0 0% 8%)', borderColor: 'transparent' };

export const isHarveyTag = (name?: string | null) => (name || '').trim().toLowerCase() === HARVEY_TAG.toLowerCase();

type CF = Record<string, unknown> | null | undefined;

/** Selo do card: etiqueta "Migrado do Harvey" (#C8FF00) + coluna original. */
export function HarveyStageBadge({ customFields, className }: { customFields: CF; className?: string }) {
  const stage = customFields?.stage_harvey as string | undefined;
  if (!stage) return null;
  return (
    <Badge
      variant="outline"
      className={cn('text-[10px] px-1.5 py-0 gap-0.5 font-medium', className)}
      style={harveyTagStyle}
      title={`Migrado do Harvey — coluna original: ${stage}`}
    >
      <History className="h-2.5 w-2.5" />
      Harvey: {stage}
    </Badge>
  );
}

/** Bloco no detalhe do negócio com onde o cliente estava no Harvey. */
export function HarveyOrigemCard({ customFields }: { customFields: CF }) {
  const stage = customFields?.stage_harvey as string | undefined;
  if (!stage) return null;
  const linhas: [string, unknown][] = [
    ['Coluna no Harvey', stage],
    ['Prioridade', customFields?.prioridade],
    ['Entrada na carteira', customFields?.entrada_carteira],
    ['Última atividade', customFields?.ultima_atividade],
    ['Encaminhamentos', customFields?.encaminhamentos_areas],
    ['Notas do Harvey', customFields?.notas_harvey],
  ];
  return (
    <div className="rounded-lg border p-3 space-y-2 bg-card">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px]" style={harveyTagStyle}>{HARVEY_TAG}</Badge>
        <span className="text-xs text-muted-foreground">Onde o cliente estava no app anterior</span>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {linhas.filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '').map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground text-xs pt-0.5">{k}</dt>
            <dd className={cn('break-words', k === 'Coluna no Harvey' && 'font-semibold')}>{String(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
