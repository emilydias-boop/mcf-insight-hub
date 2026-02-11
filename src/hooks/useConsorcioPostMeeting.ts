import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Stage IDs
const CONSORCIO_STAGE_IDS = {
  // Viver de Aluguel
  VDA_R1_REALIZADA: '0f450ec9-0f00-4fbe-8400-cdb2440897e5',
  VDA_PROPOSTA_ENVIADA: '09a0a99e-feee-46df-a817-bc4d0e1ac3d9',
  VDA_CONTRATO_PAGO: 'a35fea26-805e-40d5-b604-56fd6319addf',
  VDA_VENDA_REALIZADA: 'aa194279-c40e-458d-80aa-c5179b414658',
  VDA_SEM_SUCESSO: '86bcc03c-17be-4e1c-8018-497c46b6eee4',
  // Efeito Alavanca
  EA_R1_REALIZADA: 'f7c48a43-4ca3-45a1-85d0-e6da76c3cff2',
  EA_SEM_SUCESSO: 'c2c7288b-809a-4c65-8ea9-ac4bcbe795ab',
};

const CONSORCIO_ORIGIN_IDS = [
  '4e2b810a-6782-4ce9-9c0d-10d04c018636', // Viver de Aluguel
  '7d7b1cb5-2a44-4552-9eff-c3b798646b78', // Efeito Alavanca
];

const R1_REALIZADA_IDS = [
  CONSORCIO_STAGE_IDS.VDA_R1_REALIZADA,
  CONSORCIO_STAGE_IDS.EA_R1_REALIZADA,
];

const SEM_SUCESSO_IDS = [
  CONSORCIO_STAGE_IDS.VDA_SEM_SUCESSO,
  CONSORCIO_STAGE_IDS.EA_SEM_SUCESSO,
];

export interface CompletedMeeting {
  deal_id: string;
  deal_name: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  closer_name: string;
  origin_name: string;
  origin_id: string;
  stage_id: string;
  stage_name: string;
  updated_at: string;
  meeting_date: string;
  region: string;
  renda: string;
}

export interface Proposal {
  id: string;
  deal_id: string;
  deal_name: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  proposal_date: string;
  proposal_details: string;
  valor_credito: number;
  prazo_meses: number;
  tipo_produto: string;
  status: string;
  aceite_date: string | null;
  motivo_recusa: string | null;
  consortium_card_id: string | null;
  origin_id: string;
  created_at: string;
}

export interface SemSucessoDeal {
  deal_id: string;
  deal_name: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  origin_name: string;
  origin_id: string;
  stage_id: string;
  updated_at: string;
  motivo_recusa: string | null;
  proposal_id: string | null;
}

// Fetch deals em R1 Realizada (reuniões realizadas sem proposta ainda)
export function useRealizadas() {
  return useQuery({
    queryKey: ['consorcio-realizadas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_deals')
        .select(`
          id,
          name,
          origin_id,
          stage_id,
          updated_at,
          owner_id,
          custom_fields,
          crm_contacts (name, phone, email),
          crm_stages (stage_name),
          crm_origins (name)
        `)
        .in('stage_id', R1_REALIZADA_IDS)
        .in('origin_id', CONSORCIO_ORIGIN_IDS)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Exclude deals that already have a proposal
      const dealIds = (data || []).map(d => d.id);
      let proposalDealIds: string[] = [];
      if (dealIds.length > 0) {
        const { data: proposals } = await supabase
          .from('consorcio_proposals')
          .select('deal_id')
          .in('deal_id', dealIds);
        proposalDealIds = (proposals || []).map(p => p.deal_id).filter(Boolean) as string[];
      }

      const filteredDeals = (data || []).filter(d => !proposalDealIds.includes(d.id));

      // Fetch meeting dates for these deals
      const filteredDealIds = filteredDeals.map(d => d.id);
      let meetingByDeal: Record<string, string> = {};
      if (filteredDealIds.length > 0) {
        const { data: attendees } = await supabase
          .from('meeting_slot_attendees')
          .select('deal_id, meeting_slot_id, meeting_slots (scheduled_at)')
          .in('deal_id', filteredDealIds);
        (attendees || []).forEach(a => {
          if (a.deal_id) {
            const scheduledAt = (a.meeting_slots as any)?.scheduled_at;
            if (scheduledAt) meetingByDeal[a.deal_id] = scheduledAt;
          }
        });
      }

      // Fetch consorcio closers only
      const { data: consorcioClosers } = await supabase
        .from('closers')
        .select('name, email')
        .eq('bu', 'consorcio')
        .eq('is_active', true);

      const closerEmailSet = new Set(
        (consorcioClosers || []).map(c => c.email?.toLowerCase()).filter(Boolean)
      );
      const closerNameByEmail: Record<string, string> = {};
      (consorcioClosers || []).forEach(c => {
        if (c.email) closerNameByEmail[c.email.toLowerCase()] = c.name;
      });

      // Filter deals to only those owned by consorcio closers
      const consorcioDeals = filteredDeals.filter(d =>
        d.owner_id && closerEmailSet.has(d.owner_id.toLowerCase())
      );

      return consorcioDeals.map(d => {
        const cf = (d.custom_fields as any) || {};
        return {
          deal_id: d.id,
          deal_name: d.name || '',
          contact_name: (d.crm_contacts as any)?.name || '',
          contact_phone: (d.crm_contacts as any)?.phone || '',
          contact_email: (d.crm_contacts as any)?.email || '',
          closer_name: (d.owner_id && closerNameByEmail[d.owner_id.toLowerCase()]) || d.owner_id || '',
          origin_name: (d.crm_origins as any)?.name || '',
          origin_id: d.origin_id || '',
          stage_id: d.stage_id || '',
          stage_name: (d.crm_stages as any)?.stage_name || '',
          updated_at: d.updated_at || '',
          meeting_date: meetingByDeal[d.id] || '',
          region: cf.estado || '',
          renda: cf.faixa_de_renda || '',
        };
      }) as CompletedMeeting[];
    },
  });
}

// Fetch proposals pendentes/aceitas
export function useProposals() {
  return useQuery({
    queryKey: ['consorcio-proposals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consorcio_proposals')
        .select(`
          id,
          deal_id,
          proposal_date,
          proposal_details,
          valor_credito,
          prazo_meses,
          tipo_produto,
          status,
          aceite_date,
          motivo_recusa,
          consortium_card_id,
          created_at,
          crm_deals (name, origin_id, crm_contacts (name, phone, email))
        `)
        .in('status', ['pendente', 'aceita'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(p => ({
        id: p.id,
        deal_id: p.deal_id || '',
        deal_name: (p.crm_deals as any)?.name || '',
        contact_name: (p.crm_deals as any)?.crm_contacts?.name || '',
        contact_phone: (p.crm_deals as any)?.crm_contacts?.phone || '',
        contact_email: (p.crm_deals as any)?.crm_contacts?.email || '',
        proposal_date: p.proposal_date || '',
        proposal_details: p.proposal_details || '',
        valor_credito: p.valor_credito || 0,
        prazo_meses: p.prazo_meses || 0,
        tipo_produto: p.tipo_produto || '',
        status: p.status || 'pendente',
        aceite_date: p.aceite_date,
        motivo_recusa: p.motivo_recusa,
        consortium_card_id: p.consortium_card_id,
        origin_id: (p.crm_deals as any)?.origin_id || '',
        created_at: p.created_at || '',
      })) as Proposal[];
    },
  });
}

// Fetch deals sem sucesso
export function useSemSucesso() {
  return useQuery({
    queryKey: ['consorcio-sem-sucesso'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_deals')
        .select(`
          id,
          name,
          origin_id,
          stage_id,
          updated_at,
          crm_contacts (name, phone, email),
          crm_origins (name)
        `)
        .in('stage_id', SEM_SUCESSO_IDS)
        .in('origin_id', CONSORCIO_ORIGIN_IDS)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const dealIds = (data || []).map(d => d.id);
      let proposalsByDeal: Record<string, { id: string; motivo_recusa: string | null }> = {};
      if (dealIds.length > 0) {
        const { data: proposals } = await supabase
          .from('consorcio_proposals')
          .select('id, deal_id, motivo_recusa')
          .in('deal_id', dealIds)
          .eq('status', 'recusada');
        (proposals || []).forEach(p => {
          if (p.deal_id) proposalsByDeal[p.deal_id] = { id: p.id, motivo_recusa: p.motivo_recusa };
        });
      }

      return (data || []).map(d => ({
        deal_id: d.id,
        deal_name: d.name || '',
        contact_name: (d.crm_contacts as any)?.name || '',
        contact_phone: (d.crm_contacts as any)?.phone || '',
        contact_email: (d.crm_contacts as any)?.email || '',
        origin_name: (d.crm_origins as any)?.name || '',
        origin_id: d.origin_id || '',
        stage_id: d.stage_id || '',
        updated_at: d.updated_at || '',
        motivo_recusa: proposalsByDeal[d.id]?.motivo_recusa || null,
        proposal_id: proposalsByDeal[d.id]?.id || null,
      })) as SemSucessoDeal[];
    },
  });
}

// Mutation: Enviar proposta
export function useEnviarProposta() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      deal_id: string;
      origin_id: string;
      proposal_details: string;
      valor_credito: number;
      prazo_meses: number;
      tipo_produto: string;
    }) => {
      // 1. Create proposal
      const { error: propError } = await supabase
        .from('consorcio_proposals')
        .insert({
          deal_id: params.deal_id,
          created_by: user?.id,
          proposal_details: params.proposal_details,
          valor_credito: params.valor_credito,
          prazo_meses: params.prazo_meses,
          tipo_produto: params.tipo_produto,
        });
      if (propError) throw propError;

      // 2. Move deal to PROPOSTA ENVIADA (only VdA has this stage)
      const isVdA = params.origin_id === '4e2b810a-6782-4ce9-9c0d-10d04c018636';
      if (isVdA) {
        const { error: dealError } = await supabase
          .from('crm_deals')
          .update({ stage_id: CONSORCIO_STAGE_IDS.VDA_PROPOSTA_ENVIADA })
          .eq('id', params.deal_id);
        if (dealError) throw dealError;
      }
    },
    onSuccess: () => {
      toast.success('Proposta registrada com sucesso');
      queryClient.invalidateQueries({ queryKey: ['consorcio-realizadas'] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-proposals'] });
    },
    onError: (e: any) => toast.error('Erro ao registrar proposta: ' + e.message),
  });
}

// Mutation: Marcar sem sucesso
export function useMarcarSemSucesso() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      deal_id: string;
      origin_id: string;
      motivo: string;
      proposal_id?: string; // if rejecting from proposals tab
    }) => {
      const isVdA = params.origin_id === '4e2b810a-6782-4ce9-9c0d-10d04c018636';
      const semSucessoId = isVdA
        ? CONSORCIO_STAGE_IDS.VDA_SEM_SUCESSO
        : CONSORCIO_STAGE_IDS.EA_SEM_SUCESSO;

      // Move deal
      const { error } = await supabase
        .from('crm_deals')
        .update({ stage_id: semSucessoId })
        .eq('id', params.deal_id);
      if (error) throw error;

      // If there's a proposal, mark as recusada
      if (params.proposal_id) {
        await supabase
          .from('consorcio_proposals')
          .update({ status: 'recusada', motivo_recusa: params.motivo })
          .eq('id', params.proposal_id);
      }
    },
    onSuccess: () => {
      toast.success('Deal marcado como Sem Sucesso');
      queryClient.invalidateQueries({ queryKey: ['consorcio-realizadas'] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-proposals'] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-sem-sucesso'] });
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

// Mutation: Aceite confirmado
export function useConfirmarAceite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { proposal_id: string }) => {
      const { error } = await supabase
        .from('consorcio_proposals')
        .update({ status: 'aceita', aceite_date: new Date().toISOString().split('T')[0] })
        .eq('id', params.proposal_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Aceite confirmado!');
      queryClient.invalidateQueries({ queryKey: ['consorcio-proposals'] });
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

// Mutation: Retomar contato (volta para R1 Realizada)
export function useRetomarContato() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { deal_id: string; origin_id: string }) => {
      const isVdA = params.origin_id === '4e2b810a-6782-4ce9-9c0d-10d04c018636';
      const r1RealizadaId = isVdA
        ? CONSORCIO_STAGE_IDS.VDA_R1_REALIZADA
        : CONSORCIO_STAGE_IDS.EA_R1_REALIZADA;

      const { error } = await supabase
        .from('crm_deals')
        .update({ stage_id: r1RealizadaId })
        .eq('id', params.deal_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Contato retomado - deal voltou para R1 Realizada');
      queryClient.invalidateQueries({ queryKey: ['consorcio-sem-sucesso'] });
      queryClient.invalidateQueries({ queryKey: ['consorcio-realizadas'] });
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

// Mutation: Vincular carta ao deal após cadastro
export function useVincularCarta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      proposal_id: string;
      deal_id: string;
      origin_id: string;
      consortium_card_id: string;
    }) => {
      // Update proposal with card ID
      await supabase
        .from('consorcio_proposals')
        .update({ consortium_card_id: params.consortium_card_id })
        .eq('id', params.proposal_id);

      // Move deal to CONTRATO PAGO / VENDA REALIZADA
      const isVdA = params.origin_id === '4e2b810a-6782-4ce9-9c0d-10d04c018636';
      const finalStage = isVdA
        ? CONSORCIO_STAGE_IDS.VDA_CONTRATO_PAGO
        : CONSORCIO_STAGE_IDS.EA_R1_REALIZADA; // EA doesn't have contrato pago, keep as is

      await supabase
        .from('crm_deals')
        .update({ stage_id: finalStage })
        .eq('id', params.deal_id);
    },
    onSuccess: () => {
      toast.success('Cota cadastrada e deal atualizado!');
      queryClient.invalidateQueries({ queryKey: ['consorcio-proposals'] });
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

export { CONSORCIO_STAGE_IDS, CONSORCIO_ORIGIN_IDS };
