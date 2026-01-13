import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  ConsorcioCard, 
  ConsorcioCardWithDetails, 
  ConsorcioInstallment,
  ConsorcioPartner,
  ConsorcioDocument,
  ConsorcioSummary,
  CreateConsorcioCardInput,
  TipoProduto
} from '@/types/consorcio';
import { calcularComissao, calcularComissaoTotal } from '@/lib/commissionCalculator';
import { calcularDataVencimento } from '@/lib/businessDays';
import { toast } from 'sonner';

interface ConsorcioFilters {
  startDate?: Date;
  endDate?: Date;
  status?: string;
  tipoProduto?: string;
  vendedorId?: string;
  categoria?: 'inside' | 'life';
}

export function useConsorcioCards(filters: ConsorcioFilters = {}) {
  return useQuery({
    queryKey: ['consortium-cards', filters],
    queryFn: async () => {
      let query = supabase
        .from('consortium_cards')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters.startDate) {
        query = query.gte('data_contratacao', filters.startDate.toISOString().split('T')[0]);
      }
      if (filters.endDate) {
        query = query.lte('data_contratacao', filters.endDate.toISOString().split('T')[0]);
      }
      if (filters.status && filters.status !== 'todos') {
        query = query.eq('status', filters.status);
      }
      if (filters.tipoProduto && filters.tipoProduto !== 'todos') {
        query = query.eq('tipo_produto', filters.tipoProduto);
      }
      if (filters.vendedorId) {
        query = query.eq('vendedor_id', filters.vendedorId);
      }
      if (filters.categoria) {
        query = query.eq('categoria', filters.categoria);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ConsorcioCard[];
    },
  });
}

export function useConsorcioCardDetails(cardId: string | null) {
  return useQuery({
    queryKey: ['consortium-card-details', cardId],
    queryFn: async () => {
      if (!cardId) return null;

      const [cardResult, installmentsResult, partnersResult, documentsResult] = await Promise.all([
        supabase.from('consortium_cards').select('*').eq('id', cardId).single(),
        supabase.from('consortium_installments').select('*').eq('card_id', cardId).order('numero_parcela'),
        supabase.from('consortium_pj_partners').select('*').eq('card_id', cardId),
        supabase.from('consortium_documents').select('*').eq('card_id', cardId),
      ]);

      if (cardResult.error) throw cardResult.error;

      return {
        ...cardResult.data,
        installments: installmentsResult.data || [],
        partners: partnersResult.data || [],
        documents: documentsResult.data || [],
      } as ConsorcioCardWithDetails;
    },
    enabled: !!cardId,
  });
}

export function useConsorcioSummary(filters: ConsorcioFilters = {}) {
  return useQuery({
    queryKey: ['consortium-summary', filters],
    queryFn: async () => {
      let query = supabase.from('consortium_cards').select('*');

      if (filters.startDate) {
        query = query.gte('data_contratacao', filters.startDate.toISOString().split('T')[0]);
      }
      if (filters.endDate) {
        query = query.lte('data_contratacao', filters.endDate.toISOString().split('T')[0]);
      }
      if (filters.categoria) {
        query = query.eq('categoria', filters.categoria);
      }

      const { data: cards, error: cardsError } = await query;
      if (cardsError) throw cardsError;

      // Get all installments for these cards
      const cardIds = cards?.map(c => c.id) || [];
      const { data: installments } = await supabase
        .from('consortium_installments')
        .select('*')
        .in('card_id', cardIds);

      const summary: ConsorcioSummary = {
        totalCartas: cards?.length || 0,
        totalCredito: cards?.reduce((acc, c) => acc + Number(c.valor_credito), 0) || 0,
        comissaoTotal: 0,
        comissaoRecebida: 0,
        comissaoPendente: 0,
        cartasSelect: cards?.filter(c => c.tipo_produto === 'select').length || 0,
        cartasParcelinha: cards?.filter(c => c.tipo_produto === 'parcelinha').length || 0,
      };

      // Calculate commissions from installments
      installments?.forEach(inst => {
        summary.comissaoTotal += Number(inst.valor_comissao);
        if (inst.status === 'pago') {
          summary.comissaoRecebida += Number(inst.valor_comissao);
        } else {
          summary.comissaoPendente += Number(inst.valor_comissao);
        }
      });

      return summary;
    },
  });
}

export function useCreateConsorcioCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateConsorcioCardInput) => {
      // 1. Create the card
      const { partners, ...cardData } = input;
      
      const { data: card, error: cardError } = await supabase
        .from('consortium_cards')
        .insert(cardData)
        .select()
        .single();

      if (cardError) throw cardError;

      // 2. Create partners if PJ
      if (input.tipo_pessoa === 'pj' && partners && partners.length > 0) {
        const partnersData = partners.map(p => ({
          card_id: card.id,
          nome: p.nome,
          cpf: p.cpf,
          renda: p.renda,
        }));

        const { error: partnersError } = await supabase
          .from('consortium_pj_partners')
          .insert(partnersData);

        if (partnersError) throw partnersError;
      }

      // 3. Generate installments
      const dataContratacao = new Date(input.data_contratacao);
      const installments: Omit<ConsorcioInstallment, 'id' | 'created_at' | 'updated_at'>[] = [];

      for (let i = 1; i <= input.prazo_meses; i++) {
        const dataVencimento = calcularDataVencimento(dataContratacao, input.dia_vencimento, i);
        const valorComissao = calcularComissao(input.valor_credito, input.tipo_produto, i);
        
        // Determine if this installment is paid by client or company
        let tipo: 'cliente' | 'empresa';
        if (input.tipo_contrato === 'intercalado') {
          // Intercalado: empresa paga parcelas ímpares, cliente paga pares (ou vice-versa)
          tipo = i % 2 === 1 ? 'empresa' : 'cliente';
        } else {
          // Normal: empresa paga as primeiras N parcelas
          tipo = i <= input.parcelas_pagas_empresa ? 'empresa' : 'cliente';
        }

        installments.push({
          card_id: card.id,
          numero_parcela: i,
          tipo,
          valor_parcela: input.valor_credito / input.prazo_meses, // Simplified calculation
          valor_comissao: valorComissao,
          data_vencimento: dataVencimento.toISOString().split('T')[0],
          status: 'pendente',
        });
      }

      const { error: installmentsError } = await supabase
        .from('consortium_installments')
        .insert(installments);

      if (installmentsError) throw installmentsError;

      return card;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consortium-cards'] });
      queryClient.invalidateQueries({ queryKey: ['consortium-summary'] });
      toast.success('Carta de consórcio criada com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao criar carta:', error);
      toast.error('Erro ao criar carta de consórcio');
    },
  });
}

export function useUpdateConsorcioCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, partners, ...cardData }: Partial<ConsorcioCard> & { 
      id: string; 
      partners?: Array<{ nome: string; cpf: string; renda?: number }> 
    }) => {
      // 1. Update the card (without partners field)
      const { error: cardError } = await supabase
        .from('consortium_cards')
        .update(cardData)
        .eq('id', id);

      if (cardError) throw cardError;

      // 2. Update partners if provided (for PJ cards)
      if (partners !== undefined) {
        // Delete existing partners
        const { error: deleteError } = await supabase
          .from('consortium_pj_partners')
          .delete()
          .eq('card_id', id);

        if (deleteError) throw deleteError;

        // Insert new partners
        if (partners && partners.length > 0) {
          const partnersData = partners.map(p => ({
            card_id: id,
            nome: p.nome,
            cpf: p.cpf,
            renda: p.renda,
          }));

          const { error: insertError } = await supabase
            .from('consortium_pj_partners')
            .insert(partnersData);

          if (insertError) throw insertError;
        }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['consortium-cards'] });
      queryClient.invalidateQueries({ queryKey: ['consortium-card-details', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['consortium-summary'] });
      toast.success('Carta atualizada com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao atualizar carta:', error);
      toast.error('Erro ao atualizar carta');
    },
  });
}

export function useDeleteConsorcioCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cardId: string) => {
      const { error } = await supabase
        .from('consortium_cards')
        .delete()
        .eq('id', cardId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consortium-cards'] });
      queryClient.invalidateQueries({ queryKey: ['consortium-summary'] });
      toast.success('Carta excluída com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao excluir carta:', error);
      toast.error('Erro ao excluir carta');
    },
  });
}

export function usePayInstallment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ installmentId, dataPagamento }: { installmentId: string; dataPagamento: string }) => {
      const { error } = await supabase
        .from('consortium_installments')
        .update({
          status: 'pago',
          data_pagamento: dataPagamento,
        })
        .eq('id', installmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consortium-card-details'] });
      queryClient.invalidateQueries({ queryKey: ['consortium-summary'] });
      toast.success('Parcela marcada como paga!');
    },
    onError: (error) => {
      console.error('Erro ao marcar parcela como paga:', error);
      toast.error('Erro ao atualizar parcela');
    },
  });
}

export function useConsorcioInstallments(cardId: string | null) {
  return useQuery({
    queryKey: ['consortium-installments', cardId],
    queryFn: async () => {
      if (!cardId) return [];

      const { data, error } = await supabase
        .from('consortium_installments')
        .select('*')
        .eq('card_id', cardId)
        .order('numero_parcela');

      if (error) throw error;
      return data as ConsorcioInstallment[];
    },
    enabled: !!cardId,
  });
}

export function useMyConsorcioCards(vendedorId: string | null) {
  return useQuery({
    queryKey: ['my-consortium-cards', vendedorId],
    queryFn: async () => {
      if (!vendedorId) return [];

      const { data, error } = await supabase
        .from('consortium_cards')
        .select('*')
        .eq('vendedor_id', vendedorId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ConsorcioCard[];
    },
    enabled: !!vendedorId,
  });
}
