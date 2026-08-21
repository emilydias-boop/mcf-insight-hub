/**
 * "Adicionar Carta" — lançamento manual de uma venda de consórcio que não
 * passou pelo funil (parceiro, indicação, collab, sócio).
 *
 * Diferente do antigo "Adicionar Pendente", aqui nasce uma VENDA de verdade:
 * 1 proposta (`consorcio_proposals`, status aceita) + N cartas
 * (`consorcio_proposal_cartas`) + N cadastros (`consorcio_pending_registrations`),
 * um por carta, com o documento replicado para todos.
 *
 * Por isso a carta nasce na etapa 3 (Termos de Adesão Pendentes) e só chega em
 * "Cotas a Fazer" depois do termo assinado — regra do dono, válida para toda
 * carta de consórcio.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Search, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { CartasProposalEditor } from './CartasProposalEditor';
import { DadosClienteFields, TipoPessoaSelect, useDadosCliente } from './DadosClienteBloco';
import { useEnviarProposta } from '@/hooks/useConsorcioPostMeeting';
import { useCreatePendingRegistration } from '@/hooks/useConsorcioPendingRegistrations';
import { useConsorcioTipoOptions, useConsorcioOrigemOptions, useConsorcioVendedorOptions } from '@/hooks/useConsorcioConfigOptions';
import { replicarDocumentosDaVenda } from '@/lib/consorcioDocumentReplication';
import {
  PropostaCartaDraft, cartaDraftValida, draftsParaInput, novaCartaDraft, derivarParcelasEmpresa,
} from '@/types/consorcioCartas';
import { CONSORCIO_LABELS } from '@/lib/consorcioLabels';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CONSORCIO_BU = 'consorcio';
/** Pipeline padrão do consórcio (Efeito Alavanca + Clube) para leads novos. */
const EA_ORIGIN_ID = '7d7b1cb5-2a44-4552-9eff-c3b798646b78';
/** Primeira etapa da esteira EA — entrada neutra, sem automação de mensagem. */
const EA_ENTRADA_STAGE_ID = '801a19f4-2e79-497d-9fd5-468c7529b3d2';

function useConsorcioOriginIds() {
  return useQuery({
    queryKey: ['consorcio-bu-origin-ids'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bu_origin_mapping')
        .select('entity_id')
        .eq('bu', CONSORCIO_BU)
        .eq('entity_type', 'origin');
      if (error) throw error;
      const ids = (data || []).map((r: any) => r.entity_id as string);
      return ids.includes(EA_ORIGIN_ID) ? ids : [...ids, EA_ORIGIN_ID];
    },
  });
}

interface DealMatch {
  deal_id: string;
  origin_id: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  origin_label: string | null;
  stage_name: string | null;
}

function useConsorcioLeadSearch(query: string, originIds: string[], enabled: boolean) {
  const term = query.trim();
  return useQuery({
    queryKey: ['consorcio-lead-search', term.toLowerCase(), originIds.length],
    enabled: enabled && term.length >= 2 && originIds.length > 0,
    staleTime: 15_000,
    queryFn: async (): Promise<DealMatch[]> => {
      const like = `%${term}%`;
      const digits = term.replace(/\D/g, '');

      let cq = supabase
        .from('crm_contacts')
        .select('id, name, email, phone')
        .eq('is_archived', false)
        .limit(30);
      cq = digits.length >= 4
        ? cq.or(`name.ilike.${like},email.ilike.${like},phone.ilike.%${digits}%`)
        : cq.or(`name.ilike.${like},email.ilike.${like}`);
      const { data: contacts } = await cq;
      const contactIds = (contacts || []).map((c: any) => c.id);
      if (!contactIds.length) return [];

      const contactById = new Map<string, any>();
      (contacts || []).forEach((c: any) => contactById.set(c.id, c));

      const { data: deals } = await supabase
        .from('crm_deals')
        .select('id, contact_id, stage_id, origin_id, created_at')
        .in('contact_id', contactIds)
        .in('origin_id', originIds)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
        .limit(30);
      if (!deals || deals.length === 0) return [];

      const originIdsUsed = Array.from(new Set(deals.map((d: any) => d.origin_id).filter(Boolean)));
      const stageIdsUsed = Array.from(new Set(deals.map((d: any) => d.stage_id).filter(Boolean)));
      const [{ data: origins }, { data: stages }] = await Promise.all([
        originIdsUsed.length
          ? supabase.from('crm_origins').select('id, display_name, name').in('id', originIdsUsed)
          : Promise.resolve({ data: [] as any[] }),
        stageIdsUsed.length
          ? supabase.from('crm_stages').select('id, stage_name').in('id', stageIdsUsed)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const originById = new Map<string, string>();
      (origins || []).forEach((o: any) => originById.set(o.id, o.display_name || o.name));
      const stageById = new Map<string, string>();
      (stages || []).forEach((s: any) => stageById.set(s.id, s.stage_name));

      const seen = new Set<string>();
      const out: DealMatch[] = [];
      for (const d of deals as any[]) {
        if (seen.has(d.contact_id)) continue;
        seen.add(d.contact_id);
        const c = contactById.get(d.contact_id) || {};
        out.push({
          deal_id: d.id,
          origin_id: d.origin_id,
          contact_name: c.name || null,
          contact_email: c.email || null,
          contact_phone: c.phone || null,
          origin_label: originById.get(d.origin_id) || null,
          stage_name: stageById.get(d.stage_id) || null,
        });
      }
      return out;
    },
  });
}

export function AddCartaModal({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const enviarProposta = useEnviarProposta();
  const createRegistration = useCreatePendingRegistration();
  const { data: tipoOptions = [] } = useConsorcioTipoOptions();
  const { data: origemOptions = [] } = useConsorcioOrigemOptions();
  const { data: vendedorOptions = [] } = useConsorcioVendedorOptions();

  const [lead, setLead] = useState<DealMatch | null>(null);
  const [leadOpen, setLeadOpen] = useState(false);
  const [leadSearch, setLeadSearch] = useState('');
  const [criandoLead, setCriandoLead] = useState(false);

  const [origem, setOrigem] = useState('');
  const [origemDetalhe, setOrigemDetalhe] = useState('');
  const [closerId, setCloserId] = useState('');
  const [aceiteDate, setAceiteDate] = useState(new Date().toISOString().split('T')[0]);
  const [obs, setObs] = useState('');
  const [cartas, setCartas] = useState<PropostaCartaDraft[]>([novaCartaDraft()]);
  const [mostrarErros, setMostrarErros] = useState(false);
  const [cadastroAberto, setCadastroAberto] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const cliente = useDadosCliente({ nomeInicial: lead?.contact_name || '' });
  const { data: originIds = [] } = useConsorcioOriginIds();
  const { data: leadMatches = [], isFetching: isSearching } = useConsorcioLeadSearch(
    leadSearch, originIds, leadOpen,
  );

  const closerNome = (() => {
    const c: any = vendedorOptions.find((v: any) => v.id === closerId);
    return c ? (c.name ?? c.nome ?? '') : '';
  })();

  const cartasOk = cartas.length > 0 && cartas.every(cartaDraftValida);
  const podeSalvar = !!lead && cartasOk && !!origem && !!closerId;

  const resetar = () => {
    setLead(null); setLeadSearch(''); setOrigem(''); setOrigemDetalhe('');
    setCloserId(''); setAceiteDate(new Date().toISOString().split('T')[0]);
    setObs(''); setCartas([novaCartaDraft()]); setMostrarErros(false);
    cliente.form.reset();
  };

  const selecionarLead = (m: DealMatch) => {
    setLead(m);
    cliente.form.setValue('nome_completo', m.contact_name || '');
    if (m.contact_phone) cliente.form.setValue('telefone', m.contact_phone);
    if (m.contact_email) cliente.form.setValue('email', m.contact_email);
    setLeadOpen(false);
  };

  /** Cria contato + negócio de verdade na esteira do consórcio. */
  const criarLeadNovo = async () => {
    const nome = leadSearch.trim();
    if (nome.length < 3) {
      toast.error('Digite o nome do cliente na busca para criar o lead.');
      return;
    }
    setCriandoLead(true);
    try {
      const { data: contato, error: cErr } = await supabase
        .from('crm_contacts')
        .insert({ name: nome } as any)
        .select('id, name')
        .single();
      if (cErr) throw cErr;

      const { data: deal, error: dErr } = await supabase
        .from('crm_deals')
        .insert({
          name: nome,
          contact_id: contato.id,
          origin_id: EA_ORIGIN_ID,
          stage_id: EA_ENTRADA_STAGE_ID,
        } as any)
        .select('id')
        .single();
      if (dErr) throw dErr;

      selecionarLead({
        deal_id: deal.id,
        origin_id: EA_ORIGIN_ID,
        contact_name: nome,
        contact_email: null,
        contact_phone: null,
        origin_label: 'Efeito Alavanca + Clube',
        stage_name: 'Parceiros',
      });
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
      toast.success('Lead criado no CRM do consórcio.');
    } catch (e: any) {
      const msg = String(e?.message || '');
      toast.error(
        msg.includes('duplicate_contact')
          ? 'Já existe contato com esse e-mail/telefone — busque o lead existente.'
          : 'Erro ao criar o lead: ' + msg,
      );
    } finally {
      setCriandoLead(false);
    }
  };

  const handleSubmit = async () => {
    if (!lead) { toast.error('Selecione o lead no CRM — é dele que sai o termo e a atribuição.'); return; }
    if (!origem) { toast.error('Informe a origem da venda.'); return; }
    if (!closerId) { toast.error('Informe o closer responsável.'); return; }
    if (!cartasOk) { setMostrarErros(true); return; }

    setSalvando(true);
    try {
      const resultado = await enviarProposta.mutateAsync({
        deal_id: lead.deal_id,
        origin_id: lead.origin_id,
        proposal_details: obs,
        cartas: draftsParaInput(cartas),
        origem_lead: origem,
      });

      // Venda manual já nasce aceita, na data informada pela equipe.
      await supabase
        .from('consorcio_proposals')
        .update({
          status: 'aceita',
          proposal_date: aceiteDate,
          aceite_date: aceiteDate,
          aceite_at: new Date().toISOString(),
        } as any)
        .eq('id', resultado.proposal_id);

      const dados = cliente.dadosLimpos(cliente.form.getValues());
      const docs = cliente.documentos();

      for (let idx = 0; idx < resultado.cartas.length; idx++) {
        const carta = resultado.cartas[idx];
        const parcelas = derivarParcelasEmpresa(carta.parcelas_mcf);
        await createRegistration.mutateAsync({
          carta_id: carta.id,
          proposal_id: resultado.proposal_id,
          deal_id: lead.deal_id,
          tipo_pessoa: cliente.tipoPessoa,
          vendedor_name: closerNome,
          documents: idx === 0 ? docs : [],
          empresa_paga_parcelas: parcelas.empresa_paga_parcelas,
          tipo_contrato: parcelas.tipo_contrato,
          parcelas_pagas_empresa: parcelas.parcelas_pagas_empresa,
          valor_credito: Number(carta.valor_credito),
          prazo_meses: Number(carta.prazo_meses),
          tipo_produto: carta.tipo_produto || undefined,
          parcela_1a_12a: carta.parcela_1a_12a ?? undefined,
          parcela_demais: carta.parcela_demais ?? undefined,
          condicao_pagamento: carta.condicao_pagamento || undefined,
          objetivo: carta.objetivo || undefined,
          categoria: carta.categoria || undefined,
          origem,
          origem_detalhe: origemDetalhe.trim() || undefined,
          aceite_date: aceiteDate,
          vendedor_id: closerId || undefined,
          vendedor_name_cota: closerNome || undefined,
          observacoes: obs.trim() || undefined,
          ...dados,
        } as any);
      }

      await replicarDocumentosDaVenda(resultado.proposal_id);

      toast.success(
        `Carta lançada em ${CONSORCIO_LABELS.termosPendentes} — só entra em ${CONSORCIO_LABELS.cotasAFazer} depois do termo assinado.`,
      );
      resetar();
      onOpenChange(false);
    } catch {
      // hooks já mostram o erro; mantém o modal aberto para correção
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetar(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar Carta</DialogTitle>
          <DialogDescription>
            Venda de consórcio que não passou pelo funil (parceiro, indicação, collab, sócio).
            A carta criada aqui nasce na etapa {CONSORCIO_LABELS.termosPendentes} e só chega em{' '}
            {CONSORCIO_LABELS.cotasAFazer} depois do termo assinado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* ===== Lead (obrigatório) ===== */}
          <div className="space-y-2 rounded-lg border p-3">
            <h3 className="text-sm font-semibold">1. Lead no CRM (obrigatório)</h3>
            <p className="text-xs text-muted-foreground">
              O termo de adesão e a atribuição de closer/SDR saem do lead. Sem lead não existe venda.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Popover open={leadOpen} onOpenChange={setLeadOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start gap-2">
                    <Search className="h-4 w-4" />
                    {lead ? (lead.contact_name || 'Lead selecionado') : 'Buscar lead...'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[420px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Nome, e-mail ou telefone..."
                      value={leadSearch}
                      onValueChange={setLeadSearch}
                    />
                    <CommandList>
                      {isSearching && (
                        <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" /> Buscando...
                        </div>
                      )}
                      {!isSearching && leadMatches.length === 0 && (
                        <CommandEmpty>Nenhum lead encontrado.</CommandEmpty>
                      )}
                      <CommandGroup>
                        {leadMatches.map(m => (
                          <CommandItem key={m.deal_id} value={m.deal_id} onSelect={() => selecionarLead(m)}>
                            <div className="flex flex-col">
                              <span className="text-sm">{m.contact_name}</span>
                              <span className="text-xs text-muted-foreground">
                                {[m.contact_phone, m.origin_label, m.stage_name].filter(Boolean).join(' · ')}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <Button variant="secondary" onClick={criarLeadNovo} disabled={criandoLead}>
                {criandoLead ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                Criar lead novo no CRM
              </Button>

              {lead && (
                <Badge variant="outline">
                  {lead.origin_label} {lead.stage_name ? `· ${lead.stage_name}` : ''}
                </Badge>
              )}
            </div>
          </div>

          {/* ===== Venda ===== */}
          <div className="space-y-4 rounded-lg border p-3">
            <h3 className="text-sm font-semibold">2. Dados da venda</h3>
            <CartasProposalEditor
              cartas={cartas}
              onChange={setCartas}
              tipoOptions={tipoOptions.map(o => ({ name: o.name, label: o.label }))}
              mostrarErros={mostrarErros}
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Origem da venda</Label>
                <Select value={origem} onValueChange={setOrigem}>
                  <SelectTrigger><SelectValue placeholder="Selecione a origem" /></SelectTrigger>
                  <SelectContent>
                    {origemOptions.map(o => (
                      <SelectItem key={o.name} value={o.name}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Detalhe da origem (opcional)</Label>
                <Input
                  value={origemDetalhe}
                  onChange={e => setOrigemDetalhe(e.target.value)}
                  placeholder="Ex.: nome do parceiro, quem indicou..."
                />
              </div>
              <div>
                <Label>Closer responsável</Label>
                <Select value={closerId} onValueChange={setCloserId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o closer" /></SelectTrigger>
                  <SelectContent>
                    {(vendedorOptions as any[]).map((v: any) => (
                      <SelectItem key={v.id} value={v.id}>{v.name ?? v.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data de aceite</Label>
                <Input type="date" value={aceiteDate} onChange={e => setAceiteDate(e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea value={obs} onChange={e => setObs(e.target.value)} rows={3} />
            </div>
          </div>

          {/* ===== Cadastral ===== */}
          <Collapsible open={cadastroAberto} onOpenChange={setCadastroAberto}>
            <div className="rounded-lg border p-3">
              <CollapsibleTrigger asChild>
                <button type="button" className="flex w-full items-center justify-between gap-2 text-left">
                  <div>
                    <h3 className="text-sm font-semibold">3. Dados cadastrais do cliente</h3>
                    <p className="text-xs text-muted-foreground">
                      Sem os dados completos e os documentos, a carta fica marcada como cadastro
                      incompleto e o termo de adesão não sai.
                    </p>
                  </div>
                  {cadastroAberto ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-4">
                <TipoPessoaSelect bloco={cliente} />
                <DadosClienteFields bloco={cliente} />
              </CollapsibleContent>
            </div>
          </Collapsible>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={salvando || !podeSalvar}>
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {salvando ? 'Lançando...' : 'Lançar carta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
