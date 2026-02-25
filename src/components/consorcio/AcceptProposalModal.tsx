import { useState, useCallback } from 'react';
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
    // Validate documents
    if (tipoPessoa === 'pf' && pfDocuments.length === 0) {
      form.setError('root', { message: 'Upload do RG ou CNH é obrigatório' });
      return;
    }
    if (tipoPessoa === 'pj') {
      if (!pjDocContratoSocial) {
        form.setError('root', { message: 'Upload do Contrato Social é obrigatório' });
        return;
      }
      if (!pjDocRgSocios) {
        form.setError('root', { message: 'Upload do RG/CNH dos sócios é obrigatório' });
        return;
      }
      if (!pjDocCartaoCnpj) {
        form.setError('root', { message: 'Upload do Cartão CNPJ é obrigatório' });
        return;
      }
    }

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
            Preencha os dados completos do cliente para enviar ao Controle Consórcio.
          </p>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-4">
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
                      <Label>RG ou CNH (PDF) *</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept=".pdf"
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
                          // Handle socios
                          if (parsed.socios_cpfs && parsed.socios_cpfs.length > 0) {
                            const rendaPorSocio = parsed.renda_socios ? Math.round((parsed.renda_socios / parsed.socios_cpfs.length) * 100) / 100 : 0;
                            // Remove existing socios and add new ones
                            while (socioFields.length > 0) removeSocio(0);
                            parsed.socios_cpfs.forEach(cpf => {
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
                        <Label>RG/CNH dos Sócios (PDF) *</Label>
                        <Input type="file" accept=".pdf" onChange={e => setPjDocRgSocios(e.target.files?.[0] || null)} />
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

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createRegistration.isPending}>
                    {createRegistration.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Confirmar e Enviar para Controle Consórcio
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
