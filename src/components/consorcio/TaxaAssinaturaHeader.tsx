import { FileSignature, Timer } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useTermoAssinaturaMetrics } from '@/hooks/useConsorcioTermos';

/** Abaixo disso o percentual é ruído: dizemos isso na tela em vez de exibir um número que engana. */
const MINIMO_SIGNIFICATIVO = 5;

function formatarDuracao(horas: number): string {
  if (horas < 1) return `${Math.max(1, Math.round(horas * 60))} min`;
  if (horas < 48) return `${horas.toFixed(1).replace('.', ',')} h`;
  return `${(horas / 24).toFixed(1).replace('.', ',')} dias`;
}

/**
 * Cabeçalho da etapa 3. A conversão 2→3 é 100% por construção (toda venda
 * lançada gera um termo pendente), então o número que importa aqui é a taxa de
 * assinatura e o tempo entre gerar e assinar.
 */
export function TaxaAssinaturaHeader({
  range,
  className,
}: {
  range: { startDate?: Date; endDate?: Date };
  className?: string;
}) {
  const { data, isLoading } = useTermoAssinaturaMetrics(range);

  if (isLoading || !data) return null;

  const poucoDado = data.gerados < MINIMO_SIGNIFICATIVO;
  const tom =
    poucoDado || data.taxa == null
      ? 'text-muted-foreground'
      : data.taxa >= 70
        ? 'text-emerald-600 dark:text-emerald-400'
        : data.taxa >= 40
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-destructive';

  return (
    <div className={cn('flex flex-wrap items-center gap-4 rounded-lg border bg-muted/30 px-3 py-2', className)}>
      <div className="flex items-center gap-2">
        <FileSignature className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Taxa de assinatura</span>
        {data.gerados === 0 ? (
          <span className="text-sm text-muted-foreground">nenhum termo gerado no período</span>
        ) : poucoDado ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help text-sm text-muted-foreground">
                {data.assinados}/{data.gerados} termos — amostra pequena
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-[280px]">
              <p className="text-xs">
                Com menos de {MINIMO_SIGNIFICATIVO} termos gerados no período o percentual oscila
                demais para significar algo. Mostramos a contagem crua.
              </p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className={cn('text-sm font-semibold tabular-nums', tom)}>
            {data.taxa!.toFixed(1).replace('.', ',')}%
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              ({data.assinados} de {data.gerados})
            </span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Timer className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Tempo mediano até assinar</span>
        <span className="text-sm font-semibold tabular-nums">
          {data.medianaHoras != null ? formatarDuracao(data.medianaHoras) : '—'}
        </span>
      </div>
    </div>
  );
}
