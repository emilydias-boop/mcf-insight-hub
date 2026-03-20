import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BillingAgreement, BillingAgreementInstallment, BillingAgreementStatus } from '@/types/billing';

export interface AprovadoAgreementData {
  subscription: {
    id: string;
    status: string;
    valor_total_contrato: number;
    responsavel_financeiro: string | null;
    forma_pagamento: string | null;
  };
  agreements: BillingAgreement[];
  latestAgreement: BillingAgreement | null;
  installments: BillingAgreementInstallment[];
  parcelasPagas: number;
  totalParcelas: number;
  saldoDevedor: number;
  proximoVencimento: string | null;
  isOverdue: boolean;
}

export function useAprovadoAgreements(dealId: string | null) {
  return useQuery({
    queryKey: ['aprovado-agreements', dealId],
    queryFn: async (): Promise<AprovadoAgreementData | null> => {
      if (!dealId) return null;

      const { data: sub } = await supabase
        .from('billing_subscriptions')
        .select('id, status, valor_total_contrato, responsavel_financeiro, forma_pagamento')
        .eq('deal_id', dealId)
        .maybeSingle();

      if (!sub) return null;

      const { data: agreements } = await supabase
        .from('billing_agreements')
        .select('*')
        .eq('subscription_id', sub.id)
        .order('created_at', { ascending: false });

      const agreementsList = (agreements || []) as unknown as BillingAgreement[];
      const latestAgreement = agreementsList.length > 0 ? agreementsList[0] : null;

      let installments: BillingAgreementInstallment[] = [];
      let parcelasPagas = 0;
      let totalParcelas = 0;
      let saldoDevedor = 0;
      let proximoVencimento: string | null = null;
      let isOverdue = false;

      if (latestAgreement) {
        const { data: instData } = await supabase
          .from('billing_agreement_installments')
          .select('*')
          .eq('agreement_id', latestAgreement.id)
          .order('numero_parcela', { ascending: true });

        installments = (instData || []) as unknown as BillingAgreementInstallment[];
        totalParcelas = installments.length;
        parcelasPagas = installments.filter(i => i.status === 'pago').length;
        
        const totalValor = installments.reduce((s, i) => s + (i.valor || 0), 0);
        const totalPago = installments.filter(i => i.status === 'pago').reduce((s, i) => s + (i.valor || 0), 0);
        saldoDevedor = totalValor - totalPago;

        const pendentes = installments.filter(i => i.status !== 'pago').sort((a, b) => 
          new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime()
        );
        if (pendentes.length > 0) {
          proximoVencimento = pendentes[0].data_vencimento;
          isOverdue = new Date(pendentes[0].data_vencimento) < new Date();
        }
      }

      return {
        subscription: sub as any,
        agreements: agreementsList,
        latestAgreement,
        installments,
        parcelasPagas,
        totalParcelas,
        saldoDevedor,
        proximoVencimento,
        isOverdue,
      };
    },
    enabled: !!dealId,
  });
}

// Batch hook for list view - fetches agreement status for multiple deal_ids
export function useAprovadoAgreementsBatch(dealIds: string[]) {
  return useQuery({
    queryKey: ['aprovado-agreements-batch', dealIds.sort().join(',')],
    queryFn: async () => {
      if (dealIds.length === 0) return new Map<string, { status: BillingAgreementStatus; hasAgreement: boolean }>();

      // 1. Fetch subscriptions by deal_ids
      const { data: subs } = await supabase
        .from('billing_subscriptions')
        .select('id, deal_id')
        .in('deal_id', dealIds);

      if (!subs || subs.length === 0) return new Map();

      const subIds = subs.map(s => s.id);
      const subByDealId = new Map(subs.map(s => [s.deal_id, s.id]));

      // 2. Fetch latest agreement for each subscription
      const { data: agreements } = await supabase
        .from('billing_agreements')
        .select('id, subscription_id, status')
        .in('subscription_id', subIds)
        .order('created_at', { ascending: false });

      // Map: subscription_id -> latest agreement status
      const agreementBySubId = new Map<string, BillingAgreementStatus>();
      (agreements || []).forEach(a => {
        if (!agreementBySubId.has(a.subscription_id)) {
          agreementBySubId.set(a.subscription_id, a.status as BillingAgreementStatus);
        }
      });

      // 3. Build result map: deal_id -> { status, hasAgreement }
      const result = new Map<string, { status: BillingAgreementStatus; hasAgreement: boolean }>();
      dealIds.forEach(dealId => {
        const subId = subByDealId.get(dealId);
        if (subId && agreementBySubId.has(subId)) {
          result.set(dealId, {
            status: agreementBySubId.get(subId)!,
            hasAgreement: true,
          });
        }
      });

      return result;
    },
    enabled: dealIds.length > 0,
  });
}
