import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { usePendingOutcomes } from '@/hooks/usePendingOutcomes';
import { OutcomeRequiredModal } from '@/components/consorcio/OutcomeRequiredModal';
import { cn } from '@/lib/utils';

export function PendingOutcomesBanner() {
  const { data: pending = [], isLoading } = usePendingOutcomes();
  const [expanded, setExpanded] = useState(false);
  const [activeDeal, setActiveDeal] = useState<typeof pending[number] | null>(null);
  const navigate = useNavigate();

  if (isLoading || pending.length === 0) return null;

  const overdue = pending.filter(p => p.hours_pending >= 24).length;
  const total = pending.length;

  return (
    <>
      <div
        className={cn(
          'rounded-lg border-2 p-4 space-y-3',
          overdue > 0
            ? 'border-destructive bg-destructive/5'
            : 'border-amber-500 bg-amber-500/5'
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className={cn(
                'h-5 w-5 mt-0.5 shrink-0',
                overdue > 0 ? 'text-destructive' : 'text-amber-600'
              )}
            />
            <div>
              <div className="font-semibold text-sm text-foreground">
                Você tem {total} {total === 1 ? 'reunião' : 'reuniões'} sem desfecho registrado
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {overdue > 0 ? (
                  <>
                    <Badge variant="destructive" className="mr-1">
                      {overdue} há mais de 24h
                    </Badge>
                    Registre Proposta, Sem Sucesso ou Aguardar para refletir nos seus números.
                  </>
                ) : (
                  'Registre o desfecho de cada R1 realizada (Proposta / Sem Sucesso / Aguardar).'
                )}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="shrink-0"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {expanded ? 'Ocultar' : 'Ver lista'}
          </Button>
        </div>

        {expanded && (
          <div className="space-y-2 pt-2 border-t">
            {pending.slice(0, 10).map((p) => (
              <div
                key={p.deal_id}
                className="flex items-center justify-between gap-3 rounded-md bg-background p-2 border"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{p.contact_name || p.deal_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.origin_name} · {p.hours_pending}h sem desfecho
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={p.hours_pending >= 24 ? 'destructive' : 'default'}
                  onClick={() => setActiveDeal(p)}
                >
                  Registrar
                </Button>
              </div>
            ))}
            {pending.length > 10 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => navigate('/consorcio/crm/pos-reuniao')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Ver todas ({pending.length}) na aba Pós-Reunião
              </Button>
            )}
          </div>
        )}
      </div>

      {activeDeal && (
        <OutcomeRequiredModal
          open={!!activeDeal}
          onOpenChange={(v) => !v && setActiveDeal(null)}
          dealId={activeDeal.deal_id}
          dealName={activeDeal.deal_name}
          contactName={activeDeal.contact_name}
          originId={activeDeal.origin_id}
        />
      )}
    </>
  );
}
