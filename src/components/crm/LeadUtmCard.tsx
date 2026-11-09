import { Badge } from '@/components/ui/badge';
import { Megaphone } from 'lucide-react';

type UtmDeal = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  src?: string | null;
} | null | undefined;

const LINHAS: [keyof NonNullable<UtmDeal>, string][] = [
  ['utm_source', 'Origem (source)'],
  ['utm_medium', 'Mídia (medium)'],
  ['utm_campaign', 'Campanha'],
  ['utm_content', 'Anúncio / criativo'],
  ['utm_term', 'Termo'],
  ['src', 'SRC'],
];

/** Bloco no detalhe do negócio: de qual campanha/anúncio o lead veio (colunas utm_* e src de crm_deals). */
export function LeadUtmCard({ deal }: { deal: UtmDeal }) {
  const preenchidas = LINHAS.filter(([k]) => {
    const v = deal?.[k];
    return v !== undefined && v !== null && String(v).trim() !== '';
  });
  if (preenchidas.length === 0) return null;
  return (
    <div className="rounded-lg border p-3 space-y-2 bg-card">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px] gap-1">
          <Megaphone className="h-2.5 w-2.5" />
          Rastreamento de tráfego
        </Badge>
        <span className="text-xs text-muted-foreground">De qual campanha e anúncio o lead veio</span>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {preenchidas.map(([k, label]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground text-xs pt-0.5">{label}</dt>
            <dd className="break-words font-mono text-xs pt-0.5">{String(deal?.[k])}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
