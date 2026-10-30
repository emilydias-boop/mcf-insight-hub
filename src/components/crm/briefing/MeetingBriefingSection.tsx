import { useState } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BriefingLeadCard } from './BriefingLeadCard';
import { ResumoAnamneseCard } from './ResumoAnamneseCard';
import { DealDetailsDrawer } from '@/components/crm/DealDetailsDrawer';
import { useBriefingsResumo } from '@/hooks/useDealBriefing';

export type BriefingParticipante = {
  key: string;
  nome: string;
  dealId: string | null;
  contactId?: string | null;
};

/**
 * Briefing (ou resumo da anamnese, como fallback) por participante no detalhe da reunião.
 * Só é montado com o detalhe aberto, então os cards completos nunca rodam pela grade.
 */
export function MeetingBriefingSection({ participantes }: { participantes: BriefingParticipante[] }) {
  const comDeal = participantes.filter((p) => !!p.dealId);
  const [dealAberto, setDealAberto] = useState<string | null>(null);
  const { data: resumoMap } = useBriefingsResumo(comDeal.map((p) => p.dealId!));
  if (comDeal.length === 0) return null;

  const cards = (p: BriefingParticipante) => (
    <div className="space-y-2">
      <BriefingLeadCard dealId={p.dealId!} />
      <ResumoAnamneseCard dealId={p.dealId!} contactId={p.contactId} />
      <Button size="sm" variant="outline" className="w-full" onClick={() => setDealAberto(p.dealId)}>
        <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir negócio
      </Button>
    </div>
  );

  return (
    <div className="space-y-2">
      {comDeal.length === 1
        ? cards(comDeal[0])
        : comDeal.map((p) => (
            <Recolhivel key={p.key} nome={p.nome} alerta={resumoMap?.get(p.dealId!)?.alerta}>
              {cards(p)}
            </Recolhivel>
          ))}
      <DealDetailsDrawer dealId={dealAberto} open={!!dealAberto} onOpenChange={(o) => !o && setDealAberto(null)} />
    </div>
  );
}

function Recolhivel({ nome, alerta, children }: { nome: string; alerta?: string; children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="rounded-lg border border-border">
      <button type="button" className="w-full flex items-start gap-2 p-2 text-left" onClick={() => setAberto((v) => !v)}>
        <ChevronDown className={cn('h-4 w-4 mt-0.5 shrink-0 transition-transform', aberto && 'rotate-180')} />
        <div className="min-w-0">
          <div className="text-xs font-semibold">Briefing de {nome}</div>
          {!aberto && alerta && <div className="text-[11px] text-amber-600 dark:text-amber-400 truncate">{alerta}</div>}
        </div>
      </button>
      {aberto && <div className="px-2 pb-2">{children}</div>}
    </div>
  );
}
