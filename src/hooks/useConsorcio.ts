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
import { calcularDataVencimento, calcularProximoDiaUtil } from '@/lib/businessDays';
import { toast } from 'sonner';

interface ConsorcioFilters {
  startDate?: Date;
  endDate?: Date;
  status?: string;
  tipoProduto?: string;
  vendedorId?: string;
  categoria?: 'inside' | 'life';
  search?: string;
  diaVencimento?: number;
  grupo?: string;
  origem?: string;
}

export function useConsorcioCards(filters: ConsorcioFilters = {}) {
  return useQuery({
    queryKey: ['consortium-cards', filters],
    queryFn: async () => {
      let query = supabase
        .from('consortium_cards')
        .select(`
          *,
          consortium_installments(valor_comissao)
        `)
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
      if (filters.search) {
        query = query.or(`nome_completo.ilike.%${filters.search}%,telefone.ilike.%${filters.search}%,email.ilike.%${filters.search}%,razao_social.ilike.%${filters.search}%`);
      }
      if (filters.diaVencimento) {
        query = query.eq('dia_vencimento', filters.diaVencimento);
      }
      if (filters.grupo) {
        query = query.eq('grupo', filters.grupo);
      }
      if (filters.origem) {
        query = query.eq('origem', filters.origem);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Calculate total commission from installments for each card
      const cardsWithCommission = (data || []).map((card: any) => {
        const valorComissaoTotal = card.consortium_installments?.reduce(
          (sum: number, inst: { valor_comissao: number }) => sum + Number(inst.valor_comissao || 0),
          0
        ) || 0;
        
        // Remove raw installments data and add calculated total
        const { consortium_installments, ...cardData } = card;
        return {
          ...cardData,
          valor_comissao_total: valorComissaoTotal,
        } as ConsorcioCard;
      });
      
      return cardsWithCommission;
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
      let query = supabase.from('consortium_cards').select('id, valor_credito, tipo_produto');

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

      const cardIds = cards?.map(c => c.id) || [];
      
      // Use aggregation to avoid 1000 row limit
      // Fetch installments in batches to get accurate totals
      let comissaoTotal = 0;
      let comissaoRecebida = 0;
      let comissaoPendente = 0;

      if (cardIds.length > 0) {
        // Fetch sum of commissions per card to avoid row limit
        for (const cardId of cardIds) {
          const { data: installments } = await supabase
            .from('consortium_installments')
            .select('valor_comissao, status')
            .eq('card_id', cardId);

          installments?.forEach(inst => {
            const valor = Number(inst.valor_comissao);
            comissaoTotal += valor;
            if (inst.status === 'pago') {
              comissaoRecebida += valor;
            } else {
              comissaoPendente += valor;
            }
          });
        }
      }

      const summary: ConsorcioSummary = {
        totalCartas: cards?.length || 0,
        totalCredito: cards?.reduce((acc, c) => acc + Number(c.valor_credito), 0) || 0,
        comissaoTotal,
        comissaoRecebida,
        comissaoPendente,
        cartasSelect: cards?.filter(c => c.tipo_produto === 'select').length || 0,
        cartasParcelinha: cards?.filter(c => c.tipo_produto === 'parcelinha').length || 0,
      };

      return summary;
    },
  });
}

export function useCreateConsorcioCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateConsorcioCardInput) => {
      // 1. Create the card
      const { partners, inicio_segunda_parcela, ...cardData } = input;
      
      // Sanitizar campos vazios antes de enviar ao banco
      const cleanedData = Object.fromEntries(
        Object.entries(cardData).filter(([_, v]) => v !== '' && v !== undefined)
      );
      
      const { data: card, error: cardError } = await supabase
        .from('consortium_cards')
        .insert(cleanedData as any)
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

      // 3. Generate installments - Parse date without timezone issues
      const [year, month, day] = input.data_contratacao.split('-').map(Number);
      const dataContratacao = new Date(year, month - 1, day);
      
      // Determine offset for 2nd installment based on inicio_segunda_parcela
      const inicioSegunda = input.inicio_segunda_parcela || 'automatico';
      let offsetSegundaParcela: number;
      if (inicioSegunda === 'proximo_mes') {
        offsetSegundaParcela = 1;
      } else if (inicioSegunda === 'pular_mes') {
        offsetSegundaParcela = 2;
      } else {
        // automatico: if contract day > 16, skip 1 month
        offsetSegundaParcela = dataContratacao.getDate() > 16 ? 2 : 1;
      }
      
      const installments: Omit<ConsorcioInstallment, 'id' | 'created_at' | 'updated_at'>[] = [];

      for (let i = 1; i <= input.prazo_meses; i++) {
        let dataVencimento: Date;
        if (i === 1) {
          // Parcela 1 = data de contratação (já paga no ato)
          dataVencimento = dataContratacao;
        } else {
          // Parcela N: base month = contratação month + offset + (i-2)
          const monthOffset = offsetSegundaParcela + (i - 2);
          const mesAlvo = dataContratacao.getMonth() + monthOffset;
          const anoAlvo = dataContratacao.getFullYear() + Math.floor(mesAlvo / 12);
          const mesNormalizado = ((mesAlvo % 12) + 12) % 12;
          const ultimoDia = new Date(anoAlvo, mesNormalizado + 1, 0).getDate();
          const diaAjustado = Math.min(input.dia_vencimento, ultimoDia);
          dataVencimento = calcularProximoDiaUtil(new Date(anoAlvo, mesNormalizado, diaAjustado));
        }
        const valorComissao = calcularComissao(input.valor_credito, input.tipo_produto, i);
        
        // Determine if this installment is paid by client or company
        let tipo: 'cliente' | 'empresa';
        if (input.tipo_contrato === 'intercalado') {
          // Intercalado PAR: empresa paga as primeiras N parcelas PARES (2, 4, 6, 8...)
          const ehPar = i % 2 === 0;
          const qualParcelaParEhEssa = i / 2; // 2→1, 4→2, 6→3, 8→4...
          tipo = (ehPar && qualParcelaParEhEssa <= input.parcelas_pagas_empresa) ? 'empresa' : 'cliente';
        } else if (input.tipo_contrato === 'intercalado_impar') {
          // Intercalado ÍMPAR: empresa paga as primeiras N parcelas ÍMPARES (1, 3, 5, 7...)
          const ehImpar = i % 2 === 1;
          const qualParcelaImparEhEssa = Math.ceil(i / 2); // 1→1, 3→2, 5→3, 7→4...
          tipo = (ehImpar && qualParcelaImparEhEssa <= input.parcelas_pagas_empresa) ? 'empresa' : 'cliente';
        } else {
          // Normal: empresa paga as primeiras N parcelas sequenciais
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
    onError: (error: any) => {
      console.error('Erro ao criar carta:', error);
      toast.error(`Erro ao criar carta: ${error?.message || 'Erro desconhecido'}`);
    },
  });
}

export function useUpdateConsorcioCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, partners, inicio_segunda_parcela, ...cardData }: Partial<ConsorcioCard> & { 
      id: string; 
      partners?: Array<{ nome: string; cpf: string; renda?: number }>;
      inicio_segunda_parcela?: string;
    }) => {
      // 0. Check if tipo_produto is changing - need to recalculate commissions
      let shouldRecalculateCommissions = false;
      let newTipoProduto: TipoProduto | undefined;
      let newValorCredito: number | undefined;

      if (cardData.tipo_produto || cardData.valor_credito) {
        // Fetch current card to compare
        const { data: currentCard, error: fetchError } = await supabase
          .from('consortium_cards')
          .select('tipo_produto, valor_credito')
          .eq('id', id)
          .single();

        if (fetchError) throw fetchError;

        const tipoProdutoChanged = cardData.tipo_produto && cardData.tipo_produto !== currentCard.tipo_produto;
        const valorCreditoChanged = cardData.valor_credito && Number(cardData.valor_credito) !== Number(currentCard.valor_credito);

        if (tipoProdutoChanged || valorCreditoChanged) {
          shouldRecalculateCommissions = true;
          newTipoProduto = (cardData.tipo_produto || currentCard.tipo_produto) as TipoProduto;
          newValorCredito = Number(cardData.valor_credito || currentCard.valor_credito);
        }
      }

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

      // 3. Recalculate commissions if tipo_produto or valor_credito changed
      if (shouldRecalculateCommissions && newTipoProduto && newValorCredito) {
        const { data: installments, error: instError } = await supabase
          .from('consortium_installments')
          .select('id, numero_parcela, valor_comissao')
          .eq('card_id', id);

        if (instError) throw instError;

        for (const inst of installments || []) {
          const comissaoCorreta = calcularComissao(newValorCredito, newTipoProduto, inst.numero_parcela);

          if (Math.abs(Number(inst.valor_comissao) - comissaoCorreta) > 0.01) {
            const { error: updateError } = await supabase
              .from('consortium_installments')
              .update({ valor_comissao: comissaoCorreta })
              .eq('id', inst.id);

            if (updateError) throw updateError;
          }
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

export function useUpdateCardStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      cardId, 
      status,
      numeroContemplacao,
      dataContemplacao,
      motivoContemplacao,
      valorLance,
      percentualLance,
    }: { 
      cardId: string; 
      status: string;
      numeroContemplacao?: string;
      dataContemplacao?: string;
      motivoContemplacao?: string;
      valorLance?: number;
      percentualLance?: number;
    }) => {
      const updateData: Record<string, unknown> = { status };
      
      if (numeroContemplacao !== undefined) {
        updateData.numero_contemplacao = numeroContemplacao;
      }
      if (dataContemplacao !== undefined) {
        updateData.data_contemplacao = dataContemplacao;
      }
      if (motivoContemplacao !== undefined) {
        updateData.motivo_contemplacao = motivoContemplacao;
      }
      if (valorLance !== undefined) {
        updateData.valor_lance = valorLance;
      }
      if (percentualLance !== undefined) {
        updateData.percentual_lance = percentualLance;
      }

      const { error } = await supabase
        .from('consortium_cards')
        .update(updateData)
        .eq('id', cardId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['consortium-cards'] });
      queryClient.invalidateQueries({ queryKey: ['consortium-card-details', variables.cardId] });
      queryClient.invalidateQueries({ queryKey: ['consortium-summary'] });
      toast.success('Status atualizado com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');
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

export function useUpdateInstallment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      tipo: 'cliente' | 'empresa';
      valor_parcela: number;
      valor_comissao: number;
      data_vencimento: string;
      data_pagamento?: string | null;
      status: 'pendente' | 'pago' | 'atrasado';
      observacao?: string;
    }) => {
      const { id, ...updateData } = data;
      
      const { error } = await supabase
        .from('consortium_installments')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consortium-card-details'] });
      queryClient.invalidateQueries({ queryKey: ['consortium-installments'] });
      queryClient.invalidateQueries({ queryKey: ['consortium-summary'] });
      toast.success('Parcela atualizada com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao atualizar parcela:', error);
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
