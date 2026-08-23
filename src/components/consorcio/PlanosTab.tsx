import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Search, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useConsorcioProdutos } from '@/hooks/useConsorcioProdutos';
import {
  useAllConsorcioCreditos,
  useCreateConsorcioCredito,
  useUpdateConsorcioCredito,
  useDeleteConsorcioCredito,
  useReactivateConsorcioCredito,
  CONDICOES,
  PRAZOS,
  PARCELA_COLUMNS,
} from '@/hooks/useConsorcioCreditosAdmin';
import { ConsorcioCredito, ConsorcioProduto } from '@/types/consorcioProdutos';
import { formatBRLInput, parseBRLInput, numberToBRLInput } from '@/lib/brlMask';
import {
  useConsorcioPlanosFaltando,
  type CombinacaoFaltante,
} from '@/hooks/useConsorcioPlanosFaltando';
import { produtosElegiveisParaCarta } from '@/lib/consorcioParcelaOficial';


const brl = (v?: number | null) =>
  typeof v === 'number' ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

/** As 9 combinações (3 condições × 3 prazos) de um plano, com o par 1ª-à-12ª / demais. */
type Combinacao = {
  key: string;
  condicaoLabel: string;
  prazo: number;
  primeiras: number | null;
  demais: number | null;
  completa: boolean;
};

function combinacoesDoPlano(c: ConsorcioCredito): Combinacao[] {
  const out: Combinacao[] = [];
  for (const cond of CONDICOES) {
    for (const p of PRAZOS) {
      const primeiras = (c as any)[`parcela_1a_12a_${cond.key}_${p}`] ?? null;
      const demais = (c as any)[`parcela_demais_${cond.key}_${p}`] ?? null;
      out.push({
        key: `${cond.key}_${p}`,
        condicaoLabel: cond.label,
        prazo: p,
        primeiras: typeof primeiras === 'number' ? primeiras : null,
        demais: typeof demais === 'number' ? demais : null,
        completa: typeof primeiras === 'number' && typeof demais === 'number',
      });
    }
  }
  return out;
}

/** Dígitos de um termo de busca comparados contra os dígitos de qualquer valor de parcela. */
function planoTemParcela(c: ConsorcioCredito, termDigits: string): boolean {
  if (!termDigits) return false;
  return PARCELA_COLUMNS.some((col) => {
    const v = (c as any)[col];
    if (typeof v !== 'number') return false;
    const asBr = v.toFixed(2).replace('.', ',');
    return asBr.replace(/\D/g, '').includes(termDigits) || asBr.includes(termDigits);
  });
}


export function PlanosTab() {
  const { data: produtos = [] } = useConsorcioProdutos();
  const { data: creditos = [], isLoading } = useAllConsorcioCreditos();
  const create = useCreateConsorcioCredito();
  const update = useUpdateConsorcioCredito();
  const remove = useDeleteConsorcioCredito();
  const reactivate = useReactivateConsorcioCredito();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ConsorcioCredito | null>(null);
  const [search, setSearch] = useState('');
  const [showInativos, setShowInativos] = useState(false);
  const [toDelete, setToDelete] = useState<ConsorcioCredito | null>(null);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [prefill, setPrefill] = useState<CombinacaoFaltante | null>(null);
  const [formKey, setFormKey] = useState(0);


  const toggleExpandido = (id: string) =>
    setExpandidos((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });


  const produtoLabel = (id?: string | null) => {
    const p = produtos.find((x) => x.id === id);
    return p ? `${p.codigo} — ${p.nome}` : '—';
  };

  const ordered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...creditos]
      .sort((a, b) => {
        const pa = produtoLabel(a.produto_id);
        const pb = produtoLabel(b.produto_id);
        if (pa !== pb) return pa.localeCompare(pb);
        return (a.valor_credito || 0) - (b.valor_credito || 0);
      })
      .filter((c) => {
        if (!showInativos && !c.ativo) return false;
        if (!term) return true;
        const digits = term.replace(/\D/g, '');
        return (
          (c.codigo_credito || '').toLowerCase().includes(term) ||
          String(c.valor_credito || '').includes(digits) ||
          brl(c.valor_credito).toLowerCase().includes(term) ||
          planoTemParcela(c, digits)
        );
      });

  }, [creditos, search, produtos, showInativos]);

  const handleSave = (data: Record<string, any>) => {
    if (editing) {
      update.mutate({ id: editing.id, ...data }, {
        onSuccess: () => { setEditing(null); setShowForm(false); },
      });
    } else {
      create.mutate(data, { onSuccess: () => setShowForm(false) });
    }
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Cadastre os planos (créditos) de cada produto com os valores oficiais de parcela por condição e prazo.
        </p>
        <Button size="sm" onClick={() => { setEditing(null); setPrefill(null); setFormKey((k) => k + 1); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Novo plano
        </Button>

      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por código, valor do crédito ou valor da parcela (ex: 508,92)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Switch checked={showInativos} onCheckedChange={setShowInativos} />
          <Label className="text-sm text-muted-foreground">Mostrar inativos</Label>
        </div>
      </div>

      <PlanosFaltandoBlock
        onCadastrar={(combo) => {
          setEditing(null);
          setPrefill(combo);
          setFormKey((k) => k + 1);
          setShowForm(true);
        }}
      />

      {showForm && (
        <PlanoForm
          key={formKey}
          produtos={produtos}
          initial={editing}
          prefill={editing ? null : prefill}
          onCancel={() => { setEditing(null); setPrefill(null); setShowForm(false); }}
          onSave={handleSave}
          isPending={create.isPending || update.isPending}
        />
      )}


      <div className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>}
        {!isLoading && ordered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum plano cadastrado.</p>
        )}
        {ordered.map((c) => {
          const combos = combinacoesDoPlano(c);
          const preenchidas = combos.filter((k) => k.completa);
          const faltando = combos.filter((k) => !k.completa);
          const aberto = expandidos.has(c.id);
          return (
            <div
              key={c.id}
              className={`bg-muted/50 rounded-lg text-sm ${c.ativo ? '' : 'opacity-60'}`}
            >
              <div className="flex items-center gap-3 p-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  aria-label={aberto ? 'Recolher combinações' : 'Ver as 9 combinações'}
                  onClick={() => toggleExpandido(c.id)}
                >
                  {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate flex items-center gap-2">
                    {c.codigo_credito} — {brl(c.valor_credito)}
                    {!c.ativo && <Badge variant="outline" className="text-[10px]">Inativo</Badge>}
                    <Badge
                      variant={preenchidas.length === 9 ? 'secondary' : 'outline'}
                      className={`text-[10px] ${preenchidas.length === 9 ? '' : 'border-amber-500 text-amber-700 dark:text-amber-400'}`}
                    >
                      {preenchidas.length}/9 combinações
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    Produto: <strong>{produtoLabel(c.produto_id)}</strong> ·
                    {' '}Conv. 240: {brl(c.parcela_1a_12a_conv_240)} / {brl(c.parcela_demais_conv_240)}
                  </div>
                  {faltando.length > 0 && (
                    <div className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                      Falta cadastrar: {faltando.map((k) => `${k.condicaoLabel} / ${k.prazo}`).join(' · ')}
                    </div>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setEditing(c); setPrefill(null); setFormKey((k) => k + 1); setShowForm(true); }}>
                  Editar
                </Button>
                {c.ativo ? (
                  <Button variant="ghost" size="icon" onClick={() => setToDelete(c)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => reactivate.mutate(c.id)}>
                    <RotateCcw className="h-4 w-4 mr-1" /> Reativar
                  </Button>
                )}
              </div>

              {aberto && (
                <div className="px-3 pb-3">
                  <div className="overflow-x-auto rounded-md border bg-background">
                    <table className="w-full text-xs min-w-[520px]">
                      <thead>
                        <tr className="text-muted-foreground border-b">
                          <th className="text-left font-medium p-2">Condição</th>
                          {PRAZOS.map((p) => (
                            <th key={p} className="text-left font-medium p-2">{p} meses</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {CONDICOES.map((cond) => (
                          <tr key={cond.key} className="border-b last:border-0">
                            <td className="p-2 whitespace-nowrap">{cond.label}</td>
                            {PRAZOS.map((p) => {
                              const k = combos.find((x) => x.key === `${cond.key}_${p}`)!;
                              return (
                                <td key={p} className="p-2 align-top">
                                  {k.completa || k.primeiras != null || k.demais != null ? (
                                    <div className="space-y-0.5">
                                      <div>
                                        <span className="text-muted-foreground">1ª à 12ª: </span>
                                        <span className="font-medium tabular-nums">{brl(k.primeiras)}</span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Demais: </span>
                                        <span className="font-medium tabular-nums">{brl(k.demais)}</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">Não cadastrado</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Valores oficiais da tabela Embracon para este plano. Use esta grade para conferir plano por plano.
                  </p>
                </div>
              )}
            </div>
          );
        })}

      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover plano</AlertDialogTitle>
            <AlertDialogDescription>
              O plano <strong>{toDelete?.codigo_credito}</strong> será desativado e deixará de aparecer na seleção
              de planos. Você pode reativá-lo depois usando o filtro "Mostrar inativos".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (toDelete) remove.mutate(toDelete.id); setToDelete(null); }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Fila de cadastro: combinações que as vendas já usaram e a tabela não tem.
 * Só informa e pré-preenche produto/crédito — NUNCA sugere valor de parcela.
 * Se não há nada faltando, o bloco não aparece.
 */
function PlanosFaltandoBlock({
  onCadastrar,
}: {
  onCadastrar: (combo: CombinacaoFaltante) => void;
}) {
  const { data } = useConsorcioPlanosFaltando();
  const [aberto, setAberto] = useState(true);

  const combos = data?.combinacoes || [];
  const prazoFora = data?.cartasPrazoForaDaTabela || 0;
  if (combos.length === 0 && prazoFora === 0) return null;

  const totalCartas = combos.reduce((a, c) => a + c.cartas, 0);

  return (
    <div className="border rounded-lg bg-muted/30">
      {combos.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            className="w-full flex items-center gap-2 px-4 py-3 text-left"
          >
            {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span className="text-sm font-medium">
              {combos.length} combinaç{combos.length === 1 ? 'ão' : 'ões'} usada
              {combos.length === 1 ? '' : 's'} em vendas sem plano cadastrado
            </span>
            <span className="text-xs text-muted-foreground">
              · {totalCartas} carta{totalCartas === 1 ? '' : 's'}
            </span>
          </button>

          {aberto && (
            <div className="px-4 pb-3 space-y-1">
              <p className="text-xs text-muted-foreground pb-1">
                Trabalho de fila, não urgência. Os valores de parcela vêm da tabela oficial da
                Embracon — o sistema não sugere nenhum.
              </p>
              {combos.map((c) => (
                <div
                  key={c.key}
                  className="flex flex-wrap items-center gap-2 justify-between rounded-md border bg-background px-3 py-2"
                >
                  <div className="text-sm">
                    <span className="font-medium">{c.tipoTaxaLabel}</span>
                    <span className="text-muted-foreground"> · </span>
                    {brl(c.valorCredito)}
                    <span className="text-muted-foreground"> · {c.prazoMeses}x · </span>
                    <span className={c.condKey ? '' : 'text-amber-600 dark:text-amber-500'}>
                      {c.condicaoLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {c.cartas} carta{c.cartas === 1 ? '' : 's'}
                    </Badge>
                    <Button size="sm" variant="outline" onClick={() => onCadastrar(c)}>
                      Cadastrar plano
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {prazoFora > 0 && (
        <p className="px-4 py-3 text-xs text-muted-foreground border-t">
          {prazoFora} carta{prazoFora === 1 ? '' : 's'} com prazo fora de 200/220/240 — a tabela não
          tem coluna para esse prazo; cadastrar plano não resolve.
        </p>
      )}
    </div>
  );
}

function PlanoForm({
  produtos,
  initial,
  prefill,
  onSave,
  onCancel,
  isPending,
}: {
  produtos: ConsorcioProduto[];
  initial: ConsorcioCredito | null;
  prefill?: CombinacaoFaltante | null;
  onSave: (data: Record<string, any>) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  // Prefill: produto (só quando UM produto é elegível), crédito, e destaque das
  // colunas de prazo/condição pedidas. Nenhum valor de parcela é sugerido.
  const produtoPreSelecionado = useMemo(() => {
    if (!prefill) return '';
    const elegiveis = produtosElegiveisParaCarta(
      produtos as any[],
      prefill.valorCredito,
      prefill.tipoTaxa === 'primeira_parcela' ? 'select' : 'parcelinha',
    );
    return elegiveis.length === 1 ? String((elegiveis[0] as any).id) : '';
  }, [prefill, produtos]);

  const [produtoId, setProdutoId] = useState(initial?.produto_id || produtoPreSelecionado);
  const [codigo, setCodigo] = useState(initial?.codigo_credito || '');
  const [valor, setValor] = useState(
    numberToBRLInput(initial?.valor_credito ?? prefill?.valorCredito),
  );
  const [ativo, setAtivo] = useState(initial?.ativo ?? true);
  const [parcelas, setParcelas] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    PARCELA_COLUMNS.forEach((col) => {
      init[col] = numberToBRLInput((initial as any)?.[col]);
    });
    return init;
  });


  const setParcela = (col: string, raw: string) =>
    setParcelas((p) => ({ ...p, [col]: formatBRLInput(raw) }));

  const canSave = !!produtoId && !!codigo.trim() && parseBRLInput(valor) > 0;

  const handleSubmit = () => {
    if (!canSave) return;
    const payload: Record<string, any> = {
      produto_id: produtoId,
      codigo_credito: codigo.trim(),
      valor_credito: parseBRLInput(valor),
      ativo,
    };
    PARCELA_COLUMNS.forEach((col) => {
      const v = parcelas[col];
      payload[col] = v ? parseBRLInput(v) : null;
    });
    onSave(payload);
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-card">
      <h4 className="font-semibold text-sm">{initial ? 'Editar plano' : 'Novo plano'}</h4>

      {!initial && prefill && (
        <p className="text-xs text-muted-foreground">
          Combinação pedida por {prefill.cartas} carta{prefill.cartas === 1 ? '' : 's'}:{' '}
          <span className="font-medium text-foreground">
            {prefill.tipoTaxaLabel} · {brl(prefill.valorCredito)} · {prefill.prazoMeses}x ·{' '}
            {prefill.condicaoLabel}
          </span>
          . Preencha as parcelas com os valores da tabela oficial da Embracon
          {prefill.condKey ? '' : ' — confirme a condição antes de cadastrar'}.
        </p>
      )}


      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Produto *</Label>
          <Select value={produtoId} onValueChange={setProdutoId}>
            <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
            <SelectContent>
              {produtos.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.codigo} — {p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Código do crédito *</Label>
          <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ex: C150" />
        </div>
        <div className="space-y-2">
          <Label>Valor do crédito (R$) *</Label>
          <Input
            inputMode="numeric"
            value={valor}
            onChange={(e) => setValor(formatBRLInput(e.target.value))}
            placeholder="150.000,00"
          />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <Switch checked={ativo} onCheckedChange={setAtivo} />
          <Label>Ativo</Label>
        </div>
      </div>

      <ParcelaGrid title="Parcela 1ª à 12ª" prefix="parcela_1a_12a" values={parcelas} onChange={setParcela} />
      <ParcelaGrid title="Demais parcelas" prefix="parcela_demais" values={parcelas} onChange={setParcela} />

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" onClick={handleSubmit} disabled={isPending || !canSave}>
          {isPending ? 'Salvando...' : 'Salvar plano'}
        </Button>
      </div>
    </div>
  );
}

function ParcelaGrid({
  title,
  prefix,
  values,
  onChange,
}: {
  title: string;
  prefix: string;
  values: Record<string, string>;
  onChange: (col: string, raw: string) => void;
}) {
  return (
    <div className="space-y-2">
      <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h5>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[520px]">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="text-left font-medium pb-1">Condição</th>
              {PRAZOS.map((p) => (
                <th key={p} className="text-left font-medium pb-1">{p} meses</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CONDICOES.map((c) => (
              <tr key={c.key}>
                <td className="pr-2 py-1 text-xs whitespace-nowrap">{c.label}</td>
                {PRAZOS.map((p) => {
                  const col = `${prefix}_${c.key}_${p}`;
                  return (
                    <td key={col} className="py-1 pr-2">
                      <Input
                        inputMode="numeric"
                        className="h-8"
                        value={values[col] || ''}
                        onChange={(e) => onChange(col, e.target.value)}
                        placeholder="0,00"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
