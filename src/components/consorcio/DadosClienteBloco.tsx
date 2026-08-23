/**
 * Bloco CADASTRAL do cliente (PF/PJ) — compartilhado entre o lançamento da
 * venda (`ProposalModal`, bloco 2 opcional) e o "Cadastrar Dados da Cota"
 * (`AcceptProposalModal`, onde é obrigatório).
 *
 * Os campos, as máscaras, o "Colar Check-list" e os anexos são exatamente os
 * mesmos nos dois lugares: quem decide se o bloco é obrigatório é a tela que o
 * usa, não este componente.
 */
import { useCallback, useState } from 'react';
import { useForm, useFieldArray, type UseFormReturn } from 'react-hook-form';
import { Loader2, Plus, Trash2, FileText, X } from 'lucide-react';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { parseChecklistPF, parseChecklistPJ } from '@/lib/checklistParser';
import { validateCpf, validateCnpj, buscarCnpj } from '@/lib/documentUtils';
import { buscarCep } from '@/lib/cepUtils';
import { formatBRLInput, parseBRLInput, numberToBRLInput } from '@/lib/brlMask';

import { TipoDocumento } from '@/types/consorcio';

// ===== Máscaras =====
export function formatCpf(value: string): string {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function formatCnpj(value: string): string {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export function formatCep(value: string): string {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function formatPhone(value: string): string {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export const CAMPOS_PF = [
  'nome_completo', 'rg', 'cpf', 'profissao', 'telefone', 'email',
  'endereco_completo', 'endereco_cep', 'renda', 'patrimonio', 'pix',
] as const;

export const CAMPOS_PJ = [
  'razao_social', 'cnpj', 'natureza_juridica', 'inscricao_estadual', 'data_fundacao',
  'telefone_comercial', 'email_comercial', 'endereco_comercial',
  'endereco_comercial_cep', 'faturamento_mensal',
] as const;

const isFilled = (v: unknown) =>
  v !== undefined && v !== null && String(v).trim() !== '' && v !== 0;

export interface DadosClienteBloco {
  form: UseFormReturn<any>;
  tipoPessoa: 'pf' | 'pj';
  setTipoPessoa: (v: 'pf' | 'pj') => void;
  /** Todos os campos obrigatórios do tipo de pessoa estão preenchidos. */
  checklistOk: boolean;
  /** Anexos mínimos presentes (1 doc no PF; contrato + RG + cartão no PJ). */
  docsOk: boolean;
  /** O operador começou a preencher algo — usado para decidir se o bloco "conta". */
  algumCampoPreenchido: boolean;
  /** Arquivos escolhidos, no formato que o hook de cadastro espera. */
  documentos: () => Array<{ file: File; tipo: TipoDocumento }>;
  /** Dados do formulário limpos de campos do outro tipo de pessoa. */
  dadosLimpos: (data: any) => Record<string, unknown>;
  // internos usados pelo componente de campos
  _interno: {
    loadingCep: boolean;
    loadingCnpj: boolean;
    buscarCepEmCampo: (cep: string, prefix: 'endereco' | 'comercial') => void;
    buscarCnpjEmCampo: (cnpj: string) => void;
    showChecklist: boolean;
    setShowChecklist: (v: boolean) => void;
    checklistText: string;
    setChecklistText: (v: string) => void;
    showChecklistPJ: boolean;
    setShowChecklistPJ: (v: boolean) => void;
    checklistTextPJ: string;
    setChecklistTextPJ: (v: string) => void;
    checklistSemNomeSocio: boolean;
    setChecklistSemNomeSocio: (v: boolean) => void;
    socioFields: Array<{ id: string }>;
    addSocio: (v: { nome: string; cpf: string; renda: number }) => void;
    removeSocio: (i: number) => void;
    pfDocuments: File[];
    setPfDocuments: React.Dispatch<React.SetStateAction<File[]>>;
    pjContratoSocial: File | null;
    setPjContratoSocial: (f: File | null) => void;
    pjRgSocios: File | null;
    setPjRgSocios: (f: File | null) => void;
    pjCartaoCnpj: File | null;
    setPjCartaoCnpj: (f: File | null) => void;
  };
}

export function useDadosCliente(opts?: { nomeInicial?: string }): DadosClienteBloco {
  const [tipoPessoa, setTipoPessoaState] = useState<'pf' | 'pj'>('pf');
  const [loadingCep, setLoadingCep] = useState(false);
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [checklistText, setChecklistText] = useState('');
  const [showChecklistPJ, setShowChecklistPJ] = useState(false);
  const [checklistTextPJ, setChecklistTextPJ] = useState('');
  const [checklistSemNomeSocio, setChecklistSemNomeSocio] = useState(false);
  const [pfDocuments, setPfDocuments] = useState<File[]>([]);
  const [pjContratoSocial, setPjContratoSocial] = useState<File | null>(null);
  const [pjRgSocios, setPjRgSocios] = useState<File | null>(null);
  const [pjCartaoCnpj, setPjCartaoCnpj] = useState<File | null>(null);

  const form = useForm<any>({
    defaultValues: {
      tipo_pessoa: 'pf',
      nome_completo: opts?.nomeInicial || '',
      rg: '', cpf: '', cpf_conjuge: '', profissao: '', telefone: '', email: '',
      endereco_completo: '', endereco_cep: '', renda: 0, patrimonio: 0, pix: '',
      razao_social: '', cnpj: '', natureza_juridica: '', inscricao_estadual: '',
      data_fundacao: '', telefone_comercial: '', email_comercial: '',
      endereco_comercial: '', endereco_comercial_cep: '',
      num_funcionarios: 0, faturamento_mensal: 0,
      socios: [{ nome: '', cpf: '', renda: 0 }],
    },
  });

  const { fields: socioFields, append: addSocio, remove: removeSocio } = useFieldArray({
    control: form.control,
    name: 'socios',
  });

  const watched = form.watch();

  const checklistOk = tipoPessoa === 'pf'
    ? CAMPOS_PF.every(k => isFilled((watched as any)[k]))
    : CAMPOS_PJ.every(k => isFilled((watched as any)[k]))
      && Array.isArray((watched as any).socios)
      && (watched as any).socios.length > 0
      && (watched as any).socios.every((s: any) => isFilled(s?.cpf) && isFilled(s?.nome));

  const docsOk = tipoPessoa === 'pf'
    ? pfDocuments.length > 0
    : !!(pjContratoSocial && pjRgSocios && pjCartaoCnpj);

  const camposDoTipo = tipoPessoa === 'pf' ? CAMPOS_PF : CAMPOS_PJ;
  const algumCampoPreenchido = camposDoTipo.some(k => isFilled((watched as any)[k]))
    || pfDocuments.length > 0 || !!pjContratoSocial || !!pjRgSocios || !!pjCartaoCnpj;

  const buscarCepEmCampo = useCallback(async (cep: string, prefix: 'endereco' | 'comercial') => {
    if (cep.replace(/\D/g, '').length !== 8) return;
    setLoadingCep(true);
    try {
      const r = await buscarCep(cep);
      if (r) {
        const addr = `${r.rua}, ${r.bairro}, ${r.cidade} - ${r.estado}`;
        form.setValue(prefix === 'endereco' ? 'endereco_completo' : 'endereco_comercial', addr);
      }
    } finally {
      setLoadingCep(false);
    }
  }, [form]);

  const buscarCnpjEmCampo = useCallback(async (cnpj: string) => {
    if (cnpj.replace(/\D/g, '').length !== 14) return;
    setLoadingCnpj(true);
    try {
      const r = await buscarCnpj(cnpj);
      if (r) {
        form.setValue('razao_social', r.razao_social);
        if (r.natureza_juridica) form.setValue('natureza_juridica', r.natureza_juridica);
        if (r.data_fundacao) form.setValue('data_fundacao', r.data_fundacao);
        if (r.telefone) form.setValue('telefone_comercial', formatPhone(r.telefone));
        if (r.email) form.setValue('email_comercial', r.email);
        if (r.cep) {
          form.setValue('endereco_comercial_cep', formatCep(r.cep));
          const addr = `${r.logradouro || ''} ${r.numero || ''}, ${r.bairro || ''}, ${r.municipio || ''} - ${r.uf || ''}`;
          form.setValue('endereco_comercial', addr.trim());
        }
      }
    } finally {
      setLoadingCnpj(false);
    }
  }, [form]);

  const documentos = useCallback((): Array<{ file: File; tipo: TipoDocumento }> => {
    const out: Array<{ file: File; tipo: TipoDocumento }> = [];
    if (tipoPessoa === 'pf') {
      pfDocuments.forEach(f => out.push({ file: f, tipo: 'cnh' }));
    } else {
      if (pjContratoSocial) out.push({ file: pjContratoSocial, tipo: 'contrato_social' });
      if (pjRgSocios) out.push({ file: pjRgSocios, tipo: 'cnh' });
      if (pjCartaoCnpj) out.push({ file: pjCartaoCnpj, tipo: 'cartao_cnpj' });
    }
    return out;
  }, [tipoPessoa, pfDocuments, pjContratoSocial, pjRgSocios, pjCartaoCnpj]);

  const dadosLimpos = useCallback((data: any) => {
    const pjOnly = [...CAMPOS_PJ, 'num_funcionarios', 'socios'] as string[];
    const pfOnly = ['nome_completo', 'rg', 'cpf', 'cpf_conjuge', 'profissao'];
    const excluir = tipoPessoa === 'pf' ? pjOnly : pfOnly;
    return Object.fromEntries(Object.entries(data || {}).filter(([k]) => !excluir.includes(k)));
  }, [tipoPessoa]);

  const setTipoPessoa = useCallback((v: 'pf' | 'pj') => {
    setTipoPessoaState(v);
    form.setValue('tipo_pessoa', v);
  }, [form]);

  return {
    form, tipoPessoa, setTipoPessoa, checklistOk, docsOk, algumCampoPreenchido,
    documentos, dadosLimpos,
    _interno: {
      loadingCep, loadingCnpj, buscarCepEmCampo, buscarCnpjEmCampo,
      showChecklist, setShowChecklist, checklistText, setChecklistText,
      showChecklistPJ, setShowChecklistPJ, checklistTextPJ, setChecklistTextPJ,
      checklistSemNomeSocio, setChecklistSemNomeSocio,
      socioFields, addSocio: (v) => addSocio(v), removeSocio,
      pfDocuments, setPfDocuments,
      pjContratoSocial, setPjContratoSocial,
      pjRgSocios, setPjRgSocios,
      pjCartaoCnpj, setPjCartaoCnpj,
    },
  };
}

/** Seletor PF/PJ — separado porque nem toda tela o quer no mesmo lugar. */
export function TipoPessoaSelect({ bloco }: { bloco: DadosClienteBloco }) {
  return (
    <div className="space-y-2">
      <Label>Tipo de Pessoa</Label>
      <Select value={bloco.tipoPessoa} onValueChange={(v: 'pf' | 'pj') => bloco.setTipoPessoa(v)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="pf">Pessoa Física</SelectItem>
          <SelectItem value="pj">Pessoa Jurídica</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Campos do bloco cadastral. Renderiza dentro de um `<Form>` próprio para poder
 * ser usado em telas que não têm um form react-hook-form envolvendo tudo.
 */
export function DadosClienteFields({
  bloco,
  children,
}: {
  bloco: DadosClienteBloco;
  /** Conteúdo extra no fim do bloco (ex.: rodapé/ações da tela que o usa). */
  children?: React.ReactNode;
}) {
  const { form, tipoPessoa } = bloco;
  const i = bloco._interno;

  return (
    <Form {...form}>
      <div className="space-y-4">
        {tipoPessoa === 'pf' ? (
          <>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Dados Pessoais</h3>
              <Button type="button" variant="outline" size="sm" onClick={() => i.setShowChecklist(!i.showChecklist)}>
                {i.showChecklist ? 'Fechar' : '📋 Colar Check-list'}
              </Button>
            </div>
            {i.showChecklist && (
              <div className="space-y-2 p-3 border rounded-md bg-muted/30">
                <Label className="text-xs text-muted-foreground">Cole o texto do check-list abaixo:</Label>
                <Textarea
                  value={i.checklistText}
                  onChange={e => i.setChecklistText(e.target.value)}
                  rows={6}
                  placeholder={"Nome Completo: ...\nRG: ...\nCPF: ...\nCPF Cônjuge: ...\nEndereço Residencial: ...\nCEP: ...\nTelefone: ...\nE-mail: ...\nProfissão: ...\nRenda: R$ ...\nPatrimônio: R$ ...\nChave Pix: ..."}
                />
                <Button type="button" size="sm" onClick={() => {
                  const parsed = parseChecklistPF(i.checklistText);
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
                  i.setShowChecklist(false);
                  i.setChecklistText('');
                }}>
                  Preencher Campos
                </Button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="nome_completo" render={({ field }) => (
                <FormItem><FormLabel>Nome Completo</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="rg" render={({ field }) => (
                <FormItem><FormLabel>RG</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="cpf" rules={{ validate: (v: string) => !v || validateCpf(v) || 'CPF inválido' }} render={({ field }) => (
                <FormItem><FormLabel>CPF</FormLabel><FormControl><Input {...field} onChange={e => field.onChange(formatCpf(e.target.value))} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="cpf_conjuge" render={({ field }) => (
                <FormItem><FormLabel>CPF Cônjuge</FormLabel><FormControl><Input {...field} onChange={e => field.onChange(formatCpf(e.target.value))} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="profissao" render={({ field }) => (
                <FormItem><FormLabel>Profissão</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            <h3 className="font-semibold text-sm">Contato</h3>
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="telefone" render={({ field }) => (
                <FormItem><FormLabel>Telefone</FormLabel><FormControl><Input {...field} onChange={e => field.onChange(formatPhone(e.target.value))} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            <h3 className="font-semibold text-sm">Endereço</h3>
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="endereco_cep" render={({ field }) => (
                <FormItem>
                  <FormLabel>CEP</FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Input {...field} onChange={e => { const v = formatCep(e.target.value); field.onChange(v); i.buscarCepEmCampo(v, 'endereco'); }} />
                      {i.loadingCep && <Loader2 className="h-4 w-4 animate-spin mt-2" />}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="endereco_completo" render={({ field }) => (
                <FormItem className="col-span-2"><FormLabel>Endereço Completo</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            <h3 className="font-semibold text-sm">Dados Financeiros</h3>
            <div className="grid grid-cols-3 gap-3">
              {/* Renda e Patrimônio usam a MESMA máscara de centavos do Crédito e
                  das parcelas: digitar 150000 vira 1.500,00. O valor guardado no
                  formulário continua numérico. */}
              <FormField control={form.control} name="renda" render={({ field }) => (
                <FormItem><FormLabel>Renda Mensal (R$)</FormLabel><FormControl>
                  <Input
                    inputMode="numeric"
                    placeholder="0,00"
                    value={field.value ? numberToBRLInput(Number(field.value)) : ''}
                    onChange={e => field.onChange(parseBRLInput(formatBRLInput(e.target.value)))}
                  />
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="patrimonio" render={({ field }) => (
                <FormItem><FormLabel>Patrimônio (R$)</FormLabel><FormControl>
                  <Input
                    inputMode="numeric"
                    placeholder="0,00"
                    value={field.value ? numberToBRLInput(Number(field.value)) : ''}
                    onChange={e => field.onChange(parseBRLInput(formatBRLInput(e.target.value)))}
                  />
                </FormControl><FormMessage /></FormItem>
              )} />

              <FormField control={form.control} name="pix" render={({ field }) => (
                <FormItem><FormLabel>Chave PIX</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            <h3 className="font-semibold text-sm">Documentos</h3>
            <div className="space-y-2">
              <Label>RG ou CNH (PDF, JPG, JPEG)</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) i.setPfDocuments(prev => [...prev, file]);
                }}
              />
              {i.pfDocuments.map((f, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4" />
                  <span>{f.name}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => i.setPfDocuments(prev => prev.filter((_, k) => k !== idx))}>
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
              <Button type="button" variant="outline" size="sm" onClick={() => i.setShowChecklistPJ(!i.showChecklistPJ)}>
                {i.showChecklistPJ ? 'Fechar' : '📋 Colar Check-list'}
              </Button>
            </div>
            {i.showChecklistPJ && (
              <div className="space-y-2 p-3 border rounded-md bg-muted/30">
                <Label className="text-xs text-muted-foreground">Cole o texto do check-list PJ abaixo:</Label>
                <Textarea
                  value={i.checklistTextPJ}
                  onChange={e => i.setChecklistTextPJ(e.target.value)}
                  rows={6}
                  placeholder={"Razão Social: ...\nCNPJ: ...\nNatureza Jurídica: ...\nInscrição Estadual: ...\nData de Fundação: dd/mm/aaaa\nCPF dos sócios: 000.000.000-00, ...\nEndereço Comercial: ...\nCEP: ...\nTelefone Comercial: ...\nE-mail comercial: ...\nFaturamento médio: R$ ...\nNúmero de funcionários: ...\nRenda dos sócios: R$ ..."}
                />
                <Button type="button" size="sm" onClick={() => {
                  const parsed = parseChecklistPJ(i.checklistTextPJ);
                  i.setChecklistSemNomeSocio(false);
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
                  const validCpfs = (parsed.socios_cpfs || []).filter(c => /\d/.test(c));
                  if (validCpfs.length > 0) {
                    const rendaPorSocio = parsed.renda_socios
                      ? Math.round((parsed.renda_socios / validCpfs.length) * 100) / 100
                      : 0;
                    const nomes = parsed.socios_nomes || [];
                    for (let k = i.socioFields.length - 1; k >= 0; k--) i.removeSocio(k);
                    validCpfs.forEach((cpf, k) => {
                      i.addSocio({ nome: nomes[k] || '', cpf: formatCpf(cpf), renda: rendaPorSocio });
                    });
                    i.setChecklistSemNomeSocio(validCpfs.some((_, k) => !(nomes[k] || '').trim()));
                  }
                  i.setShowChecklistPJ(false);
                  i.setChecklistTextPJ('');
                }}>
                  Preencher Campos
                </Button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="cnpj" rules={{ validate: (v: string) => !v || validateCnpj(v) || 'CNPJ inválido' }} render={({ field }) => (
                <FormItem>
                  <FormLabel>CNPJ</FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Input {...field} onChange={e => { const v = formatCnpj(e.target.value); field.onChange(v); i.buscarCnpjEmCampo(v); }} />
                      {i.loadingCnpj && <Loader2 className="h-4 w-4 animate-spin mt-2" />}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="razao_social" render={({ field }) => (
                <FormItem><FormLabel>Razão Social</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="natureza_juridica" render={({ field }) => (
                <FormItem><FormLabel>Natureza Jurídica</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="inscricao_estadual" render={({ field }) => (
                <FormItem><FormLabel>Inscrição Estadual</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="data_fundacao" render={({ field }) => (
                <FormItem><FormLabel>Data de Fundação</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            <h3 className="font-semibold text-sm">Contato Comercial</h3>
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="telefone_comercial" render={({ field }) => (
                <FormItem><FormLabel>Telefone Comercial</FormLabel><FormControl><Input {...field} onChange={e => field.onChange(formatPhone(e.target.value))} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="email_comercial" render={({ field }) => (
                <FormItem><FormLabel>Email Comercial</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            <h3 className="font-semibold text-sm">Endereço Comercial</h3>
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="endereco_comercial_cep" render={({ field }) => (
                <FormItem>
                  <FormLabel>CEP</FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Input {...field} onChange={e => { const v = formatCep(e.target.value); field.onChange(v); i.buscarCepEmCampo(v, 'comercial'); }} />
                      {i.loadingCep && <Loader2 className="h-4 w-4 animate-spin mt-2" />}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="endereco_comercial" render={({ field }) => (
                <FormItem className="col-span-2"><FormLabel>Endereço Comercial</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            <h3 className="font-semibold text-sm">Dados Operacionais</h3>
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="num_funcionarios" render={({ field }) => (
                <FormItem><FormLabel>Nº Funcionários</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
              )} />
              {/* Mesma máscara de centavos de Crédito/Renda: 150000 -> 1.500,00. */}
              <FormField control={form.control} name="faturamento_mensal" render={({ field }) => (
                <FormItem><FormLabel>Faturamento Mensal (R$)</FormLabel><FormControl>
                  <Input
                    inputMode="numeric"
                    placeholder="0,00"
                    value={field.value ? numberToBRLInput(Number(field.value)) : ''}
                    onChange={e => field.onChange(parseBRLInput(formatBRLInput(e.target.value)))}
                  />
                </FormControl><FormMessage /></FormItem>
              )} />
            </div>

            <h3 className="font-semibold text-sm">Sócios</h3>
            <div className="space-y-3">
              {i.socioFields.map((f, index) => (
                <div key={f.id} className="flex gap-3 items-end">
                  <FormField control={form.control} name={`socios.${index}.nome`} render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Nome do Sócio</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      {i.checklistSemNomeSocio && !String(field.value || '').trim() && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          o check-list não trouxe o nome — preencha
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name={`socios.${index}.cpf`} render={({ field }) => (
                    <FormItem className="flex-1"><FormLabel>CPF do Sócio</FormLabel><FormControl><Input {...field} onChange={e => field.onChange(formatCpf(e.target.value))} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name={`socios.${index}.renda`} render={({ field }) => (
                    <FormItem className="flex-1"><FormLabel>Renda (R$)</FormLabel><FormControl>
                      <Input
                        inputMode="numeric"
                        placeholder="0,00"
                        value={field.value ? numberToBRLInput(Number(field.value)) : ''}
                        onChange={e => field.onChange(parseBRLInput(formatBRLInput(e.target.value)))}
                      />
                    </FormControl><FormMessage /></FormItem>
                  )} />
                  {i.socioFields.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => i.removeSocio(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => i.addSocio({ nome: '', cpf: '', renda: 0 })}>
                <Plus className="h-3 w-3 mr-1" /> Adicionar Sócio
              </Button>
            </div>

            <h3 className="font-semibold text-sm">Documentos</h3>
            <div className="space-y-3">
              <div>
                <Label>Contrato Social (PDF)</Label>
                <Input type="file" accept=".pdf" onChange={e => i.setPjContratoSocial(e.target.files?.[0] || null)} />
                {i.pjContratoSocial && <p className="text-xs text-muted-foreground mt-1"><FileText className="h-3 w-3 inline mr-1" />{i.pjContratoSocial.name}</p>}
              </div>
              <div>
                <Label>RG/CNH dos Sócios (PDF, JPG, JPEG)</Label>
                <Input type="file" accept=".pdf,.jpg,.jpeg" onChange={e => i.setPjRgSocios(e.target.files?.[0] || null)} />
                {i.pjRgSocios && <p className="text-xs text-muted-foreground mt-1"><FileText className="h-3 w-3 inline mr-1" />{i.pjRgSocios.name}</p>}
              </div>
              <div>
                <Label>Cartão CNPJ (PDF)</Label>
                <Input type="file" accept=".pdf" onChange={e => i.setPjCartaoCnpj(e.target.files?.[0] || null)} />
                {i.pjCartaoCnpj && <p className="text-xs text-muted-foreground mt-1"><FileText className="h-3 w-3 inline mr-1" />{i.pjCartaoCnpj.name}</p>}
              </div>
            </div>
          </>
        )}
        {children}
      </div>
    </Form>
  );
}
