import { useState, useCallback, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { parseChecklistPF, parseChecklistPJ } from '@/lib/checklistParser';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, Plus, Trash2, Upload, FileText, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { validateCpf, validateCnpj, buscarCnpj } from '@/lib/documentUtils';
import { buscarCep } from '@/lib/cepUtils';
import { useCreatePendingRegistration } from '@/hooks/useConsorcioPendingRegistrations';
import { TipoDocumento } from '@/types/consorcio';
import { Switch } from '@/components/ui/switch';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { ChevronsUpDown } from 'lucide-react';
import { useAllConsorcioCreditos } from '@/hooks/useConsorcioCreditosAdmin';
import { useConsorcioProdutos } from '@/hooks/useConsorcioProdutos';
import { useConsorcioObjetivoOptions } from '@/hooks/useConsorcioObjetivoOptions';
import { CONDICAO_PAGAMENTO_OPTIONS } from '@/types/consorcioProdutos';
import { formatBRLInput, parseBRLInput, numberToBRLInput } from '@/lib/brlMask';

const condSuffix = (c: string) => (c === '50' ? '50' : c === '25' ? '25' : 'conv');

// Formatting functions
function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function formatCep(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

const pfSchema = z.object({
  tipo_pessoa: z.literal('pf'),
  nome_completo: z.string().min(1, 'Nome é obrigatório'),
  rg: z.string().min(1, 'RG é obrigatório'),
  cpf: z.string().min(1, 'CPF é obrigatório').refine(validateCpf, 'CPF inválido'),
  cpf_conjuge: z.string().optional(),
  profissao: z.string().min(1, 'Profissão é obrigatória'),
  telefone: z.string().min(1, 'Telefone é obrigatório'),
  email: z.string().email('Email inválido'),
  endereco_completo: z.string().min(1, 'Endereço é obrigatório'),
  endereco_cep: z.string().min(8, 'CEP é obrigatório'),
  renda: z.number().positive('Renda é obrigatória'),
  patrimonio: z.number().min(0, 'Patrimônio é obrigatório'),
  pix: z.string().min(1, 'Chave PIX é obrigatória'),
});

const pjSchema = z.object({
  tipo_pessoa: z.literal('pj'),
  razao_social: z.string().min(1, 'Razão social é obrigatória'),
  cnpj: z.string().min(1, 'CNPJ é obrigatório').refine(validateCnpj, 'CNPJ inválido'),
  natureza_juridica: z.string().min(1, 'Natureza jurídica é obrigatória'),
  inscricao_estadual: z.string().min(1, 'Inscrição estadual é obrigatória'),
  data_fundacao: z.string().min(1, 'Data de fundação é obrigatória'),
  telefone_comercial: z.string().min(1, 'Telefone é obrigatório'),
  email_comercial: z.string().email('Email inválido'),
  endereco_comercial: z.string().min(1, 'Endereço é obrigatório'),
  endereco_comercial_cep: z.string().min(8, 'CEP é obrigatório'),
  num_funcionarios: z.number().min(0, 'Número de funcionários é obrigatório'),
  faturamento_mensal: z.number().positive('Faturamento é obrigatório'),
  socios: z.array(z.object({
    cpf: z.string().min(1, 'CPF do sócio é obrigatório'),
    renda: z.number().min(0, 'Renda é obrigatória'),
  })).min(1, 'Pelo menos um sócio é obrigatório'),
});

const formSchema = z.discriminatedUnion('tipo_pessoa', [pfSchema, pjSchema]);

type FormData = z.infer<typeof formSchema>;

interface AcceptProposalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposalId: string;
  dealId: string;
  contactName: string;
  vendedorName: string;
}

export function AcceptProposalModal({
  open,
  onOpenChange,
  proposalId,
  dealId,
  contactName,
  vendedorName,
}: AcceptProposalModalProps) {
  const [tipoPessoa, setTipoPessoa] = useState<'pf' | 'pj'>('pf');
  const [loadingCep, setLoadingCep] = useState(false);
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [checklistText, setChecklistText] = useState('');
  const [showChecklistPJ, setShowChecklistPJ] = useState(false);
  const [checklistTextPJ, setChecklistTextPJ] = useState('');
  const [pfDocuments, setPfDocuments] = useState<File[]>([]);
  const [pjDocContratoSocial, setPjDocContratoSocial] = useState<File | null>(null);
  const [pjDocRgSocios, setPjDocRgSocios] = useState<File | null>(null);
  const [pjDocCartaoCnpj, setPjDocCartaoCnpj] = useState<File | null>(null);

  // Parcelas que a empresa pagará (capturado já aqui no aceite)
  const [empresaPaga, setEmpresaPaga] = useState<'sim' | 'nao'>('nao');
  const [tipoContrato, setTipoContrato] = useState<'normal' | 'intercalado' | 'intercalado_impar'>('normal');
  const [qtdParcelasEmpresa, setQtdParcelasEmpresa] = useState<number>(0);

  // ===== Dados do plano (comerciais do Termo de Adesão) =====
  const { data: creditos = [] } = useAllConsorcioCreditos();
  const { data: produtos = [] } = useConsorcioProdutos();
  const { data: objetivos = [] } = useConsorcioObjetivoOptions();
  const [creditoId, setCreditoId] = useState('');
  const [planoOpen, setPlanoOpen] = useState(false);
  const [valorCreditoStr, setValorCreditoStr] = useState('');
  const [prazo, setPrazo] = useState('');
  const [condicao, setCondicao] = useState('convencional');
  const [parcela1a12, setParcela1a12] = useState('');
  const [parcelaDemais, setParcelaDemais] = useState('');
  const [parcelasFonte, setParcelasFonte] = useState<'tabela' | 'manual' | null>(null);
  const [diaVencimento, setDiaVencimento] = useState('');
  const [inicioSegundaParcela, setInicioSegundaParcela] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [incluiSeguro, setIncluiSeguro] = useState(false);

  const creditosAtivos = creditos.filter((c) => c.ativo);
  const creditoSelecionado = creditos.find((c) => c.id === creditoId);
  const produtoDoPlano = produtos.find((p) => p.id === creditoSelecionado?.produto_id);
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
      setParcela1a12(numberToBRLInput(c1 ?? null));
      setParcelaDemais(numberToBRLInput(c2 ?? null));
      setParcelasFonte('tabela');
    } else {
      // Prazo válido mas sem valor cadastrado nesta combinação: mantém os valores digitados,
      // mas zera a fonte para o selo "da tabela oficial" não continuar mentindo.
      setParcelasFonte(null);
    }
  };

  // true quando há plano + prazo válido, mas a combinação não tem valor tabelado.
  const semValorTabelado =
    !!creditoSelecionado && !!prazo && !prazoSemTabela && parcelasFonte === null;

  const handleSelectPlano = (id: string) => {
    const credito = creditos.find((c) => c.id === id);
    setCreditoId(id);
    setPlanoOpen(false);
    if (credito) {
      setValorCreditoStr(numberToBRLInput(credito.valor_credito));
      aplicarValoresTabela(credito, condicao, prazo);
    }
  };

  // Bloco "Dados do plano" é opcional: serve para emitir o Termo de Adesão, não trava o aceite.
  // O aviso aparece quando falta QUALQUER campo que o termo precisa (plano, parcelas, dia de vencimento).
  // Os campos herdados da proposta (valor do crédito, prazo) não contam.
  const termoIncompleto =
    !creditoId ||
    !parseBRLInput(parcela1a12) ||
    !parseBRLInput(parcelaDemais) ||
    !diaVencimento;

  // Carrega proposta para pegar valor_credito/prazo
  const { data: proposal } = useQuery({
    queryKey: ['consorcio-proposal-snapshot', proposalId],
    enabled: open && !!proposalId,
    queryFn: async () => {
      const { data } = await supabase
        .from('consorcio_proposals')
        .select('valor_credito, prazo_meses, proposal_details')
        .eq('id', proposalId)
        .maybeSingle();
      return data;
    },
  });

  const createRegistration = useCreatePendingRegistration();

  const form = useForm<any>({
    defaultValues: {
      tipo_pessoa: 'pf',
      nome_completo: contactName || '',
      rg: '',
      cpf: '',
      cpf_conjuge: '',
      profissao: '',
      telefone: '',
      email: '',
      endereco_completo: '',
      endereco_cep: '',
      renda: 0,
      patrimonio: 0,
      pix: '',
      // PJ
      razao_social: '',
      cnpj: '',
      natureza_juridica: '',
      inscricao_estadual: '',
      data_fundacao: '',
      telefone_comercial: '',
      email_comercial: '',
      endereco_comercial: '',
      endereco_comercial_cep: '',
      num_funcionarios: 0,
      faturamento_mensal: 0,
      socios: [{ cpf: '', renda: 0 }],
    },
  });

  const { fields: socioFields, append: addSocio, remove: removeSocio } = useFieldArray({
    control: form.control,
    name: 'socios',
  });

  // Validação: checklist preenchido + ao menos 1 documento anexado
  const watched = form.watch();
  const isFilled = (v: any) => v !== undefined && v !== null && String(v).trim() !== '' && v !== 0;
  const checklistOk = tipoPessoa === 'pf'
    ? ['nome_completo','rg','cpf','profissao','telefone','email','endereco_completo','endereco_cep','renda','patrimonio','pix']
        .every((k) => isFilled((watched as any)[k]))
    : ['razao_social','cnpj','natureza_juridica','inscricao_estadual','data_fundacao','telefone_comercial','email_comercial','endereco_comercial','endereco_comercial_cep','faturamento_mensal']
        .every((k) => isFilled((watched as any)[k]))
      && Array.isArray((watched as any).socios)
      && (watched as any).socios.length > 0
      && (watched as any).socios.every((s: any) => isFilled(s?.cpf));
  const docsOk = tipoPessoa === 'pf'
    ? pfDocuments.length > 0
    : !!(pjDocContratoSocial && pjDocRgSocios && pjDocCartaoCnpj);
  const canSubmit = checklistOk && docsOk;

  // Pré-preenche valor do crédito e prazo com o que veio da proposta
  useEffect(() => {
    if (!proposal) return;
    if (!valorCreditoStr && proposal.valor_credito) {
      setValorCreditoStr(numberToBRLInput(Number(proposal.valor_credito)));
    }
    if (!prazo && proposal.prazo_meses) setPrazo(String(proposal.prazo_meses));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal]);

  const handleCepLookup = useCallback(async (cep: string, prefix: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;
    setLoadingCep(true);
    try {
      const result = await buscarCep(cep);
      if (result) {
        const addr = `${result.rua}, ${result.bairro}, ${result.cidade} - ${result.estado}`;
        if (prefix === 'endereco') {
          form.setValue('endereco_completo', addr);
        } else {
          form.setValue('endereco_comercial', addr);
        }
      }
    } finally {
      setLoadingCep(false);
    }
  }, [form]);

  const handleCnpjLookup = useCallback(async (cnpj: string) => {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) return;
    setLoadingCnpj(true);
    try {
      const result = await buscarCnpj(cnpj);
      if (result) {
        form.setValue('razao_social', result.razao_social);
        if (result.natureza_juridica) form.setValue('natureza_juridica', result.natureza_juridica);
        if (result.data_fundacao) form.setValue('data_fundacao', result.data_fundacao);
        if (result.telefone) form.setValue('telefone_comercial', formatPhone(result.telefone));
        if (result.email) form.setValue('email_comercial', result.email);
        if (result.cep) {
          form.setValue('endereco_comercial_cep', formatCep(result.cep));
          const addr = `${result.logradouro || ''} ${result.numero || ''}, ${result.bairro || ''}, ${result.municipio || ''} - ${result.uf || ''}`;
          form.setValue('endereco_comercial', addr.trim());
        }
      }
    } finally {
      setLoadingCnpj(false);
    }
  }, [form]);

  const onSubmit = async (data: any) => {
    // Documentos são opcionais — podem ser anexados posteriormente

    // Build documents array
    const documents: Array<{ file: File; tipo: TipoDocumento }> = [];
    if (tipoPessoa === 'pf') {
      pfDocuments.forEach(f => documents.push({ file: f, tipo: 'cnh' }));
    } else {
      if (pjDocContratoSocial) documents.push({ file: pjDocContratoSocial, tipo: 'contrato_social' });
      if (pjDocRgSocios) documents.push({ file: pjDocRgSocios, tipo: 'cnh' });
      if (pjDocCartaoCnpj) documents.push({ file: pjDocCartaoCnpj, tipo: 'cartao_cnpj' });
    }

    // Filtrar campos irrelevantes baseado no tipo de pessoa para evitar enviar strings vazias
    const pjOnlyFields = ['razao_social', 'cnpj', 'natureza_juridica', 'inscricao_estadual', 'data_fundacao', 'faturamento_mensal', 'num_funcionarios', 'email_comercial', 'telefone_comercial', 'endereco_comercial', 'endereco_comercial_cep', 'socios'];
    const pfOnlyFields = ['nome_completo', 'rg', 'cpf', 'cpf_conjuge', 'profissao'];
    const fieldsToExclude = tipoPessoa === 'pf' ? pjOnlyFields : pfOnlyFields;
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([k]) => !fieldsToExclude.includes(k))
    );

    await createRegistration.mutateAsync({
      proposal_id: proposalId,
      deal_id: dealId,
      tipo_pessoa: tipoPessoa,
      vendedor_name: vendedorName,
      documents,
      empresa_paga_parcelas: empresaPaga,
      tipo_contrato: tipoContrato,
      parcelas_pagas_empresa: empresaPaga === 'sim' ? Number(qtdParcelasEmpresa || 0) : 0,
      valor_credito: parseBRLInput(valorCreditoStr) || (proposal?.valor_credito ? Number(proposal.valor_credito) : undefined),
      prazo_meses: prazo ? Number(prazo) : (proposal?.prazo_meses ? Number(proposal.prazo_meses) : undefined),
      credito_id: creditoId || undefined,
      produto_codigo: produtoDoPlano?.codigo || undefined,
      condicao_pagamento: condicao || undefined,
      parcela_1a_12a: parseBRLInput(parcela1a12) || undefined,
      parcela_demais: parseBRLInput(parcelaDemais) || undefined,
      dia_vencimento: diaVencimento ? Number(diaVencimento) : undefined,
      inicio_segunda_parcela: inicioSegundaParcela || undefined,
      objetivo: objetivo || undefined,
      inclui_seguro: incluiSeguro,
      observacoes: proposal?.proposal_details?.trim() || undefined,
      ...cleanData,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Cadastrar Dados da Cota</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Preencha os dados completos do cliente para enviar ao Cadastros Pendentes.
          </p>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-4">
            {/* ===== Dados do plano ===== */}
            <div className="space-y-3 rounded-lg border p-3">
              <h3 className="font-semibold text-sm">Dados do plano</h3>
              {termoIncompleto && (
                <p className="text-xs text-muted-foreground">
                  Preencha para gerar o Termo de Adesão. Sem estes dados o aceite funciona, mas o termo não pode ser emitido.
                </p>
              )}

              <div className="space-y-2">
                <Label>Plano</Label>
                {creditosAtivos.length === 0 ? (
                  <p className="text-xs text-muted-foreground rounded-md border border-dashed p-2">
                    Nenhum plano cadastrado. Cadastre em Configurações → Planos.
                  </p>
                ) : (
                <Popover open={planoOpen} onOpenChange={setPlanoOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-between font-normal">
                      <span className="truncate">
                        {creditoSelecionado
                          ? `${creditoSelecionado.codigo_credito} — ${Number(creditoSelecionado.valor_credito).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
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
                          {creditosAtivos.map((c) => {
                            const prod = produtos.find((p) => p.id === c.produto_id);
                            if (!prod) return null;
                            const valor = Number(c.valor_credito).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                            return (
                              <CommandItem
                                key={c.id}
                                value={`${c.codigo_credito} ${valor} ${prod.codigo}`}
                                onSelect={() => handleSelectPlano(c.id)}
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Valor do crédito (R$)</Label>
                  <Input
                    inputMode="numeric"
                    value={valorCreditoStr}
                    onChange={(e) => setValorCreditoStr(formatBRLInput(e.target.value))}
                    placeholder="150.000,00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Prazo (meses)</Label>
                  <Select
                    value={prazo}
                    onValueChange={(v) => { setPrazo(v); aplicarValoresTabela(creditoSelecionado, condicao, v); }}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {prazosDisponiveis.map((p) => (
                        <SelectItem key={p} value={String(p)}>{p} meses</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {prazoSemTabela && (
                    <p className="text-xs text-amber-500">
                      Não há valor tabelado para este prazo; informe manualmente.
                    </p>
                  )}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Condição de pagamento</Label>
                  <Select
                    value={condicao}
                    onValueChange={(v) => { setCondicao(v); aplicarValoresTabela(creditoSelecionado, v, prazo); }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONDICAO_PAGAMENTO_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    Parcela 1ª à 12ª
                    {parcelasFonte === 'tabela' && <Badge variant="secondary" className="text-[10px]">da tabela oficial</Badge>}
                    {parcelasFonte === 'manual' && <Badge variant="outline" className="text-[10px]">editado manualmente</Badge>}
                  </Label>
                  <Input
                    inputMode="numeric"
                    value={parcela1a12}
                    onChange={(e) => { setParcela1a12(formatBRLInput(e.target.value)); setParcelasFonte('manual'); }}
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    Demais parcelas
                    {parcelasFonte === 'tabela' && <Badge variant="secondary" className="text-[10px]">da tabela oficial</Badge>}
                    {parcelasFonte === 'manual' && <Badge variant="outline" className="text-[10px]">editado manualmente</Badge>}
                  </Label>
                  <Input
                    inputMode="numeric"
                    value={parcelaDemais}
                    onChange={(e) => { setParcelaDemais(formatBRLInput(e.target.value)); setParcelasFonte('manual'); }}
                    placeholder="0,00"
                  />
                </div>
                {semValorTabelado && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-amber-500">sem valor tabelado para esta combinação</p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Dia de vencimento</Label>
                  <Input
                    type="number"
                    min={1}
                    max={28}
                    value={diaVencimento}
                    onChange={(e) => setDiaVencimento(e.target.value)}
                    placeholder="1 a 28"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Início da 2ª parcela</Label>
                  <Input type="date" value={inicioSegundaParcela} onChange={(e) => setInicioSegundaParcela(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Objetivo</Label>
                  <Select value={objetivo} onValueChange={setObjetivo}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {objetivos.map((o) => (
                        <SelectItem key={o.id} value={o.name}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={incluiSeguro} onCheckedChange={setIncluiSeguro} />
                  <Label>Inclui seguro de vida</Label>
                </div>
              </div>
            </div>

            {/* Tipo de Pessoa */}
            <div className="space-y-2">
              <Label>Tipo de Pessoa *</Label>
              <Select
                value={tipoPessoa}
                onValueChange={(v: 'pf' | 'pj') => {
                  setTipoPessoa(v);
                  form.setValue('tipo_pessoa', v);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pf">Pessoa Física</SelectItem>
                  <SelectItem value="pj">Pessoa Jurídica</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {tipoPessoa === 'pf' ? (
                  <>
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm">Dados Pessoais</h3>
                      <Button type="button" variant="outline" size="sm" onClick={() => setShowChecklist(!showChecklist)}>
                        {showChecklist ? 'Fechar' : '📋 Colar Check-list'}
                      </Button>
                    </div>
                    {showChecklist && (
                      <div className="space-y-2 p-3 border rounded-md bg-muted/30">
                        <Label className="text-xs text-muted-foreground">Cole o texto do check-list abaixo:</Label>
                        <Textarea
                          value={checklistText}
                          onChange={e => setChecklistText(e.target.value)}
                          rows={6}
                          placeholder={"Nome Completo: ...\nRG: ...\nCPF: ...\nCPF Cônjuge: ...\nEndereço Residencial: ...\nCEP: ...\nTelefone: ...\nE-mail: ...\nProfissão: ...\nRenda: R$ ...\nPatrimônio: R$ ...\nChave Pix: ..."}
                        />
                        <Button type="button" size="sm" onClick={() => {
                          const parsed = parseChecklistPF(checklistText);
                          if (parsed.nome_completo) form.setValue('nome_completo', parsed.nome_completo);
                          if (parsed.rg) form.setValue('rg', parsed.rg);
                          if (parsed.cpf) form.setValue('cpf', formatCpf(parsed.cpf));
                          if (parsed.cpf_conjuge) form.setValue('cpf_conjuge', formatCpf(parsed.cpf_conjuge));
                          if (parsed.endereco_completo) form.setValue('endereco_completo', parsed.endereco_completo);
                          if (parsed.endereco_cep) form.setValue('endereco_cep', formatCep(parsed.endereco_cep));
                          if (parsed.telefone) form.setValue('telefone', formatPhone(parsed.telefone));
                          if (parsed.email) form.setValue('email', parsed.email);
                          if (parsed.profissao) form.setValue('profissao', parsed.profissao);
                          if (parsed.renda) form.setValue('renda', parsed.renda);
                          if (parsed.patrimonio) form.setValue('patrimonio', parsed.patrimonio);
                          if (parsed.pix) form.setValue('pix', parsed.pix);
                          setShowChecklist(false);
                          setChecklistText('');
                        }}>
                          Preencher Campos
                        </Button>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name="nome_completo" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                        <FormItem><FormLabel>Nome Completo *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="rg" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                        <FormItem><FormLabel>RG *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="cpf" rules={{ required: 'Obrigatório', validate: (v: string) => !v || validateCpf(v) || 'CPF inválido' }} render={({ field }) => (
                        <FormItem><FormLabel>CPF *</FormLabel><FormControl><Input {...field} onChange={e => field.onChange(formatCpf(e.target.value))} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="cpf_conjuge" render={({ field }) => (
                        <FormItem><FormLabel>CPF Cônjuge</FormLabel><FormControl><Input {...field} onChange={e => field.onChange(formatCpf(e.target.value))} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="profissao" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                        <FormItem><FormLabel>Profissão *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>

                    <h3 className="font-semibold text-sm">Contato</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name="telefone" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                        <FormItem><FormLabel>Telefone *</FormLabel><FormControl><Input {...field} onChange={e => field.onChange(formatPhone(e.target.value))} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="email" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                        <FormItem><FormLabel>Email *</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>

                    <h3 className="font-semibold text-sm">Endereço</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name="endereco_cep" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                        <FormItem>
                          <FormLabel>CEP *</FormLabel>
                          <FormControl>
                            <div className="flex gap-2">
                              <Input {...field} onChange={e => { const v = formatCep(e.target.value); field.onChange(v); if (v.replace(/\D/g, '').length === 8) handleCepLookup(v, 'endereco'); }} />
                              {loadingCep && <Loader2 className="h-4 w-4 animate-spin mt-2" />}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="endereco_completo" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                        <FormItem className="col-span-2"><FormLabel>Endereço Completo *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>

                    <h3 className="font-semibold text-sm">Dados Financeiros</h3>
                    <div className="grid grid-cols-3 gap-3">
                      <FormField control={form.control} name="renda" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                        <FormItem><FormLabel>Renda Mensal *</FormLabel><FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="patrimonio" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                        <FormItem><FormLabel>Patrimônio *</FormLabel><FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="pix" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                        <FormItem><FormLabel>Chave PIX *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>

                    <h3 className="font-semibold text-sm">Documentos</h3>
                    <div className="space-y-2">
                      <Label>RG ou CNH (PDF, JPG, JPEG) *</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept=".pdf,.jpg,.jpeg"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) setPfDocuments(prev => [...prev, file]);
                          }}
                        />
                      </div>
                      {pfDocuments.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <FileText className="h-4 w-4" />
                          <span>{f.name}</span>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setPfDocuments(prev => prev.filter((_, idx) => idx !== i))}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm">Dados da Empresa</h3>
                      <Button type="button" variant="outline" size="sm" onClick={() => setShowChecklistPJ(!showChecklistPJ)}>
                        {showChecklistPJ ? 'Fechar' : '📋 Colar Check-list'}
                      </Button>
                    </div>
                    {showChecklistPJ && (
                      <div className="space-y-2 p-3 border rounded-md bg-muted/30">
                        <Label className="text-xs text-muted-foreground">Cole o texto do check-list PJ abaixo:</Label>
                        <Textarea
                          value={checklistTextPJ}
                          onChange={e => setChecklistTextPJ(e.target.value)}
                          rows={6}
                          placeholder={"Razão Social: ...\nCNPJ: ...\nNatureza Jurídica: ...\nInscrição Estadual: ...\nData de Fundação: dd/mm/aaaa\nCPF dos sócios: 000.000.000-00, ...\nEndereço Comercial: ...\nCEP: ...\nTelefone Comercial: ...\nE-mail comercial: ...\nFaturamento médio: R$ ...\nNúmero de funcionários: ...\nRenda dos sócios: R$ ..."}
                        />
                        <Button type="button" size="sm" onClick={() => {
                          const parsed = parseChecklistPJ(checklistTextPJ);
                          if (parsed.razao_social) form.setValue('razao_social', parsed.razao_social);
                          if (parsed.cnpj) form.setValue('cnpj', formatCnpj(parsed.cnpj));
                          if (parsed.natureza_juridica) form.setValue('natureza_juridica', parsed.natureza_juridica);
                          if (parsed.inscricao_estadual !== undefined) form.setValue('inscricao_estadual', parsed.inscricao_estadual);
                          if (parsed.data_fundacao) form.setValue('data_fundacao', parsed.data_fundacao);
                          if (parsed.endereco_comercial) form.setValue('endereco_comercial', parsed.endereco_comercial);
                          if (parsed.endereco_comercial_cep) form.setValue('endereco_comercial_cep', formatCep(parsed.endereco_comercial_cep));
                          if (parsed.telefone_comercial) form.setValue('telefone_comercial', formatPhone(parsed.telefone_comercial));
                          if (parsed.email_comercial) form.setValue('email_comercial', parsed.email_comercial);
                          if (parsed.faturamento_mensal) form.setValue('faturamento_mensal', parsed.faturamento_mensal);
                          if (parsed.num_funcionarios !== undefined) form.setValue('num_funcionarios', parsed.num_funcionarios);
                          // Handle socios — only when parser found valid CPFs
                          const validCpfs = (parsed.socios_cpfs || []).filter(c => /\d/.test(c));
                          if (validCpfs.length > 0) {
                            const rendaPorSocio = parsed.renda_socios ? Math.round((parsed.renda_socios / validCpfs.length) * 100) / 100 : 0;
                            // Remove existing socios (iterate backwards to avoid index shift / infinite loop)
                            for (let i = socioFields.length - 1; i >= 0; i--) removeSocio(i);
                            validCpfs.forEach(cpf => {
                              addSocio({ cpf: formatCpf(cpf), renda: rendaPorSocio });
                            });
                          }
                          setShowChecklistPJ(false);
                          setChecklistTextPJ('');
                        }}>
                          Preencher Campos
                        </Button>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name="cnpj" rules={{ required: 'Obrigatório', validate: (v: string) => !v || validateCnpj(v) || 'CNPJ inválido' }} render={({ field }) => (
                        <FormItem>
                          <FormLabel>CNPJ *</FormLabel>
                          <FormControl>
                            <div className="flex gap-2">
                              <Input {...field} onChange={e => { const v = formatCnpj(e.target.value); field.onChange(v); if (v.replace(/\D/g, '').length === 14) handleCnpjLookup(v); }} />
                              {loadingCnpj && <Loader2 className="h-4 w-4 animate-spin mt-2" />}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="razao_social" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                        <FormItem><FormLabel>Razão Social *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="natureza_juridica" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                        <FormItem><FormLabel>Natureza Jurídica *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="inscricao_estadual" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                        <FormItem><FormLabel>Inscrição Estadual *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="data_fundacao" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                        <FormItem><FormLabel>Data de Fundação *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>

                    <h3 className="font-semibold text-sm">Contato Comercial</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name="telefone_comercial" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                        <FormItem><FormLabel>Telefone Comercial *</FormLabel><FormControl><Input {...field} onChange={e => field.onChange(formatPhone(e.target.value))} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="email_comercial" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                        <FormItem><FormLabel>Email Comercial *</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>

                    <h3 className="font-semibold text-sm">Endereço Comercial</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name="endereco_comercial_cep" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                        <FormItem>
                          <FormLabel>CEP *</FormLabel>
                          <FormControl>
                            <div className="flex gap-2">
                              <Input {...field} onChange={e => { const v = formatCep(e.target.value); field.onChange(v); if (v.replace(/\D/g, '').length === 8) handleCepLookup(v, 'comercial'); }} />
                              {loadingCep && <Loader2 className="h-4 w-4 animate-spin mt-2" />}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="endereco_comercial" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                        <FormItem className="col-span-2"><FormLabel>Endereço Comercial *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>

                    <h3 className="font-semibold text-sm">Dados Operacionais</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name="num_funcionarios" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                        <FormItem><FormLabel>Nº Funcionários *</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="faturamento_mensal" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                        <FormItem><FormLabel>Faturamento Mensal *</FormLabel><FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>

                    <h3 className="font-semibold text-sm">Sócios</h3>
                    <div className="space-y-3">
                      {socioFields.map((field, index) => (
                        <div key={field.id} className="flex gap-3 items-end">
                          <FormField control={form.control} name={`socios.${index}.cpf`} rules={{ required: 'CPF obrigatório' }} render={({ field }) => (
                            <FormItem className="flex-1"><FormLabel>CPF do Sócio *</FormLabel><FormControl><Input {...field} onChange={e => field.onChange(formatCpf(e.target.value))} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name={`socios.${index}.renda`} rules={{ required: 'Renda obrigatória' }} render={({ field }) => (
                            <FormItem className="flex-1"><FormLabel>Renda *</FormLabel><FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
                          )} />
                          {socioFields.length > 1 && (
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeSocio(index)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button type="button" variant="outline" size="sm" onClick={() => addSocio({ cpf: '', renda: 0 })}>
                        <Plus className="h-3 w-3 mr-1" /> Adicionar Sócio
                      </Button>
                    </div>

                    <h3 className="font-semibold text-sm">Documentos Obrigatórios</h3>
                    <div className="space-y-3">
                      <div>
                        <Label>Contrato Social (PDF) *</Label>
                        <Input type="file" accept=".pdf" onChange={e => setPjDocContratoSocial(e.target.files?.[0] || null)} />
                        {pjDocContratoSocial && <p className="text-xs text-muted-foreground mt-1"><FileText className="h-3 w-3 inline mr-1" />{pjDocContratoSocial.name}</p>}
                      </div>
                      <div>
                        <Label>RG/CNH dos Sócios (PDF, JPG, JPEG) *</Label>
                        <Input type="file" accept=".pdf,.jpg,.jpeg" onChange={e => setPjDocRgSocios(e.target.files?.[0] || null)} />
                        {pjDocRgSocios && <p className="text-xs text-muted-foreground mt-1"><FileText className="h-3 w-3 inline mr-1" />{pjDocRgSocios.name}</p>}
                      </div>
                      <div>
                        <Label>Cartão CNPJ (PDF) *</Label>
                        <Input type="file" accept=".pdf" onChange={e => setPjDocCartaoCnpj(e.target.files?.[0] || null)} />
                        {pjDocCartaoCnpj && <p className="text-xs text-muted-foreground mt-1"><FileText className="h-3 w-3 inline mr-1" />{pjDocCartaoCnpj.name}</p>}
                      </div>
                    </div>
                  </>
                )}

                {form.formState.errors.root && (
                  <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
                )}

                <Separator />
                <h3 className="font-semibold text-sm">Parcelas que a empresa pagará</h3>
                <div className="grid grid-cols-3 gap-3 items-end">
                  <div className="space-y-2">
                    <Label>Empresa paga parcelas?</Label>
                    <Select value={empresaPaga} onValueChange={(v: 'sim' | 'nao') => setEmpresaPaga(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nao">Não</SelectItem>
                        <SelectItem value="sim">Sim</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {empresaPaga === 'sim' && (
                    <>
                      <div className="space-y-2">
                        <Label>Tipo de Contrato</Label>
                        <Select value={tipoContrato} onValueChange={(v: any) => setTipoContrato(v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="normal">Normal (1ª, 2ª…)</SelectItem>
                            <SelectItem value="intercalado">Intercalado par</SelectItem>
                            <SelectItem value="intercalado_impar">Intercalado ímpar</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Qtd parcelas</Label>
                        <Input
                          type="number"
                          min={0}
                          value={qtdParcelasEmpresa}
                          onChange={(e) => setQtdParcelasEmpresa(Number(e.target.value || 0))}
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createRegistration.isPending || !canSubmit}
                    title={
                      !checklistOk
                        ? 'Preencha todos os campos do checklist antes de enviar'
                        : !docsOk
                          ? (tipoPessoa === 'pf'
                              ? 'Anexe ao menos 1 documento (CNH/RG) antes de enviar'
                              : 'Anexe Contrato Social, RG dos sócios e Cartão CNPJ antes de enviar')
                          : undefined
                    }
                  >
                    {createRegistration.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Confirmar e Enviar para Cadastros Pendentes
                  </Button>
                </div>
                {!canSubmit && (
                  <p className="text-xs text-destructive text-right">
                    {!checklistOk
                      ? 'Preencha todos os campos do checklist para habilitar o envio.'
                      : (tipoPessoa === 'pf'
                          ? 'Anexe ao menos 1 documento (CNH/RG) para habilitar o envio.'
                          : 'Anexe Contrato Social, RG dos sócios e Cartão CNPJ para habilitar o envio.')}
                  </p>
                )}
              </form>
            </Form>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
