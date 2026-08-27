import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import { PRAZO_OPTIONS, CONDICAO_PAGAMENTO_OPTIONS } from '@/types/consorcioProdutos';
import { CurrencyInput } from '@/components/ui/currency-input';
import { numberToBRLInput } from '@/lib/brlMask';
import {
  filtrarPlanosCarta,
  useConsorcioPlanosTabela,
  type PlanoCartaOption,
} from '@/hooks/useConsorcioPlanosCarta';
import { useConsorcioObjetivoOptions } from '@/hooks/useConsorcioObjetivoOptions';
import { useConsorcioCategoriaOptions } from '@/hooks/useConsorcioConfigOptions';
import { CATEGORIA_OPTIONS } from '@/types/consorcio';
import {
  estruturaParcela,
  faixaParcelaCurta,
  rotulosParcela,
} from '@/lib/consorcioParcelaOficial';



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
  /**
   * Permissão EXPLÍCITA de quem chama para pré-selecionar Parcelinha/240/
   * Convencional em cartas novas. Default `false`: editar proposta existente
   * nunca pré-seleciona nada.
   */
  preSelecionarPadrao?: boolean;
}


const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

/** Igual ao fmtBRL, com centavos — parcela sem centavos esconde a diferença. */
const fmtBRLc = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });



export function CartasProposalEditor({
  cartas, onChange, tipoOptions, mostrarErros, preSelecionarPadrao = false,
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
  // Plano escolhido por carta (id do registro em `consorcio_creditos`) e
  // anotação de apoio. É estado de TELA: nada disso vai para o banco nesta fase.
  const [planoPorCarta, setPlanoPorCarta] = useState<Record<string, string>>({});
  const [manualPorCarta, setManualPorCarta] = useState<Record<string, boolean>>({});
  const [obsPorCarta, setObsPorCarta] = useState<Record<string, string>>({});
  // Carta que tinha plano aplicado e perdeu o vínculo ao trocar produto/prazo/
  // condição: guarda a combinação pedida só para explicar em texto.
  const [planoPerdido, setPlanoPerdido] = useState<Record<string, { prazo: string; condicao: string }>>({});
  const { data: tabelaPlanos, isLoading: carregandoPlanos } = useConsorcioPlanosTabela();

  /** Carta sem plano escolhido, ou destravada de propósito, é manual. */
  const ehManual = (c: PropostaCartaDraft) =>
    manualPorCarta[c.key] === true || !planoPorCarta[c.key];

  const patch = (key: string, p: Partial<PropostaCartaDraft>) =>
    onChange(cartas.map(c => (c.key === key ? { ...c, ...p } : c)));

  const limparPerdido = (key: string) =>
    setPlanoPerdido(m => {
      if (!(key in m)) return m;
      const n = { ...m };
      delete n[key];
      return n;
    });

  /**
   * Trocar produto, prazo ou condição com plano aplicado REAPLICA o plano na
   * nova combinação — o rótulo do seletor e os campos nunca podem divergir.
   * Se o plano não existir na nova combinação, só o vínculo cai (campos
   * destravam com o que já estava; nada é apagado).
   */
  const trocarFiltro = (c: PropostaCartaDraft, p: Partial<PropostaCartaDraft>) => {
    const planoId = planoPorCarta[c.key];
    if (!planoId || manualPorCarta[c.key]) { patch(c.key, p); return; }
    const alvo = { ...c, ...p };
    const { opcoes } = filtrarPlanosCarta(tabelaPlanos, {
      tipoProduto: alvo.tipoProduto,
      prazoMeses: alvo.prazoMeses,
      condicaoPagamento: alvo.condicaoPagamento,
    });
    const plano = opcoes.find(o => o.id === planoId);
    if (!plano) {
      setPlanoPorCarta(m => ({ ...m, [c.key]: '' }));
      setPlanoPerdido(m => ({
        ...m,
        [c.key]: { prazo: String(alvo.prazoMeses || ''), condicao: String(alvo.condicaoPagamento || '') },
      }));
      patch(c.key, p);
      return;
    }
    limparPerdido(c.key);
    patch(c.key, {
      ...p,
      valorStr: numberToBRLInput(plano.valorCredito),
      parcela1a12Str: numberToBRLInput(plano.parcela1a12),
      parcelaDemaisStr: numberToBRLInput(plano.parcelaDemais),
    });
  };


  /**
   * Pré-seleção Parcelinha / 240 / Convencional — o caso comum (175 de 177
   * cartas). Só em carta NOVA (sem `id`) e só em campo vazio: carta que veio do
   * banco nunca é tocada, senão o `formDiff` acusaria mudança que ninguém fez.
   */
  const tipoPadrao = useMemo(
    () => tipoOptions.find(o => /parcelinha/i.test(o.name) || /parcelinha/i.test(o.label))?.name,
    [tipoOptions],
  );

  useEffect(() => {
    if (!preSelecionarPadrao) return;
    let mudou = false;
    const proximas = cartas.map(c => {
      if (c.id) return c;
      const p: Partial<PropostaCartaDraft> = {};
      if (!c.tipoProduto && tipoPadrao) p.tipoProduto = tipoPadrao;
      if (!c.prazoMeses && !c.prazoOutro) p.prazoMeses = '240';
      if (!c.condicaoPagamento) p.condicaoPagamento = 'convencional';
      if (Object.keys(p).length === 0) return c;
      mudou = true;
      return { ...c, ...p };
    });
    if (mudou) onChange(proximas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartas, tipoPadrao, preSelecionarPadrao]);

  /** Escolher o plano preenche os três campos e trava. Formato: `numberToBRLInput`. */
  const aplicarPlano = (key: string, plano: PlanoCartaOption) => {
    setPlanoPorCarta(m => ({ ...m, [key]: plano.id }));
    setManualPorCarta(m => ({ ...m, [key]: false }));
    limparPerdido(key);
    patch(key, {
      valorStr: numberToBRLInput(plano.valorCredito),
      parcela1a12Str: numberToBRLInput(plano.parcela1a12),
      parcelaDemaisStr: numberToBRLInput(plano.parcelaDemais),
    });
  };

  /** "Meu plano não está na lista" e "editar manualmente": destrava, não apaga. */
  const virarManual = (key: string) => {
    setPlanoPorCarta(m => ({ ...m, [key]: '' }));
    setManualPorCarta(m => ({ ...m, [key]: true }));
    limparPerdido(key);
  };


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
            const manual = ehManual(c);
            // "fora da tabela" ≠ "campos destravados". Só acende quando o
            // operador ESCOLHEU manual: `__manual__` no seletor, ou "editar
            // manualmente" depois de um plano aplicado. Carta sem plano
            // escolhido (a maioria) não recebe badge — senão o alerta vira
            // ruído e ninguém lê mais.
            const foraDaTabela = manualPorCarta[c.key] === true;
            const { opcoes: planos, faltando, prazoForaDaTabela } = filtrarPlanosCarta(
              tabelaPlanos,
              { tipoProduto: c.tipoProduto, prazoMeses: c.prazoMeses, condicaoPagamento: c.condicaoPagamento },
            );
            const planoSel = planos.find(p => p.id === planoPorCarta[c.key]);
            // O selo "tabela oficial" só pode existir quando os três campos são,
            // byte a byte, o que a tabela tem para a combinação escolhida agora.
            const planoBate = !!planoSel
              && c.valorStr === numberToBRLInput(planoSel.valorCredito)
              && c.parcela1a12Str === numberToBRLInput(planoSel.parcela1a12)
              && c.parcelaDemaisStr === numberToBRLInput(planoSel.parcelaDemais);
            const perdido = planoPerdido[c.key];
            // Estrutura da parcela POR CARTA: uma proposta pode misturar Select
            // e Parcelinha. Com plano da tabela escolhido, o código do produto
            // manda; sem ele, vale o tipo de produto da carta.
            const estrutura = estruturaParcela(c.tipoProduto, planoSel?.produtoCodigo);
            const rotulos = rotulosParcela(estrutura);
            const condicaoLabel = (v?: string) =>
              CONDICAO_PAGAMENTO_OPTIONS.find(o => o.value === v)?.label || v || '—';

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

                {/* 1) Filtro do plano: produto → prazo → condição. Trocar
                    qualquer um destes NUNCA apaga crédito ou parcela já
                    preenchidos — filtro é filtro, não é reset. */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Tipo de produto</Label>
                    <Select value={c.tipoProduto} onValueChange={v => trocarFiltro(c, { tipoProduto: v })}>
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

                  <div>
                    <Label className="text-xs">Prazo (meses)</Label>
                    <Select
                      value={c.prazoOutro ? 'outro' : (c.prazoMeses || '')}
                      onValueChange={v => {
                        if (v === 'outro') trocarFiltro(c, { prazoOutro: true, prazoMeses: '' });
                        else trocarFiltro(c, { prazoOutro: false, prazoMeses: v });
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
                        onChange={e => trocarFiltro(c, { prazoMeses: e.target.value })}
                        placeholder="Meses"
                      />
                    )}
                  </div>

                  <div>
                    <Label className="text-xs">Condição de pagamento</Label>
                    <Select
                      value={c.condicaoPagamento}
                      onValueChange={v => trocarFiltro(c, { condicaoPagamento: v })}
                    >
                      <SelectTrigger className="h-9"><SelectValue placeholder="Condição" /></SelectTrigger>
                      <SelectContent>
                        {CONDICAO_PAGAMENTO_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* 2) Plano da tabela Embracon. Opt-in: escolher preenche
                    crédito e as duas parcelas com o valor tabelado, sem
                    digitação. Nunca obrigatório, nunca trava a venda. */}
                <div className="space-y-2 rounded-md border border-dashed p-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label className="text-xs">
                      Plano da carta {i + 1}
                      <span className="ml-1 font-normal text-muted-foreground">(opcional)</span>
                    </Label>
                    <div className="flex items-center gap-1.5">
                      {!manual && planoBate && planoSel && (
                        <Badge variant="secondary" className="text-[10px]">
                          {planoSel.produtoCodigo} · tabela oficial
                        </Badge>
                      )}
                      {foraDaTabela && (
                        <Badge
                          variant="outline"
                          className="border-amber-500 text-[10px] text-amber-600 dark:text-amber-400"
                        >
                          plano fora da tabela
                        </Badge>
                      )}
                      {cartaSemParcela(c) && (
                        <span className="text-[11px] text-amber-600 dark:text-amber-400">
                          sem parcela → cadastro incompleto
                        </span>
                      )}
                    </div>
                  </div>

                  <Select
                    value={planoPorCarta[c.key] || (foraDaTabela ? '__manual__' : '')}
                    onValueChange={v => {
                      if (v === '__manual__') { virarManual(c.key); return; }
                      const p = planos.find(o => o.id === v);
                      if (p) aplicarPlano(c.key, p);
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Escolher plano da tabela" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Saída de emergência no TOPO, com separador logo abaixo.
                          Não pode ficar escondida no fim de uma lista de
                          dezenas de planos. */}
                      <SelectItem value="__manual__">
                        Meu plano não está na lista — informar manualmente
                      </SelectItem>
                      <div className="-mx-1 my-1 h-px bg-border" />
                      {planos.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {fmtBRL(p.valorCredito)} —{' '}
                          {faixaParcelaCurta(estruturaParcela(c.tipoProduto, p.produtoCodigo))}{' '}
                          {fmtBRLc(p.parcela1a12)} · demais {fmtBRLc(p.parcelaDemais)} (
                          {p.produtoCodigo})
                        </SelectItem>
                      ))}

                    </SelectContent>
                  </Select>

                  {/* Sem vermelho: a tela explica o que falta, o botão de salvar
                      da tela segue clicável e o caminho manual segue aberto. */}
                  {carregandoPlanos && (
                    <p className="text-[11px] text-muted-foreground">Carregando planos da tabela…</p>
                  )}
                  {!carregandoPlanos && faltando.length > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Escolha {faltando.join(', ')} acima para a lista de planos aparecer — ou informe
                      crédito e parcela manualmente.
                    </p>
                  )}
                  {!carregandoPlanos && faltando.length === 0 && prazoForaDaTabela && (
                    <p className="text-[11px] text-muted-foreground">
                      A tabela só tem planos para 200, 220 e 240 meses. Para {c.prazoMeses} meses,
                      informe crédito e parcela manualmente.
                    </p>
                  )}
                  {!carregandoPlanos && faltando.length === 0 && !prazoForaDaTabela && planos.length === 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Nenhum plano cadastrado para esta combinação de produto, prazo e condição.
                      Informe crédito e parcela manualmente — a venda pode ser lançada assim.
                    </p>
                  )}
                  {perdido && (
                    <p className="text-[11px] text-muted-foreground">
                      A tabela não tem esse plano em {perdido.prazo || '—'} meses /{' '}
                      {condicaoLabel(perdido.condicao)}. Os valores continuam como estavam — escolha
                      outro plano ou confira à mão.
                    </p>
                  )}

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div>
                      <Label className="text-xs">Crédito (R$)</Label>
                      {/* `required` aqui só controla o aviso visual de vazio — a regra
                          de salvar continua sendo `cartaDraftValida`, intocada. */}
                      <CurrencyInput
                        value={c.valorStr}
                        onChange={masked => patch(c.key, { valorStr: masked })}
                        required
                        showError={invalida}
                        disabled={!manual}
                        placeholder="Digite o valor do crédito"
                        emptyHint="Campo vazio — digite o crédito."
                        inputClassName="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">{rotulos.diferenciada}</Label>
                      {/* Segue opcional: sem `required` não aparece linha de vazio. */}
                      <CurrencyInput
                        value={c.parcela1a12Str}
                        onChange={masked => patch(c.key, { parcela1a12Str: masked })}
                        disabled={!manual}
                        placeholder="Digite o valor da parcela"
                        inputClassName="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">{rotulos.demais}</Label>
                      <CurrencyInput
                        value={c.parcelaDemaisStr}
                        onChange={masked => patch(c.key, { parcelaDemaisStr: masked })}
                        disabled={!manual}
                        placeholder="Digite o valor da parcela"
                        inputClassName="h-9"
                      />
                    </div>
                  </div>

                  {estrutura === 'primeira_parcela' && (
                    <p className="text-[11px] text-muted-foreground">
                      Neste produto só a 1ª parcela é diferente; da 2ª em diante todas são iguais.
                    </p>
                  )}


                  {!manual && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[11px] text-muted-foreground"
                      onClick={() => virarManual(c.key)}
                    >
                      <Pencil className="mr-1 h-3 w-3" /> editar manualmente
                    </Button>
                  )}

                  {foraDaTabela && (
                    <div>
                      <Label className="text-xs">Observação do plano (anotação de tela)</Label>
                      <Input
                        className="h-9"
                        value={obsPorCarta[c.key] || ''}
                        onChange={e => setObsPorCarta(m => ({ ...m, [c.key]: e.target.value }))}
                        placeholder="Ex: crédito novo da Embracon, 264x sem tabela"
                        maxLength={120}
                      />
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Esta anotação NÃO é gravada: serve só de apoio enquanto a tela está aberta e
                        some ao fechar. Para registrar junto da venda, escreva em “Detalhes da
                        Proposta”.
                      </p>

                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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

                  <ParcelasMcfPicker
                    value={c.parcelasMcf}
                    onChange={v => patch(c.key, { parcelasMcf: v })}
                    label="Parcelas que a MCF paga (intenção)"
                  />

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
