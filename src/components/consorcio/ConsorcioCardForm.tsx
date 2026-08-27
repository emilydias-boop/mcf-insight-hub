import { useState, useEffect, useMemo, useRef } from 'react';
import { useClosersFromBu } from '@/hooks/useClosersFromBu';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { formatDateForDB, parseDateWithoutTimezone } from '@/lib/dateHelpers';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Plus, Trash2, Loader2, Upload, FileText, X, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { parseChecklistPF, parseChecklistPJ } from '@/lib/checklistParser';
import { cn } from '@/lib/utils';
import { buscarCep } from '@/lib/cepUtils';
import { validateCpf, validateCnpj, buscarCnpj } from '@/lib/documentUtils';
import { toast } from 'sonner';
import { useCreateConsorcioCard, useUpdateConsorcioCard, useConsorcioCardDetails } from '@/hooks/useConsorcio';
import { diffContraSnapshot, nenhumaAlteracao } from '@/lib/formDiff';
import { estruturaParcela, limiteParcelaDiferenciada } from '@/lib/consorcioParcelaOficial';
import { ParcelasMcfPicker } from '@/components/consorcio/ParcelasMcfPicker';
import { derivarParcelasEmpresa, normalizarParcelasMcf } from '@/types/consorcioCartas';

import { useBatchUploadDocuments } from '@/hooks/useConsorcioDocuments';
import { useEmployees } from '@/hooks/useEmployees';
import { useConsorcioProdutos, useConsorcioCreditos } from '@/hooks/useConsorcioProdutos';
import { useConsorcioOrigemOptions, useConsorcioCategoriaOptions, useConsorcioVendedorOptions } from '@/hooks/useConsorcioConfigOptions';
import { useConsorcioObjetivoOptions } from '@/hooks/useConsorcioObjetivoOptions';
import { calcularParcela, getValoresTabelados } from '@/lib/consorcioCalculos';
import { ParcelaComposicao } from './ParcelaComposicao';
import { ConsorciadoSearchPanel } from './ConsorciadoSearchPanel';
import type { ConsorciadoMatch } from '@/hooks/useConsorciadoSearch';
import { CondicaoPagamento, PrazoParcelas, CONDICAO_PAGAMENTO_OPTIONS, PRAZO_OPTIONS } from '@/types/consorcioProdutos';
import {
  ESTADO_CIVIL_OPTIONS,
  TIPO_SERVIDOR_OPTIONS,
  ORIGEM_OPTIONS,
  TIPO_DOCUMENTO_OPTIONS,
  CATEGORIA_OPTIONS,
  CreateConsorcioCardInput,
  TipoDocumento,
  ConsorcioCardWithDetails,
} from '@/types/consorcio';

// === Formatting functions for input masks ===
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

// Format currency for display (R$ 000.000,00)
function formatMonetaryDisplay(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0);
}

// Parse monetary input and return raw number
function parseMonetaryInput(value: string): number {
  const digits = value.replace(/\D/g, '');
  return Number(digits) / 100;
}

const formSchema = z.object({
  tipo_pessoa: z.enum(['pf', 'pj']),
  categoria: z.enum(['inside', 'life']),
  tipo_registro: z.enum(['reserva', 'contratacao']).default('contratacao'),
  
  // Cota
  grupo: z.string().optional().or(z.literal('')),
  cota: z.string().optional().or(z.literal('')),
  contrato_embracon: z.string().optional().or(z.literal('')),
  valor_credito: z.number().min(1, 'Valor do crédito é obrigatório'),
  prazo_meses: z.number().optional(),
  tipo_produto: z.enum(['select', 'parcelinha']),
  empresa_paga_parcelas: z.enum(['sim', 'nao']),
  /**
   * Como as parcelas da MCF são declaradas:
   * - `padrao`: tipo_contrato + quantidade (expressa "todas as pares" de um 240);
   * - `lista`: os números exatos das 12 primeiras parcelas.
   */
  modo_parcelas_mcf: z.enum(['padrao', 'lista']).default('padrao'),
  parcelas_mcf_numeros: z.array(z.number()).optional(),
  tipo_contrato: z.enum(['normal', 'intercalado', 'intercalado_impar']).optional(),
  parcelas_pagas_empresa: z.number().min(0).optional(),
  data_reserva: z.date().optional().nullable(),
  data_contratacao: z.date().optional().nullable(),
  dia_vencimento: z.number().min(1).max(31),
  inicio_segunda_parcela: z.enum(['proximo_mes', 'pular_mes', 'automatico']).default('automatico'),
  // Cadastro retroativo
  parcelas_pagas_cliente: z.number().min(0).optional(),
  data_ultimo_pagamento_cliente: z.date().optional().nullable(),
  origem: z.string().min(1, 'Origem é obrigatória'),
  origem_detalhe: z.string().optional(),
  vendedor_id: z.string().optional(),
  
  // Controle adicional
  valor_comissao: z.number().optional().nullable(),
  e_transferencia: z.boolean().optional(),
  transferido_de: z.string().optional(),
  observacoes: z.string().optional(),
  
  // Produto Embracon e cálculos
  produto_codigo: z.string().optional(),
  condicao_pagamento: z.enum(['convencional', '50', '25']).optional(),
  inclui_seguro: z.boolean().optional(),
  objetivo: z.string().min(1, { message: 'Objetivo é obrigatório' }),
  vendedor_name: z.string().optional(),
  
  // PF
  nome_completo: z.string().optional(),
  data_nascimento: z.date().optional().nullable(),
  cpf: z.string().optional().refine(
    (val) => !val || val.replace(/\D/g, '').length === 0 || validateCpf(val),
    { message: 'CPF inválido' }
  ),
  rg: z.string().optional(),
  estado_civil: z.enum(['solteiro', 'casado', 'divorciado', 'viuvo', 'uniao_estavel']).optional().nullable(),
  cpf_conjuge: z.string().optional().refine(
    (val) => !val || val.replace(/\D/g, '').length === 0 || validateCpf(val),
    { message: 'CPF do cônjuge inválido' }
  ),
  endereco_cep: z.string().optional(),
  endereco_rua: z.string().optional(),
  endereco_numero: z.string().optional(),
  endereco_complemento: z.string().optional(),
  endereco_bairro: z.string().optional(),
  endereco_cidade: z.string().optional(),
  endereco_estado: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  profissao: z.string().optional(),
  tipo_servidor: z.enum(['estadual', 'federal', 'municipal']).optional().nullable(),
  renda: z.number().optional().nullable(),
  patrimonio: z.number().optional().nullable(),
  pix: z.string().optional(),
  
  // PJ
  razao_social: z.string().optional(),
  cnpj: z.string().optional().refine(
    (val) => !val || val.replace(/\D/g, '').length === 0 || validateCnpj(val),
    { message: 'CNPJ inválido' }
  ),
  natureza_juridica: z.string().optional(),
  inscricao_estadual: z.string().optional(),
  data_fundacao: z.date().optional().nullable(),
  endereco_comercial_cep: z.string().optional(),
  endereco_comercial_rua: z.string().optional(),
  endereco_comercial_numero: z.string().optional(),
  endereco_comercial_complemento: z.string().optional(),
  endereco_comercial_bairro: z.string().optional(),
  endereco_comercial_cidade: z.string().optional(),
  endereco_comercial_estado: z.string().optional(),
  telefone_comercial: z.string().optional(),
  email_comercial: z.string().email().optional().or(z.literal('')),
  faturamento_mensal: z.number().optional().nullable(),
  num_funcionarios: z.number().optional().nullable(),
  
  // Partners
  partners: z.array(z.object({
    nome: z.string(),
    cpf: z.string().refine(
      (val) => !val || val.replace(/\D/g, '').length === 0 || validateCpf(val),
      { message: 'CPF inválido' }
    ),
    renda: z.number().optional(),
  })).optional(),
}).refine(
  (data) =>
    data.tipo_registro === 'reserva'
      ? !!data.data_reserva
      : !!data.data_contratacao,
  {
    message: 'Informe a data correspondente ao tipo de cadastro',
    path: ['data_contratacao'],
  }
).superRefine((data, ctx) => {
  if (data.tipo_registro !== 'reserva') {
    if (!data.grupo || !data.grupo.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Grupo é obrigatório', path: ['grupo'] });
    }
    if (!data.cota || !data.cota.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Cota é obrigatória', path: ['cota'] });
    }
    if (!data.prazo_meses || data.prazo_meses < 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Prazo é obrigatório', path: ['prazo_meses'] });
    }
  }
});

type FormData = z.infer<typeof formSchema>;

/**
 * Valores do formulário a partir de uma cota (edição) ou da cota de origem
 * (duplicação). Uma função só para os dois caminhos: é isso que garante que a
 * duplicação herde o plano inteiro e que o snapshot do diff represente
 * exatamente o que foi colocado na tela.
 */
function valoresDaCarta(c: any): Partial<FormData> {
  return {
    tipo_pessoa: (c.tipo_pessoa as 'pf' | 'pj') || 'pf',
    categoria: (c.categoria as 'inside' | 'life') || undefined,
    tipo_registro: ((c.tipo_registro as 'reserva' | 'contratacao') || 'contratacao'),
    tipo_produto: (c.tipo_produto as 'select' | 'parcelinha') || 'select',
    empresa_paga_parcelas: (Number(c.parcelas_pagas_empresa) > 0 ? 'sim' : 'nao') as 'sim' | 'nao',
    // Só abre no modo preciso a cota que REALMENTE tem a lista gravada. Cota sem
    // lista não recebe grade derivada: seria dar cara de escolha ao que ninguém escolheu.
    modo_parcelas_mcf: (normalizarParcelasMcf(c.parcelas_mcf_numeros).length > 0 ? 'lista' : 'padrao') as 'padrao' | 'lista',
    parcelas_mcf_numeros: normalizarParcelasMcf(c.parcelas_mcf_numeros),
    tipo_contrato: (c.tipo_contrato as 'normal' | 'intercalado' | 'intercalado_impar') || undefined,
    parcelas_pagas_empresa: Number(c.parcelas_pagas_empresa) || 0,
    dia_vencimento: c.dia_vencimento ?? undefined,
    origem: (c.origem as any) || undefined,
    origem_detalhe: c.origem_detalhe || undefined,
    grupo: c.grupo || '',
    cota: c.cota || '',
    contrato_embracon: c.contrato_embracon || '',
    valor_credito: c.valor_credito != null ? Number(c.valor_credito) : 0,
    prazo_meses: c.prazo_meses ?? undefined,
    data_contratacao: c.data_contratacao ? parseDateWithoutTimezone(c.data_contratacao) : undefined,
    data_reserva: c.data_reserva ? parseDateWithoutTimezone(c.data_reserva) : undefined,
    vendedor_id: c.vendedor_id || undefined,
    vendedor_name: c.vendedor_name || undefined,
    // Composição da parcela / plano
    produto_codigo: c.produto_embracon || 'auto',
    condicao_pagamento: ((c.condicao_pagamento || 'convencional') as 'convencional' | '50' | '25'),
    inclui_seguro: c.inclui_seguro_vida || false,
    objetivo: c.objetivo || '',
    // Controle adicional
    valor_comissao: c.valor_comissao != null ? Number(c.valor_comissao) : undefined,
    e_transferencia: c.e_transferencia || false,
    transferido_de: c.transferido_de || undefined,
    observacoes: c.observacoes || undefined,
    // PF
    nome_completo: c.nome_completo || '',
    data_nascimento: c.data_nascimento ? parseDateWithoutTimezone(c.data_nascimento) : undefined,
    cpf: c.cpf || '',
    rg: c.rg || '',
    estado_civil: (c.estado_civil as any) || undefined,
    cpf_conjuge: c.cpf_conjuge || '',
    endereco_cep: c.endereco_cep || '',
    endereco_rua: c.endereco_rua || '',
    endereco_numero: c.endereco_numero || '',
    endereco_complemento: c.endereco_complemento || '',
    endereco_bairro: c.endereco_bairro || '',
    endereco_cidade: c.endereco_cidade || '',
    endereco_estado: c.endereco_estado || '',
    telefone: c.telefone || '',
    email: c.email || '',
    profissao: c.profissao || '',
    tipo_servidor: (c.tipo_servidor as any) || undefined,
    renda: c.renda != null ? Number(c.renda) : undefined,
    patrimonio: c.patrimonio != null ? Number(c.patrimonio) : undefined,
    pix: c.pix || '',
    // PJ
    razao_social: c.razao_social || '',
    cnpj: c.cnpj || '',
    natureza_juridica: c.natureza_juridica || '',
    inscricao_estadual: c.inscricao_estadual || '',
    data_fundacao: c.data_fundacao ? parseDateWithoutTimezone(c.data_fundacao) : undefined,
    endereco_comercial_cep: c.endereco_comercial_cep || '',
    endereco_comercial_rua: c.endereco_comercial_rua || '',
    endereco_comercial_numero: c.endereco_comercial_numero || '',
    endereco_comercial_complemento: c.endereco_comercial_complemento || '',
    endereco_comercial_bairro: c.endereco_comercial_bairro || '',
    endereco_comercial_cidade: c.endereco_comercial_cidade || '',
    endereco_comercial_estado: c.endereco_comercial_estado || '',
    telefone_comercial: c.telefone_comercial || '',
    email_comercial: c.email_comercial || '',
    faturamento_mensal: c.faturamento_mensal != null ? Number(c.faturamento_mensal) : undefined,
    num_funcionarios: c.num_funcionarios != null ? Number(c.num_funcionarios) : undefined,
    partners: (c.partners || []).map((p: any) => ({
      nome: p.nome,
      cpf: p.cpf,
      renda: p.renda != null ? Number(p.renda) : undefined,
    })),
  };
}

/** Rótulos para a mensagem de validação (não altera obrigatoriedade de nada). */
const CAMPO_LABELS: Record<string, string> = {
  tipo_pessoa: 'Tipo de Pessoa',
  categoria: 'Categoria',
  grupo: 'Grupo',
  cota: 'Cota',
  contrato_embracon: 'Contrato Embracon',
  valor_credito: 'Valor do Crédito',
  prazo_meses: 'Prazo (meses)',
  tipo_produto: 'Tipo de Produto',
  condicao_pagamento: 'Condição de Pagamento',
  objetivo: 'Objetivo da Carta',
  empresa_paga_parcelas: 'Empresa paga parcelas?',
  tipo_contrato: 'Tipo de Contrato',
  parcelas_pagas_empresa: 'Qtd de Parcelas',
  dia_vencimento: 'Dia de Vencimento',
  data_contratacao: 'Data de Contratação',
  data_reserva: 'Data de Reserva',
  origem: 'Origem',
  nome_completo: 'Nome Completo',
  cpf: 'CPF',
  razao_social: 'Razão Social',
  cnpj: 'CNPJ',
  email: 'E-mail',
  email_comercial: 'E-mail Comercial',
  partners: 'Sócios',
};

interface ConsorcioCardFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card?: ConsorcioCardWithDetails | null;
  duplicateFrom?: Partial<import('@/types/consorcio').ConsorcioCard> | null;
}


/**
 * Aviso de atribuição: o Painel Comercial do Consórcio conta a cota para o
 * closer casando `vendedor_name` com a lista de closers da BU. Vendedor em
 * branco (ou fora dessa lista) cai em "Sem vendedor identificado".
 */
function VendedorAvisoPainel({ vendedorName }: { vendedorName?: string | null }) {
  const { data: closers = [] } = useClosersFromBu('consorcio');
  const chave = (n?: string | null) => {
    if (!n) return null;
    const partes = n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
    if (partes.length === 0) return null;
    return `${partes[0]}|${partes[partes.length - 1]}`;
  };
  if (!vendedorName) {
    return (
      <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
        Sem vendedor a cota entra como "Sem vendedor identificado" no Painel Comercial.
      </p>
    );
  }
  if (closers.length === 0) return null;
  const casa = closers.some(c => chave(c.name) === chave(vendedorName));
  if (casa) return null;
  return (
    <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
      Este vendedor não consta como closer ativo do Consórcio — a cota não será somada a nenhum closer no Painel Comercial.
    </p>
  );
}

export function ConsorcioCardForm({ open, onOpenChange, card, duplicateFrom }: ConsorcioCardFormProps) {
  const [activeTab, setActiveTab] = useState('dados');
  const [loadingCep, setLoadingCep] = useState(false);
  const [loadingCepComercial, setLoadingCepComercial] = useState(false);
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [pendingDocuments, setPendingDocuments] = useState<Array<{ file: File; tipo: TipoDocumento }>>([]);
  const [selectedDocType, setSelectedDocType] = useState<TipoDocumento>('cnh');
  const [showChecklist, setShowChecklist] = useState(false);
  const [checklistText, setChecklistText] = useState('');
  const [showChecklistPJ, setShowChecklistPJ] = useState(false);
  const [checklistTextPJ, setChecklistTextPJ] = useState('');
  
  const isEditing = !!card;
  const { data: employees } = useEmployees();
  const { data: produtos } = useConsorcioProdutos();
  const { data: origemOptions = [] } = useConsorcioOrigemOptions();
  const { data: categoriaOptions = [] } = useConsorcioCategoriaOptions();
  /**
   * Catálogo de categoria: hoje as duas linhas de `consorcio_categoria_options`
   * estão com `is_active = false`, então a lista chegava VAZIA e o select abria
   * em branco mesmo com a cota tendo `categoria = 'inside'`. Fallback fixo +
   * garantia de que o valor atual da cota sempre tem item na lista.
   */
  const categoriasDisponiveis = useMemo(() => {
    const ativas = categoriaOptions.filter((o) => o.is_active);
    const base = (ativas.length > 0 ? ativas : categoriaOptions).map((o) => ({
      name: o.name,
      label: o.label,
      display_order: o.display_order ?? 0,
    }));
    const lista = base.length > 0
      ? base
      : [
          { name: 'inside', label: 'Inside Consórcio', display_order: 0 },
          { name: 'life', label: 'Life Consórcio', display_order: 1 },
        ];
    return lista.sort((a, b) => a.display_order - b.display_order);
  }, [categoriaOptions]);

  const createCard = useCreateConsorcioCard();
  const updateCard = useUpdateConsorcioCard();
  const batchUpload = useBatchUploadDocuments();
  /**
   * Cota completa: a listagem da etapa 6 entrega um objeto parcial (sem RG,
   * profissão, renda, patrimônio, PIX e endereço), o que fazia o formulário de
   * edição abrir esses campos em branco.
   */
  const {
    data: detalheCarta,
    isError: erroDetalhe,
    refetch: recarregarDetalhe,
    isFetching: buscandoDetalhe,
  } = useConsorcioCardDetails(card?.id ?? null);

  /**
   * Situação do cronograma da cota em edição — SOMENTE LEITURA.
   * Salvar uma edição não regenera `consortium_installments` (o gerador corta
   * quando já existe parcela), então mudar o desenho das parcelas aqui altera o
   * que a cota declara sem tocar no cronograma. Esta consulta existe só para
   * avisar quem está editando; nada é gravado, regenerado ou bloqueado.
   */
  const { data: situacaoCronograma } = useQuery({
    queryKey: ['card-cronograma-situacao', card?.id ?? null],
    enabled: !!card?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consortium_installments')
        .select('id, status, data_pagamento')
        .eq('card_id', card!.id);
      if (error) throw error;
      const linhas = data || [];
      return {
        total: linhas.length,
        pagas: linhas.filter(
          (p: any) => p.status === 'pago' || !!p.data_pagamento,
        ).length,
      };
    },
  });
  const cronogramaGerado = (situacaoCronograma?.total || 0) > 0;
  const parcelasPagasNoCronograma = situacaoCronograma?.pagas || 0;

  const dialogContentRef = useRef<HTMLDivElement | null>(null);
  /** Chave do que já foi hidratado nesta abertura (`<id>:detalhe` | `novo`). */
  const hidratadoDe = useRef<string | null>(null);
  /** Payload equivalente ao formulário recém-hidratado — base do diff do save. */
  const snapshotPayload = useRef<CreateConsorcioCardInput | null>(null);
  /**
   * Espelho em estado do snapshot: sem snapshot NÃO existe save de edição.
   * Se o detalhe não chegar (rede, RLS, lentidão), o botão fica desabilitado —
   * salvar sem saber o que mudou é justamente o bug que estamos corrigindo.
   */
  const [snapshotPronto, setSnapshotPronto] = useState(false);



  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: card ? {
      tipo_pessoa: card.tipo_pessoa as 'pf' | 'pj',
      categoria: (card.categoria as 'inside' | 'life') || 'inside',
      tipo_registro: ((card as any).tipo_registro as 'reserva' | 'contratacao') || 'contratacao',
      tipo_produto: card.tipo_produto as 'select' | 'parcelinha',
      empresa_paga_parcelas: (card.parcelas_pagas_empresa > 0 ? 'sim' : 'nao') as 'sim' | 'nao',
      modo_parcelas_mcf: (normalizarParcelasMcf((card as any).parcelas_mcf_numeros).length > 0 ? 'lista' : 'padrao') as 'padrao' | 'lista',
      parcelas_mcf_numeros: normalizarParcelasMcf((card as any).parcelas_mcf_numeros),
      tipo_contrato: card.tipo_contrato as 'normal' | 'intercalado' | 'intercalado_impar' | undefined,
      parcelas_pagas_empresa: card.parcelas_pagas_empresa,
      dia_vencimento: card.dia_vencimento,
      origem: card.origem as 'socio' | 'gr' | 'indicacao' | 'outros',
      origem_detalhe: card.origem_detalhe || undefined,
      grupo: card.grupo,
      cota: card.cota,
      contrato_embracon: (card as any).contrato_embracon || '',
      valor_credito: Number(card.valor_credito),
      prazo_meses: card.prazo_meses,
      data_contratacao: card.data_contratacao ? parseDateWithoutTimezone(card.data_contratacao) : undefined,
      data_reserva: (card as any).data_reserva ? parseDateWithoutTimezone((card as any).data_reserva) : undefined,
      vendedor_id: card.vendedor_id || undefined,
      vendedor_name: card.vendedor_name || undefined,
      // Controle adicional
      valor_comissao: card.valor_comissao ? Number(card.valor_comissao) : undefined,
      e_transferencia: card.e_transferencia || false,
      transferido_de: card.transferido_de || undefined,
      observacoes: card.observacoes || undefined,
      // PF
      nome_completo: card.nome_completo || undefined,
      data_nascimento: card.data_nascimento ? parseDateWithoutTimezone(card.data_nascimento) : undefined,
      cpf: card.cpf || undefined,
      rg: card.rg || undefined,
      estado_civil: card.estado_civil as any || undefined,
      cpf_conjuge: card.cpf_conjuge || undefined,
      endereco_cep: card.endereco_cep || undefined,
      endereco_rua: card.endereco_rua || undefined,
      endereco_numero: card.endereco_numero || undefined,
      endereco_complemento: card.endereco_complemento || undefined,
      endereco_bairro: card.endereco_bairro || undefined,
      endereco_cidade: card.endereco_cidade || undefined,
      endereco_estado: card.endereco_estado || undefined,
      telefone: card.telefone || undefined,
      email: card.email || undefined,
      profissao: card.profissao || undefined,
      tipo_servidor: card.tipo_servidor as any || undefined,
      renda: card.renda ? Number(card.renda) : undefined,
      patrimonio: card.patrimonio ? Number(card.patrimonio) : undefined,
      pix: card.pix || undefined,
      // PJ
      razao_social: card.razao_social || undefined,
      cnpj: card.cnpj || undefined,
      natureza_juridica: card.natureza_juridica || undefined,
      inscricao_estadual: card.inscricao_estadual || undefined,
      data_fundacao: card.data_fundacao ? parseDateWithoutTimezone(card.data_fundacao) : undefined,
      endereco_comercial_cep: card.endereco_comercial_cep || undefined,
      endereco_comercial_rua: card.endereco_comercial_rua || undefined,
      endereco_comercial_numero: card.endereco_comercial_numero || undefined,
      endereco_comercial_complemento: card.endereco_comercial_complemento || undefined,
      endereco_comercial_bairro: card.endereco_comercial_bairro || undefined,
      endereco_comercial_cidade: card.endereco_comercial_cidade || undefined,
      endereco_comercial_estado: card.endereco_comercial_estado || undefined,
      telefone_comercial: card.telefone_comercial || undefined,
      email_comercial: card.email_comercial || undefined,
      faturamento_mensal: card.faturamento_mensal ? Number(card.faturamento_mensal) : undefined,
      num_funcionarios: card.num_funcionarios ? Number(card.num_funcionarios) : undefined,
      partners: card.partners?.map(p => ({ nome: p.nome, cpf: p.cpf, renda: p.renda ? Number(p.renda) : undefined })) || [],
    } : {
      tipo_pessoa: 'pf',
      categoria: 'inside',
      tipo_registro: 'contratacao',
      tipo_produto: 'select',
      empresa_paga_parcelas: 'nao',
      modo_parcelas_mcf: 'padrao',
      parcelas_mcf_numeros: [],
      tipo_contrato: undefined,
      parcelas_pagas_empresa: 0,
      dia_vencimento: 10,
      origem: 'socio',
      partners: [],
      prazo_meses: 240,
      produto_codigo: 'auto',
      condicao_pagamento: 'convencional',
      inclui_seguro: false,
      objetivo: 'imovel',
      // Controle adicional
      valor_comissao: undefined,
      e_transferencia: false,
      transferido_de: undefined,
      observacoes: undefined,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'partners',
  });

  const tipoPessoa = form.watch('tipo_pessoa');
  const estadoCivil = form.watch('estado_civil');
  const profissao = form.watch('profissao');
  const empresaPagaParcelas = form.watch('empresa_paga_parcelas');
  const modoParcelasMcf = form.watch('modo_parcelas_mcf') || 'padrao';
  const parcelasMcfNumeros = form.watch('parcelas_mcf_numeros') || [];
  const tipoContrato = form.watch('tipo_contrato');
  const valorCredito = form.watch('valor_credito') || 0;
  const prazoMeses = form.watch('prazo_meses') || 240;
  const parcelasPagasEmpresa = form.watch('parcelas_pagas_empresa') || 0;
  const produtoCodigo = form.watch('produto_codigo');
  const condicaoPagamento = (form.watch('condicao_pagamento') || 'convencional') as CondicaoPagamento;
  const incluiSeguro = form.watch('inclui_seguro') || false;
  const dataContratacaoWatch = form.watch('data_contratacao');
  const tipoRegistroWatch = form.watch('tipo_registro') || 'contratacao';
  const dataReservaWatch = form.watch('data_reserva');
  const parcelasPagasClienteWatch = form.watch('parcelas_pagas_cliente') || 0;

  const applyConsorciadoMatch = async (m: ConsorciadoMatch) => {
    const setIfEmpty = (field: any, value: any) => {
      if (value == null || value === '') return;
      const current = form.getValues(field);
      if (current === undefined || current === null || current === '') {
        form.setValue(field, value, { shouldDirty: true, shouldValidate: false });
      }
    };
    if (tipoPessoa === 'pf') {
      setIfEmpty('nome_completo', m.nome || m.razao_social);
      setIfEmpty('cpf', m.cpf_cnpj);
      setIfEmpty('telefone', m.telefone);
      setIfEmpty('email', m.email);
    } else {
      setIfEmpty('razao_social', m.razao_social || m.nome);
      setIfEmpty('cnpj', m.cpf_cnpj);
      setIfEmpty('telefone_comercial', m.telefone);
      setIfEmpty('email_comercial', m.email);
    }

    // Para cotas anteriores, busca o registro completo e preenche endereço + dados extras
    if (m.source === 'consortium') {
      try {
        const { data: full } = await supabase
          .from('consortium_cards')
          .select('data_nascimento, rg, estado_civil, cpf_conjuge, profissao, tipo_servidor, renda, patrimonio, pix, endereco_cep, endereco_rua, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_estado, natureza_juridica, inscricao_estadual, data_fundacao, faturamento_mensal, num_funcionarios, endereco_comercial_cep, endereco_comercial_rua, endereco_comercial_numero, endereco_comercial_complemento, endereco_comercial_bairro, endereco_comercial_cidade, endereco_comercial_estado')
          .eq('id', m.id)
          .maybeSingle();
        if (!full) return;
        if (tipoPessoa === 'pf') {
          setIfEmpty('data_nascimento', full.data_nascimento ? parseDateWithoutTimezone(full.data_nascimento) : undefined);
          setIfEmpty('rg', full.rg);
          setIfEmpty('estado_civil', full.estado_civil);
          setIfEmpty('cpf_conjuge', full.cpf_conjuge);
          setIfEmpty('profissao', full.profissao);
          setIfEmpty('tipo_servidor', full.tipo_servidor);
          setIfEmpty('renda', full.renda ? Number(full.renda) : undefined);
          setIfEmpty('patrimonio', full.patrimonio ? Number(full.patrimonio) : undefined);
          setIfEmpty('pix', full.pix);
          setIfEmpty('endereco_cep', full.endereco_cep);
          setIfEmpty('endereco_rua', full.endereco_rua);
          setIfEmpty('endereco_numero', full.endereco_numero);
          setIfEmpty('endereco_complemento', full.endereco_complemento);
          setIfEmpty('endereco_bairro', full.endereco_bairro);
          setIfEmpty('endereco_cidade', full.endereco_cidade);
          setIfEmpty('endereco_estado', full.endereco_estado);
        } else {
          setIfEmpty('natureza_juridica', full.natureza_juridica);
          setIfEmpty('inscricao_estadual', full.inscricao_estadual);
          setIfEmpty('data_fundacao', full.data_fundacao ? parseDateWithoutTimezone(full.data_fundacao) : undefined);
          setIfEmpty('faturamento_mensal', full.faturamento_mensal ? Number(full.faturamento_mensal) : undefined);
          setIfEmpty('num_funcionarios', full.num_funcionarios ? Number(full.num_funcionarios) : undefined);
          setIfEmpty('endereco_comercial_cep', full.endereco_comercial_cep);
          setIfEmpty('endereco_comercial_rua', full.endereco_comercial_rua);
          setIfEmpty('endereco_comercial_numero', full.endereco_comercial_numero);
          setIfEmpty('endereco_comercial_complemento', full.endereco_comercial_complemento);
          setIfEmpty('endereco_comercial_bairro', full.endereco_comercial_bairro);
          setIfEmpty('endereco_comercial_cidade', full.endereco_comercial_cidade);
          setIfEmpty('endereco_comercial_estado', full.endereco_comercial_estado);
        }
      } catch (e) {
        console.warn('[autofill] failed to fetch full consortium record', e);
      }
    }
  };

  // Detectar cadastro retroativo (data de contratação anterior ao mês atual)
  const isCadastroRetroativo = useMemo(() => {
    const dataBase = tipoRegistroWatch === 'reserva' ? dataReservaWatch : dataContratacaoWatch;
    if (!dataBase) return false;
    const hoje = new Date();
    const inicioMesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    return dataBase < inicioMesAtual;
  }, [dataContratacaoWatch, dataReservaWatch, tipoRegistroWatch]);

  // Sugerir nº de parcelas pagas pelo cliente: meses entre contratação e hoje menos parcelas da empresa
  const sugestaoParcelasCliente = useMemo(() => {
    const dataBase = tipoRegistroWatch === 'reserva' ? dataReservaWatch : dataContratacaoWatch;
    if (!isCadastroRetroativo || !dataBase) return 0;
    const hoje = new Date();
    const meses =
      (hoje.getFullYear() - dataBase.getFullYear()) * 12 +
      (hoje.getMonth() - dataBase.getMonth());
    const restante = Math.max(0, meses - (parcelasPagasEmpresa || 0));
    return Math.min(restante, (prazoMeses || 240) - (parcelasPagasEmpresa || 0));
  }, [isCadastroRetroativo, dataContratacaoWatch, dataReservaWatch, tipoRegistroWatch, parcelasPagasEmpresa, prazoMeses]);

  // Fetch vendedor options from configurable table
  const { data: vendedorOptions = [] } = useConsorcioVendedorOptions();
  const { data: objetivoOptions = [] } = useConsorcioObjetivoOptions();
  const objetivoWatch = form.watch('objetivo');
  const objetivoSelecionado = useMemo(
    () => objetivoOptions.find((o) => o.name === objetivoWatch),
    [objetivoOptions, objetivoWatch]
  );

  // Auto-detect candidates: never pick "the first" when more than one matches.
  const candidatosAuto = useMemo(() => {
    if (!produtos || valorCredito <= 0) return [];

    const tipoProduto = form.watch('tipo_produto');
    const taxaTipo = tipoProduto === 'parcelinha' ? 'dividida_12' : 'primeira_parcela';

    return produtos.filter(p =>
      p.ativo &&
      valorCredito >= p.faixa_credito_min &&
      valorCredito <= p.faixa_credito_max &&
      p.taxa_antecipada_tipo === taxaTipo &&
      // Filter by objetivo when selected; products linked to an objetivo only apply to that one
      (!objetivoSelecionado || !p.objetivo_option_id || p.objetivo_option_id === objetivoSelecionado.id)
    );
  }, [produtos, valorCredito, form, objetivoSelecionado]);

  const escolhaManual = !!produtoCodigo && produtoCodigo !== 'auto';

  // Find product that matches selected code, or resolve automatically ONLY when unambiguous
  const produtoSelecionado = useMemo(() => {
    if (!produtos) return undefined;

    if (escolhaManual) {
      return produtos.find(p => p.codigo === produtoCodigo);
    }

    // Ambiguous (>1) or no match: do not guess, leave unresolved
    return candidatosAuto.length === 1 ? candidatosAuto[0] : undefined;
  }, [produtos, produtoCodigo, escolhaManual, candidatosAuto]);

  // Estado da detecção automática, para explicar em texto o que aconteceu
  const autoStatus: 'manual' | 'sem_credito' | 'unico' | 'ambiguo' | 'nenhum' = escolhaManual
    ? 'manual'
    : valorCredito <= 0
      ? 'sem_credito'
      : candidatosAuto.length === 1
        ? 'unico'
        : candidatosAuto.length > 1
          ? 'ambiguo'
          : 'nenhum';


  // Fetch credits for the selected product to get tabulated values
  const { data: creditos } = useConsorcioCreditos(produtoSelecionado?.id);
  
  // Find tabulated credit for the exact value
  const creditoTabelado = useMemo(() => {
    if (!creditos || valorCredito <= 0) return undefined;
    return creditos.find(c => c.valor_credito === valorCredito);
  }, [creditos, valorCredito]);

  // Calculate installment composition - prioritize tabulated values
  const calculoParcela = useMemo(() => {
    if (!produtoSelecionado || valorCredito <= 0 || prazoMeses <= 0) return null;
    
    const prazoValido = prazoMeses > 0 ? prazoMeses : 240;
    
    // First calculate using formulas
    const calculoBase = calcularParcela(
      valorCredito,
      prazoValido,
      produtoSelecionado,
      condicaoPagamento,
      incluiSeguro
    );
    
    // Check if we have tabulated values for this credit
    const valoresTabelados = getValoresTabelados(creditoTabelado, prazoValido, condicaoPagamento);
    
    // If tabulated values exist, use them instead
    if (valoresTabelados.parcela1a12 && valoresTabelados.parcelaDemais) {
      // Faixa do valor diferenciado derivada da estrutura do produto:
      // Parcelinha (dividida_12) → 12 primeiras · Select (primeira_parcela) → só a 1ª.
      const limite = limiteParcelaDiferenciada(
        estruturaParcela(
          produtoSelecionado.taxa_antecipada_tipo === 'dividida_12' ? 'parcelinha' : 'select',
          produtoSelecionado.codigo,
        ),
      );
      const totalPagoTabelado =
        (valoresTabelados.parcela1a12 * limite) +
        (valoresTabelados.parcelaDemais * (prazoValido - limite));

      
      return {
        ...calculoBase,
        parcela1a12: valoresTabelados.parcela1a12,
        parcelaDemais: valoresTabelados.parcelaDemais,
        totalPago: totalPagoTabelado,
        usandoTabelaOficial: true,
      };
    }
    
    return {
      ...calculoBase,
      usandoTabelaOficial: false,
    };
  }, [produtoSelecionado, valorCredito, prazoMeses, condicaoPagamento, incluiSeguro, creditoTabelado]);

  // Calculate total value of installments paid by the company
  const valorTotalParcelasEmpresa = useMemo(() => {
    if (empresaPagaParcelas !== 'sim' || prazoMeses <= 0) return 0;
    
    // Use calculated installment value if available
    const valorParcela = calculoParcela?.parcelaDemais || (valorCredito / prazoMeses);
    
    if (tipoContrato === 'intercalado') {
      // Intercalado: empresa paga as parcelas pares (2, 4, 6, ...)
      return parcelasPagasEmpresa * valorParcela;
    }
    // Normal: empresa paga as primeiras N parcelas
    return parcelasPagasEmpresa * valorParcela;
  }, [empresaPagaParcelas, valorCredito, prazoMeses, tipoContrato, parcelasPagasEmpresa, calculoParcela]);

  // === Tab navigation logic ===
  const tabOrder = useMemo(() => {
    return tipoPessoa === 'pj' 
      ? ['dados', 'endereco', 'documentos', 'cota', 'socios']
      : ['dados', 'endereco', 'documentos', 'cota'];
  }, [tipoPessoa]);

  const currentTabIndex = tabOrder.indexOf(activeTab);

  const handleNextTab = () => {
    if (currentTabIndex < tabOrder.length - 1) {
      setActiveTab(tabOrder[currentTabIndex + 1]);
    }
  };

  const handlePreviousTab = () => {
    if (currentTabIndex > 0) {
      setActiveTab(tabOrder[currentTabIndex - 1]);
    }
  };

  // === Tab error checking for validation indicators ===
  const tabFieldsMap = useMemo(() => ({
    dados: tipoPessoa === 'pf' 
      ? ['nome_completo', 'cpf', 'telefone', 'email', 'data_nascimento', 'estado_civil', 'renda', 'patrimonio', 'pix', 'profissao', 'tipo_servidor', 'rg', 'cpf_conjuge']
      : ['razao_social', 'cnpj', 'telefone_comercial', 'email_comercial', 'natureza_juridica', 'inscricao_estadual', 'data_fundacao', 'faturamento_mensal', 'num_funcionarios'],
    endereco: tipoPessoa === 'pf'
      ? ['endereco_cep', 'endereco_rua', 'endereco_numero', 'endereco_bairro', 'endereco_cidade', 'endereco_estado']
      : ['endereco_comercial_cep', 'endereco_comercial_rua', 'endereco_comercial_numero', 'endereco_comercial_bairro', 'endereco_comercial_cidade', 'endereco_comercial_estado'],
    documentos: [],
    // Categoria, Objetivo e companhia moram nesta aba e também bloqueiam o
    // submit — sem estar nesta lista o selo da aba e o foco erravam o alvo.
    cota: [
      'categoria', 'grupo', 'cota', 'contrato_embracon', 'valor_credito', 'prazo_meses',
      'tipo_produto', 'condicao_pagamento', 'objetivo', 'empresa_paga_parcelas',
      'tipo_contrato', 'parcelas_pagas_empresa', 'tipo_registro',
      'data_contratacao', 'data_reserva', 'dia_vencimento', 'origem', 'origem_detalhe',
    ],
    socios: ['partners'],
  }), [tipoPessoa]);


  const getTabHasErrors = (tabKey: string) => {
    const fields = tabFieldsMap[tabKey as keyof typeof tabFieldsMap] || [];
    const errors = form.formState.errors;
    return fields.some(field => field in errors);
  };

  /**
   * Hidratação do formulário.
   *
   * Edição: a listagem entrega um objeto PARCIAL (sem RG, profissão, renda,
   * patrimônio, PIX e endereço), por isso esperamos a consulta detalhada antes
   * de tirar o snapshot. Snapshot tirado com o objeto parcial faria o diff
   * enxergar a hidratação como mudança do usuário e reenviar tudo.
   */
  useEffect(() => {
    if (!open) {
      hidratadoDe.current = null;
      snapshotPayload.current = null;
      setSnapshotPronto(false);
      return;
    }

    if (card) {
      const detalhado = detalheCarta && detalheCarta.id === card.id ? detalheCarta : null;
      const fonte: any = detalhado || card;
      const chave = `${card.id}:${detalhado ? 'detalhe' : 'parcial'}`;
      if (hidratadoDe.current === chave) return;
      hidratadoDe.current = chave;
      setPendingDocuments([]);
      if (!detalhado) setActiveTab('dados');
      form.reset(valoresDaCarta(fonte));
      // Snapshot SÓ com a cota completa em mão. Sem ele o save fica bloqueado.
      snapshotPayload.current = detalhado
        ? montarPayloadCarta(form.getValues(), {
            tipoProduto: (form.getValues('tipo_produto') as 'select' | 'parcelinha') || 'select',
            parcela1a12: fonte.parcela_1a_12a != null ? Number(fonte.parcela_1a_12a) : undefined,
            parcelaDemais: fonte.parcela_demais != null ? Number(fonte.parcela_demais) : undefined,
          })
        : null;
      setSnapshotPronto(!!detalhado);
      return;
    }

    if (hidratadoDe.current === 'novo') return;
    hidratadoDe.current = 'novo';
    setActiveTab('dados');
    setPendingDocuments([]);
    snapshotPayload.current = null;
    setSnapshotPronto(false);


    if (duplicateFrom) {
      /**
       * Duplicar carta: herda TUDO do original (plano, categoria, origem,
       * parcelas da empresa, vencimento, dados pessoais e endereço). Ficam em
       * branco só o que é único de cada cota: grupo, cota e contrato Embracon.
       */
      form.reset({
        ...valoresDaCarta(duplicateFrom as any),
        grupo: '',
        cota: '',
        contrato_embracon: '',
        partners: [],
      });
      return;
    }

    // Criação de carta nova - valores vazios
    form.reset({
      tipo_pessoa: 'pf',
      categoria: 'inside',
      tipo_produto: 'select',
      empresa_paga_parcelas: 'nao',
      modo_parcelas_mcf: 'padrao',
      parcelas_mcf_numeros: [],
      tipo_contrato: undefined,
      parcelas_pagas_empresa: 0,
      dia_vencimento: 10,
      origem: 'socio',
      partners: [],
      grupo: '',
      cota: '',
      contrato_embracon: '',
      valor_credito: 0,
      prazo_meses: 0,
      nome_completo: '',
      data_nascimento: undefined,
      cpf: '',
      rg: '',
      estado_civil: undefined,
      cpf_conjuge: '',
      endereco_cep: '',
      endereco_rua: '',
      endereco_numero: '',
      endereco_complemento: '',
      endereco_bairro: '',
      endereco_cidade: '',
      endereco_estado: '',
      telefone: '',
      email: '',
      profissao: '',
      tipo_servidor: undefined,
      renda: undefined,
      patrimonio: undefined,
      pix: '',
      razao_social: '',
      cnpj: '',
      natureza_juridica: '',
      inscricao_estadual: '',
      data_fundacao: undefined,
      endereco_comercial_cep: '',
      endereco_comercial_rua: '',
      endereco_comercial_numero: '',
      endereco_comercial_complemento: '',
      endereco_comercial_bairro: '',
      endereco_comercial_cidade: '',
      endereco_comercial_estado: '',
      telefone_comercial: '',
      email_comercial: '',
      faturamento_mensal: undefined,
      num_funcionarios: undefined,
      origem_detalhe: '',
      vendedor_id: undefined,
      vendedor_name: undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, card, detalheCarta, duplicateFrom]);


  // Auto-set default parcelas when changing to intercalado (only for NEW cards)
  useEffect(() => {
    // Skip auto-set when editing an existing card
    if (card) return;
    
    if (tipoContrato === 'intercalado' && prazoMeses > 0) {
      const parcelasPares = Math.floor(prazoMeses / 2);
      form.setValue('parcelas_pagas_empresa', parcelasPares);
    }
  }, [tipoContrato, prazoMeses, form, card]);

  // Handle CEP lookup for PF
  const handleCepBlur = async (cep: string) => {
    if (cep.replace(/\D/g, '').length !== 8) return;
    
    setLoadingCep(true);
    const endereco = await buscarCep(cep);
    setLoadingCep(false);
    
    if (endereco) {
      form.setValue('endereco_rua', endereco.rua);
      form.setValue('endereco_bairro', endereco.bairro);
      form.setValue('endereco_cidade', endereco.cidade);
      form.setValue('endereco_estado', endereco.estado);
    }
  };

  // Handle CEP lookup for PJ
  const handleCepComercialBlur = async (cep: string) => {
    if (cep.replace(/\D/g, '').length !== 8) return;
    
    setLoadingCepComercial(true);
    const endereco = await buscarCep(cep);
    setLoadingCepComercial(false);
    
    if (endereco) {
      form.setValue('endereco_comercial_rua', endereco.rua);
      form.setValue('endereco_comercial_bairro', endereco.bairro);
      form.setValue('endereco_comercial_cidade', endereco.cidade);
      form.setValue('endereco_comercial_estado', endereco.estado);
    }
  };

  // Handle CNPJ lookup and auto-fill company data
  const handleCnpjChange = async (value: string, fieldOnChange: (v: string) => void) => {
    const formatted = formatCnpj(value);
    fieldOnChange(formatted);
    
    const digits = formatted.replace(/\D/g, '');
    
    // Auto-fetch when CNPJ is complete (14 digits) and valid
    if (digits.length === 14 && validateCnpj(formatted)) {
      setLoadingCnpj(true);
      const dados = await buscarCnpj(formatted);
      setLoadingCnpj(false);
      
      if (dados) {
        // Fill form fields with company data
        form.setValue('razao_social', dados.razao_social);
        if (dados.natureza_juridica) form.setValue('natureza_juridica', dados.natureza_juridica);
        if (dados.telefone) form.setValue('telefone_comercial', formatPhone(dados.telefone));
        if (dados.email) form.setValue('email_comercial', dados.email.toLowerCase());
        if (dados.cep) form.setValue('endereco_comercial_cep', formatCep(dados.cep));
        if (dados.logradouro) form.setValue('endereco_comercial_rua', dados.logradouro);
        if (dados.numero) form.setValue('endereco_comercial_numero', dados.numero);
        if (dados.complemento) form.setValue('endereco_comercial_complemento', dados.complemento);
        if (dados.bairro) form.setValue('endereco_comercial_bairro', dados.bairro);
        if (dados.municipio) form.setValue('endereco_comercial_cidade', dados.municipio);
        if (dados.uf) form.setValue('endereco_comercial_estado', dados.uf);
        
        // Convert foundation date if available
        if (dados.data_fundacao) {
          const [year, month, day] = dados.data_fundacao.split('-').map(Number);
          if (year && month && day) {
            form.setValue('data_fundacao', new Date(year, month - 1, day));
          }
        }
        
        toast.success('Dados da empresa preenchidos automaticamente!');
      }
    }
  };

  const handleAddDocument = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingDocuments(prev => [...prev, { file, tipo: selectedDocType }]);
      e.target.value = ''; // Reset input
    }
  };

  const handleRemoveDocument = (index: number) => {
    setPendingDocuments(prev => prev.filter((_, i) => i !== index));
  };

  /**
   * Payload COMPLETO da carta a partir dos valores do formulário.
   * A mesma função monta o snapshot da hidratação e o estado atual do save —
   * é isso que permite comparar chave por chave sem falso positivo.
   */
  const montarPayloadCarta = (
    data: FormData,
    opts: { tipoProduto: 'select' | 'parcelinha'; parcela1a12?: number | null; parcelaDemais?: number | null },
  ): CreateConsorcioCardInput => {
    // Modo "lista": os números escolhidos são a verdade e os campos antigos
    // (tipo_contrato / quantidade) passam a ser DERIVADOS deles — nunca o contrário.
    const usaLista =
      data.empresa_paga_parcelas === 'sim' && data.modo_parcelas_mcf === 'lista';
    const listaMcf = usaLista ? normalizarParcelasMcf(data.parcelas_mcf_numeros) : [];
    const derivado = usaLista ? derivarParcelasEmpresa(listaMcf) : null;
    const calculatedParcelas = derivado
      ? derivado.parcelas_pagas_empresa
      : data.empresa_paga_parcelas === 'sim'
        ? (data.parcelas_pagas_empresa || 0)
        : 0;
    return {
      tipo_pessoa: data.tipo_pessoa,
      categoria: data.categoria,
      grupo: data.grupo,
      cota: data.cota,
      contrato_embracon: data.contrato_embracon ?? '',
      valor_credito: data.valor_credito,
      prazo_meses: data.prazo_meses,
      tipo_produto: opts.tipoProduto,
      tipo_contrato: derivado
        ? derivado.tipo_contrato
        : data.empresa_paga_parcelas === 'sim' ? (data.tipo_contrato || 'normal') : 'normal',
      parcelas_pagas_empresa: calculatedParcelas,
      // `null` (e não `undefined`) para que o diff consiga LIMPAR a lista quando
      // o usuário voltar ao modo padrão.
      parcelas_mcf_numeros: listaMcf.length > 0 ? listaMcf : null,
      tipo_registro: data.tipo_registro,
      data_contratacao: data.data_contratacao ? formatDateForDB(data.data_contratacao) : null,
      data_reserva: data.data_reserva ? formatDateForDB(data.data_reserva) : null,
      dia_vencimento: data.dia_vencimento,
      inicio_segunda_parcela: data.inicio_segunda_parcela || 'automatico',
      origem: data.origem,
      origem_detalhe: data.origem_detalhe,
      vendedor_id: data.vendedor_id || undefined,
      vendedor_name: data.vendedor_name || undefined,
      nome_completo: data.nome_completo,
      data_nascimento: data.data_nascimento ? formatDateForDB(data.data_nascimento) : undefined,
      cpf: data.cpf,
      rg: data.rg,
      estado_civil: data.estado_civil || undefined,
      cpf_conjuge: data.cpf_conjuge,
      endereco_cep: data.endereco_cep,
      endereco_rua: data.endereco_rua,
      endereco_numero: data.endereco_numero,
      endereco_complemento: data.endereco_complemento,
      endereco_bairro: data.endereco_bairro,
      endereco_cidade: data.endereco_cidade,
      endereco_estado: data.endereco_estado,
      telefone: data.telefone,
      email: data.email,
      profissao: data.profissao,
      tipo_servidor: data.tipo_servidor || undefined,
      renda: data.renda ?? undefined,
      patrimonio: data.patrimonio ?? undefined,
      pix: data.pix,
      razao_social: data.razao_social,
      cnpj: data.cnpj,
      natureza_juridica: data.natureza_juridica,
      inscricao_estadual: data.inscricao_estadual,
      data_fundacao: data.data_fundacao ? formatDateForDB(data.data_fundacao) : undefined,
      endereco_comercial_cep: data.endereco_comercial_cep,
      endereco_comercial_rua: data.endereco_comercial_rua,
      endereco_comercial_numero: data.endereco_comercial_numero,
      endereco_comercial_complemento: data.endereco_comercial_complemento,
      endereco_comercial_bairro: data.endereco_comercial_bairro,
      endereco_comercial_cidade: data.endereco_comercial_cidade,
      endereco_comercial_estado: data.endereco_comercial_estado,
      telefone_comercial: data.telefone_comercial,
      email_comercial: data.email_comercial,
      faturamento_mensal: data.faturamento_mensal ?? undefined,
      num_funcionarios: data.num_funcionarios ?? undefined,
      // Controle adicional
      valor_comissao: data.valor_comissao ?? undefined,
      e_transferencia: data.e_transferencia || false,
      transferido_de: data.transferido_de,
      observacoes: data.observacoes,

      // Composição da parcela
      produto_embracon: data.produto_codigo || undefined,
      condicao_pagamento: data.condicao_pagamento || undefined,
      inclui_seguro_vida: data.inclui_seguro || false,
      objetivo: data.objetivo as any,
      parcela_1a_12a: opts.parcela1a12 ?? undefined,
      parcela_demais: opts.parcelaDemais ?? undefined,

      // Cadastro retroativo
      parcelas_pagas_cliente: data.parcelas_pagas_cliente || undefined,
      data_ultimo_pagamento_cliente: data.data_ultimo_pagamento_cliente
        ? formatDateForDB(data.data_ultimo_pagamento_cliente)
        : undefined,

      partners: (data.partners || []).filter(p => p.nome && p.cpf) as Array<{ nome: string; cpf: string; renda?: number }>,
    };
  };

  const onSubmit = async (data: FormData) => {
    /**
     * Campos que definem o plano da carta. Em EDIÇÃO, se nenhum deles foi
     * tocado, os valores de parcela e o tipo de produto do banco são a verdade:
     * recalcular pela tabela aqui é o que fazia o diff acusar mudança em
     * `parcela_1a_12a` / `parcela_demais` num formulário intocado e sobrescrever
     * parcela negociada à mão (1.500 / 200) pelo valor tabelado.
     */
    const camposDoPlano = [
      'valor_credito', 'prazo_meses', 'condicao_pagamento', 'inclui_seguro',
      'produto_codigo', 'tipo_produto', 'objetivo',
    ] as const;
    const dirty = form.formState.dirtyFields as Record<string, unknown>;
    const planoTocado = camposDoPlano.some((c) => !!dirty[c]);
    const snap = snapshotPayload.current;
    const preservarPlano = isEditing && !!snap && !planoTocado;

    // Derivar tipo_produto automaticamente do produto selecionado
    const tipoProdutoDerivado: 'select' | 'parcelinha' = preservarPlano
      ? ((snap!.tipo_produto as 'select' | 'parcelinha') || data.tipo_produto)
      : produtoSelecionado
        ? (produtoSelecionado.taxa_antecipada_tipo === 'dividida_12' ? 'parcelinha' : 'select')
        : data.tipo_produto;

    const input = montarPayloadCarta(data, {
      tipoProduto: tipoProdutoDerivado,
      parcela1a12: preservarPlano ? snap!.parcela_1a_12a : calculoParcela?.parcela1a12,
      parcelaDemais: preservarPlano ? snap!.parcela_demais : calculoParcela?.parcelaDemais,
    });


    if (isEditing && card) {
      /**
       * Trava dura: sem snapshot da cota completa não existe save de edição.
       * Salvar o payload inteiro a partir de um formulário hidratado só com o
       * objeto parcial da listagem apagaria RG, renda, endereço e categoria.
       */
      if (!snapshotPayload.current) {
        toast.error(
          'Não é possível salvar: os dados completos da cota não foram carregados. Feche e abra novamente, ou use "Tentar de novo".',
        );
        return;
      }
      // Edição: só o que o usuário mudou (diff contra o snapshot da hidratação).
      // Campo intocado fica fora do payload; campo limpo de propósito vai vazio.
      const alterado = diffContraSnapshot(
        snapshotPayload.current as unknown as Record<string, unknown>,
        input as unknown as Record<string, unknown>,
      );
      /**
       * Auditoria em tela: chave que entra no diff sem o campo estar "dirty" é
       * bug de montagem do payload, não edição do usuário. Fica no console para
       * dar para conferir na hora.
       *
       * O nome da coluna no payload não é sempre o nome do campo no formulário
       * (`produto_embracon` vem de `produto_codigo`, a parcela vem do bloco de
       * plano inteiro...). Sem este mapa a auditoria acusaria falso positivo em
       * toda edição e o log viraria ruído.
       */
      const camposDoPlanoParaAuditoria = [...camposDoPlano] as string[];
      const origemDaChave: Record<string, string[]> = {
        produto_embracon: ['produto_codigo'],
        inclui_seguro_vida: ['inclui_seguro'],
        tipo_produto: ['tipo_produto', 'produto_codigo'],
        parcela_1a_12a: camposDoPlanoParaAuditoria,
        parcela_demais: camposDoPlanoParaAuditoria,
        tipo_contrato: ['tipo_contrato', 'empresa_paga_parcelas', 'modo_parcelas_mcf', 'parcelas_mcf_numeros'],
        parcelas_pagas_empresa: ['parcelas_pagas_empresa', 'empresa_paga_parcelas', 'modo_parcelas_mcf', 'parcelas_mcf_numeros'],
        parcelas_mcf_numeros: ['parcelas_mcf_numeros', 'modo_parcelas_mcf', 'empresa_paga_parcelas'],
      };
      const chavesDoDiff = Object.keys(alterado);
      const naoTocadas = chavesDoDiff.filter(
        (k) => !(origemDaChave[k] ?? [k]).some((campo) => !!dirty[campo]),
      );

      const semAlteracao = nenhumaAlteracao(alterado);

      // O rótulo diz se HOUVE escrita: log antes da checagem enganava a leitura.
      console.info(
        semAlteracao
          ? '[carta:edit] nada enviado (nenhuma alteração)'
          : '[carta:edit] diff enviado',
        {
          cardId: card.id,
          enviado: !semAlteracao,
          chaves: chavesDoDiff,
          camposTocados: Object.keys(dirty),
          suspeitas_nao_tocadas: naoTocadas,
          diff: alterado,
        },
      );
      if (naoTocadas.length > 0) {
        console.warn(
          '[carta:edit] chaves no diff sem edição do usuário (possível bug):',
          naoTocadas,
        );
      }

      if (semAlteracao) {
        // Fecha SEM nenhuma escrita: nada de mutateAsync neste caminho.
        toast.info('Nenhuma alteração para salvar.');
        onOpenChange(false);
        return;
      }

      await updateCard.mutateAsync({ id: card.id, ...(alterado as any) });
      snapshotPayload.current = input;

    } else {
      // Criação (nova carta e duplicação) segue com o payload completo.
      const newCard = await createCard.mutateAsync(input);

      // Upload pending documents if any
      if (pendingDocuments.length > 0 && newCard?.id) {
        await batchUpload.mutateAsync({
          cardId: newCard.id,
          documents: pendingDocuments,
        });
      }
    }

    onOpenChange(false);
    form.reset();
    setPendingDocuments([]);
  };

  /**
   * Validação reprovada: hoje o clique só acendia um pontinho vermelho na aba.
   * Agora leva o usuário até a aba do primeiro campo inválido, rola até ele,
   * foca e diz o que falta. Nenhuma obrigatoriedade foi criada ou removida.
   */
  const onInvalid = (errors: Record<string, any>) => {
    const nomes = Object.keys(errors);
    if (nomes.length === 0) return;
    const ordemCampos = tabOrder.flatMap((t) => tabFieldsMap[t as keyof typeof tabFieldsMap] || []);
    const primeiro = ordemCampos.find((f) => nomes.includes(f)) || nomes[0];
    const aba = tabOrder.find((t) =>
      (tabFieldsMap[t as keyof typeof tabFieldsMap] || []).includes(primeiro),
    );
    if (aba) setActiveTab(aba);

    toast.error(
      `Complete os campos obrigatórios: ${nomes.map((n) => CAMPO_LABELS[n] || n).join(', ')}`,
    );

    setTimeout(() => {
      const root = dialogContentRef.current;
      if (!root) return;
      const alvo =
        (root.querySelector(`[name="${primeiro}"]`) as HTMLElement | null) ||
        (root.querySelector('[aria-invalid="true"]') as HTMLElement | null);
      alvo?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      alvo?.focus?.();
    }, 120);
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={dialogContentRef} className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Carta de Consórcio' : duplicateFrom ? 'Duplicar Carta de Consórcio' : 'Nova Carta de Consórcio'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-6">

            {/* Tipo de Pessoa */}
            <FormField
              control={form.control}
              name="tipo_pessoa"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Pessoa</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pf">Pessoa Física</SelectItem>
                      <SelectItem value="pj">Pessoa Jurídica</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full">
                <TabsTrigger value="dados" className="relative">
                  {tipoPessoa === 'pf' ? 'Dados Pessoais' : 'Dados da Empresa'}
                  {getTabHasErrors('dados') && (
                    <AlertCircle className="absolute -top-1 -right-1 h-3.5 w-3.5 text-destructive" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="endereco" className="relative">
                  Endereço
                  {getTabHasErrors('endereco') && (
                    <AlertCircle className="absolute -top-1 -right-1 h-3.5 w-3.5 text-destructive" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="documentos" className="relative">
                  Documentos
                  {getTabHasErrors('documentos') && (
                    <AlertCircle className="absolute -top-1 -right-1 h-3.5 w-3.5 text-destructive" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="cota" className="relative">
                  Dados da Cota
                  {getTabHasErrors('cota') && (
                    <AlertCircle className="absolute -top-1 -right-1 h-3.5 w-3.5 text-destructive" />
                  )}
                </TabsTrigger>
                {tipoPessoa === 'pj' && (
                  <TabsTrigger value="socios" className="relative">
                    Sócios
                    {getTabHasErrors('socios') && (
                      <AlertCircle className="absolute -top-1 -right-1 h-3.5 w-3.5 text-destructive" />
                    )}
                  </TabsTrigger>
                )}
              </TabsList>

              {/* Tab: Dados da Cota */}
              <TabsContent value="cota" className="space-y-4">
                <FormField
                  control={form.control}
                  name="categoria"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a categoria" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                      {categoriasDisponiveis.map(opt => (
                        <SelectItem key={opt.name} value={opt.name}>{opt.label}</SelectItem>
                      ))}
                      {field.value && !categoriasDisponiveis.some(o => o.name === field.value) && (
                        <SelectItem value={field.value}>{field.value}</SelectItem>
                      )}
                        </SelectContent>

                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="grupo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grupo{tipoRegistroWatch === 'reserva' ? '' : ' *'}</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ex: A" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cota"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cota{tipoRegistroWatch === 'reserva' ? '' : ' *'}</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ex: 101" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="contrato_embracon"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contrato Embracon</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ''} placeholder="Nº do contrato na administradora" />
                      </FormControl>
                      <FormDescription>
                        Necessário para emitir o Comprovante de Cadastro ao cliente.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="valor_credito"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor do Crédito *</FormLabel>
                        <FormControl>
                          <Input
                            value={formatMonetaryDisplay(field.value || 0)}
                            onChange={e => {
                              const rawValue = parseMonetaryInput(e.target.value);
                              field.onChange(rawValue);
                            }}
                            placeholder="R$ 0,00"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="prazo_meses"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prazo (meses){tipoRegistroWatch === 'reserva' ? '' : ' *'}</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min={1}
                            max={300}
                            placeholder="Ex: 239"
                            value={field.value || ''}
                            onChange={(e) => field.onChange(Number(e.target.value) || 240)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Produto e condição de pagamento */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="produto_codigo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Produto Embracon</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || 'auto'}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={produtoSelecionado ? produtoSelecionado.nome : "Auto-detectar"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="auto">Auto-detectar</SelectItem>
                            {produtos?.filter(p => p.ativo).map(p => (
                              <SelectItem key={p.codigo} value={p.codigo}>
                                {p.codigo} - {p.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {autoStatus === 'sem_credito' && (
                          <p className="text-xs text-muted-foreground">
                            Informe o valor do crédito para o sistema procurar o produto. Se preferir, escolha o produto aqui na lista.
                          </p>
                        )}
                        {autoStatus === 'unico' && produtoSelecionado && (
                          <p className="text-xs text-muted-foreground">
                            O sistema escolheu automaticamente: <strong>{produtoSelecionado.codigo} - {produtoSelecionado.nome}</strong> (único produto com faixa compatível). Se não for esse, escolha o produto aqui na lista.
                          </p>
                        )}
                        {autoStatus === 'ambiguo' && (
                          <div className="text-xs text-amber-600 dark:text-amber-400 space-y-1">
                            <p>
                              Mais de um produto atende este crédito, então o Auto-detectar não escolhe por você. Selecione um aqui na lista:
                            </p>
                            <ul className="list-disc pl-4">
                              {candidatosAuto.map(p => (
                                <li key={p.codigo}>{p.codigo} - {p.nome}</li>
                              ))}
                            </ul>
                            <p className="text-muted-foreground">
                              Enquanto não escolher, o produto e a parcela ficam em branco — dá para salvar a cota assim e completar depois.
                            </p>
                          </div>
                        )}
                        {autoStatus === 'nenhum' && (
                          <p className="text-xs text-muted-foreground">
                            Nenhum produto ativo tem faixa de crédito compatível com este valor (confira também tipo de produto e objetivo). Escolha o produto aqui na lista ou digite as parcelas à mão.
                          </p>
                        )}

                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="condicao_pagamento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Condição de Pagamento</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || 'convencional'}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {CONDICAO_PAGAMENTO_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Objetivo da carta */}
                <FormField
                  control={form.control}
                  name="objetivo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Objetivo da Carta *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {objetivoOptions.map((o) => (
                            <SelectItem key={o.id} value={o.name}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Seguro de vida opcional */}
                <FormField
                  control={form.control}
                  name="inclui_seguro"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Seguro de Vida</FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Inclui seguro de vida opcional na parcela
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Composição da parcela calculada */}
                {calculoParcela && produtoSelecionado && (
                  <ParcelaComposicao
                    calculo={calculoParcela}
                    prazo={prazoMeses}
                    incluiSeguro={incluiSeguro}
                    taxaAntecipadaTipo={produtoSelecionado.taxa_antecipada_tipo}
                    usandoTabelaOficial={calculoParcela.usandoTabelaOficial}
                  />
                )}

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="empresa_paga_parcelas"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Empresa paga parcelas? *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="nao">Não</SelectItem>
                            <SelectItem value="sim">Sim</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dia_vencimento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dia de Vencimento</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={31}
                            {...field}
                            onChange={e => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="inicio_segunda_parcela"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Início da 2ª Parcela</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || 'automatico'}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="automatico">Automático (dia 16)</SelectItem>
                            <SelectItem value="proximo_mes">Próximo mês</SelectItem>
                            <SelectItem value="pular_mes">Pular 1 mês</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {field.value === 'automatico' 
                            ? 'Se contratação após dia 16, pula 1 mês' 
                            : field.value === 'pular_mes' 
                              ? '2ª parcela vence 2 meses após contratação' 
                              : '2ª parcela vence no mês seguinte'}
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Campos condicionais quando empresa paga parcelas */}
                {empresaPagaParcelas === 'sim' && (
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                    {/* Aviso de divergência: salvar edição NÃO regenera cronograma. */}
                    {isEditing && cronogramaGerado && (
                      <div
                        className={cn(
                          'rounded-md border p-3 text-sm',
                          parcelasPagasNoCronograma > 0
                            ? 'border-destructive/50 bg-destructive/10 text-destructive'
                            : 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400',
                        )}
                      >
                        <div className="flex gap-2">
                          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                          <div className="space-y-1">
                            <p>
                              O cronograma desta cota já foi gerado. Alterar as parcelas aqui muda o
                              que a cota declara, mas <strong>não</strong> reescreve o cronograma nem
                              os pagamentos já lançados.
                            </p>
                            {parcelasPagasNoCronograma > 0 && (
                              <p>
                                Esta cota tem <strong>{parcelasPagasNoCronograma}</strong> parcela(s)
                                com pagamento lançado. Alterar o desenho das parcelas vai desalinhar a
                                cota do que já foi pago.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Modo de declaração: padrão (quantidade) ou lista exata. */}
                    <FormField
                      control={form.control}
                      name="modo_parcelas_mcf"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Como declarar as parcelas da MCF</FormLabel>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={field.value !== 'lista' ? 'default' : 'outline'}
                              onClick={() => field.onChange('padrao')}
                            >
                              Por padrão
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={field.value === 'lista' ? 'default' : 'outline'}
                              onClick={() => field.onChange('lista')}
                            >
                              Escolher as parcelas
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {field.value === 'lista'
                              ? 'Marque exatamente quais das primeiras parcelas a MCF assume.'
                              : 'Tipo de contrato + quantidade — atende plano longo (ex.: todas as pares de 240).'}
                          </p>
                        </FormItem>
                      )}
                    />

                    {modoParcelasMcf === 'lista' ? (
                      <FormField
                        control={form.control}
                        name="parcelas_mcf_numeros"
                        render={({ field }) => (
                          <FormItem>
                            <ParcelasMcfPicker
                              value={field.value || []}
                              onChange={field.onChange}
                            />
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="tipo_contrato"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Tipo de Contrato *</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || ''}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="normal">Normal (primeiras parcelas)</SelectItem>
                                    <SelectItem value="intercalado">Intercalado (parcelas pares)</SelectItem>
                                    <SelectItem value="intercalado_impar">Intercalado (parcelas ímpares)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />

                          {tipoContrato && (
                            <FormField
                              control={form.control}
                              name="parcelas_pagas_empresa"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Quantas parcelas a empresa paga?</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min={0}
                                      max={tipoContrato === 'intercalado' ? Math.floor(prazoMeses / 2) : prazoMeses}
                                      {...field}
                                      onChange={e => field.onChange(Number(e.target.value))}
                                      value={field.value ?? 0}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                        </div>

                        {/* Valor total calculado */}
                        {tipoContrato && (
                          <div className="p-3 bg-primary/10 rounded-md">
                            <p className="text-sm text-muted-foreground">
                              {tipoContrato === 'intercalado'
                                ? `Intercalado: empresa paga as parcelas 2, 4, 6...${parcelasPagasEmpresa * 2} (${parcelasPagasEmpresa} parcelas pares)`
                                : `Normal: empresa paga as primeiras ${parcelasPagasEmpresa} parcelas`}
                            </p>
                            <p className="text-lg font-semibold text-primary mt-1">
                              Valor total: {formatMonetaryDisplay(valorTotalParcelasEmpresa)}
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}


                <div className="grid grid-cols-1 gap-4">
                  <FormField
                    control={form.control}
                    name="origem"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Origem *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                      {origemOptions
                        .filter(opt => opt.is_active)
                        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
                        .map(opt => (
                          <SelectItem key={opt.name} value={opt.name}>
                            {opt.label}
                          </SelectItem>
                        ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Tipo de cadastro: Reserva ou Contratação */}
                <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                  <FormField
                    control={form.control}
                    name="tipo_registro"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Cadastro *</FormLabel>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={field.value === 'reserva' ? 'default' : 'outline'}
                            size="sm"
                            className="flex-1"
                            onClick={() => field.onChange('reserva')}
                          >
                            🔖 Reserva (acordada)
                          </Button>
                          <Button
                            type="button"
                            variant={field.value === 'contratacao' ? 'default' : 'outline'}
                            size="sm"
                            className="flex-1"
                            onClick={() => field.onChange('contratacao')}
                          >
                            ✅ Contratação (1ª parcela paga)
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {field.value === 'reserva'
                            ? 'Cota acordada, mas a 1ª parcela ainda não foi paga. Parcelas serão geradas como previsão.'
                            : 'Cota com a 1ª parcela já paga. Parcelas serão geradas como pendentes/pagas.'}
                        </p>
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="data_reserva"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>
                            Data da Reserva {tipoRegistroWatch === 'reserva' ? '*' : ''}
                          </FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    'w-full pl-3 text-left font-normal',
                                    !field.value && 'text-muted-foreground'
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value as Date, 'dd/MM/yyyy', { locale: ptBR })
                                  ) : (
                                    <span>Selecione</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={(field.value as Date) ?? undefined}
                                onSelect={field.onChange}
                                locale={ptBR}
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {tipoRegistroWatch === 'contratacao' && (
                      <FormField
                        control={form.control}
                        name="data_contratacao"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Data de Contratação * (1ª parcela paga)</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      'w-full pl-3 text-left font-normal',
                                      !field.value && 'text-muted-foreground'
                                    )}
                                  >
                                    {field.value ? (
                                      format(field.value as Date, 'dd/MM/yyyy', { locale: ptBR })
                                    ) : (
                                      <span>Selecione</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={(field.value as Date) ?? undefined}
                                  onSelect={field.onChange}
                                  locale={ptBR}
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                </div>

                {/* Cadastro retroativo: histórico de pagamentos do cliente */}
                {isCadastroRetroativo && !isEditing && (
                  <div className="space-y-4 p-4 border border-amber-300 rounded-lg bg-amber-50 dark:bg-amber-950/20">
                    <div>
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                        ⚠️ Cadastro retroativo detectado
                      </p>
                      <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                        A data de contratação é anterior ao mês atual. Informe quantas parcelas o cliente já pagou
                        para que o sistema marque corretamente o histórico e evite cancelamento automático por inadimplência.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="parcelas_pagas_cliente"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Parcelas já pagas pelo cliente</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={0}
                                max={(prazoMeses || 240) - (parcelasPagasEmpresa || 0)}
                                placeholder={`Sugestão: ${sugestaoParcelasCliente}`}
                                {...field}
                                onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                                value={field.value ?? ''}
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground mt-1">
                              Sugestão automática: <strong>{sugestaoParcelasCliente}</strong> parcela(s)
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="data_ultimo_pagamento_cliente"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Data do último pagamento (opcional)</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      'w-full pl-3 text-left font-normal',
                                      !field.value && 'text-muted-foreground'
                                    )}
                                  >
                                    {field.value ? (
                                      format(field.value, 'dd/MM/yyyy', { locale: ptBR })
                                    ) : (
                                      <span>Hoje (padrão)</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value || undefined}
                                  onSelect={field.onChange}
                                  locale={ptBR}
                                />
                              </PopoverContent>
                            </Popover>
                            <p className="text-xs text-muted-foreground mt-1">
                              Marca como pagas até esta data
                            </p>
                          </FormItem>
                        )}
                      />
                    </div>
                    {parcelasPagasClienteWatch > 0 && (
                      <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-md">
                        <p className="text-sm text-amber-900 dark:text-amber-200">
                          ✅ Serão marcadas como <strong>pagas</strong> as primeiras{' '}
                          <strong>{parcelasPagasClienteWatch}</strong> parcela(s) do cliente cujo vencimento já tenha ocorrido.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="origem_detalhe"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Detalhe da Origem</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: Nome do sócio, campanha, etc." />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="vendedor_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendedor Responsável</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          const vendedor = vendedorOptions.find(v => v.id === value);
                          form.setValue('vendedor_name', vendedor?.name || '');
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {vendedorOptions.length > 0 ? (
                            vendedorOptions.map(vendedor => (
                              <SelectItem key={vendedor.id} value={vendedor.id}>
                                {vendedor.name}
                              </SelectItem>
                            ))
                          ) : (
                            <div className="p-2 text-sm text-muted-foreground">
                              Nenhum vendedor cadastrado. Adicione nas configurações.
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                      <VendedorAvisoPainel vendedorName={form.watch('vendedor_name')} />
                    </FormItem>
                  )}
                />

                {/* Seção: Controle Adicional */}
                <div className="space-y-4 p-4 border rounded-lg bg-muted/30 mt-6">
                  <h3 className="font-medium text-sm text-muted-foreground">Informações Adicionais</h3>
                  
                  <FormField
                    control={form.control}
                    name="valor_comissao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor da Comissão</FormLabel>
                        <FormControl>
                          <Input
                            value={formatMonetaryDisplay(field.value || 0)}
                            onChange={e => {
                              const rawValue = parseMonetaryInput(e.target.value);
                              field.onChange(rawValue);
                            }}
                            placeholder="R$ 0,00"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="e_transferencia"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>É Transferência?</FormLabel>
                          <p className="text-xs text-muted-foreground">
                            Marque se esta cota foi transferida de outro consorciado
                          </p>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {form.watch('e_transferencia') && (
                    <FormField
                      control={form.control}
                      name="transferido_de"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Transferido de</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Nome do antigo consorciado" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="observacoes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações</FormLabel>
                        <FormControl>
                          <textarea
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="Observações gerais sobre a cota..."
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Navigation buttons */}
                <div className="flex justify-between pt-4 border-t mt-6">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handlePreviousTab}
                    disabled={currentTabIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Anterior
                  </Button>
                  <Button 
                    type="button" 
                    onClick={handleNextTab}
                    disabled={currentTabIndex === tabOrder.length - 1}
                  >
                    Próximo
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </TabsContent>

              {/* Tab: Dados Pessoais (PF) */}
              {tipoPessoa === 'pf' && (
                <TabsContent value="dados" className="space-y-4">
                  {!isEditing && (
                    <ConsorciadoSearchPanel tipoPessoa="pf" onSelect={applyConsorciadoMatch} />
                  )}
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowChecklist(v => !v)}
                    >
                      {showChecklist ? 'Fechar' : '📋 Colar Check-list'}
                    </Button>
                  </div>
                  {showChecklist && (
                    <div className="space-y-2 p-3 border rounded-md bg-muted/30">
                      <label className="text-xs text-muted-foreground">Cole o texto do check-list abaixo:</label>
                      <Textarea
                        value={checklistText}
                        onChange={e => setChecklistText(e.target.value)}
                        rows={6}
                        placeholder={"Nome Completo: ...\nRG: ...\nCPF: ...\nCPF Cônjuge: ...\nEndereço Residencial: ...\nCEP: ...\nTelefone: ...\nE-mail: ...\nProfissão: ...\nRenda: R$ ...\nPatrimônio: R$ ...\nChave Pix: ..."}
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          const parsed = parseChecklistPF(checklistText);
                          if (parsed.nome_completo) form.setValue('nome_completo', parsed.nome_completo);
                          if (parsed.rg) form.setValue('rg', parsed.rg);
                          if (parsed.cpf) form.setValue('cpf', formatCpf(parsed.cpf));
                          if (parsed.cpf_conjuge) form.setValue('cpf_conjuge', formatCpf(parsed.cpf_conjuge));
                          if (parsed.endereco_completo) form.setValue('endereco_rua', parsed.endereco_completo);
                          if (parsed.endereco_cep) form.setValue('endereco_cep', formatCep(parsed.endereco_cep));
                          if (parsed.telefone) form.setValue('telefone', formatPhone(parsed.telefone));
                          if (parsed.email) form.setValue('email', parsed.email);
                          if (parsed.profissao) form.setValue('profissao', parsed.profissao);
                          if (parsed.renda) form.setValue('renda', parsed.renda);
                          if (parsed.patrimonio) form.setValue('patrimonio', parsed.patrimonio);
                          if (parsed.pix) form.setValue('pix', parsed.pix);
                          toast.success('Campos preenchidos a partir do check-list');
                          setShowChecklist(false);
                          setChecklistText('');
                        }}
                      >
                        Preencher Campos
                      </Button>
                    </div>
                  )}
                  <FormField
                    control={form.control}
                    name="nome_completo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Completo *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="cpf"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CPF *</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              value={formatCpf(field.value || '')}
                              onChange={(e) => field.onChange(formatCpf(e.target.value))}
                              placeholder="000.000.000-00" 
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="rg"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>RG</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="data_nascimento"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Data de Nascimento</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    'w-full pl-3 text-left font-normal',
                                    !field.value && 'text-muted-foreground'
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, 'dd/MM/yyyy', { locale: ptBR })
                                  ) : (
                                    <span>Selecione</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value || undefined}
                                onSelect={field.onChange}
                                locale={ptBR}
                              />
                            </PopoverContent>
                          </Popover>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="estado_civil"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estado Civil</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {ESTADO_CIVIL_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </div>

                  {estadoCivil === 'casado' && (
                    <FormField
                      control={form.control}
                      name="cpf_conjuge"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CPF do Cônjuge</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              value={formatCpf(field.value || '')}
                              onChange={(e) => field.onChange(formatCpf(e.target.value))}
                              placeholder="000.000.000-00" 
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="telefone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone *</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              value={formatPhone(field.value || '')}
                              onChange={(e) => field.onChange(formatPhone(e.target.value))}
                              placeholder="(11) 99999-9999" 
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="profissao"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Profissão</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Ex: Servidor Público" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    {profissao?.toLowerCase().includes('servidor') && (
                      <FormField
                        control={form.control}
                        name="tipo_servidor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo de Servidor</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {TIPO_SERVIDOR_OPTIONS.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="renda"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Renda</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="patrimonio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Patrimônio</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="pix"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Chave PIX</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Navigation buttons */}
                  <div className="flex justify-between pt-4 border-t mt-6">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handlePreviousTab}
                      disabled={currentTabIndex === 0}
                    >
                      <ChevronLeft className="h-4 w-4 mr-2" />
                      Anterior
                    </Button>
                    <Button 
                      type="button" 
                      onClick={handleNextTab}
                      disabled={currentTabIndex === tabOrder.length - 1}
                    >
                      Próximo
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </TabsContent>
              )}

              {/* Tab: Dados da Empresa (PJ) */}
              {tipoPessoa === 'pj' && (
                <TabsContent value="dados" className="space-y-4">
                  {!isEditing && (
                    <ConsorciadoSearchPanel tipoPessoa="pj" onSelect={applyConsorciadoMatch} />
                  )}
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowChecklistPJ(v => !v)}
                    >
                      {showChecklistPJ ? 'Fechar' : '📋 Colar Check-list PJ'}
                    </Button>
                  </div>
                  {showChecklistPJ && (
                    <div className="space-y-2 p-3 border rounded-md bg-muted/30">
                      <label className="text-xs text-muted-foreground">Cole o texto do check-list PJ abaixo:</label>
                      <Textarea
                        value={checklistTextPJ}
                        onChange={e => setChecklistTextPJ(e.target.value)}
                        rows={6}
                        placeholder={"Razão Social: ...\nCNPJ: ...\nNatureza Jurídica: ...\nInscrição Estadual: ...\nData de Fundação: dd/mm/aaaa\nEndereço Comercial: ...\nCEP: ...\nTelefone Comercial: ...\nE-mail comercial: ...\nFaturamento médio: R$ ...\nNúmero de funcionários: ..."}
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          const parsed = parseChecklistPJ(checklistTextPJ);
                          if (parsed.razao_social) form.setValue('razao_social', parsed.razao_social);
                          if (parsed.cnpj) form.setValue('cnpj', parsed.cnpj);
                          if (parsed.natureza_juridica) form.setValue('natureza_juridica', parsed.natureza_juridica);
                          if (parsed.inscricao_estadual) form.setValue('inscricao_estadual', parsed.inscricao_estadual);
                          if (parsed.data_fundacao) {
                            const d = parseDateWithoutTimezone(parsed.data_fundacao);
                            if (d) form.setValue('data_fundacao', d as any);
                          }
                          if (parsed.endereco_comercial) form.setValue('endereco_comercial_rua', parsed.endereco_comercial);
                          if (parsed.endereco_comercial_cep) form.setValue('endereco_comercial_cep', formatCep(parsed.endereco_comercial_cep));
                          if (parsed.telefone_comercial) form.setValue('telefone_comercial', formatPhone(parsed.telefone_comercial));
                          if (parsed.email_comercial) form.setValue('email_comercial', parsed.email_comercial);
                          if (parsed.faturamento_mensal) form.setValue('faturamento_mensal', parsed.faturamento_mensal);
                          if (parsed.num_funcionarios) form.setValue('num_funcionarios', parsed.num_funcionarios);
                          toast.success('Campos preenchidos a partir do check-list');
                          setShowChecklistPJ(false);
                          setChecklistTextPJ('');
                        }}
                      >
                        Preencher Campos
                      </Button>
                    </div>
                  )}
                  <FormField
                    control={form.control}
                    name="razao_social"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Razão Social *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="cnpj"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CNPJ *</FormLabel>
                          <div className="relative">
                            <FormControl>
                              <Input 
                                {...field} 
                                value={formatCnpj(field.value || '')}
                                onChange={(e) => handleCnpjChange(e.target.value, field.onChange)}
                                placeholder="00.000.000/0000-00"
                                disabled={loadingCnpj}
                              />
                            </FormControl>
                            {loadingCnpj && (
                              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="inscricao_estadual"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Inscrição Estadual</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="natureza_juridica"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Natureza Jurídica</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="data_fundacao"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Data de Fundação</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    'w-full pl-3 text-left font-normal',
                                    !field.value && 'text-muted-foreground'
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, 'dd/MM/yyyy', { locale: ptBR })
                                  ) : (
                                    <span>Selecione</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value || undefined}
                                onSelect={field.onChange}
                                locale={ptBR}
                              />
                            </PopoverContent>
                          </Popover>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="telefone_comercial"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone Comercial</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              value={formatPhone(field.value || '')}
                              onChange={(e) => field.onChange(formatPhone(e.target.value))}
                              placeholder="(11) 3333-3333" 
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email_comercial"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Comercial</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="faturamento_mensal"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Faturamento Mensal</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="num_funcionarios"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número de Funcionários</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  {/* Navigation buttons */}
                  <div className="flex justify-between pt-4 border-t mt-6">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handlePreviousTab}
                      disabled={currentTabIndex === 0}
                    >
                      <ChevronLeft className="h-4 w-4 mr-2" />
                      Anterior
                    </Button>
                    <Button 
                      type="button" 
                      onClick={handleNextTab}
                      disabled={currentTabIndex === tabOrder.length - 1}
                    >
                      Próximo
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </TabsContent>
              )}

              {/* Tab: Sócios (PJ only) */}
              {tipoPessoa === 'pj' && (
                <TabsContent value="socios" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Sócios</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => append({ nome: '', cpf: '', renda: undefined })}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Sócio
                    </Button>
                  </div>

                  {fields.map((field, index) => (
                    <div key={field.id} className="p-4 border rounded-lg space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium">Sócio {index + 1}</h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name={`partners.${index}.nome`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nome *</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`partners.${index}.cpf`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>CPF *</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  value={formatCpf(field.value || '')}
                                  onChange={(e) => field.onChange(formatCpf(e.target.value))}
                                  placeholder="000.000.000-00" 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`partners.${index}.renda`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Renda</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  {...field}
                                  onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                                  value={field.value ?? ''}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  ))}

                  {fields.length === 0 && (
                    <p className="text-muted-foreground text-center py-8">
                      Nenhum sócio adicionado. Clique em "Adicionar Sócio" para incluir.
                    </p>
                  )}

                  {/* Navigation buttons */}
                  <div className="flex justify-between pt-4 border-t mt-6">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handlePreviousTab}
                      disabled={currentTabIndex === 0}
                    >
                      <ChevronLeft className="h-4 w-4 mr-2" />
                      Anterior
                    </Button>
                    <Button 
                      type="button" 
                      onClick={handleNextTab}
                      disabled={currentTabIndex === tabOrder.length - 1}
                    >
                      Próximo
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </TabsContent>
              )}

              {/* Tab: Endereço */}
              <TabsContent value="endereco" className="space-y-4">
                {tipoPessoa === 'pf' ? (
                  <>
                    <FormField
                      control={form.control}
                      name="endereco_cep"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CEP</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input
                                {...field}
                                value={formatCep(field.value || '')}
                                onChange={(e) => field.onChange(formatCep(e.target.value))}
                                placeholder="00000-000"
                                onBlur={(e) => {
                                  field.onBlur();
                                  handleCepBlur(e.target.value);
                                }}
                              />
                            </FormControl>
                            {loadingCep && <Loader2 className="h-4 w-4 animate-spin" />}
                          </div>
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="endereco_rua"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Rua</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="endereco_numero"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Número</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="endereco_complemento"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Complemento</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="endereco_bairro"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bairro</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="endereco_cidade"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cidade</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="endereco_estado"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Estado</FormLabel>
                            <FormControl>
                              <Input {...field} maxLength={2} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="font-medium">Endereço Comercial</h3>
                    <FormField
                      control={form.control}
                      name="endereco_comercial_cep"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CEP</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input
                                {...field}
                                value={formatCep(field.value || '')}
                                onChange={(e) => field.onChange(formatCep(e.target.value))}
                                placeholder="00000-000"
                                onBlur={(e) => {
                                  field.onBlur();
                                  handleCepComercialBlur(e.target.value);
                                }}
                              />
                            </FormControl>
                            {loadingCepComercial && <Loader2 className="h-4 w-4 animate-spin" />}
                          </div>
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="endereco_comercial_rua"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Rua</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="endereco_comercial_numero"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Número</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="endereco_comercial_complemento"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Complemento</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="endereco_comercial_bairro"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bairro</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="endereco_comercial_cidade"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cidade</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="endereco_comercial_estado"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Estado</FormLabel>
                            <FormControl>
                              <Input {...field} maxLength={2} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </>
                )}

                {/* Navigation buttons */}
                <div className="flex justify-between pt-4 border-t mt-6">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handlePreviousTab}
                    disabled={currentTabIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Anterior
                  </Button>
                  <Button 
                    type="button" 
                    onClick={handleNextTab}
                    disabled={currentTabIndex === tabOrder.length - 1}
                  >
                    Próximo
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </TabsContent>

              {/* Tab: Documentos */}
              <TabsContent value="documentos" className="space-y-4">
                <div className="space-y-4">
                  <div className="flex gap-4 items-end">
                    <div className="flex-1">
                      <label className="text-sm font-medium mb-2 block">Tipo de Documento</label>
                      <Select value={selectedDocType} onValueChange={(v) => setSelectedDocType(v as TipoDocumento)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPO_DOCUMENTO_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label htmlFor="doc-upload" className="cursor-pointer">
                        <Button type="button" variant="outline" asChild>
                          <span>
                            <Upload className="h-4 w-4 mr-2" />
                            Selecionar Arquivo
                          </span>
                        </Button>
                      </label>
                      <input
                        id="doc-upload"
                        type="file"
                        className="hidden"
                        onChange={handleAddDocument}
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      />
                    </div>
                  </div>

                  {/* Lista de documentos pendentes */}
                  {pendingDocuments.length > 0 ? (
                    <div className="border rounded-lg divide-y">
                      {pendingDocuments.map((doc, index) => (
                        <div key={index} className="flex items-center justify-between p-3">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-sm">{doc.file.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {TIPO_DOCUMENTO_OPTIONS.find(o => o.value === doc.tipo)?.label || doc.tipo}
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveDocument(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="border rounded-lg p-8 text-center text-muted-foreground">
                      <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p>Nenhum documento adicionado</p>
                      <p className="text-xs mt-1">Selecione o tipo e clique em "Selecionar Arquivo"</p>
                    </div>
                  )}
                </div>

                {/* Navigation buttons */}
                <div className="flex justify-between pt-4 border-t mt-6">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handlePreviousTab}
                    disabled={currentTabIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Anterior
                  </Button>
                  <Button 
                    type="button" 
                    onClick={handleNextTab}
                    disabled={currentTabIndex === tabOrder.length - 1}
                  >
                    Próximo
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex flex-wrap items-center justify-end gap-4 pt-4">
              {/* Edição sem os dados completos = save bloqueado, não payload inteiro. */}
              {isEditing && !snapshotPronto && (
                <div className="mr-auto flex items-center gap-2 text-sm">
                  {erroDetalhe ? (
                    <>
                      <span className="text-destructive">
                        Não foi possível carregar os dados completos da cota. Salvar está bloqueado para não apagar informação.
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => recarregarDetalhe()}
                        disabled={buscandoDetalhe}
                      >
                        {buscandoDetalhe && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
                        Tentar de novo
                      </Button>
                    </>
                  ) : (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Carregando dados da cota…
                    </span>
                  )}
                </div>
              )}
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  createCard.isPending ||
                  updateCard.isPending ||
                  batchUpload.isPending ||
                  (isEditing && !snapshotPronto)
                }
                title={
                  isEditing && !snapshotPronto
                    ? erroDetalhe
                      ? 'Dados completos da cota não carregados — salvar bloqueado'
                      : 'Carregando dados da cota…'
                    : undefined
                }
              >
                {(createCard.isPending || updateCard.isPending || batchUpload.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? 'Salvar Alterações' : 'Cadastrar Carta'}
              </Button>
            </div>

          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
