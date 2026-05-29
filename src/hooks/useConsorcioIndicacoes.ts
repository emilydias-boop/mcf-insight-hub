import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Indicador {
  id: string;
  nome: string;
  tipo: 'consorciado' | 'externo';
  card_id: string | null;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  pix: string | null;
  observacoes: string | null;
  created_at: string;
}

export interface Indicacao {
  id: string;
  indicador_id: string;
  card_id: string;
  percentual: number;
  num_parcelas: number;
  observacoes: string | null;
  created_at: string;
}

export interface IndicacaoParcela {
  id: string;
  indicacao_id: string;
  numero_parcela: number;
  valor: number;
  data_vencimento: string;
  status: 'pendente' | 'pago' | 'cancelado';
  data_pagamento: string | null;
  observacao: string | null;
}

export interface IndicacaoRich extends Indicacao {
  indicador: Indicador;
  card: {
    id: string;
    nome_completo: string | null;
    razao_social: string | null;
    grupo: string;
    cota: string;
    valor_credito: number;
    data_contratacao: string | null;
    status: string;
    tipo_produto: string;
  } | null;
  parcelas: IndicacaoParcela[];
  cardParcelasPagas: Set<number>; // parcelas da cota que foram pagas
  valorComissaoTotal: number;
  valorPago: number;
  valorLiberadoAPagar: number; // parcela_indicacao N liberada quando parcela_cota N está paga
  valorPendente: number;
}

export function useIndicadores() {
  return useQuery({
    queryKey: ['consorcio-indicadores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consorcio_indicadores')
        .select('*')
        .order('nome');
      if (error) throw error;
      return (data || []) as Indicador[];
    },
  });
}

export function useIndicacoes() {
  return useQuery({
    queryKey: ['consorcio-indicacoes-rich'],
    queryFn: async (): Promise<IndicacaoRich[]> => {
      const { data: indicacoes, error } = await supabase
        .from('consorcio_indicacoes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!indicacoes || indicacoes.length === 0) return [];

      const indicadorIds = [...new Set(indicacoes.map((i: any) => i.indicador_id))];
      const cardIds = [...new Set(indicacoes.map((i: any) => i.card_id))];
      const indIds = indicacoes.map((i: any) => i.id);

      const [indicadoresRes, cardsRes, parcelasRes, cardInstRes] = await Promise.all([
        supabase.from('consorcio_indicadores').select('*').in('id', indicadorIds),
        supabase
          .from('consortium_cards')
          .select('id,nome_completo,razao_social,grupo,cota,valor_credito,data_contratacao,status,tipo_produto')
          .in('id', cardIds),
        supabase.from('consorcio_indicacao_parcelas').select('*').in('indicacao_id', indIds).order('numero_parcela'),
        supabase
          .from('consortium_installments')
          .select('card_id,numero_parcela,status')
          .in('card_id', cardIds),
      ]);
      if (indicadoresRes.error) throw indicadoresRes.error;
      if (cardsRes.error) throw cardsRes.error;
      if (parcelasRes.error) throw parcelasRes.error;
      if (cardInstRes.error) throw cardInstRes.error;

      const indMap = new Map<string, Indicador>((indicadoresRes.data || []).map((x: any) => [x.id, x]));
      const cardMap = new Map<string, any>((cardsRes.data || []).map((x: any) => [x.id, x]));
      const parcelasByInd = new Map<string, IndicacaoParcela[]>();
      for (const p of (parcelasRes.data || []) as any[]) {
        const arr = parcelasByInd.get(p.indicacao_id) || [];
        arr.push(p);
        parcelasByInd.set(p.indicacao_id, arr);
      }
      const paidByCard = new Map<string, Set<number>>();
      for (const inst of (cardInstRes.data || []) as any[]) {
        if (inst.status !== 'pago') continue;
        const set = paidByCard.get(inst.card_id) || new Set<number>();
        set.add(inst.numero_parcela);
        paidByCard.set(inst.card_id, set);
      }

      return (indicacoes as any[]).map((i) => {
        const parcelas = (parcelasByInd.get(i.id) || []).sort((a, b) => a.numero_parcela - b.numero_parcela);
        const cardParcelasPagas = paidByCard.get(i.card_id) || new Set<number>();
        const valorComissaoTotal = parcelas.reduce((s, p) => s + Number(p.valor), 0);
        const valorPago = parcelas.filter((p) => p.status === 'pago').reduce((s, p) => s + Number(p.valor), 0);
        const valorLiberadoAPagar = parcelas
          .filter((p) => p.status === 'pendente' && cardParcelasPagas.has(p.numero_parcela))
          .reduce((s, p) => s + Number(p.valor), 0);
        const valorPendente = parcelas.filter((p) => p.status === 'pendente').reduce((s, p) => s + Number(p.valor), 0);
        return {
          ...(i as any),
          indicador: indMap.get(i.indicador_id)!,
          card: cardMap.get(i.card_id) || null,
          parcelas,
          cardParcelasPagas,
          valorComissaoTotal,
          valorPago,
          valorLiberadoAPagar,
          valorPendente,
        } as IndicacaoRich;
      });
    },
  });
}

export function useCreateIndicador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Indicador>) => {
      const { data, error } = await supabase.from('consorcio_indicadores').insert(payload as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consorcio-indicadores'] });
      toast.success('Indicador cadastrado');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateIndicador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Indicador> }) => {
      const { error } = await supabase.from('consorcio_indicadores').update(patch as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consorcio-indicadores'] });
      qc.invalidateQueries({ queryKey: ['consorcio-indicacoes-rich'] });
      toast.success('Indicador atualizado');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteIndicador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('consorcio_indicadores').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consorcio-indicadores'] });
      qc.invalidateQueries({ queryKey: ['consorcio-indicacoes-rich'] });
      toast.success('Indicador removido');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useCreateIndicacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { indicador_id: string; card_id: string; percentual?: number; num_parcelas?: number; observacoes?: string }) => {
      const { data, error } = await supabase
        .from('consorcio_indicacoes')
        .insert({
          indicador_id: payload.indicador_id,
          card_id: payload.card_id,
          percentual: payload.percentual ?? 1.0,
          num_parcelas: payload.num_parcelas ?? 5,
          observacoes: payload.observacoes ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consorcio-indicacoes-rich'] });
      toast.success('Indicação registrada');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateIndicacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Indicacao> }) => {
      const { error } = await supabase.from('consorcio_indicacoes').update(patch as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consorcio-indicacoes-rich'] });
      toast.success('Indicação atualizada');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteIndicacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('consorcio_indicacoes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consorcio-indicacoes-rich'] });
      toast.success('Indicação removida');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateIndicacaoParcela() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<IndicacaoParcela> }) => {
      const { error } = await supabase.from('consorcio_indicacao_parcelas').update(patch as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consorcio-indicacoes-rich'] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// Busca cotas (para selecionar ao criar indicação) — exclui cotas que já têm indicação
export function useCotasParaIndicacao(search: string) {
  return useQuery({
    queryKey: ['cotas-para-indicacao', search],
    queryFn: async () => {
      const { data: jaIndicadas } = await supabase.from('consorcio_indicacoes').select('card_id');
      const exclude = new Set((jaIndicadas || []).map((x: any) => x.card_id));
      let q = supabase
        .from('consortium_cards')
        .select('id,nome_completo,razao_social,grupo,cota,valor_credito,data_contratacao,status')
        .order('created_at', { ascending: false })
        .limit(50);
      if (search.trim()) {
        q = q.or(
          `nome_completo.ilike.%${search}%,razao_social.ilike.%${search}%,grupo.ilike.%${search}%,cota.ilike.%${search}%`,
        );
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).filter((c: any) => !exclude.has(c.id));
    },
  });
}