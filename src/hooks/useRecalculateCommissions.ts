import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { calcularComissao } from '@/lib/commissionCalculator';
import { TipoProduto } from '@/types/consorcio';
import { toast } from 'sonner';

interface RecalculateResult {
  cardId: string;
  totalAntes: number;
  totalDepois: number;
  parcelasAtualizadas: number;
}

export function useRecalculateCommissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cardId: string): Promise<RecalculateResult> => {
      // 1. Fetch card data
      const { data: card, error: cardError } = await supabase
        .from('consortium_cards')
        .select('valor_credito, tipo_produto')
        .eq('id', cardId)
        .single();

      if (cardError) throw cardError;

      // 2. Fetch all installments
      const { data: installments, error: instError } = await supabase
        .from('consortium_installments')
        .select('id, numero_parcela, valor_comissao')
        .eq('card_id', cardId)
        .order('numero_parcela');

      if (instError) throw instError;

      const tipoProduto = card.tipo_produto as TipoProduto;
      const valorCredito = Number(card.valor_credito);
      
      let totalAntes = 0;
      let totalDepois = 0;
      let parcelasAtualizadas = 0;

      // 3. Recalculate each installment
      for (const inst of installments || []) {
        const comissaoCorreta = calcularComissao(valorCredito, tipoProduto, inst.numero_parcela);
        totalAntes += Number(inst.valor_comissao);
        totalDepois += comissaoCorreta;

        // Only update if different
        if (Math.abs(Number(inst.valor_comissao) - comissaoCorreta) > 0.01) {
          const { error: updateError } = await supabase
            .from('consortium_installments')
            .update({ valor_comissao: comissaoCorreta })
            .eq('id', inst.id);

          if (updateError) throw updateError;
          parcelasAtualizadas++;
        }
      }

      return {
        cardId,
        totalAntes,
        totalDepois,
        parcelasAtualizadas,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['consortium-card-details', result.cardId] });
      queryClient.invalidateQueries({ queryKey: ['consortium-summary'] });
      
      if (result.parcelasAtualizadas > 0) {
        toast.success(`Comissões recalculadas! ${result.parcelasAtualizadas} parcelas atualizadas.`);
      } else {
        toast.info('Comissões já estavam corretas.');
      }
    },
    onError: (error) => {
      console.error('Erro ao recalcular comissões:', error);
      toast.error('Erro ao recalcular comissões');
    },
  });
}

// Function to recalculate all cards
export function useRecalculateAllCommissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<{ total: number; atualizadas: number }> => {
      // 1. Fetch all cards
      const { data: cards, error: cardsError } = await supabase
        .from('consortium_cards')
        .select('id, valor_credito, tipo_produto');

      if (cardsError) throw cardsError;

      let totalAtualizadas = 0;

      for (const card of cards || []) {
        const tipoProduto = card.tipo_produto as TipoProduto;
        const valorCredito = Number(card.valor_credito);

        // Fetch installments for this card
        const { data: installments, error: instError } = await supabase
          .from('consortium_installments')
          .select('id, numero_parcela, valor_comissao')
          .eq('card_id', card.id);

        if (instError) throw instError;

        for (const inst of installments || []) {
          const comissaoCorreta = calcularComissao(valorCredito, tipoProduto, inst.numero_parcela);

          if (Math.abs(Number(inst.valor_comissao) - comissaoCorreta) > 0.01) {
            const { error: updateError } = await supabase
              .from('consortium_installments')
              .update({ valor_comissao: comissaoCorreta })
              .eq('id', inst.id);

            if (updateError) throw updateError;
            totalAtualizadas++;
          }
        }
      }

      return {
        total: cards?.length || 0,
        atualizadas: totalAtualizadas,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['consortium-cards'] });
      queryClient.invalidateQueries({ queryKey: ['consortium-card-details'] });
      queryClient.invalidateQueries({ queryKey: ['consortium-summary'] });
      
      toast.success(`Processadas ${result.total} cartas. ${result.atualizadas} parcelas atualizadas.`);
    },
    onError: (error) => {
      console.error('Erro ao recalcular comissões:', error);
      toast.error('Erro ao recalcular comissões');
    },
  });
}
