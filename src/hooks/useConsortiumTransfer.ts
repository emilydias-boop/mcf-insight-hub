import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  ConsortiumTransfer,
  ConsortiumTransferBuyer,
  ConsortiumTransferFinancial,
  ConsortiumTransferDocument,
  PosContemplacaoDecisao,
} from '@/types/consorcioTransfer';

const db = supabase as any;

export function useActiveTransfer(cardId: string | null) {
  return useQuery({
    queryKey: ['consortium-transfer', cardId],
    enabled: !!cardId,
    queryFn: async (): Promise<ConsortiumTransfer | null> => {
      const { data, error } = await db
        .from('consortium_transfers')
        .select('*')
        .eq('card_id', cardId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as ConsortiumTransfer | null;
    },
  });
}

export function useTransferBuyer(transferId: string | null) {
  return useQuery({
    queryKey: ['consortium-transfer-buyer', transferId],
    enabled: !!transferId,
    queryFn: async (): Promise<ConsortiumTransferBuyer | null> => {
      const { data, error } = await db
        .from('consortium_transfer_buyers')
        .select('*')
        .eq('transfer_id', transferId)
        .maybeSingle();
      if (error) throw error;
      return data as ConsortiumTransferBuyer | null;
    },
  });
}

export function useTransferFinancials(transferId: string | null) {
  return useQuery({
    queryKey: ['consortium-transfer-financials', transferId],
    enabled: !!transferId,
    queryFn: async (): Promise<ConsortiumTransferFinancial[]> => {
      const { data, error } = await db
        .from('consortium_transfer_financials')
        .select('*')
        .eq('transfer_id', transferId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data as ConsortiumTransferFinancial[]) || [];
    },
  });
}

export function useTransferDocuments(transferId: string | null) {
  return useQuery({
    queryKey: ['consortium-transfer-documents', transferId],
    enabled: !!transferId,
    queryFn: async (): Promise<ConsortiumTransferDocument[]> => {
      const { data, error } = await db
        .from('consortium_transfer_documents')
        .select('*')
        .eq('transfer_id', transferId)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      return (data as ConsortiumTransferDocument[]) || [];
    },
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>, cardId?: string | null) {
  qc.invalidateQueries({ queryKey: ['consortium-transfer'] });
  qc.invalidateQueries({ queryKey: ['consortium-transfer-buyer'] });
  qc.invalidateQueries({ queryKey: ['consortium-transfer-financials'] });
  qc.invalidateQueries({ queryKey: ['consortium-transfer-documents'] });
  qc.invalidateQueries({ queryKey: ['consortium-card-history'] });
  if (cardId) {
    qc.invalidateQueries({ queryKey: ['consortium-card-details', cardId] });
  }
  qc.invalidateQueries({ queryKey: ['consorcio-cards'] });
}

export function useStartTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cardId: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await db
        .from('consortium_transfers')
        .insert({ card_id: cardId, created_by: userData?.user?.id })
        .select()
        .single();
      if (error) throw error;
      await db
        .from('consortium_cards')
        .update({
          pos_contemplacao_decisao: 'em_transferencia',
          data_decisao_pos_contemplacao: new Date().toISOString(),
        })
        .eq('id', cardId);
      return data;
    },
    onSuccess: (_d, cardId) => {
      toast.success('Processo de transferência iniciado');
      invalidate(qc, cardId);
    },
    onError: (e: any) => toast.error('Erro ao iniciar transferência: ' + e.message),
  });
}

export function useUpdateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, cardId, patch }: { id: string; cardId: string; patch: Partial<ConsortiumTransfer> }) => {
      const { error } = await db.from('consortium_transfers').update(patch).eq('id', id);
      if (error) throw error;
      return { id, cardId };
    },
    onSuccess: ({ cardId }) => {
      toast.success('Transferência atualizada');
      invalidate(qc, cardId);
    },
    onError: (e: any) => toast.error('Erro ao atualizar: ' + e.message),
  });
}

export function useUpsertTransferBuyer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (buyer: Partial<ConsortiumTransferBuyer> & { transfer_id: string }) => {
      const { data: existing } = await db
        .from('consortium_transfer_buyers')
        .select('id')
        .eq('transfer_id', buyer.transfer_id)
        .maybeSingle();
      if (existing?.id) {
        const { error } = await db.from('consortium_transfer_buyers').update(buyer).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await db.from('consortium_transfer_buyers').insert(buyer);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Dados do comprador salvos');
      invalidate(qc);
    },
    onError: (e: any) => toast.error('Erro ao salvar comprador: ' + e.message),
  });
}

export function useAddTransferFinancial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Partial<ConsortiumTransferFinancial> & { transfer_id: string; tipo: string; valor: number }) => {
      const { error } = await db.from('consortium_transfer_financials').insert(row);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Lançamento adicionado'); invalidate(qc); },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

export function useUpdateTransferFinancial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ConsortiumTransferFinancial> }) => {
      const { error } = await db.from('consortium_transfer_financials').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Lançamento atualizado'); invalidate(qc); },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

export function useDeleteTransferFinancial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('consortium_transfer_financials').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Lançamento removido'); invalidate(qc); },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

export function useSetPosContemplacaoDecisao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ cardId, decisao }: { cardId: string; decisao: PosContemplacaoDecisao }) => {
      const { error } = await db
        .from('consortium_cards')
        .update({
          pos_contemplacao_decisao: decisao,
          data_decisao_pos_contemplacao: new Date().toISOString(),
        })
        .eq('id', cardId);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => { toast.success('Decisão registrada'); invalidate(qc, vars.cardId); },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

export function useCotasAVenda() {
  return useQuery({
    queryKey: ['cotas-a-venda'],
    queryFn: async () => {
      const { data, error } = await db
        .from('consortium_cards')
        .select('id, grupo, cota, valor_credito, tipo_produto, nome_completo, razao_social, tipo_pessoa, motivo_contemplacao, data_contemplacao, vendedor_name, pos_contemplacao_decisao, data_decisao_pos_contemplacao')
        .eq('pos_contemplacao_decisao', 'a_venda')
        .order('data_decisao_pos_contemplacao', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}