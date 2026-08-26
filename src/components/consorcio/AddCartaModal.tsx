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
import { fetchR1ConsorcioDetalhePorDeal, R1ConsorcioInfo } from '@/hooks/useCorrigirVinculoCota';
import { useBuscarReuniaoConsorcio, ReuniaoConsorcioCandidato } from '@/hooks/useBuscarReuniaoConsorcio';
import { nameKey } from '@/hooks/useConsorcioCotasContratadas';

/** E-mail do closer da BU Consórcio que casa (nameKey) com o vendedor escolhido — vira owner do lead novo. */
async function emailDoCloserPorNome(nome: string): Promise<string | null> {
  const alvo = nameKey(nome);
  if (!alvo) return null;
  const { data } = await supabase.from('closers').select('name, email').eq('bu', CONSORCIO_BU);
  const found = (data || []).find((c: any) => nameKey(c.name) === alvo);
  return (found as any)?.email || null;
}

const fmtDiaCurto = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
const fmtDiaHora = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '';

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
  /** Selo de R1 de consórcio — null quando o lead não tem reunião elegível. */
  r1: R1ConsorcioInfo | null;
}

/**
 * Busca de lead do "Adicionar Carta".
 * Casa por contato (nome/e-mail/telefone), pelo NOME DO DEAL e por CPF/CNPJ
 * via cadastros de consórcio. Um lead com R1 de consórcio elegível entra no
 * resultado venha de qual origem vier — é ele que credita SDR e closer.
 */
function useConsorcioLeadSearch(
  query: string,
  originIds: string[],
  docs: { cpf?: string; cnpj?: string },
  enabled: boolean,
) {
  const term = query.trim();
  const cpfDigits = (docs.cpf || '').replace(/\D/g, '');
  const cnpjDigits = (docs.cnpj || '').replace(/\D/g, '');
  return useQuery({
    queryKey: ['consorcio-lead-search', term.toLowerCase(), cpfDigits, cnpjDigits, originIds.length],
    enabled: enabled && (term.length >= 2 || cpfDigits.length >= 11 || cnpjDigits.length >= 11) && originIds.length > 0,
    staleTime: 15_000,
    queryFn: async (): Promise<DealMatch[]> => {
      const like = `%${term}%`;
      const digits = term.replace(/\D/g, '');

      const contactById = new Map<string, any>();
      const dealsPorId = new Map<string, any>();

      if (term.length >= 2) {
        // 1) contatos que casam por nome/e-mail/telefone
        let cq = supabase
          .from('crm_contacts')
          .select('id, name, email, phone')
          .eq('is_archived', false)
          .limit(30);
        cq = digits.length >= 4
          ? cq.or(`name.ilike.${like},email.ilike.${like},phone.ilike.%${digits}%`)
          : cq.or(`name.ilike.${like},email.ilike.${like}`);
        const { data: contacts } = await cq;
        (contacts || []).forEach((c: any) => contactById.set(c.id, c));
        const contactIds = (contacts || []).map((c: any) => c.id);
        if (contactIds.length) {
          const { data: deals } = await supabase
            .from('crm_deals')
            .select('id, contact_id, stage_id, origin_id, created_at')
            .in('contact_id', contactIds)
            .eq('is_archived', false)
            .order('created_at', { ascending: false })
            .limit(30);
          (deals || []).forEach((d: any) => dealsPorId.set(d.id, d));
        }

        // 2) nome do DEAL — muitos leads de consórcio não têm contato com nome
        const { data: dealsNome } = await supabase
          .from('crm_deals')
          .select('id, contact_id, stage_id, origin_id, created_at')
          .ilike('name', like)
          .eq('is_archived', false)
          .order('created_at', { ascending: false })
          .limit(30);
        (dealsNome || []).forEach((d: any) => {
          if (!dealsPorId.has(d.id)) dealsPorId.set(d.id, d);
        });
      }

      // 3) reforço por CPF/CNPJ: deals de cadastros de consórcio do mesmo documento
      const pares: Array<[string, string]> = [];
      if (cpfDigits.length >= 11 && docs.cpf?.trim()) pares.push(['cpf', docs.cpf.trim()]);
      if (cnpjDigits.length >= 11 && docs.cnpj?.trim()) pares.push(['cnpj', docs.cnpj.trim()]);
      for (const [col, valor] of pares) {
        const { data: regs } = await supabase
          .from('consorcio_pending_registrations')
          .select('deal_id')
          .eq(col, valor)
          .not('deal_id', 'is', null)
          .limit(20);
        const faltam = [...new Set((regs || []).map((r: any) => r.deal_id).filter(Boolean))].filter(
          (id) => !dealsPorId.has(id as string),
        ) as string[];
        if (faltam.length) {
          const { data: extraDeals } = await supabase
            .from('crm_deals')
            .select('id, contact_id, stage_id, origin_id, created_at')
            .in('id', faltam);
          (extraDeals || []).forEach((d: any) => dealsPorId.set(d.id, d));
        }
      }

      let deals = [...dealsPorId.values()];
      if (deals.length === 0) return [];

      // Contatos dos deals achados pelo nome do deal ou pelo documento
      const contatosFaltantes = [
        ...new Set(deals.map((d: any) => d.contact_id).filter(Boolean)),
      ].filter((id) => !contactById.has(id as string)) as string[];
      if (contatosFaltantes.length) {
        const { data: cs } = await supabase
          .from('crm_contacts')
          .select('id, name, email, phone')
          .in('id', contatosFaltantes);
        (cs || []).forEach((c: any) => contactById.set(c.id, c));
      }

      // Selo de R1 ANTES do filtro de origem: lead com R1 de consórcio é
      // relevante por definição, venha de onde vier.
      const r1Map = await fetchR1ConsorcioDetalhePorDeal(deals.map((d: any) => String(d.id)));
      deals = deals.filter((d: any) => originIds.includes(d.origin_id) || r1Map.has(String(d.id)));
      if (deals.length === 0) return [];

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
        if (d.contact_id) {
          if (seen.has(d.contact_id)) continue;
          seen.add(d.contact_id);
        }
        const c = contactById.get(d.contact_id) || {};
        const r1 = r1Map.get(String(d.id));
        out.push({
          deal_id: d.id,
          origin_id: d.origin_id,
          contact_name: c.name || d.name || null,
          contact_email: c.email || null,
          contact_phone: c.phone || null,
          origin_label: originById.get(d.origin_id) || null,
          stage_name: stageById.get(d.stage_id) || null,
          r1: r1 ? { dia: r1.dia, closerName: r1.closerName, temAgendador: r1.temAgendador } : null,
        });
      }
      // Quem tem R1 de consórcio vem primeiro — foi a ordenação que faltou no caso Rodrigo.
      out.sort((a, b) => Number(!!b.r1) - Number(!!a.r1));
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
  /** Campo próprio de criação: o clique no botão fechava o popover e descartava a busca. */
  const [novoLeadAberto, setNovoLeadAberto] = useState(false);
  const [novoLeadNome, setNovoLeadNome] = useState('');


  const [origem, setOrigem] = useState('');
  const [origemDetalhe, setOrigemDetalhe] = useState('');
  const [closerId, setCloserId] = useState('');
  const [aceiteDate, setAceiteDate] = useState(new Date().toISOString().split('T')[0]);
  const [obs, setObs] = useState('');
  const [cartas, setCartas] = useState<PropostaCartaDraft[]>([novaCartaDraft()]);
  const [mostrarErros, setMostrarErros] = useState(false);
  const [cadastroAberto, setCadastroAberto] = useState(true);
  const [salvando, setSalvando] = useState(false);
  /** Lead criado por ESTE modal — único contato/deal que o submit pode complementar. */
  const [leadCriadoAqui, setLeadCriadoAqui] = useState<{ dealId: string; contactId: string } | null>(null);
  /** Candidatos com R1 de consórcio encontrados na verificação do submit — abre o diálogo de atrito. */
  const [candidatosReuniao, setCandidatosReuniao] = useState<ReuniaoConsorcioCandidato[] | null>(null);
  const [motivoSemR1, setMotivoSemR1] = useState('');

  const cliente = useDadosCliente({ nomeInicial: lead?.contact_name || '' });
  const buscarReuniao = useBuscarReuniaoConsorcio();
  const cpfBusca = (cliente.form.watch('cpf') as string) || '';
  const cnpjBusca = (cliente.form.watch('cnpj') as string) || '';
  const { data: originIds = [] } = useConsorcioOriginIds();
  const { data: leadMatches = [], isFetching: isSearching } = useConsorcioLeadSearch(
    leadSearch, originIds, { cpf: cpfBusca, cnpj: cnpjBusca }, leadOpen,
  );

  const closerNome = (() => {
    const c: any = vendedorOptions.find((v: any) => v.id === closerId);
    return c ? (c.name ?? c.nome ?? '') : '';
  })();

  const cartasOk = cartas.length > 0 && cartas.every(cartaDraftValida);

  /**
   * O que falta para lançar, em texto. O botão NUNCA fica travado em silêncio:
   * ele sempre é clicável e o clique explica a pendência.
   */
  const pendencias: string[] = [
    !lead && 'Vincule o lead no CRM (busque ou crie).',
    !origem && 'Selecione a origem da venda.',
    !closerId && 'Selecione o closer responsável.',
    ...cartas.map((c, i) =>
      cartaDraftValida(c)
        ? ''
        : `Carta ${i + 1}: preencha crédito, prazo e produto (os três são obrigatórios).`,
    ),
  ].filter(Boolean) as string[];

  


  const resetar = () => {
    setLead(null); setLeadSearch(''); setOrigem(''); setOrigemDetalhe('');
    setNovoLeadAberto(false); setNovoLeadNome('');
    setCloserId(''); setAceiteDate(new Date().toISOString().split('T')[0]);
    setObs(''); setCartas([novaCartaDraft()]); setMostrarErros(false);
    setLeadCriadoAqui(null); setCandidatosReuniao(null); setMotivoSemR1('');
    cliente.form.reset();
  };

  const selecionarLead = (m: DealMatch) => {
    setLead(m);
    setLeadCriadoAqui(null);
    cliente.form.setValue('nome_completo', m.contact_name || '');
    if (m.contact_phone) cliente.form.setValue('telefone', m.contact_phone);
    if (m.contact_email) cliente.form.setValue('email', m.contact_email);
    setLeadOpen(false);
    setNovoLeadAberto(false);
  };

  /** Abre o campo de criação já com o que foi digitado na busca. */
  const abrirCriacaoLead = () => {
    console.log('[AddCartaModal] abrirCriacaoLead', { leadSearch, criandoLead });
    setCriandoLead(false); // destrava caso uma tentativa anterior tenha ficado presa
    setNovoLeadNome(prev => prev || leadSearch.trim());
    setNovoLeadAberto(true);
    setLeadOpen(false);
  };


  /** Cria contato + negócio de verdade na esteira do consórcio. */
  const criarLeadNovo = async (nomeInformado: string) => {
    console.log('[AddCartaModal] criarLeadNovo INICIADO', { nomeInformado, criandoLead });
    const nome = (nomeInformado || '').trim();
    if (nome.length < 3) {
      toast.error('Informe o nome completo do cliente (mínimo 3 letras).');
      return;
    }

    setCriandoLead(true);
    try {
      // O lead novo não nasce mais cego: telefone/e-mail/documento do bloco 3
      // (quando já preenchidos) entram no contato, e o closer vira dono do deal.
      const vals = cliente.form.getValues();
      const tel = String(vals.telefone || vals.telefone_comercial || '').trim();
      const mail = String(vals.email || vals.email_comercial || '').trim();
      const docDigits = String(vals.cpf || vals.cnpj || '').replace(/\D/g, '');
      const contatoInsert: Record<string, unknown> = { name: nome, clint_id: `local-${Date.now()}` };
      if (tel) contatoInsert.phone = tel;
      if (mail) contatoInsert.email = mail;
      if (docDigits.length >= 11) contatoInsert.custom_fields = { documento: docDigits };

      console.log('[AddCartaModal] inserindo crm_contacts...', nome);
      const { data: contato, error: cErr } = await supabase
        .from('crm_contacts')
        .insert(contatoInsert as any)
        .select('id, name')
        .single();
      console.log('[AddCartaModal] resposta crm_contacts', { contato, cErr });
      if (cErr) throw cErr;
      if (!contato?.id) throw new Error('Contato criado sem ID retornado.');

      const ownerEmail = closerNome ? await emailDoCloserPorNome(closerNome) : null;
      const { data: deal, error: dErr } = await supabase
        .from('crm_deals')
        .insert({
          name: nome,
          contact_id: contato.id,
          origin_id: EA_ORIGIN_ID,
          stage_id: EA_ENTRADA_STAGE_ID,
          clint_id: `manual_${Date.now()}_${String(contato.id).slice(0, 8)}`,
          ...(ownerEmail ? { owner_id: ownerEmail } : {}),
        } as any)
        .select('id')
        .single();
      console.log('[AddCartaModal] resposta crm_deals', { deal, dErr });
      if (dErr) throw dErr;
      if (!deal?.id) throw new Error('Negócio criado sem ID retornado.');

      selecionarLead({
        deal_id: deal.id,
        origin_id: EA_ORIGIN_ID,
        contact_name: nome,
        contact_email: mail || null,
        contact_phone: tel || null,
        origin_label: 'Efeito Alavanca + Clube',
        stage_name: 'Parceiros',
        r1: null,
      });
      setLeadCriadoAqui({ dealId: deal.id, contactId: contato.id });
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
      setNovoLeadNome('');
      toast.success('Lead criado no CRM do consórcio.');

    } catch (e: any) {
      console.error('[AddCartaModal] ERRO ao criar lead', e);
      const msg =
        e?.message ||
        e?.details ||
        e?.hint ||
        (typeof e === 'string' ? e : JSON.stringify(e));
      toast.error(
        String(msg).includes('duplicate_contact')
          ? 'Já existe contato com esse e-mail/telefone — busque o lead existente.'
          : `Erro ao criar o lead: ${msg}`,
      );
    } finally {
      setCriandoLead(false);
    }
  };


  const handleSubmit = async () => {
    if (pendencias.length > 0) {
      setMostrarErros(true);
      toast.error(`Falta preencher: ${pendencias.join(' ')}`);
      return;
    }
    if (!lead) return;


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
                        <CommandEmpty>
                          <div className="space-y-2 p-1 text-center">
                            <p className="text-sm text-muted-foreground">Nenhum lead encontrado.</p>
                            {leadSearch.trim().length >= 3 && (
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => criarLeadNovo(leadSearch)}
                                disabled={criandoLead}
                              >
                                {criandoLead
                                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  : <UserPlus className="mr-2 h-4 w-4" />}
                                Criar "{leadSearch.trim()}" no CRM
                              </Button>
                            )}
                          </div>
                        </CommandEmpty>
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

              <Button type="button" variant="secondary" onClick={abrirCriacaoLead} disabled={criandoLead}>
                <UserPlus className="mr-2 h-4 w-4" />
                Criar lead novo no CRM
              </Button>

              {lead && (
                <Badge variant="outline">
                  {lead.origin_label} {lead.stage_name ? `· ${lead.stage_name}` : ''}
                </Badge>
              )}
            </div>

            {novoLeadAberto && !lead && (
              <div className="space-y-2 rounded-md border border-dashed p-3">
                <Label htmlFor="novo-lead-nome" className="text-xs">
                  Nome completo do cliente
                </Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    id="novo-lead-nome"
                    autoFocus
                    className="w-[280px]"
                    value={novoLeadNome}
                    onChange={e => setNovoLeadNome(e.target.value)}
                    placeholder="Ex: Maria Aparecida da Silva"
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); void criarLeadNovo(novoLeadNome); }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => { void criarLeadNovo(novoLeadNome); }}
                    disabled={criandoLead || novoLeadNome.trim().length < 3}
                  >
                    {criandoLead && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Criar lead
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => { setNovoLeadAberto(false); setNovoLeadNome(''); }}
                    disabled={criandoLead}
                  >
                    Cancelar
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Cria contato + negócio na esteira do consórcio (Efeito Alavanca + Clube · Parceiros).
                </p>
              </div>
            )}
          </div>


          {/* ===== Venda ===== */}
          <div className="space-y-4 rounded-lg border p-3">
            <h3 className="text-sm font-semibold">2. Dados da venda</h3>
            <CartasProposalEditor
              cartas={cartas}
              onChange={setCartas}
              tipoOptions={tipoOptions.map(o => ({ name: o.name, label: o.label }))}
              mostrarErros={mostrarErros}
              preSelecionarPadrao
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

        <DialogFooter className="flex-col items-stretch gap-2 sm:flex-col sm:items-stretch">
          {pendencias.length > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-left text-xs text-amber-700 dark:text-amber-300">
              <p className="font-medium">Falta preencher antes de lançar:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {pendencias.map(p => <li key={p}>{p}</li>)}
              </ul>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={salvando}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {salvando ? 'Lançando...' : 'Lançar carta'}
            </Button>
          </div>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
