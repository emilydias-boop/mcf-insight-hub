import { useState, useEffect, useMemo, useRef } from 'react';
import { parseChecklistPF } from '@/lib/checklistParser';
import { CloserR1NoteBlock } from './CloserR1NoteBlock';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, FileText, ExternalLink, Trash2, Upload, AlertCircle } from 'lucide-react';
import { formatarCep } from '@/lib/cepUtils';

function formatCep(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

// Formatting functions
function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** Número opcional preservando o zero legítimo (vazio/NaN → null). */
function numOuNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
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
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { usePendingRegistration, useOpenCota, useUpdatePendingRegistration } from '@/hooks/useConsorcioPendingRegistrations';
import {
  usePendingRegistrationDocuments,
  useBatchUploadPendingDocuments,
  useDeletePendingDocument,
} from '@/hooks/useConsorcioDocuments';
import { TIPO_DOCUMENTO_OPTIONS, TipoDocumento } from '@/types/consorcio';
import { toast } from 'sonner';
import { useConsorcioProdutos } from '@/hooks/useConsorcioProdutos';
import { useConsorcioOrigemOptions, useConsorcioCategoriaOptions, useConsorcioVendedorOptions } from '@/hooks/useConsorcioConfigOptions';
import { calcularParcela, findProdutoForCredito, formatCurrency } from '@/lib/consorcioCalculos';
import { ParcelaComposicao } from './ParcelaComposicao';
import { useConsorcioDuplicateCheck } from '@/hooks/useConsorcioDuplicateCheck';
import { DuplicateWarningBanner } from './DuplicateWarningBanner';
import { CONDICAO_PAGAMENTO_OPTIONS, PRAZO_OPTIONS, PrazoParcelas, CondicaoPagamento } from '@/types/consorcioProdutos';
import { CATEGORIA_OPTIONS, ORIGEM_OPTIONS } from '@/types/consorcio';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Label } from '@/components/ui/label';
import { DadosPlanoFields, useDadosPlano } from './DadosPlanoFields';

interface OpenCotaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registrationId: string;
  mode?: 'open' | 'view';
  /** Abre já em modo edição (usado pelo atalho "Completar cadastro" do Termo de Adesão). */
  startEditing?: boolean;
  /** Rola até o bloco "Dados da Cota" ao abrir. */
  focusPlano?: boolean;
}

export function OpenCotaModal({ open, onOpenChange, registrationId, mode = 'open', startEditing = false, focusPlano = false }: OpenCotaModalProps) {
  const isViewMode = mode === 'view';
  const [isEditing, setIsEditing] = useState(startEditing);
  const readOnly = isViewMode && !isEditing;
  const { data: registration, isLoading: regLoading } = usePendingRegistration(registrationId);
  const { data: produtos = [] } = useConsorcioProdutos();
  const { data: origemOptions = [] } = useConsorcioOrigemOptions();
  const { data: categoriaOptions = [] } = useConsorcioCategoriaOptions();
  const { data: vendedorOptions = [] } = useConsorcioVendedorOptions();
  const openCota = useOpenCota();
  const updatePending = useUpdatePendingRegistration();

  const planoHidratado = useRef(false);
  const cotaBlockRef = useRef<HTMLDivElement | null>(null);
  const dialogContentRef = useRef<HTMLDivElement | null>(null);
  /**
   * Abertura como reserva x já contratada — default RESERVA: é o caminho novo e
   * o mais comum (o número da Embracon quase nunca está em mãos na hora do
   * cadastro). O modo é escolhido num seletor no topo da seção "Dados da Cota",
   * não no rodapé. `modoAbertura` é lido pelo onSubmit logo depois da validação.
   */
  const modoAbertura = useRef<'reserva' | 'contratacao'>('reserva');
  /**
   * Espelho em estado do modo: em "reserva" o valor digitado é gravado em
   * `data_reserva`, não em `data_contratacao`, e grupo/cota viram opcionais.
   */
  const [modo, setModo] = useState<'reserva' | 'contratacao'>('reserva');



  // Documents attached to the pending registration
  const { data: documents = [] } = usePendingRegistrationDocuments(registrationId);
  const uploadPendingDocs = useBatchUploadPendingDocuments();
  const deletePendingDoc = useDeletePendingDocument();
  const [pendingFiles, setPendingFiles] = useState<Array<{ file: File; tipo: TipoDocumento }>>([]);
  const canEditDocs = !readOnly;

  const addFilesToUpload = (files: FileList | null) => {
    if (!files) return;
    const newOnes = Array.from(files).map((f) => ({ file: f, tipo: 'outro' as TipoDocumento }));
    setPendingFiles((prev) => [...prev, ...newOnes]);
  };

  const handleUploadPending = async () => {
    if (pendingFiles.length === 0) {
      toast.error('Selecione ao menos um arquivo');
      return;
    }
    await uploadPendingDocs.mutateAsync({ pendingRegistrationId: registrationId, documents: pendingFiles });
    toast.success('Documentos enviados com sucesso');
    setPendingFiles([]);
  };

  const [showChecklist, setShowChecklist] = useState(false);
  const [checklistText, setChecklistText] = useState('');

  const form = useForm({
    defaultValues: {
      // Client data (editable)
      cliente_nome: '',
      cliente_cpf: '',
      cliente_rg: '',
      cliente_cpf_conjuge: '',
      cliente_profissao: '',
      cliente_telefone: '',
      cliente_email: '',
      cliente_endereco: '',
      cliente_cep: '',
      cliente_renda: 0,
      cliente_patrimonio: 0,
      cliente_pix: '',
      // Cota data
      // Estes 6 campos NÃO têm default: sem valor no cadastro pendente o operador
      // precisa escolher explicitamente (antes o formulário carimbava em silêncio
      // inside/200/select/convencional/dia 15/valor 0).
      categoria: '',
      grupo: '',
      cota: '',
      valor_credito: null as number | null,
      prazo_meses: null as number | null,
      tipo_produto: '',
      produto_codigo: '',
      condicao_pagamento: '',
      inclui_seguro: false,
      empresa_paga_parcelas: 'nao',
      tipo_contrato: 'normal',
      parcelas_pagas_empresa: 0,
      dia_vencimento: null as number | null,
      inicio_segunda_parcela: 'automatico',
      data_contratacao: new Date().toISOString().split('T')[0],
      origem: '',
      origem_detalhe: '',
      vendedor_id: '',
      vendedor_name: '',
      valor_comissao: 0,
      e_transferencia: false,
      transferido_de: '',
      observacoes: '',
    },
  });

  // Populate client fields when registration loads
  useEffect(() => {
    if (registration) {
      form.setValue('cliente_nome', registration.nome_completo || '');
      form.setValue('cliente_cpf', registration.cpf ? formatCpf(registration.cpf) : '');
      form.setValue('cliente_rg', registration.rg || '');
      form.setValue('cliente_cpf_conjuge', registration.cpf_conjuge ? formatCpf(registration.cpf_conjuge) : '');
      form.setValue('cliente_profissao', registration.profissao || '');
      form.setValue('cliente_telefone', registration.telefone ? formatPhone(registration.telefone) : '');
      form.setValue('cliente_email', registration.email || '');
      form.setValue('cliente_endereco', registration.endereco_completo || '');
      form.setValue('cliente_cep', registration.endereco_cep || '');
      form.setValue('cliente_renda', registration.renda || 0);
      form.setValue('cliente_patrimonio', registration.patrimonio || 0);
      form.setValue('cliente_pix', registration.pix || '');
      // Populate cota fields if already saved (so view/edit shows real values).
      // No modo de edição do cadastro pendente, campo sem valor no registro fica VAZIO —
      // nunca com o default do formulário, para o "Salvar" não carimbar dados inventados.
      // No modo de edição/visualização, campo sem valor volta ao "vazio" declarado.
      // No modo de abertura os defaults dos 6 campos críticos já são vazios (ver
      // defaultValues), então não há carimbo silencioso.
      const setCota = (name: any, value: any, vazio: any) => {
        if (value != null && value !== '') form.setValue(name, value);
        else if (isViewMode) form.setValue(name, vazio);
      };
      setCota('valor_credito', registration.valor_credito != null ? Number(registration.valor_credito) : null, null);
      setCota('prazo_meses', registration.prazo_meses != null ? Number(registration.prazo_meses) : null, null);
      setCota('tipo_produto', registration.tipo_produto, '');
      setCota('produto_codigo', registration.produto_codigo, '');
      setCota('condicao_pagamento', registration.condicao_pagamento, '');
      setCota('inclui_seguro', registration.inclui_seguro != null ? !!registration.inclui_seguro : null, false);
      setCota('empresa_paga_parcelas', registration.empresa_paga_parcelas, '');
      setCota('tipo_contrato', registration.tipo_contrato, '');
      setCota('parcelas_pagas_empresa', registration.parcelas_pagas_empresa != null ? Number(registration.parcelas_pagas_empresa) : null, 0);
      setCota('dia_vencimento', registration.dia_vencimento != null ? Number(registration.dia_vencimento) : null, null);
      setCota('inicio_segunda_parcela', registration.inicio_segunda_parcela, '');
      setCota('data_contratacao', registration.data_contratacao, '');
      setCota('categoria', registration.categoria, '');
      setCota('grupo', registration.grupo, '');
      setCota('cota', registration.cota, '');
      setCota('origem', registration.origem, '');
      setCota('origem_detalhe', registration.origem_detalhe, '');
      setCota('vendedor_id', registration.vendedor_id, '');
      setCota('vendedor_name', registration.vendedor_name_cota, '');
      setCota('observacoes', registration.observacoes, '');
      setCota('valor_comissao', (registration as any).valor_comissao ?? null, null);
      setCota('e_transferencia', (registration as any).e_transferencia ?? null, false);
      setCota('transferido_de', (registration as any).transferido_de, '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registration, form, isViewMode]);

  const valorCredito = form.watch('valor_credito');
  const prazoMeses = form.watch('prazo_meses');
  const tipoProduto = form.watch('tipo_produto');
  const condicaoPagamento = form.watch('condicao_pagamento');
  const incluiSeguro = form.watch('inclui_seguro');
  /**
   * Prazo vindo da proposta pode estar fora do catálogo (ex.: 210, porque a proposta
   * aceita prazo livre). Injetamos uma opção dinâmica para o dado não se perder.
   */
  const prazoOptions = useMemo(() => {
    const base = PRAZO_OPTIONS.map(o => ({ value: Number(o.value), label: o.label }));
    const atual = Number(prazoMeses);
    if (atual > 0 && !base.some(o => o.value === atual)) {
      return [...base, { value: atual, label: `${atual} meses (fora do catálogo)` }]
        .sort((a, b) => a.value - b.value);
    }
    return base;
  }, [prazoMeses]);
  const empresaPaga = form.watch('empresa_paga_parcelas');
  const vendedorId = form.watch('vendedor_id');

  // Bloco "Dados do plano" compartilhado com o AcceptProposalModal (mesmo autopreenchimento e selos).
  // Prazo e condição NÃO são duplicados aqui: o hook lê e escreve direto no formulário desta tela.
  const plano = useDadosPlano({
    prazo: prazoMeses ? String(prazoMeses) : '',
    condicao: condicaoPagamento || '',
    setPrazo: (v) => form.setValue('prazo_meses', v ? Number(v) : (null as any), { shouldValidate: true }),
    setCondicao: (v) => form.setValue('condicao_pagamento', v, { shouldValidate: true }),
  });

  // Hidrata o bloco do plano com o que já está gravado no cadastro pendente.
  useEffect(() => {
    if (!registration || planoHidratado.current) return;
    planoHidratado.current = true;
    // Só hidrata: a tabela nunca é reaplicada aqui, senão sobrescreve valor ajustado manualmente.
    plano.hidratar({
      creditoId: (registration as any).credito_id,
      valorCredito: registration.valor_credito != null ? Number(registration.valor_credito) : null,
      prazo: registration.prazo_meses != null ? Number(registration.prazo_meses) : null,
      condicao: registration.condicao_pagamento,
      parcela1a12: (registration as any).parcela_1a_12a != null ? Number((registration as any).parcela_1a_12a) : null,
      parcelaDemais: (registration as any).parcela_demais != null ? Number((registration as any).parcela_demais) : null,
      diaVencimento: registration.dia_vencimento != null ? Number(registration.dia_vencimento) : null,
      inicioSegundaParcela: registration.inicio_segunda_parcela,
      objetivo: (registration as any).objetivo,
      incluiSeguro: registration.inclui_seguro,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registration]);

  /**
   * Prazo e condição vivem no formulário da cota. A tabela é reaplicada apenas quando o
   * USUÁRIO troca um desses campos (handlers abaixo) — nunca por re-render/hidratação,
   * o que sobrescreveria a parcela ajustada à mão.
   */
  const handlePrazoChange = (v: number) => {
    plano.setPrazo(String(v || ''));
  };
  const handleCondicaoChange = (v: string) => {
    plano.setCondicao(v || 'convencional');
  };
  /**
   * Troca o modo de abertura a partir do seletor no topo. Além de atualizar os
   * dois espelhos (estado + ref lidos no submit), reavalia a validação dos
   * campos grupo/cota: em Reserva eles deixam de ser obrigatórios, então um
   * erro já marcado precisa sumir imediatamente (senão a tela mente).
   */
  const handleModoChange = (v: 'reserva' | 'contratacao') => {
    setModo(v);
    modoAbertura.current = v;
    if (v === 'reserva') {
      form.clearErrors(['grupo', 'cota']);
    } else {
      // Em "já contratada" revalida para exibir erro se ainda estiver vazio.
      form.trigger(['grupo', 'cota']);
    }
  };

  useEffect(() => {
    if (!open || !focusPlano) return;
    const t = setTimeout(() => cotaBlockRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
    return () => clearTimeout(t);
  }, [open, focusPlano, registration]);

  // Duplicate check on client fields (CPF, nome, e-mail, telefone) for PF/PJ
  const clienteCpf = form.watch('cliente_cpf');
  const clienteNome = form.watch('cliente_nome');
  const clienteEmail = form.watch('cliente_email');
  const clienteTelefone = form.watch('cliente_telefone');
  const { data: duplicateMatches = [], isLoading: dupLoading } = useConsorcioDuplicateCheck({
    cpf: clienteCpf,
    cnpj: registration?.tipo_pessoa === 'pj' ? registration?.cnpj : null,
    email: clienteEmail || (registration?.tipo_pessoa === 'pj' ? registration?.email_comercial : null),
    telefone: clienteTelefone || (registration?.tipo_pessoa === 'pj' ? registration?.telefone_comercial : null),
    nome: clienteNome || (registration?.tipo_pessoa === 'pj' ? registration?.razao_social : null),
    excludeRegistrationId: registrationId,
    enabled: open,
  });

  // Auto-detect product
  const produtoDetectado = useMemo(() => {
    if (!valorCredito || valorCredito <= 0) return null;
    const tipoTaxa = tipoProduto === 'select' ? 'primeira_parcela' : 'dividida_12';
    return findProdutoForCredito(produtos, valorCredito, tipoTaxa as any);
  }, [valorCredito, tipoProduto, produtos]);

  // Calculate parcela
  const calculoParcela = useMemo(() => {
    if (!produtoDetectado || !valorCredito || !prazoMeses) return null;
    return calcularParcela(
      valorCredito,
      prazoMeses as PrazoParcelas,
      produtoDetectado,
      (condicaoPagamento || 'convencional') as CondicaoPagamento,
      incluiSeguro || false
    );
  }, [produtoDetectado, valorCredito, prazoMeses, condicaoPagamento, incluiSeguro]);

  // Update vendedor_name when vendedor_id changes
  useEffect(() => {
    if (vendedorId) {
      const vendedor = vendedorOptions.find((v) => v.id === vendedorId);
      if (vendedor) form.setValue('vendedor_name', vendedor.name || '');
    }
  }, [vendedorId, vendedorOptions, form]);

  const onSubmit = async (data: any) => {
    if (!registration) return;

    // Extract client data from form
    const clienteData = {
      nome_completo: data.cliente_nome || null,
      cpf: data.cliente_cpf?.replace(/\D/g, '') || null,
      rg: data.cliente_rg || null,
      cpf_conjuge: data.cliente_cpf_conjuge?.replace(/\D/g, '') || null,
      profissao: data.cliente_profissao || null,
      telefone: data.cliente_telefone || null,
      email: data.cliente_email || null,
      endereco_completo: data.cliente_endereco || null,
      endereco_cep: data.cliente_cep || null,
      renda: numOuNull(data.cliente_renda),
      patrimonio: numOuNull(data.cliente_patrimonio),
      pix: data.cliente_pix || null,
    };

    // Sanitizar: remover strings vazias de campos date antes de enviar
    const rawCotaData = {
      ...data,
      // Reserva: a data informada vale como data de reserva e a contratação fica em aberto.
      tipo_registro: modoAbertura.current,
      // No caminho "já contratada" a chave é OMITIDA (não vai null) para não
      // anular eventual default/trigger da coluna no banco.
      ...(modoAbertura.current === 'reserva' ? { data_reserva: data.data_contratacao } : {}),
      produto_codigo: produtoDetectado?.codigo || data.produto_codigo || 'auto',
      parcela_1a_12a: calculoParcela?.parcela1a12,
      parcela_demais: calculoParcela?.parcelaDemais,
      // O objetivo que vale é o que está na tela no momento do submit.
      objetivo: plano.valores.objetivo ?? null,
      parcelas_pagas_empresa_count: data.empresa_paga_parcelas === 'sim' ? data.parcelas_pagas_empresa : 0,
    };
    const cleanCotaData = Object.fromEntries(
      Object.entries(rawCotaData).map(([k, v]) => [k, v === '' ? null : v])
    ) as Parameters<typeof openCota.mutateAsync>[0]['cotaData'];

    await openCota.mutateAsync({
      registrationId,
      registration: { ...registration, ...clienteData },
      cotaData: cleanCotaData,
      clienteData,
    });

    onOpenChange(false);
  };

  /** Validação reprovada: avisa quais campos faltam e leva a tela até o primeiro erro. */
  const CAMPO_LABELS: Record<string, string> = {
    cliente_nome: 'Nome Completo',
    cliente_cpf: 'CPF',
    cliente_telefone: 'Telefone',
    cliente_email: 'Email',
    categoria: 'Categoria',
    grupo: 'Grupo',
    cota: 'Cota',
    valor_credito: 'Valor do Crédito',
    prazo_meses: 'Prazo (meses)',
    tipo_produto: 'Tipo',
    dia_vencimento: 'Dia de Vencimento',
    condicao_pagamento: 'Condição de Pagamento',
    data_contratacao: 'Data de Contratação',
    origem: 'Origem',
  };
  const onInvalid = (errors: Record<string, any>) => {
    const nomes = Object.keys(errors);
    if (nomes.length === 0) return;
    toast.error(`Complete os campos obrigatórios: ${nomes.map((n) => CAMPO_LABELS[n] || n).join(', ')}`);
    setTimeout(() => {
      const root = dialogContentRef.current;
      if (!root) return;
      const el = root.querySelector('[aria-invalid="true"]') as HTMLElement | null;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.focus?.();
    }, 50);
  };

  if (regLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!registration) return null;

  const handleSavePendingEdit = async () => {
    const data = form.getValues();
    await updatePending.mutateAsync({
      id: registrationId,
      patch: {
        // cliente
        nome_completo: data.cliente_nome || null,
        cpf: data.cliente_cpf ? data.cliente_cpf.replace(/\D/g, '') : null,
        rg: data.cliente_rg || null,
        cpf_conjuge: data.cliente_cpf_conjuge ? data.cliente_cpf_conjuge.replace(/\D/g, '') : null,
        profissao: data.cliente_profissao || null,
        telefone: data.cliente_telefone || null,
        email: data.cliente_email || null,
        endereco_completo: data.cliente_endereco || null,
        endereco_cep: data.cliente_cep || null,
        renda: numOuNull(data.cliente_renda),
        patrimonio: numOuNull(data.cliente_patrimonio),
        pix: data.cliente_pix || null,
        // cota
        valor_credito: numOuNull(data.valor_credito),
        prazo_meses: data.prazo_meses || null,
        tipo_produto: data.tipo_produto || null,
        categoria: data.categoria || null,
        grupo: data.grupo || null,
        cota: data.cota || null,
        inclui_seguro: !!data.inclui_seguro,
        empresa_paga_parcelas: data.empresa_paga_parcelas || null,
        tipo_contrato: data.tipo_contrato || null,
        parcelas_pagas_empresa: data.empresa_paga_parcelas === 'sim' ? (data.parcelas_pagas_empresa || 0) : 0,
        dia_vencimento: data.dia_vencimento ? Number(data.dia_vencimento) : null,
        inicio_segunda_parcela: data.inicio_segunda_parcela || null,
        data_contratacao: data.data_contratacao || null,
        valor_comissao: numOuNull(data.valor_comissao),
        e_transferencia: !!data.e_transferencia,
        transferido_de: data.transferido_de || null,
        origem: data.origem || null,
        origem_detalhe: data.origem_detalhe || null,
        vendedor_id: data.vendedor_id || null,
        vendedor_name_cota: data.vendedor_name || null,
        observacoes: data.observacoes || null,
        // plano (Termo de Adesão) — o que vale é o que está digitado, não o cálculo
        credito_id: plano.valores.credito_id ?? null,
        condicao_pagamento: data.condicao_pagamento || null,
        parcela_1a_12a: plano.valores.parcela_1a_12a ?? null,
        parcela_demais: plano.valores.parcela_demais ?? null,
        objetivo: plano.valores.objetivo ?? null,
      },
    });
    setIsEditing(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={dialogContentRef} className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle>
              {isViewMode ? 'Detalhes do Cadastro' : 'Abertura de Cota'} — {registration.tipo_pessoa === 'pf' ? registration.nome_completo : registration.razao_social}
            </DialogTitle>
            {isViewMode && (
              <div className="flex items-center gap-2">
                {!isEditing ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                    Editar
                  </Button>
                ) : (
                  <>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setIsEditing(false)} disabled={updatePending.isPending}>
                      Cancelar
                    </Button>
                    <Button type="button" size="sm" onClick={handleSavePendingEdit} disabled={updatePending.isPending}>
                      {updatePending.isPending && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
                      Salvar
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[75vh] pr-4">
          <Form {...form}>
            <fieldset disabled={readOnly} className="contents">
            <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-6">
            <DuplicateWarningBanner matches={duplicateMatches} isLoading={dupLoading} />
            <CloserR1NoteBlock dealId={registration.deal_id} />
            {/* Editable client data */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Dados do Cliente</CardTitle>
                  {/* Saída de exceção: só aparece quando o cadastro chegou sem os dados
                      básicos (cota aberta sem aceite/check-list já preenchido). No fluxo
                      normal os campos vêm do aceite e o atalho só polui a tela. */}
                  {registration.tipo_pessoa === 'pf' &&
                    (!registration.cpf || !registration.endereco_completo) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() => setShowChecklist(!showChecklist)}
                    >
                      {showChecklist ? 'Fechar' : 'Colar check-list'}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {registration.tipo_pessoa === 'pf' ? (
                  <div className="grid grid-cols-3 gap-3">
                    <FormField control={form.control} name="cliente_nome" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                      <FormItem><FormLabel>Nome Completo *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="cliente_cpf" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                      <FormItem><FormLabel>CPF *</FormLabel><FormControl><Input {...field} onChange={e => field.onChange(formatCpf(e.target.value))} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="cliente_rg" render={({ field }) => (
                      <FormItem><FormLabel>RG</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="cliente_cpf_conjuge" render={({ field }) => (
                      <FormItem><FormLabel>CPF Cônjuge</FormLabel><FormControl><Input {...field} onChange={e => field.onChange(formatCpf(e.target.value))} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="cliente_profissao" render={({ field }) => (
                      <FormItem><FormLabel>Profissão</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="cliente_telefone" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                      <FormItem><FormLabel>Telefone *</FormLabel><FormControl><Input {...field} onChange={e => field.onChange(formatPhone(e.target.value))} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="cliente_email" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                      <FormItem><FormLabel>Email *</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="col-span-2">
                      <FormField control={form.control} name="cliente_endereco" render={({ field }) => (
                        <FormItem><FormLabel>Endereço Completo</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="cliente_cep" render={({ field }) => (
                      <FormItem><FormLabel>CEP</FormLabel><FormControl><Input {...field} onChange={e => field.onChange(formatarCep(e.target.value))} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="cliente_renda" render={({ field }) => (
                      <FormItem><FormLabel>Renda</FormLabel><FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="cliente_patrimonio" render={({ field }) => (
                      <FormItem><FormLabel>Patrimônio</FormLabel><FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="cliente_pix" render={({ field }) => (
                      <FormItem><FormLabel>PIX</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                    )} />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div><span className="text-muted-foreground">Razão Social:</span> <strong>{registration.razao_social}</strong></div>
                      <div><span className="text-muted-foreground">CNPJ:</span> {registration.cnpj}</div>
                      <div><span className="text-muted-foreground">Natureza Jurídica:</span> {registration.natureza_juridica}</div>
                      <div><span className="text-muted-foreground">Inscrição Estadual:</span> {registration.inscricao_estadual}</div>
                      <div><span className="text-muted-foreground">Data Fundação:</span> {registration.data_fundacao}</div>
                      <div><span className="text-muted-foreground">Telefone:</span> {registration.telefone_comercial}</div>
                      <div><span className="text-muted-foreground">Email:</span> {registration.email_comercial}</div>
                      <div className="col-span-2"><span className="text-muted-foreground">Endereço:</span> {registration.endereco_comercial}</div>
                      <div><span className="text-muted-foreground">Funcionários:</span> {registration.num_funcionarios}</div>
                      <div><span className="text-muted-foreground">Faturamento:</span> {registration.faturamento_mensal ? formatCurrency(registration.faturamento_mensal) : '—'}</div>
                      {registration.socios && registration.socios.length > 0 && (
                        <div className="col-span-3">
                          <span className="text-muted-foreground">Sócios:</span>
                          <div className="mt-1 space-y-1">
                            {registration.socios.map((s: any, i: number) => (
                              <Badge key={i} variant="outline" className="mr-2">
                                CPF: {s.cpf} — Renda: {formatCurrency(s.renda || 0)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Atalho de exceção: fica DEPOIS dos campos, recolhido por padrão,
                    para nunca competir com o que já veio preenchido do aceite. */}
                {showChecklist && registration.tipo_pessoa === 'pf' && (
                  <div className="space-y-2 p-3 border rounded-md bg-muted/30 mt-4">
                    <Label className="text-xs text-muted-foreground">Cole o texto do check-list abaixo:</Label>
                    <Textarea
                      value={checklistText}
                      onChange={e => setChecklistText(e.target.value)}
                      rows={6}
                      placeholder={"Nome Completo: ...\nRG: ...\nCPF: ...\nCPF Cônjuge: ...\nEndereço Residencial: ...\nCEP: ...\nTelefone: ...\nE-mail: ...\nProfissão: ...\nRenda: R$ ...\nPatrimônio: R$ ...\nChave Pix: ..."}
                    />
                    <Button type="button" size="sm" variant="secondary" onClick={() => {
                      const parsed = parseChecklistPF(checklistText);
                      if (parsed.nome_completo) form.setValue('cliente_nome', parsed.nome_completo);
                      if (parsed.rg) form.setValue('cliente_rg', parsed.rg);
                      if (parsed.cpf) form.setValue('cliente_cpf', formatCpf(parsed.cpf));
                      if (parsed.cpf_conjuge) form.setValue('cliente_cpf_conjuge', formatCpf(parsed.cpf_conjuge));
                      if (parsed.endereco_completo) form.setValue('cliente_endereco', parsed.endereco_completo);
                      if (parsed.endereco_cep) form.setValue('cliente_cep', formatCep(parsed.endereco_cep));
                      if (parsed.telefone) form.setValue('cliente_telefone', formatPhone(parsed.telefone));
                      if (parsed.email) form.setValue('cliente_email', parsed.email);
                      if (parsed.profissao) form.setValue('cliente_profissao', parsed.profissao);
                      if (parsed.renda) form.setValue('cliente_renda', parsed.renda);
                      if (parsed.patrimonio) form.setValue('cliente_patrimonio', parsed.patrimonio);
                      if (parsed.pix) form.setValue('cliente_pix', parsed.pix);
                      setShowChecklist(false);
                      setChecklistText('');
                    }}>
                      Preencher Campos
                    </Button>
                  </div>
                )}

                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Documentos ({documents.length})</span>
                  </div>

                  {documents.length > 0 && (
                    <div className="space-y-2">
                      {documents.map((doc: any) => (
                        <div key={doc.id} className="flex items-center justify-between rounded border p-2 text-sm">
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium truncate">{doc.nome_arquivo}</span>
                            <span className="text-xs text-muted-foreground capitalize">{String(doc.tipo || '').replace('_', ' ')}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {doc.storage_url && (
                              <a
                                href={doc.storage_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                <FileText className="h-3 w-3" /> Abrir <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            {canEditDocs && (
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() =>
                                  deletePendingDoc.mutate({
                                    documentId: doc.id,
                                    storagePath: doc.storage_path,
                                    pendingRegistrationId: registrationId,
                                  })
                                }
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {canEditDocs && (
                    <div className="space-y-2 rounded border border-dashed p-3">
                      <Label className="text-xs text-muted-foreground">Anexar novos documentos</Label>
                      <Input type="file" multiple onChange={(e) => addFilesToUpload(e.target.files)} />

                      {pendingFiles.length > 0 && (
                        <div className="space-y-2">
                          {pendingFiles.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 rounded border p-2">
                              <span className="flex-1 truncate text-sm">{item.file.name}</span>
                              <Select
                                value={item.tipo}
                                onValueChange={(v) =>
                                  setPendingFiles((prev) =>
                                    prev.map((p, i) => (i === idx ? { ...p, tipo: v as TipoDocumento } : p))
                                  )
                                }
                              >
                                <SelectTrigger className="w-48">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {TIPO_DOCUMENTO_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== idx))}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ))}
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              size="sm"
                              onClick={handleUploadPending}
                              disabled={uploadPendingDocs.isPending}
                            >
                              {uploadPendingDocs.isPending ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Upload className="h-4 w-4 mr-2" />
                              )}
                              Enviar ({pendingFiles.length})
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Separator />

            {/* Cota form */}
            <Card ref={cotaBlockRef}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Dados da Cota (preencher)</CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="space-y-4">
                    {/* Modo de abertura no TOPO: Reserva (default) x Já contratada.
                        Define se grupo/cota são obrigatórios e o rótulo da data. */}
                    {!readOnly && (
                      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                        <Label className="text-sm font-semibold">Modo de abertura</Label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => handleModoChange('reserva')}
                            className={`text-left rounded-md border p-2 transition-colors ${modo === 'reserva' ? 'border-primary bg-primary/10' : 'border-input hover:bg-muted/50'}`}
                          >
                            <span className="text-sm font-medium">Reserva</span>
                            <span className="block text-[11px] text-muted-foreground">
                              Cadastro enviado à Embracon, ainda sem grupo e cota.
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleModoChange('contratacao')}
                            className={`text-left rounded-md border p-2 transition-colors ${modo === 'contratacao' ? 'border-primary bg-primary/10' : 'border-input hover:bg-muted/50'}`}
                          >
                            <span className="text-sm font-medium">Já contratada</span>
                            <span className="block text-[11px] text-muted-foreground">
                              Grupo e cota já vieram da Embracon (comprovante em mãos).
                            </span>
                          </button>
                        </div>
                      </div>
                    )}
                    {/* Categoria + Grupo + Cota */}
                    <div className="grid grid-cols-3 gap-3">
                      <FormField control={form.control} name="categoria" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                        <FormItem>
                          <FormLabel>Categoria *</FormLabel>
                          <Select value={field.value || ''} onValueChange={field.onChange}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {(categoriaOptions.length > 0 ? categoriaOptions : CATEGORIA_OPTIONS).map((o: any) => (
                                <SelectItem key={o.value || o.id} value={o.value || o.id}>{o.label || o.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      {/* Reserva: grupo/cota só chegam quando a Embracon responde,
                          então são opcionais nesse modo. Contratação exige os dois. */}
                      <FormField control={form.control} name="grupo" rules={{ required: modo === 'reserva' ? false : 'Obrigatório' }} render={({ field }) => (
                        <FormItem>
                          <FormLabel>{modo === 'reserva' ? 'Grupo' : 'Grupo *'}</FormLabel>
                          <FormControl><Input {...field} placeholder={modo === 'reserva' ? 'Só quando a Embracon responder' : undefined} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="cota" rules={{ required: modo === 'reserva' ? false : 'Obrigatório' }} render={({ field }) => (
                        <FormItem>
                          <FormLabel>{modo === 'reserva' ? 'Cota' : 'Cota *'}</FormLabel>
                          <FormControl><Input {...field} placeholder={modo === 'reserva' ? 'Só quando a Embracon responder' : undefined} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    {/* Valor + Prazo + Tipo */}
                    <div className="grid grid-cols-3 gap-3">
                      <FormField control={form.control} name="valor_credito" rules={{ required: 'Obrigatório', validate: (v: any) => Number(v) > 0 || 'Informe um valor maior que zero' }} render={({ field }) => (
                        <FormItem><FormLabel>Valor do Crédito *</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="prazo_meses" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prazo (meses) *</FormLabel>
                          <Select value={field.value ? String(field.value) : ''} onValueChange={v => handlePrazoChange(Number(v))}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {prazoOptions.map(o => (
                                <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="tipo_produto" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo *</FormLabel>
                          <Select value={field.value || ''} onValueChange={field.onChange}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="select">Select</SelectItem>
                              <SelectItem value="parcelinha">Parcelinha</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    {/* Produto + Condicao + Seguro */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-sm">Produto Embracon</Label>
                        <p className="text-sm font-medium mt-1">
                          {produtoDetectado ? produtoDetectado.nome : 'Auto-detectado pelo valor'}
                        </p>
                      </div>
                      <FormField control={form.control} name="condicao_pagamento" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                        <FormItem>
                          <FormLabel>Condição de Pagamento *</FormLabel>
                          <Select value={field.value || ''} onValueChange={handleCondicaoChange}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {CONDICAO_PAGAMENTO_OPTIONS.map(o => (
                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="inclui_seguro" render={({ field }) => (
                        <FormItem className="flex items-center gap-3 pt-6">
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          <FormLabel>Seguro de Vida</FormLabel>
                        </FormItem>
                      )} />
                    </div>

                    {/* Composição da parcela */}
                    {calculoParcela && produtoDetectado && (
                      <ParcelaComposicao
                        calculo={calculoParcela}
                        prazo={prazoMeses}
                        incluiSeguro={incluiSeguro || false}
                        taxaAntecipadaTipo={tipoProduto === 'select' ? 'primeira_parcela' : 'dividida_12'}
                      />
                    )}

                    {/* Dados do plano (valores que vão para o Termo de Adesão) */}
                    <div className="rounded-lg border p-3 space-y-3">
                      <div>
                        <h4 className="text-sm font-semibold">Dados do plano</h4>
                        <p className="text-xs text-muted-foreground">
                          Os valores digitados aqui são os que vão para o Termo de Adesão — a composição acima é apenas
                          o cálculo estimado.
                        </p>
                      </div>
                      <DadosPlanoFields
                        plano={plano}
                        disabled={readOnly}
                        showAviso={false}
                        hide={['valorCredito', 'prazo', 'condicao', 'diaVencimento', 'inicioSegundaParcela', 'incluiSeguro']}
                      />
                    </div>

                    {/* Empresa paga */}
                    <div className="grid grid-cols-3 gap-3">
                      <FormField control={form.control} name="empresa_paga_parcelas" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Empresa paga parcelas?</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="nao">Não</SelectItem>
                              <SelectItem value="sim">Sim</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      {empresaPaga === 'sim' && (
                        <>
                          <FormField control={form.control} name="tipo_contrato" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tipo Contrato</FormLabel>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value="normal">Normal</SelectItem>
                                  <SelectItem value="intercalado">Intercalado (Par)</SelectItem>
                                  <SelectItem value="intercalado_impar">Intercalado (Ímpar)</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="parcelas_pagas_empresa" render={({ field }) => (
                            <FormItem><FormLabel>Qtd Parcelas</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl></FormItem>
                          )} />
                        </>
                      )}
                    </div>

                    {/* Vencimento + 2a parcela */}
                    <div className="grid grid-cols-3 gap-3">
                      <FormField control={form.control} name="dia_vencimento" rules={{
                        validate: (v) => v == null || (Number(v) >= 1 && Number(v) <= 31) || 'Informe um dia entre 1 e 31',
                      }} render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dia de Vencimento</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              max={31}
                              placeholder="A definir"
                              {...field}
                              value={field.value ?? ''}
                              onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                            />
                          </FormControl>
                          <p className="text-[11px] leading-snug text-muted-foreground">
                            Definido pela Embracon após a abertura da cota. Costuma cair no dia 10, 15 ou 20 — se for
                            fim de semana ou feriado, no próximo dia útil.
                          </p>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="inicio_segunda_parcela" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Início 2ª Parcela</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="automatico">Automático</SelectItem>
                              <SelectItem value="proximo_mes">Próximo Mês</SelectItem>
                              <SelectItem value="pular_mes">Pular 1 Mês</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="data_contratacao" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {modo === 'reserva' ? 'Data da Reserva *' : 'Data de Contratação *'}
                          </FormLabel>
                          <FormControl><Input type="date" {...field} /></FormControl>
                          <p className="text-[11px] text-muted-foreground">
                            {modo === 'reserva'
                              ? 'Data do envio à Embracon (gravada em Data da reserva). Base do cronograma.'
                              : 'Data em que a Embracon confirmou a contratação. Base do cronograma.'}
                          </p>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    {/* Origem + Vendedor */}
                    <div className="grid grid-cols-3 gap-3">
                      <FormField control={form.control} name="origem" rules={{ required: 'Obrigatório' }} render={({ field }) => (
                        <FormItem>
                          <FormLabel>Origem *</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {/* Grava SEMPRE o `name` do catálogo (fallback: slug legado).
                                  Gravar o `id` deixava a cota invisível ao filtro de Origem. */}
                              {(origemOptions.length > 0 ? origemOptions : ORIGEM_OPTIONS).map((o: any) => {
                                const valor = o.name || o.value;
                                return (
                                  <SelectItem key={o.id || valor} value={valor}>
                                    {o.label || valor}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="origem_detalhe" render={({ field }) => (
                        <FormItem><FormLabel>Detalhe da Origem</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="vendedor_id" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vendedor Responsável</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={(value) => {
                              field.onChange(value);
                              const vendedor = vendedorOptions.find((v) => v.id === value);
                              form.setValue('vendedor_name', vendedor?.name || '');
                            }}
                          >
                            <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {vendedorOptions.length > 0 ? (
                                vendedorOptions.map((v) => (
                                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                                ))
                              ) : (
                                <div className="p-2 text-sm text-muted-foreground">
                                  Nenhum vendedor cadastrado. Adicione nas configurações.
                                </div>
                              )}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                    </div>

                    {/* Comissão + transferência */}
                    <div className="grid grid-cols-3 gap-3">
                      <FormField control={form.control} name="valor_comissao" render={({ field }) => (
                        <FormItem><FormLabel>Valor Comissão</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="e_transferencia" render={({ field }) => (
                        <FormItem className="flex items-center gap-3 pt-6">
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          <FormLabel>É Transferência?</FormLabel>
                        </FormItem>
                      )} />
                      {form.watch('e_transferencia') && (
                        <FormField control={form.control} name="transferido_de" render={({ field }) => (
                          <FormItem><FormLabel>Transferido de</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                        )} />
                      )}
                    </div>

                    {/* Observações */}
                    <FormField control={form.control} name="observacoes" render={({ field }) => (
                      <FormItem><FormLabel>Observações</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl></FormItem>
                    )} />
                  </div>
              </CardContent>
            </Card>

                    <div className="space-y-2 pt-4">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                          {readOnly ? 'Fechar' : 'Cancelar'}
                        </Button>
                        {!readOnly && (
                          <>
                            {/* type="button": com submit, o Enter em qualquer campo
                                dispararia o primeiro botão do DOM. O modo já foi
                                escolhido no seletor do topo (modoAbertura.current). */}
                            <Button
                              type="button"
                              variant={modo === 'reserva' ? 'secondary' : 'default'}
                              disabled={openCota.isPending}
                              onClick={() => form.handleSubmit(onSubmit, onInvalid)()}
                            >
                              {openCota.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                              {modo === 'reserva' ? 'Abrir como reserva' : 'Abrir já contratada'}
                            </Button>
                          </>
                        )}
                      </div>
                      {!readOnly && (
                        <div className="space-y-1 text-right text-xs text-muted-foreground">
                          <p>
                            Reserva = enviado à Embracon, aguardando confirmação. Já contratada = a Embracon
                            confirmou e você tem o comprovante em mãos.
                          </p>
                          <p className="text-amber-600 dark:text-amber-500">
                            A cota aberta como reserva só entra na etapa Cotas quando for confirmada.
                          </p>
                        </div>
                      )}
                    </div>
            </form>
            </fieldset>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
