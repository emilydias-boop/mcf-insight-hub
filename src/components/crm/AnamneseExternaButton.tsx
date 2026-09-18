import { useState } from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AnamneseCampo {
  tag?: string | null;
  label?: string | null;
  valor?: string | number | null;
  valor_bruto?: unknown;
}

interface AnamneseSecao {
  chave?: string | null;
  titulo?: string | null;
  campos?: AnamneseCampo[] | null;
}

export interface AnamneseV2 {
  preenchida?: boolean | null;
  pdf_url?: string | null;
  estruturada?: { secoes?: AnamneseSecao[] | null } | null;
  resumo?: string | null;
  html?: string | null;
  preenchida_em?: string | null;
  atualizada_em?: string | null;
}

/** Extrai o pacote de anamnese do negócio; retorna null para cartões antigos. */
export function getAnamneseV2(deal: unknown): AnamneseV2 | null {
  const cf = (deal as { custom_fields?: Record<string, unknown> } | null)?.custom_fields;
  const a = cf?.anamnese_v2;
  if (!a || typeof a !== 'object' || Array.isArray(a)) return null;
  return a as AnamneseV2;
}

interface Props {
  anamnese: AnamneseV2;
  clienteNome?: string | null;
}

export const AnamneseExternaButton = ({ anamnese, clienteNome }: Props) => {
  const [open, setOpen] = useState(false);

  const secoes = (anamnese.estruturada?.secoes ?? []).filter(
    (s): s is AnamneseSecao => !!s && typeof s === 'object',
  );
  const temLink = !!anamnese.pdf_url;
  const temSecoes = secoes.length > 0;
  const semAnamnese = anamnese.preenchida === false || (!temLink && !temSecoes);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (semAnamnese) return;
    if (temLink) {
      window.open(anamnese.pdf_url as string, '_blank', 'noopener,noreferrer');
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={semAnamnese}
        onClick={handleClick}
        className="h-6 gap-1 px-1.5 text-[0.65rem] text-muted-foreground hover:text-foreground"
      >
        <FileText className="h-3 w-3" />
        {semAnamnese ? 'Sem anamnese' : 'Ver anamnese'}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>Anamnese {clienteNome ? `— ${clienteNome}` : ''}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-3">
            <div className="space-y-5">
              {secoes.map((secao, i) => (
                <div key={secao.chave ?? i} className="space-y-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {secao.titulo || 'Seção'}
                  </h3>
                  <dl className="space-y-1.5">
                    {(secao.campos ?? []).map((campo, j) => (
                      <div
                        key={campo?.tag ?? j}
                        className="flex flex-wrap gap-x-2 text-sm"
                      >
                        <dt className="font-medium">{campo?.label || campo?.tag || '—'}:</dt>
                        <dd className="text-muted-foreground">
                          {campo?.valor === null || campo?.valor === undefined || campo?.valor === ''
                            ? '—'
                            : String(campo.valor)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
              {anamnese.resumo && (
                <div className="space-y-1 border-t border-border pt-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Resumo
                  </h3>
                  <p className="whitespace-pre-line text-sm text-muted-foreground">
                    {anamnese.resumo}
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};
