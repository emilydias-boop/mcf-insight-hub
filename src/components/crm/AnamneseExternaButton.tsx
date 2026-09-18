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
    setOpen(true);
  };

  const formatarData = (iso?: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatarValor = (valor: unknown): string => {
    if (valor === null || valor === undefined || valor === '') return '—';
    if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
    if (Array.isArray(valor)) {
      const itens = valor.map((v) => formatarValor(v)).filter((v) => v !== '—');
      return itens.length ? itens.join(', ') : '—';
    }
    if (typeof valor === 'object') {
      const entradas = Object.entries(valor as Record<string, unknown>)
        .map(([k, v]) => `${k}: ${formatarValor(v)}`)
        .filter(Boolean);
      return entradas.length ? entradas.join(' • ') : '—';
    }
    return String(valor);
  };

  const preenchidaEm = formatarData(anamnese.preenchida_em);
  const atualizadaEm = formatarData(anamnese.atualizada_em);

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
          className="max-w-3xl gap-0 p-0"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader className="space-y-1 border-b border-border px-6 py-4">
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-primary" />
              Anamnese do cliente
            </DialogTitle>
            <DialogDescription className="text-xs">
              {clienteNome ? clienteNome : 'Relatório de anamnese'}
              {preenchidaEm ? ` • Preenchida em ${preenchidaEm}` : ''}
              {atualizadaEm && atualizadaEm !== preenchidaEm
                ? ` • Atualizada em ${atualizadaEm}`
                : ''}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[68vh]">
            <div className="space-y-4 px-6 py-5">
              {anamnese.resumo && (
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Resumo
                  </h3>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                    {anamnese.resumo}
                  </p>
                </div>
              )}

              {temSecoes ? (
                secoes.map((secao, i) => {
                  const campos = (secao.campos ?? []).filter(Boolean);
                  return (
                    <section
                      key={secao.chave ?? i}
                      className="overflow-hidden rounded-lg border border-border"
                    >
                      <header className="border-b border-border bg-muted/50 px-4 py-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                          {secao.titulo || 'Seção'}
                        </h3>
                      </header>
                      {campos.length ? (
                        <dl className="divide-y divide-border">
                          {campos.map((campo, j) => (
                            <div
                              key={campo?.tag ?? j}
                              className="grid gap-1 px-4 py-2.5 sm:grid-cols-[minmax(0,14rem)_1fr] sm:gap-4"
                            >
                              <dt className="text-xs font-medium text-muted-foreground sm:text-sm">
                                {campo?.label || campo?.tag || '—'}
                              </dt>
                              <dd className="whitespace-pre-line break-words text-sm text-foreground">
                                {formatarValor(campo?.valor ?? campo?.valor_bruto)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      ) : (
                        <p className="px-4 py-3 text-sm text-muted-foreground">
                          Sem informações nesta seção.
                        </p>
                      )}
                    </section>
                  );
                })
              ) : (
                !anamnese.resumo && (
                  <p className="text-sm text-muted-foreground">
                    Anamnese sem detalhamento disponível.
                  </p>
                )
              )}
            </div>
          </ScrollArea>

          {temLink && (
            <div className="flex justify-end border-t border-border px-6 py-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() =>
                  window.open(anamnese.pdf_url as string, '_blank', 'noopener,noreferrer')
                }
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir versão para impressão
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
