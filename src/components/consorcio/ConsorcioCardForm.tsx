import { useState, useEffect, useMemo } from 'react';
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
import { cn } from '@/lib/utils';
import { buscarCep } from '@/lib/cepUtils';
import { validateCpf, validateCnpj, buscarCnpj } from '@/lib/documentUtils';
import { toast } from 'sonner';
import { useCreateConsorcioCard, useUpdateConsorcioCard } from '@/hooks/useConsorcio';
import { useBatchUploadDocuments } from '@/hooks/useConsorcioDocuments';
import { useEmployees } from '@/hooks/useEmployees';
import { useConsorcioProdutos, useConsorcioCreditos } from '@/hooks/useConsorcioProdutos';
import { useConsorcioOrigemOptions, useConsorcioCategoriaOptions, useConsorcioVendedorOptions } from '@/hooks/useConsorcioConfigOptions';
import { calcularParcela, getValoresTabelados } from '@/lib/consorcioCalculos';
import { ParcelaComposicao } from './ParcelaComposicao';
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
  
  // Cota
  grupo: z.string().min(1, 'Grupo é obrigatório'),
  cota: z.string().min(1, 'Cota é obrigatória'),
  valor_credito: z.number().min(1, 'Valor do crédito é obrigatório'),
  prazo_meses: z.number().min(1, 'Prazo é obrigatório'),
  tipo_produto: z.enum(['select', 'parcelinha']),
  empresa_paga_parcelas: z.enum(['sim', 'nao']),
  tipo_contrato: z.enum(['normal', 'intercalado', 'intercalado_impar']).optional(),
  parcelas_pagas_empresa: z.number().min(0).optional(),
  data_contratacao: z.date(),
  dia_vencimento: z.number().min(1).max(31),
  inicio_segunda_parcela: z.enum(['proximo_mes', 'pular_mes', 'automatico']).default('automatico'),
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
});

type FormData = z.infer<typeof formSchema>;

interface ConsorcioCardFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card?: ConsorcioCardWithDetails | null;
  duplicateFrom?: Partial<import('@/types/consorcio').ConsorcioCard> | null;
}

export function ConsorcioCardForm({ open, onOpenChange, card, duplicateFrom }: ConsorcioCardFormProps) {
  const [activeTab, setActiveTab] = useState('dados');
  const [loadingCep, setLoadingCep] = useState(false);
  const [loadingCepComercial, setLoadingCepComercial] = useState(false);
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [pendingDocuments, setPendingDocuments] = useState<Array<{ file: File; tipo: TipoDocumento }>>([]);
  const [selectedDocType, setSelectedDocType] = useState<TipoDocumento>('cnh');
  
  const isEditing = !!card;
  const { data: employees } = useEmployees();
  const { data: produtos } = useConsorcioProdutos();
  const { data: origemOptions = [] } = useConsorcioOrigemOptions();
  const { data: categoriaOptions = [] } = useConsorcioCategoriaOptions();
  const createCard = useCreateConsorcioCard();
  const updateCard = useUpdateConsorcioCard();
  const batchUpload = useBatchUploadDocuments();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: card ? {
      tipo_pessoa: card.tipo_pessoa as 'pf' | 'pj',
      categoria: (card.categoria as 'inside' | 'life') || 'inside',
      tipo_produto: card.tipo_produto as 'select' | 'parcelinha',
      empresa_paga_parcelas: (card.parcelas_pagas_empresa > 0 ? 'sim' : 'nao') as 'sim' | 'nao',
      tipo_contrato: card.tipo_contrato as 'normal' | 'intercalado' | 'intercalado_impar' | undefined,
      parcelas_pagas_empresa: card.parcelas_pagas_empresa,
      dia_vencimento: card.dia_vencimento,
      origem: card.origem as 'socio' | 'gr' | 'indicacao' | 'outros',
      origem_detalhe: card.origem_detalhe || undefined,
      grupo: card.grupo,
      cota: card.cota,
      valor_credito: Number(card.valor_credito),
      prazo_meses: card.prazo_meses,
      data_contratacao: parseDateWithoutTimezone(card.data_contratacao),
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
      tipo_produto: 'select',
      empresa_paga_parcelas: 'nao',
      tipo_contrato: undefined,
      parcelas_pagas_empresa: 0,
      dia_vencimento: 10,
      origem: 'socio',
      partners: [],
      prazo_meses: 240,
      produto_codigo: 'auto',
      condicao_pagamento: 'convencional',
      inclui_seguro: false,
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
  const tipoContrato = form.watch('tipo_contrato');
  const valorCredito = form.watch('valor_credito') || 0;
  const prazoMeses = form.watch('prazo_meses') || 240;
  const parcelasPagasEmpresa = form.watch('parcelas_pagas_empresa') || 0;
  const produtoCodigo = form.watch('produto_codigo');
  const condicaoPagamento = (form.watch('condicao_pagamento') || 'convencional') as CondicaoPagamento;
  const incluiSeguro = form.watch('inclui_seguro') || false;

  // Fetch vendedor options from configurable table
  const { data: vendedorOptions = [] } = useConsorcioVendedorOptions();

  // Find product that matches selected code or auto-detect from credit value
  const produtoSelecionado = useMemo(() => {
    if (!produtos) return undefined;
    
    if (produtoCodigo && produtoCodigo !== 'auto') {
      return produtos.find(p => p.codigo === produtoCodigo);
    }
    
    // Auto-detect based on credit value and tipo_produto
    const tipoProduto = form.watch('tipo_produto');
    const taxaTipo = tipoProduto === 'parcelinha' ? 'dividida_12' : 'primeira_parcela';
    
    return produtos.find(p => 
      p.ativo &&
      valorCredito >= p.faixa_credito_min &&
      valorCredito <= p.faixa_credito_max &&
      p.taxa_antecipada_tipo === taxaTipo
    );
  }, [produtos, produtoCodigo, valorCredito, form]);

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
      // Calcular total baseado no tipo de taxa do produto
      let totalPagoTabelado: number;
      
      if (produtoSelecionado.taxa_antecipada_tipo === 'dividida_12') {
        // PARCELINHA: 12 primeiras iguais + demais
        totalPagoTabelado = (valoresTabelados.parcela1a12 * 12) + 
          (valoresTabelados.parcelaDemais * (prazoValido - 12));
      } else {
        // SELECT: 1ª parcela (já com taxa) + (prazo-1) parcelas demais
        totalPagoTabelado = valoresTabelados.parcela1a12 + 
          (valoresTabelados.parcelaDemais * (prazoValido - 1));
      }
      
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
    cota: ['grupo', 'cota', 'valor_credito', 'prazo_meses', 'data_contratacao', 'dia_vencimento', 'origem'],
    socios: ['partners'],
  }), [tipoPessoa]);

  const getTabHasErrors = (tabKey: string) => {
    const fields = tabFieldsMap[tabKey as keyof typeof tabFieldsMap] || [];
    const errors = form.formState.errors;
    return fields.some(field => field in errors);
  };

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      setActiveTab('dados');
      setPendingDocuments([]);
      
      if (card) {
        // Edit mode - load card data
        form.reset({
          tipo_pessoa: card.tipo_pessoa as 'pf' | 'pj',
          categoria: (card.categoria as 'inside' | 'life') || 'inside',
          tipo_produto: card.tipo_produto as 'select' | 'parcelinha',
          empresa_paga_parcelas: (card.parcelas_pagas_empresa > 0 ? 'sim' : 'nao') as 'sim' | 'nao',
          tipo_contrato: card.tipo_contrato as 'normal' | 'intercalado' | 'intercalado_impar' | undefined,
          parcelas_pagas_empresa: card.parcelas_pagas_empresa,
          dia_vencimento: card.dia_vencimento,
          origem: card.origem as 'socio' | 'gr' | 'indicacao' | 'outros',
          origem_detalhe: card.origem_detalhe || undefined,
          grupo: card.grupo,
          cota: card.cota,
          valor_credito: Number(card.valor_credito),
          prazo_meses: card.prazo_meses,
          data_contratacao: parseDateWithoutTimezone(card.data_contratacao),
          vendedor_id: card.vendedor_id || undefined,
          vendedor_name: card.vendedor_name || undefined,
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
          // Composição da parcela
          produto_codigo: (card as any).produto_embracon || 'auto',
          condicao_pagamento: ((card as any).condicao_pagamento || 'convencional') as 'convencional' | '50' | '25',
          inclui_seguro: (card as any).inclui_seguro_vida || false,
          // Controle adicional
          valor_comissao: card.valor_comissao ? Number(card.valor_comissao) : undefined,
          e_transferencia: card.e_transferencia || false,
          transferido_de: card.transferido_de || undefined,
          observacoes: card.observacoes || undefined,
        });
      } else if (duplicateFrom) {
        // Duplicate mode - pre-fill personal data, leave cota fields empty
        const d = duplicateFrom;
        form.reset({
          tipo_pessoa: (d.tipo_pessoa as 'pf' | 'pj') || 'pf',
          categoria: (d.categoria as 'inside' | 'life') || 'inside',
          tipo_produto: (d.tipo_produto as 'select' | 'parcelinha') || 'select',
          empresa_paga_parcelas: 'nao',
          tipo_contrato: undefined,
          parcelas_pagas_empresa: 0,
          dia_vencimento: 10,
          origem: (d.origem as any) || 'socio',
          origem_detalhe: d.origem_detalhe || undefined,
          vendedor_id: d.vendedor_id || undefined,
          vendedor_name: d.vendedor_name || undefined,
          partners: [],
          // Cota fields empty
          grupo: '',
          cota: '',
          valor_credito: 0,
          prazo_meses: 0,
          produto_codigo: 'auto',
          condicao_pagamento: 'convencional',
          inclui_seguro: false,
          // Controle
          valor_comissao: undefined,
          e_transferencia: d.e_transferencia || false,
          transferido_de: d.transferido_de || undefined,
          observacoes: d.observacoes || undefined,
          // PF
          nome_completo: d.nome_completo || '',
          data_nascimento: d.data_nascimento ? parseDateWithoutTimezone(d.data_nascimento) : undefined,
          cpf: d.cpf || '',
          rg: d.rg || '',
          estado_civil: (d.estado_civil as any) || undefined,
          cpf_conjuge: d.cpf_conjuge || '',
          endereco_cep: d.endereco_cep || '',
          endereco_rua: d.endereco_rua || '',
          endereco_numero: d.endereco_numero || '',
          endereco_complemento: d.endereco_complemento || '',
          endereco_bairro: d.endereco_bairro || '',
          endereco_cidade: d.endereco_cidade || '',
          endereco_estado: d.endereco_estado || '',
          telefone: d.telefone || '',
          email: d.email || '',
          profissao: d.profissao || '',
          tipo_servidor: (d.tipo_servidor as any) || undefined,
          renda: d.renda ? Number(d.renda) : undefined,
          patrimonio: d.patrimonio ? Number(d.patrimonio) : undefined,
          pix: d.pix || '',
          // PJ
          razao_social: d.razao_social || '',
          cnpj: d.cnpj || '',
          natureza_juridica: d.natureza_juridica || '',
          inscricao_estadual: d.inscricao_estadual || '',
          data_fundacao: d.data_fundacao ? parseDateWithoutTimezone(d.data_fundacao) : undefined,
          endereco_comercial_cep: d.endereco_comercial_cep || '',
          endereco_comercial_rua: d.endereco_comercial_rua || '',
          endereco_comercial_numero: d.endereco_comercial_numero || '',
          endereco_comercial_complemento: d.endereco_comercial_complemento || '',
          endereco_comercial_bairro: d.endereco_comercial_bairro || '',
          endereco_comercial_cidade: d.endereco_comercial_cidade || '',
          endereco_comercial_estado: d.endereco_comercial_estado || '',
          telefone_comercial: d.telefone_comercial || '',
          email_comercial: d.email_comercial || '',
          faturamento_mensal: d.faturamento_mensal ? Number(d.faturamento_mensal) : undefined,
          num_funcionarios: d.num_funcionarios ? Number(d.num_funcionarios) : undefined,
        });
      } else {
        // Create mode - reset to empty values
        form.reset({
          tipo_pessoa: 'pf',
          categoria: 'inside',
          tipo_produto: 'select',
          empresa_paga_parcelas: 'nao',
          tipo_contrato: undefined,
          parcelas_pagas_empresa: 0,
          dia_vencimento: 10,
          origem: 'socio',
          partners: [],
          grupo: '',
          cota: '',
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
      }
    }
  }, [open, card, duplicateFrom, form]);

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

  const onSubmit = async (data: FormData) => {
    // Calculate parcelas_pagas_empresa based on empresa_paga_parcelas
    let calculatedParcelas = 0;
    if (data.empresa_paga_parcelas === 'sim') {
      // Para ambos os modos (normal e intercalado), usar o valor digitado pelo usuário
      calculatedParcelas = data.parcelas_pagas_empresa || 0;
    }

    // Derivar tipo_produto automaticamente do produto selecionado
    const tipoProdutoDerivado: 'select' | 'parcelinha' = produtoSelecionado
      ? (produtoSelecionado.taxa_antecipada_tipo === 'dividida_12' ? 'parcelinha' : 'select')
      : data.tipo_produto;

    const input: CreateConsorcioCardInput = {
      tipo_pessoa: data.tipo_pessoa,
      categoria: data.categoria,
      grupo: data.grupo,
      cota: data.cota,
      valor_credito: data.valor_credito,
      prazo_meses: data.prazo_meses,
      tipo_produto: tipoProdutoDerivado,
      tipo_contrato: data.empresa_paga_parcelas === 'sim' ? (data.tipo_contrato || 'normal') : 'normal',
      parcelas_pagas_empresa: calculatedParcelas,
      data_contratacao: formatDateForDB(data.data_contratacao),
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
      renda: data.renda || undefined,
      patrimonio: data.patrimonio || undefined,
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
      faturamento_mensal: data.faturamento_mensal || undefined,
      num_funcionarios: data.num_funcionarios || undefined,
      // Controle adicional
      valor_comissao: data.valor_comissao || undefined,
      e_transferencia: data.e_transferencia || false,
      transferido_de: data.transferido_de,
      observacoes: data.observacoes,
      
      // Composição da parcela
      produto_embracon: data.produto_codigo || undefined,
      condicao_pagamento: data.condicao_pagamento || undefined,
      inclui_seguro_vida: data.inclui_seguro || false,
      parcela_1a_12a: calculoParcela?.parcela1a12 || undefined,
      parcela_demais: calculoParcela?.parcelaDemais || undefined,
      
      partners: (data.partners || []).filter(p => p.nome && p.cpf) as Array<{ nome: string; cpf: string; renda?: number }>,
    };

    if (isEditing && card) {
      await updateCard.mutateAsync({ id: card.id, ...input });
    } else {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Carta de Consórcio' : duplicateFrom ? 'Duplicar Carta de Consórcio' : 'Nova Carta de Consórcio'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
              <TabsList className={cn("grid w-full", tipoPessoa === 'pj' ? "grid-cols-5" : "grid-cols-4")}>
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
                      {categoriaOptions
                        .filter(opt => opt.is_active)
                        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
                        .map(opt => (
                          <SelectItem key={opt.name} value={opt.name}>{opt.label}</SelectItem>
                        ))}
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
                        <FormLabel>Grupo *</FormLabel>
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
                        <FormLabel>Cota *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ex: 101" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

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
                        <FormLabel>Prazo (meses) *</FormLabel>
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
                        {produtoSelecionado && (!field.value || field.value === 'auto') && (
                          <p className="text-xs text-muted-foreground">
                            Detectado: {produtoSelecionado.codigo} - {produtoSelecionado.nome}
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
                        : `Normal: empresa paga as primeiras ${parcelasPagasEmpresa} parcelas`
                      }
                        </p>
                        <p className="text-lg font-semibold text-primary mt-1">
                          Valor total: {formatMonetaryDisplay(valorTotalParcelasEmpresa)}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="data_contratacao"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Data de Contratação *</FormLabel>
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
                              selected={field.value}
                              onSelect={field.onChange}
                              locale={ptBR}
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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

            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createCard.isPending || updateCard.isPending || batchUpload.isPending}>
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
