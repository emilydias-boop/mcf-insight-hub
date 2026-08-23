import { useMemo, useState } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAllConsorcioCreditos } from '@/hooks/useConsorcioCreditosAdmin';
import { useConsorcioProdutos } from '@/hooks/useConsorcioProdutos';
import { useConsorcioObjetivoOptions } from '@/hooks/useConsorcioObjetivoOptions';
import { CONDICAO_PAGAMENTO_OPTIONS } from '@/types/consorcioProdutos';
import { formatBRLInput, parseBRLInput, numberToBRLInput } from '@/lib/brlMask';
import { produtosElegiveisParaCarta, taxaAntecipadaTipoDeProduto } from '@/lib/consorcioParcelaOficial';


const condSuffix = (c: string) => (c === '50' ? '50' : c === '25' ? '25' : 'conv');

/** Converte campo BRL em número preservando o zero legítimo (vazio → undefined). */
const brlOuUndefined = (s: string): number | undefined => {
  if (s == null || String(s).trim() === '') return undefined;
  const n = parseBRLInput(s);
  return Number.isFinite(n) ? n : undefined;
};

export type ParcelasFonte = 'tabela' | 'manual' | null;

/**
 * Estado + regras do bloco "Dados do plano" — compartilhado entre o aceite da proposta
 * (AcceptProposalModal) e a edição/abertura do cadastro pendente (OpenCotaModal),
 * para que o autopreenchimento por condição + prazo não divirja entre as telas.
 */
/**
 * Quando a tela hospedeira já possui os campos Prazo e Condição no próprio formulário,
 * ela passa `controlled` — o hook então NÃO mantém cópia própria desses dois valores:
 * lê sempre o valor efetivo do formulário e escreve de volta pelos setters.
 * Assim prazo/condição têm uma única fonte de verdade e não podem divergir.
 */
export interface DadosPlanoControlled {
  prazo: string;
  condicao: string;
  setPrazo: (v: string) => void;
  setCondicao: (v: string) => void;
}

/**
 * `tipoProduto` da carta ('select' | 'parcelinha'): quando informado, o seletor de
 * plano passa a mostrar SÓ os planos dos produtos elegíveis para aquela carta
 * (tipo de taxa antecipada + faixa de crédito). Sem ele, nada muda.
 */
export interface DadosPlanoOpcoes {
  tipoProduto?: string | null;
}

export function useDadosPlano(controlled?: DadosPlanoControlled, opcoes?: DadosPlanoOpcoes) {
  const { data: creditos = [] } = useAllConsorcioCreditos();
  const { data: produtos = [] } = useConsorcioProdutos();
  const { data: objetivos = [] } = useConsorcioObjetivoOptions();

  const [creditoId, setCreditoIdState] = useState('');
  const [planoOpen, setPlanoOpen] = useState(false);
  const [valorCreditoStr, setValorCreditoStr] = useState('');
  const [prazoInterno, setPrazoInterno] = useState('');
  const [condicaoInterna, setCondicaoInterna] = useState('convencional');
  // Fonte única de verdade: o formulário do pai quando controlado, o estado local caso contrário.
  const prazo = controlled ? controlled.prazo : prazoInterno;
  const condicao = controlled ? controlled.condicao : condicaoInterna;
  const setPrazoState = controlled ? controlled.setPrazo : setPrazoInterno;
  const setCondicaoState = controlled ? controlled.setCondicao : setCondicaoInterna;
  const [parcela1a12, setParcela1a12State] = useState('');
  const [parcelaDemais, setParcelaDemaisState] = useState('');
  const [parcelasFonte, setParcelasFonte] = useState<ParcelasFonte>(null);
  const [diaVencimento, setDiaVencimento] = useState('');
  const [inicioSegundaParcela, setInicioSegundaParcela] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [incluiSeguro, setIncluiSeguro] = useState(false);

  const creditosAtivos = useMemo(() => creditos.filter((c) => c.ativo), [creditos]);
  const creditoSelecionado = creditos.find((c) => c.id === creditoId);
  const produtoDoPlano = produtos.find((p) => p.id === creditoSelecionado?.produto_id);

  // ===== Filtro do seletor pelo produto da carta =====
  const tipoProdutoCarta = opcoes?.tipoProduto ?? null;
  const valorCreditoNum = brlOuUndefined(valorCreditoStr) ?? 0;
  /** Produtos elegíveis para (tipo de produto + faixa de crédito) — pode ser mais de um. */
  const produtosElegiveis = useMemo(() => {
    if (!tipoProdutoCarta || valorCreditoNum <= 0) return [];
    return produtosElegiveisParaCarta(produtos as any[], valorCreditoNum, tipoProdutoCarta);
  }, [produtos, tipoProdutoCarta, valorCreditoNum]);
  const filtroProdutoAtivo = !!tipoProdutoCarta && valorCreditoNum > 0;
  /** Lista que o seletor mostra: filtrada quando há produto resolvido, completa quando não há. */
  const planosVisiveis = useMemo(() => {
    if (!filtroProdutoAtivo) return creditosAtivos;
    const ids = new Set(produtosElegiveis.map((p: any) => p.id));
    return creditosAtivos.filter((c) => ids.has(c.produto_id));
  }, [creditosAtivos, produtosElegiveis, filtroProdutoAtivo]);

  const prazosDisponiveis = produtoDoPlano?.prazos_disponiveis?.length
    ? produtoDoPlano.prazos_disponiveis
    : [200, 220, 240];
  const prazoSemTabela = !!prazo && ![200, 220, 240].includes(Number(prazo));


  const aplicarValoresTabela = (credito: any, cond: string, prz: string) => {
    if (!credito || !prz) return;
    // Colunas de parcela só existem para 200/220/240 — não apague o que o closer digitou, nem mexa no selo.
    if (![200, 220, 240].includes(Number(prz))) return;
    const c1 = credito[`parcela_1a_12a_${condSuffix(cond)}_${prz}`];
    const c2 = credito[`parcela_demais_${condSuffix(cond)}_${prz}`];
    if (c1 || c2) {
      setParcela1a12State(numberToBRLInput(c1 ?? null));
      setParcelaDemaisState(numberToBRLInput(c2 ?? null));
      setParcelasFonte('tabela');
    } else {
      // Prazo válido sem valor cadastrado nesta combinação: mantém o digitado,
      // mas zera a fonte para o selo "da tabela oficial" não continuar mentindo.
      setParcelasFonte(null);
    }
  };

  const semValorTabelado =
    !!creditoSelecionado && !!prazo && !prazoSemTabela && parcelasFonte === null;

  const selecionarPlano = (id: string) => {
    const credito = creditos.find((c) => c.id === id);
    setCreditoIdState(id);
    setPlanoOpen(false);
    if (credito) {
      setValorCreditoStr(numberToBRLInput(credito.valor_credito));
      aplicarValoresTabela(credito, condicao, prazo);
    }
  };

  const setPrazo = (v: string) => {
    setPrazoState(v);
    aplicarValoresTabela(creditoSelecionado, condicao, v);
  };
  const setCondicao = (v: string) => {
    setCondicaoState(v);
    aplicarValoresTabela(creditoSelecionado, v, prazo);
  };

  const setParcela1a12 = (raw: string) => {
    setParcela1a12State(formatBRLInput(raw));
    setParcelasFonte('manual');
  };
  const setParcelaDemais = (raw: string) => {
    setParcelaDemaisState(formatBRLInput(raw));
    setParcelasFonte('manual');
  };

  /** Carrega valores já gravados (edição de cadastro pendente) sem marcar como manual. */
  const hidratar = (v: {
    creditoId?: string | null;
    valorCredito?: number | null;
    prazo?: number | null;
    condicao?: string | null;
    parcela1a12?: number | null;
    parcelaDemais?: number | null;
    diaVencimento?: number | null;
    inicioSegundaParcela?: string | null;
    objetivo?: string | null;
    incluiSeguro?: boolean | null;
  }) => {
    if (v.creditoId) setCreditoIdState(v.creditoId);
    if (v.valorCredito != null) setValorCreditoStr(numberToBRLInput(v.valorCredito));
    // Prazo/condição controlados pelo pai são hidratados pelo próprio formulário dele.
    if (!controlled) {
      if (v.prazo != null) setPrazoInterno(String(v.prazo));
      if (v.condicao) setCondicaoInterna(v.condicao);
    }
    if (v.parcela1a12 != null) setParcela1a12State(numberToBRLInput(v.parcela1a12));
    if (v.parcelaDemais != null) setParcelaDemaisState(numberToBRLInput(v.parcelaDemais));
    if (v.diaVencimento != null) setDiaVencimento(String(v.diaVencimento));
    if (v.inicioSegundaParcela) setInicioSegundaParcela(v.inicioSegundaParcela);
    if (v.objetivo) setObjetivo(v.objetivo);
    if (v.incluiSeguro != null) setIncluiSeguro(!!v.incluiSeguro);
  };

  // Falta QUALQUER campo que o Termo de Adesão precisa (os herdados da proposta não contam).
  const termoIncompleto =
    !creditoId || !parseBRLInput(parcela1a12) || !parseBRLInput(parcelaDemais) || !diaVencimento;

  return {
    creditos, creditosAtivos, produtos, objetivos,
    planosVisiveis, produtosElegiveis, filtroProdutoAtivo,
    tipoProdutoCarta, valorCreditoNum,
    taxaAntecipadaTipoCarta: taxaAntecipadaTipoDeProduto(tipoProdutoCarta),
    condSuffix,

    creditoId, planoOpen, setPlanoOpen, selecionarPlano,
    valorCreditoStr, setValorCreditoStr,
    prazo, setPrazo, condicao, setCondicao,
    parcela1a12, setParcela1a12, parcelaDemais, setParcelaDemais, parcelasFonte,
    diaVencimento, setDiaVencimento,
    inicioSegundaParcela, setInicioSegundaParcela,
    objetivo, setObjetivo, incluiSeguro, setIncluiSeguro,
    creditoSelecionado, produtoDoPlano, prazosDisponiveis, prazoSemTabela, semValorTabelado,
    termoIncompleto, hidratar,
    valores: {
      credito_id: creditoId || undefined,
      valor_credito: brlOuUndefined(valorCreditoStr),
      prazo_meses: prazo ? Number(prazo) : undefined,
      condicao_pagamento: condicao || undefined,
      parcela_1a_12a: brlOuUndefined(parcela1a12),
      parcela_demais: brlOuUndefined(parcelaDemais),
      dia_vencimento: diaVencimento ? Number(diaVencimento) : undefined,
      inicio_segunda_parcela: inicioSegundaParcela || undefined,
      objetivo: objetivo || undefined,
      produto_codigo: produtoDoPlano?.codigo || undefined,
    },
  };
}

export type DadosPlanoState = ReturnType<typeof useDadosPlano>;

interface DadosPlanoFieldsProps {
  plano: DadosPlanoState;
  /** Campos que a tela hospedeira já possui e portanto não devem ser repetidos aqui. */
  hide?: Array<'valorCredito' | 'prazo' | 'condicao' | 'diaVencimento' | 'inicioSegundaParcela' | 'incluiSeguro' | 'objetivo'>;
  disabled?: boolean;
  showAviso?: boolean;
}

export function DadosPlanoFields({ plano, hide = [], disabled, showAviso = true }: DadosPlanoFieldsProps) {
  const oculto = (f: DadosPlanoFieldsProps['hide'][number]) => hide.includes(f);
  const selos = (
    <>
      {plano.parcelasFonte === 'tabela' && <Badge variant="secondary" className="text-[10px]">da tabela oficial</Badge>}
      {plano.parcelasFonte === 'manual' && <Badge variant="outline" className="text-[10px]">editado manualmente</Badge>}
    </>
  );

  return (
    <div className="space-y-3">
      {showAviso && plano.termoIncompleto && (
        <p className="text-xs text-muted-foreground">
          Preencha para gerar o Termo de Adesão. Sem estes dados o aceite funciona, mas o termo não pode ser emitido.
        </p>
      )}

      <div className="space-y-2">
        <Label>Plano</Label>
        {plano.creditosAtivos.length === 0 ? (
          <p className="text-xs text-muted-foreground rounded-md border border-dashed p-2">
            Nenhum plano cadastrado. Cadastre em Cadastros → Planos.
          </p>
        ) : (
          <Popover open={plano.planoOpen} onOpenChange={plano.setPlanoOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" disabled={disabled} className="w-full justify-between font-normal">
                <span className="truncate">
                  {plano.creditoSelecionado
                    ? `${plano.creditoSelecionado.codigo_credito} — ${Number(plano.creditoSelecionado.valor_credito).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                    : 'Selecione o plano'}
                </span>
                <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar por código ou valor..." />
                <CommandList>
                  <CommandEmpty>Nenhum plano encontrado.</CommandEmpty>
                  <CommandGroup>
                    {plano.creditosAtivos.map((c) => {
                      const prod = plano.produtos.find((p) => p.id === c.produto_id);
                      if (!prod) return null;
                      const valor = Number(c.valor_credito).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                      return (
                        <CommandItem
                          key={c.id}
                          value={`${c.codigo_credito} ${valor} ${prod.codigo}`}
                          onSelect={() => plano.selecionarPlano(c.id)}
                        >
                          <span className="truncate">
                            {c.codigo_credito} — {valor}
                            <span className="text-muted-foreground text-xs"> · {prod.codigo}</span>
                          </span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
        {plano.creditoSelecionado && !plano.prazo && (
          <p className="text-xs text-muted-foreground">
            Escolha o prazo para preencher os valores da tabela.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {!oculto('valorCredito') && (
          <div className="space-y-2">
            <Label>Valor do crédito (R$)</Label>
            <Input
              inputMode="numeric"
              disabled={disabled}
              value={plano.valorCreditoStr}
              onChange={(e) => plano.setValorCreditoStr(formatBRLInput(e.target.value))}
              placeholder="150.000,00"
            />
          </div>
        )}
        {!oculto('prazo') && (
          <div className="space-y-2">
            <Label>Prazo (meses)</Label>
            <Select value={plano.prazo} onValueChange={plano.setPrazo} disabled={disabled}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {plano.prazosDisponiveis.map((p) => (
                  <SelectItem key={p} value={String(p)}>{p} meses</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {plano.prazoSemTabela && (
          <div className="sm:col-span-2">
            <p className="text-xs text-amber-500">Não há valor tabelado para este prazo; informe manualmente.</p>
          </div>
        )}
        {!oculto('condicao') && (
          <div className="space-y-2 sm:col-span-2">
            <Label>Condição de pagamento</Label>
            <Select value={plano.condicao} onValueChange={plano.setCondicao} disabled={disabled}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONDICAO_PAGAMENTO_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">Parcela 1ª à 12ª {selos}</Label>
          <Input
            inputMode="numeric"
            disabled={disabled}
            value={plano.parcela1a12}
            onChange={(e) => plano.setParcela1a12(e.target.value)}
            placeholder="0,00"
          />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-2">Demais parcelas {selos}</Label>
          <Input
            inputMode="numeric"
            disabled={disabled}
            value={plano.parcelaDemais}
            onChange={(e) => plano.setParcelaDemais(e.target.value)}
            placeholder="0,00"
          />
        </div>
        {plano.semValorTabelado && (
          <div className="sm:col-span-2">
            <p className="text-xs text-amber-500">sem valor tabelado para esta combinação</p>
          </div>
        )}
        {!oculto('diaVencimento') && (
          <div className="space-y-2">
            <Label>Dia de vencimento</Label>
            <Input
              type="number"
              min={1}
              max={28}
              disabled={disabled}
              value={plano.diaVencimento}
              onChange={(e) => plano.setDiaVencimento(e.target.value)}
              placeholder="1 a 28"
            />
          </div>
        )}
        {!oculto('inicioSegundaParcela') && (
          <div className="space-y-2">
            <Label>Início da 2ª parcela</Label>
            <Input
              type="date"
              disabled={disabled}
              value={plano.inicioSegundaParcela}
              onChange={(e) => plano.setInicioSegundaParcela(e.target.value)}
            />
          </div>
        )}
        {!oculto('objetivo') && (
          <div className="space-y-2">
            <Label>Objetivo</Label>
            <Select value={plano.objetivo} onValueChange={plano.setObjetivo} disabled={disabled}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {plano.objetivos.map((o) => (
                  <SelectItem key={o.id} value={o.name}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {!oculto('incluiSeguro') && (
          <div className="flex items-center gap-2 pt-6">
            <Switch checked={plano.incluiSeguro} onCheckedChange={plano.setIncluiSeguro} disabled={disabled} />
            <Label>Inclui seguro de vida</Label>
          </div>
        )}
      </div>
    </div>
  );
}
