import { useState } from 'react';
import { ClipboardList, ExternalLink, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

const normalizar = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const EMOJIS: [string, string][] = [
  ['contato', '📋'], ['objetivo', '🎯'], ['patrimonio', '🏛️'], ['financ', '💰'],
  ['planej', '🗺️'], ['cliente', '👤'],
];
const emojiSecao = (s: AnamneseSecao) => {
  const t = normalizar(`${s.chave ?? ''} ${s.titulo ?? ''}`);
  return EMOJIS.find(([k]) => t.includes(k))?.[1] ?? '📄';
};

interface Props {
  anamnese: AnamneseV2;
  clienteNome?: string | null;
}

export const AnamneseExternaButton = ({ anamnese, clienteNome }: Props) => {
  const [open, setOpen] = useState(false);

  const distribuido = distribuirResumo(
    anamnese.resumo,
    (anamnese.estruturada?.secoes ?? []).filter(
      (s): s is AnamneseSecao => !!s && typeof s === 'object',
    ),
  );
  const secoes = distribuido.secoes as AnamneseSecao[];
  const resumoRestante = distribuido.resto;
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
          <DialogHeader className="space-y-1 px-6 pb-2 pt-5">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <ClipboardList className="h-5 w-5 text-primary" />
              Respostas da Anamnese
            </DialogTitle>
            <DialogDescription className="text-xs">
              {clienteNome ? clienteNome : 'Relatório de anamnese'}
              {preenchidaEm ? ` • Preenchida em ${preenchidaEm}` : ''}
              {atualizadaEm && atualizadaEm !== preenchidaEm
                ? ` • Atualizada em ${atualizadaEm}`
                : ''}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[72vh]">
            <div className="space-y-4 px-6 pb-5 pt-2">
              {anamnese.resumo && (
                <div className="rounded-xl border border-border bg-muted/30 p-5">
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    📝 Resumo
                  </h3>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                    {anamnese.resumo}
                  </p>
                </div>
              )}

              {temSecoes ? (
                secoes.map((secao, i) => {
                  const campos = (secao.campos ?? []).filter(Boolean) as AnamneseCampo[];
                  const ehObjetivos = normalizar(`${secao.chave ?? ''} ${secao.titulo ?? ''}`).includes('objetivo');
                  const idxDestaque = ehObjetivos
                    ? campos.findIndex((c) => {
                        const t = normalizar(`${c.tag ?? ''} ${c.label ?? ''}`);
                        return t.includes('objetivo') && !t.includes('12');
                      })
                    : -1;
                  const destaque = idxDestaque >= 0 ? campos[idxDestaque] : null;
                  const restantes = campos.filter((_, j) => j !== idxDestaque);
                  return (
                    <section
                      key={secao.chave ?? i}
                      className="rounded-xl border border-border bg-muted/30 p-5"
                    >
                      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        {emojiSecao(secao)} {secao.titulo || 'Seção'}
                      </h3>
                      {destaque && formatarValor(destaque.valor ?? destaque.valor_bruto) !== '—' && (
                        <span className="mb-3 inline-block rounded-full bg-highlight px-4 py-1 text-sm font-semibold text-highlight-foreground">
                          {formatarValor(destaque.valor ?? destaque.valor_bruto)}
                        </span>
                      )}
                      {restantes.length ? (
                        <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                          {restantes.map((campo, j) => {
                            const bruto = campo.valor ?? campo.valor_bruto;
                            const label = campo.label || campo.tag || '—';
                            if (Array.isArray(bruto) && bruto.length) {
                              return (
                                <div key={campo.tag ?? j} className="sm:col-span-2">
                                  <dt className="mb-1.5 text-sm font-medium text-foreground">{label}:</dt>
                                  <dd className="flex flex-wrap gap-2">
                                    {bruto.map((v, k) => (
                                      <span key={k} className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                                        {formatarValor(v)}
                                      </span>
                                    ))}
                                  </dd>
                                </div>
                              );
                            }
                            const texto = formatarValor(bruto);
                            const longo = texto.length > 40;
                            return (
                              <div key={campo.tag ?? j} className={longo ? 'sm:col-span-2' : ''}>
                                <span className="text-sm font-medium text-foreground">{label}: </span>
                                <span className="whitespace-pre-line break-words text-sm text-muted-foreground">{texto}</span>
                              </div>
                            );
                          })}
                        </dl>
                      ) : (
                        !destaque && <p className="text-sm text-muted-foreground">Sem informações nesta seção.</p>
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
