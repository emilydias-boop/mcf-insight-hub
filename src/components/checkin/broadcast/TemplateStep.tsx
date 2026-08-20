import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useWaTemplates, WaTemplateOption } from '@/hooks/wa/useWaBroadcasts';
import { interpolarPreview, motivoTemplateIndisponivel } from './waBroadcastLabels';


interface Props {
  nome: string;
  onNomeChange: (v: string) => void;
  selected: WaTemplateOption | null;
  onSelect: (t: WaTemplateOption) => void;
  sampleName: string | null;
}

export function TemplateStep({ nome, onNomeChange, selected, onSelect, sampleName }: Props) {
  const { data: templates = [], isLoading } = useWaTemplates();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="broadcast-nome">Nome do disparo (só para você identificar)</Label>
        <Input
          id="broadcast-nome"
          value={nome}
          onChange={(e) => onNomeChange(e.target.value)}
          placeholder="Ex.: Convite webinar setembro"
        />
      </div>

      <div className="space-y-2">
        <Label>Template aprovado</Label>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum template aprovado disponível. Peça a um administrador para cadastrar.
          </p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {templates.map((t) => {
              const motivo = motivoTemplateIndisponivel(t.variables);
              const botao = (
                <button
                  key={t.content_sid}
                  type="button"
                  disabled={!!motivo}
                  onClick={() => !motivo && onSelect(t)}
                  className={cn(
                    'w-full rounded-lg border p-3 text-left transition-colors',
                    motivo
                      ? 'cursor-not-allowed opacity-60'
                      : 'hover:bg-accent',
                    selected?.content_sid === t.content_sid && 'border-primary bg-accent',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{t.name}</span>
                    {motivo ? (
                      <Badge variant="outline">Indisponível em massa</Badge>
                    ) : (
                      t.category && (
                        <Badge variant={t.category === 'marketing' ? 'default' : 'secondary'}>
                          {t.category}
                        </Badge>
                      )
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {motivo ?? t.body_preview}
                  </p>
                </button>
              );
              if (!motivo) return botao;
              return (
                <Tooltip key={t.content_sid}>
                  <TooltipTrigger asChild>
                    <span className="block cursor-not-allowed">{botao}</span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">{motivo}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>

        )}
      </div>

      {selected && (
        <Card>
          <CardContent className="pt-4">
            <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
              Como vai chegar no WhatsApp
            </p>
            <div className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">
              {interpolarPreview(selected.body_preview, sampleName)}
            </div>
            {!sampleName && (
              <p className="mt-2 text-xs text-muted-foreground">
                Prévia com nome genérico — depois de montar o público ela usa um lead real.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}