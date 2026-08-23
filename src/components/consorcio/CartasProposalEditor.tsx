import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { PRAZO_OPTIONS, CONDICAO_PAGAMENTO_OPTIONS } from '@/types/consorcioProdutos';
import { formatBRLInput } from '@/lib/brlMask';
import { useConsorcioObjetivoOptions } from '@/hooks/useConsorcioObjetivoOptions';
import { useConsorcioCategoriaOptions } from '@/hooks/useConsorcioConfigOptions';
import { CATEGORIA_OPTIONS } from '@/types/consorcio';

import {
  MAX_CARTAS_POR_PROPOSTA,
  PARCELAS_MARCAVEIS,
  PropostaCartaDraft,
  cartaDraftValida,
  cartaSemParcela,
  novaCartaDraft,
  totalCartas,
} from '@/types/consorcioCartas';


interface CartasProposalEditorProps {
  cartas: PropostaCartaDraft[];
  onChange: (cartas: PropostaCartaDraft[]) => void;
  /** Opções de tipo de produto (catálogo). */
  tipoOptions: { name: string; label: string }[];
  /** Destaca as linhas incompletas (após tentativa de gravar). */
  mostrarErros?: boolean;
}

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });


export function CartasProposalEditor({
  cartas, onChange, tipoOptions, mostrarErros,
}: CartasProposalEditorProps) {
  // Quantidade do atalho "×N" por linha (repetição em massa).
  const [repetir, setRepetir] = useState<Record<string, string>>({});
  const { data: objetivoOptions = [] } = useConsorcioObjetivoOptions();
  const { data: categoriaCatalogo = [] } = useConsorcioCategoriaOptions();
  // Mesma fonte do formulário completo (OpenCotaModal): catálogo quando houver
  // opções ativas, senão a lista canônica em código (inside / life).
  const categoriaOptions = categoriaCatalogo.length > 0
    ? categoriaCatalogo.map(o => ({ name: o.name, label: o.label }))
    : CATEGORIA_OPTIONS.map(o => ({ name: o.value, label: o.label }));


  const patch = (key: string, p: Partial<PropostaCartaDraft>) =>
    onChange(cartas.map(c => (c.key === key ? { ...c, ...p } : c)));

  const adicionar = () => {
    if (cartas.length >= MAX_CARTAS_POR_PROPOSTA) return;
    onChange([...cartas, novaCartaDraft()]);
  };

  const duplicar = (key: string) => {
    const base = cartas.find(c => c.key === key);
    if (!base) return;
    const nRaw = Number(repetir[key] || 1);
    const n = Math.max(1, Math.min(Number.isFinite(nRaw) ? nRaw : 1, MAX_CARTAS_POR_PROPOSTA));
    const espaco = MAX_CARTAS_POR_PROPOSTA - cartas.length;
    const qtd = Math.max(0, Math.min(n, espaco));
    if (qtd === 0) return;
    const copias = Array.from({ length: qtd }, () =>
      novaCartaDraft({
        valorStr: base.valorStr,
        prazoMeses: base.prazoMeses,
        prazoOutro: base.prazoOutro,
        tipoProduto: base.tipoProduto,
        parcelasMcf: [...base.parcelasMcf],
        parcela1a12Str: base.parcela1a12Str,
        parcelaDemaisStr: base.parcelaDemaisStr,
        condicaoPagamento: base.condicaoPagamento,
        objetivo: base.objetivo,
        categoria: base.categoria,
      }),
    );

    const idx = cartas.findIndex(c => c.key === key);
    onChange([...cartas.slice(0, idx + 1), ...copias, ...cartas.slice(idx + 1)]);
    setRepetir(r => ({ ...r, [key]: '' }));
  };

  const remover = (key: string) => {
    if (cartas.length <= 1) return;
    onChange(cartas.filter(c => c.key !== key));
  };

  const total = totalCartas(cartas);
  const incompletas = cartas.filter(c => !cartaDraftValida(c)).length;
  const semParcela = cartas.filter(cartaSemParcela).length;


  return (
    <TooltipProvider>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Cartas de consórcio</Label>
          <span className="text-xs text-muted-foreground">
            Uma linha por carta. Todas no nome do próprio lead.
          </span>
        </div>

        <div className="space-y-2">
          {cartas.map((c, i) => {
            const invalida = !!mostrarErros && !cartaDraftValida(c);
            return (
              <div
                key={c.key}
                className={`rounded-md border p-2.5 space-y-2 ${invalida ? 'border-destructive bg-destructive/5' : 'border-border'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Carta {i + 1}
                    {(() => {
                      const digits = c.valorStr.replace(/\D/g, '');
                      const v = digits ? Number(digits) / 100 : 0;
                      return v > 0 ? ` · ${fmtBRL(v)}` : '';
                    })()}
                  </span>

                  <div className="flex items-center gap-1">
                    <Input
                      className="h-7 w-14 text-xs"
                      type="number"
                      min={1}
                      max={MAX_CARTAS_POR_PROPOSTA}
                      value={repetir[c.key] ?? ''}
                      onChange={e => setRepetir(r => ({ ...r, [c.key]: e.target.value }))}
                      placeholder="×N"
                      aria-label={`Repetir carta ${i + 1} N vezes`}
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => duplicar(c.key)}
                          aria-label={`Duplicar carta ${i + 1}`}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Duplicar — informe ×N ao lado para criar várias cópias iguais de uma vez
                      </TooltipContent>
                    </Tooltip>
                    {c.travada ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="secondary" className="text-[10px]">cadastrada</Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          Esta carta já gerou cadastro/cota — não pode ser removida aqui.
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        disabled={cartas.length <= 1}
                        onClick={() => remover(c.key)}
                        aria-label={`Remover carta ${i + 1}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Crédito (R$)</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      className={`h-9 ${invalida && !c.valorStr ? 'border-destructive' : ''}`}
                      value={c.valorStr}
                      onChange={e => patch(c.key, { valorStr: formatBRLInput(e.target.value) })}
                      /* Nunca use um número como placeholder: cinza claro parecendo
                         valor preenchido foi o que travou o lançamento em produção. */
                      placeholder="Digite o valor do crédito"
                    />
                    {!c.valorStr && (
                      <p className={`mt-1 text-[11px] ${invalida ? 'text-destructive' : 'text-muted-foreground'}`}>
                        Campo vazio — digite o crédito.
                      </p>
                    )}
                  </div>

                  <div>
                    <Label className="text-xs">Prazo (meses)</Label>
                    <Select
                      value={c.prazoOutro ? 'outro' : (c.prazoMeses || '')}
                      onValueChange={v => {
                        if (v === 'outro') patch(c.key, { prazoOutro: true, prazoMeses: '' });
                        else patch(c.key, { prazoOutro: false, prazoMeses: v });
                      }}
                    >
                      <SelectTrigger className="h-9"><SelectValue placeholder="Prazo" /></SelectTrigger>
                      <SelectContent>
                        {PRAZO_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                        ))}
                        <SelectItem value="outro">Outro (informar)</SelectItem>
                      </SelectContent>
                    </Select>
                    {c.prazoOutro && (
                      <Input
                        className="mt-1.5 h-9"
                        type="number"
                        value={c.prazoMeses}
                        onChange={e => patch(c.key, { prazoMeses: e.target.value })}
                        placeholder="Meses"
                      />
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">Tipo de produto</Label>
                    <Select value={c.tipoProduto} onValueChange={v => patch(c.key, { tipoProduto: v })}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Produto" /></SelectTrigger>
                      <SelectContent>
                        {tipoOptions.map(o => (
                          <SelectItem key={o.name} value={o.name}>{o.label}</SelectItem>
                        ))}
                        {c.tipoProduto && !tipoOptions.some(o => o.name === c.tipoProduto) && (
                          <SelectItem value={c.tipoProduto}>{c.tipoProduto} (legado)</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Dados do plano da carta. Opcionais no lançamento — mas sem o
                    valor da parcela o cadastro nasce como cadastro incompleto e
                    o Termo de Adesão não sai. Nada é calculado aqui: o valor é o
                    da tabela da Embracon, digitado pela pessoa. */}
                <div className="space-y-2 rounded-md border border-dashed p-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label className="text-xs">
                      Plano da carta {i + 1}
                      {(() => {
                        const digits = c.valorStr.replace(/\D/g, '');
                        const v = digits ? Number(digits) / 100 : 0;
                        return v > 0 ? ` · ${fmtBRL(v)}` : '';
                      })()}
                      <span className="ml-1 font-normal text-muted-foreground">(opcional)</span>
                    </Label>
                    {cartaSemParcela(c) && (
                      <span className="text-[11px] text-amber-600 dark:text-amber-400">
                        sem parcela → cadastro incompleto
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">Parcela 1ª à 12ª (R$)</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        className="h-9"
                        value={c.parcela1a12Str}
                        onChange={e => patch(c.key, { parcela1a12Str: formatBRLInput(e.target.value) })}
                        placeholder="0,00"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Demais parcelas (R$)</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        className="h-9"
                        value={c.parcelaDemaisStr}
                        onChange={e => patch(c.key, { parcelaDemaisStr: formatBRLInput(e.target.value) })}
                        placeholder="0,00"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Condição de pagamento</Label>
                      <Select
                        value={c.condicaoPagamento}
                        onValueChange={v => patch(c.key, { condicaoPagamento: v })}
                      >
                        <SelectTrigger className="h-9"><SelectValue placeholder="Condição" /></SelectTrigger>
                        <SelectContent>
                          {CONDICAO_PAGAMENTO_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Categoria</Label>
                      <Select value={c.categoria} onValueChange={v => patch(c.key, { categoria: v })}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Categoria" /></SelectTrigger>
                        <SelectContent>
                          {(categoriaOptions as any[]).map((o: any) => (
                            <SelectItem key={o.id || o.name} value={o.name}>{o.label || o.name}</SelectItem>
                          ))}
                          {c.categoria && !(categoriaOptions as any[]).some((o: any) => o.name === c.categoria) && (
                            <SelectItem value={c.categoria}>{c.categoria} (legado)</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Objetivo</Label>
                      <Select value={c.objetivo} onValueChange={v => patch(c.key, { objetivo: v })}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Objetivo" /></SelectTrigger>
                        <SelectContent>
                          {objetivoOptions.map(o => (
                            <SelectItem key={o.name} value={o.name}>{o.label}</SelectItem>
                          ))}
                          {c.objetivo && !objetivoOptions.some(o => o.name === c.objetivo) && (
                            <SelectItem value={c.objetivo}>{c.objetivo} (legado)</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>


                {/* Intenção do closer: quais das 12 primeiras parcelas a MCF paga.
                    Não é verdade oficial — a confirmação acontece na etapa 5. */}
                <div className="space-y-1.5 rounded-md bg-muted/40 p-2">

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label className="text-xs">Parcelas que a MCF paga (intenção)</Label>
                    <span className="text-xs font-medium">
                      MCF paga {c.parcelasMcf.length} de {PARCELAS_MARCAVEIS}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {Array.from({ length: PARCELAS_MARCAVEIS }, (_, k) => k + 1).map(n => {
                      const mcf = c.parcelasMcf.includes(n);
                      return (
                        <Button
                          key={n}
                          type="button"
                          size="sm"
                          variant={mcf ? 'default' : 'outline'}
                          className="h-7 w-9 p-0 text-xs tabular-nums"
                          aria-pressed={mcf}
                          aria-label={`Parcela ${n} — ${mcf ? 'MCF paga' : 'cliente paga'}`}
                          onClick={() =>
                            patch(c.key, {
                              parcelasMcf: mcf
                                ? c.parcelasMcf.filter(p => p !== n)
                                : [...c.parcelasMcf, n].sort((a, b) => a - b),
                            })
                          }
                        >
                          {n}
                        </Button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Clique para alternar entre MCF e cliente. Confirmação oficial na etapa Cotas Cadastradas.
                  </p>
                </div>
              </div>

            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={adicionar}
            disabled={cartas.length >= MAX_CARTAS_POR_PROPOSTA}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar carta
          </Button>
          <div className="text-sm font-semibold">
            {cartas.length} {cartas.length === 1 ? 'carta' : 'cartas'} · {fmtBRL(total)}
          </div>
        </div>

        {!!mostrarErros && incompletas > 0 && (
          <p className="text-xs text-destructive">
            {incompletas} {incompletas === 1 ? 'carta está incompleta' : 'cartas estão incompletas'} —
            informe crédito, prazo e produto em cada linha.
          </p>
        )}

        {semParcela > 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {semParcela === 1
              ? '1 carta sem valor de parcela'
              : `${semParcela} cartas sem valor de parcela`} — a venda pode ser lançada, mas o
            cadastro fica marcado como cadastro incompleto e o Termo de Adesão só sai depois de preencher.
          </p>
        )}

      </div>
    </TooltipProvider>
  );
}
