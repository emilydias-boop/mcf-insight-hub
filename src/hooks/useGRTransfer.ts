import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Hook para transferir entrada entre carteiras
export const useTransferGREntry = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({
      entryId,
      fromWalletId,
      toWalletId,
      reason,
    }: {
      entryId: string;
      fromWalletId: string;
      toWalletId: string;
      reason?: string;
    }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      
      // 1. Registrar log de transferência
      const { error: logError } = await supabase
        .from('gr_transfers_log')
        .insert({
          entry_id: entryId,
          from_wallet_id: fromWalletId,
          to_wallet_id: toWalletId,
          reason,
          transferred_by: user.id,
        });
      
      if (logError) throw logError;
      
      // 2. Atualizar a entrada para a nova carteira
      const { data, error } = await supabase
        .from('gr_wallet_entries')
        .update({
          wallet_id: toWalletId,
          status: 'ativo', // Reset status ao transferir
        })
        .eq('id', entryId)
        .select()
        .single();
      
      if (error) throw error;
      
      // 3. Registrar ação de transferência
      await supabase
        .from('gr_actions')
        .insert({
          entry_id: entryId,
          action_type: 'status_change',
          description: `Transferido para outra carteira. Motivo: ${reason || 'Não informado'}`,
          performed_by: user.id,
          metadata: {
            from_wallet_id: fromWalletId,
            to_wallet_id: toWalletId,
            reason,
          },
        });
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gr-wallet-entries'] });
      queryClient.invalidateQueries({ queryKey: ['all-gr-wallets'] });
      queryClient.invalidateQueries({ queryKey: ['my-gr-wallet'] });
      toast.success('Cliente transferido com sucesso');
    },
    onError: (error: any) => {
      toast.error(`Erro ao transferir: ${error.message}`);
    },
  });
};

// Hook para distribuição automática
export const useDistributeToGR = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      transactionId,
      customerName,
      customerEmail,
      customerPhone,
      product,
      value,
      dealId,
      contactId,
      bu,
    }: {
      transactionId: string;
      customerName: string;
      customerEmail: string;
      customerPhone?: string;
      product: string;
      value: number;
      dealId?: string;
      contactId?: string;
      bu?: string;
    }) => {
      const { data, error } = await supabase.rpc('assign_partner_to_gr', {
        p_transaction_id: transactionId,
        p_customer_name: customerName,
        p_customer_email: customerEmail,
        p_customer_phone: customerPhone || null,
        p_product: product,
        p_value: value,
        p_deal_id: dealId || null,
        p_contact_id: contactId || null,
        p_bu: bu || 'incorporador',
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gr-wallet-entries'] });
      queryClient.invalidateQueries({ queryKey: ['all-gr-wallets'] });
      toast.success('Cliente distribuído para GR');
    },
    onError: (error: any) => {
      toast.error(`Erro na distribuição: ${error.message}`);
    },
  });
};
