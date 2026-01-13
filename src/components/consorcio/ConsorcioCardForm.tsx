import { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Plus, Trash2, Loader2, Upload, FileText, X, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { buscarCep } from '@/lib/cepUtils';
import { useCreateConsorcioCard, useUpdateConsorcioCard } from '@/hooks/useConsorcio';
import { useBatchUploadDocuments } from '@/hooks/useConsorcioDocuments';
import { useEmployees } from '@/hooks/useEmployees';
import {
  ESTADO_CIVIL_OPTIONS,
  TIPO_SERVIDOR_OPTIONS,
  ORIGEM_OPTIONS,
  TIPO_DOCUMENTO_OPTIONS,
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

const formSchema = z.object({
  tipo_pessoa: z.enum(['pf', 'pj']),
  
  // Cota
  grupo: z.string().min(1, 'Grupo é obrigatório'),
  cota: z.string().min(1, 'Cota é obrigatória'),
  valor_credito: z.number().min(1, 'Valor do crédito é obrigatório'),
  prazo_meses: z.number().min(1, 'Prazo é obrigatório'),
  tipo_produto: z.enum(['select', 'parcelinha']),
  tipo_contrato: z.enum(['normal', 'intercalado']),
  parcelas_pagas_empresa: z.number().min(0),
  data_contratacao: z.date(),
  dia_vencimento: z.number().min(1).max(31),
  origem: z.enum(['socio', 'gr', 'indicacao', 'outros']),
  origem_detalhe: z.string().optional(),
  vendedor_id: z.string().optional(),
  vendedor_name: z.string().optional(),
  
  // PF
  nome_completo: z.string().optional(),
  data_nascimento: z.date().optional().nullable(),
  cpf: z.string().optional(),
  rg: z.string().optional(),
  estado_civil: z.enum(['solteiro', 'casado', 'divorciado', 'viuvo', 'uniao_estavel']).optional().nullable(),
  cpf_conjuge: z.string().optional(),
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
  cnpj: z.string().optional(),
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
    cpf: z.string(),
    renda: z.number().optional(),
  })).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface ConsorcioCardFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card?: ConsorcioCardWithDetails | null;
}

export function ConsorcioCardForm({ open, onOpenChange, card }: ConsorcioCardFormProps) {
  const [activeTab, setActiveTab] = useState('dados');
  const [loadingCep, setLoadingCep] = useState(false);
  const [loadingCepComercial, setLoadingCepComercial] = useState(false);
  const [pendingDocuments, setPendingDocuments] = useState<Array<{ file: File; tipo: TipoDocumento }>>([]);
  const [selectedDocType, setSelectedDocType] = useState<TipoDocumento>('cnh');
  
  const isEditing = !!card;
  const { data: employees } = useEmployees();
  const createCard = useCreateConsorcioCard();
  const updateCard = useUpdateConsorcioCard();
  const batchUpload = useBatchUploadDocuments();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: card ? {
      tipo_pessoa: card.tipo_pessoa as 'pf' | 'pj',
      tipo_produto: card.tipo_produto as 'select' | 'parcelinha',
      tipo_contrato: card.tipo_contrato as 'normal' | 'intercalado',
      parcelas_pagas_empresa: card.parcelas_pagas_empresa,
      dia_vencimento: card.dia_vencimento,
      origem: card.origem as 'socio' | 'gr' | 'indicacao' | 'outros',
      origem_detalhe: card.origem_detalhe || undefined,
      grupo: card.grupo,
      cota: card.cota,
      valor_credito: Number(card.valor_credito),
      prazo_meses: card.prazo_meses,
      data_contratacao: new Date(card.data_contratacao),
      vendedor_id: card.vendedor_id || undefined,
      vendedor_name: card.vendedor_name || undefined,
      // PF
      nome_completo: card.nome_completo || undefined,
      data_nascimento: card.data_nascimento ? new Date(card.data_nascimento) : undefined,
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
      data_fundacao: card.data_fundacao ? new Date(card.data_fundacao) : undefined,
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
      tipo_produto: 'select',
      tipo_contrato: 'normal',
      parcelas_pagas_empresa: 0,
      dia_vencimento: 10,
      origem: 'socio',
      partners: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'partners',
  });

  const tipoPessoa = form.watch('tipo_pessoa');
  const estadoCivil = form.watch('estado_civil');
  const profissao = form.watch('profissao');

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
          tipo_produto: card.tipo_produto as 'select' | 'parcelinha',
          tipo_contrato: card.tipo_contrato as 'normal' | 'intercalado',
          parcelas_pagas_empresa: card.parcelas_pagas_empresa,
          dia_vencimento: card.dia_vencimento,
          origem: card.origem as 'socio' | 'gr' | 'indicacao' | 'outros',
          origem_detalhe: card.origem_detalhe || undefined,
          grupo: card.grupo,
          cota: card.cota,
          valor_credito: Number(card.valor_credito),
          prazo_meses: card.prazo_meses,
          data_contratacao: new Date(card.data_contratacao),
          vendedor_id: card.vendedor_id || undefined,
          vendedor_name: card.vendedor_name || undefined,
          nome_completo: card.nome_completo || undefined,
          data_nascimento: card.data_nascimento ? new Date(card.data_nascimento) : undefined,
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
          data_fundacao: card.data_fundacao ? new Date(card.data_fundacao) : undefined,
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
        });
      } else {
        // Create mode - reset to empty values
        form.reset({
          tipo_pessoa: 'pf',
          tipo_produto: 'select',
          tipo_contrato: 'normal',
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
  }, [open, card, form]);

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
    const input: CreateConsorcioCardInput = {
      tipo_pessoa: data.tipo_pessoa,
      grupo: data.grupo,
      cota: data.cota,
      valor_credito: data.valor_credito,
      prazo_meses: data.prazo_meses,
      tipo_produto: data.tipo_produto,
      tipo_contrato: data.tipo_contrato,
      parcelas_pagas_empresa: data.parcelas_pagas_empresa,
      data_contratacao: format(data.data_contratacao, 'yyyy-MM-dd'),
      dia_vencimento: data.dia_vencimento,
      origem: data.origem,
      origem_detalhe: data.origem_detalhe,
      vendedor_id: data.vendedor_id,
      vendedor_name: data.vendedor_name,
      nome_completo: data.nome_completo,
      data_nascimento: data.data_nascimento ? format(data.data_nascimento, 'yyyy-MM-dd') : undefined,
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
      data_fundacao: data.data_fundacao ? format(data.data_fundacao, 'yyyy-MM-dd') : undefined,
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
          <DialogTitle>{isEditing ? 'Editar Carta de Consórcio' : 'Nova Carta de Consórcio'}</DialogTitle>
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
                            type="number"
                            {...field}
                            onChange={e => field.onChange(Number(e.target.value))}
                            placeholder="50000"
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
                            {...field}
                            onChange={e => field.onChange(Number(e.target.value))}
                            placeholder="120"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="tipo_produto"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Produto *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="select">Select</SelectItem>
                            <SelectItem value="parcelinha">Parcelinha</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tipo_contrato"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Contrato *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="intercalado">Intercalado</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="parcelas_pagas_empresa"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Parcelas pagas pela empresa</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={e => field.onChange(Number(e.target.value))}
                            placeholder="0"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dia_vencimento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dia de Vencimento *</FormLabel>
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
                </div>

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
                      <FormItem>
                        <FormLabel>Origem *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ORIGEM_OPTIONS.map(opt => (
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
                          const emp = employees?.find(e => e.id === value);
                          form.setValue('vendedor_name', emp?.nome_completo || '');
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {employees?.map(emp => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.nome_completo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

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
                          <FormControl>
                            <Input 
                              {...field} 
                              value={formatCnpj(field.value || '')}
                              onChange={(e) => field.onChange(formatCnpj(e.target.value))}
                              placeholder="00.000.000/0000-00" 
                            />
                          </FormControl>
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
