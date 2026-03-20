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

// Hook for vendas list - fetches agreement data by customer emails
export function useAgreementsByEmails(emails: string[]) {
  const uniqueEmails = [...new Set(emails.filter(Boolean).map(e => e.toLowerCase()))];
  
  return useQuery({
    queryKey: ['agreements-by-emails', uniqueEmails.sort().join(',')],
    queryFn: async () => {
      if (uniqueEmails.length === 0) return new Map<string, AgreementByEmailData>();

      // 1. Fetch subscriptions by customer_email
      const { data: subs } = await supabase
        .from('billing_subscriptions')
        .select('id, customer_email, deal_id')
        .in('customer_email', uniqueEmails);

      if (!subs || subs.length === 0) return new Map<string, AgreementByEmailData>();

      const subIds = subs.map(s => s.id);
      const subByEmail = new Map<string, { subId: string; dealId: string | null }>();
      subs.forEach(s => {
        if (s.customer_email) {
          subByEmail.set(s.customer_email.toLowerCase(), { subId: s.id, dealId: s.deal_id });
        }
      });

      // 2. Fetch latest agreement per subscription
      const { data: agreements } = await supabase
        .from('billing_agreements')
        .select('id, subscription_id, status')
        .in('subscription_id', subIds)
        .order('created_at', { ascending: false });

      const latestAgreementBySubId = new Map<string, { agreementId: string; status: BillingAgreementStatus }>();
      (agreements || []).forEach(a => {
        if (!latestAgreementBySubId.has(a.subscription_id)) {
          latestAgreementBySubId.set(a.subscription_id, { agreementId: a.id, status: a.status as BillingAgreementStatus });
        }
      });

      // 3. Fetch installments for agreements that exist
      const agreementIds = [...latestAgreementBySubId.values()].map(a => a.agreementId);
      let installmentsByAgreement = new Map<string, { pagas: number; total: number }>();
      
      if (agreementIds.length > 0) {
        const { data: installments } = await supabase
          .from('billing_agreement_installments')
          .select('agreement_id, status')
          .in('agreement_id', agreementIds);

        (installments || []).forEach(inst => {
          const current = installmentsByAgreement.get(inst.agreement_id) || { pagas: 0, total: 0 };
          current.total++;
          if (inst.status === 'pago') current.pagas++;
          installmentsByAgreement.set(inst.agreement_id, current);
        });
      }

      // 4. Build result map: email -> data
      const result = new Map<string, AgreementByEmailData>();
      uniqueEmails.forEach(email => {
        const sub = subByEmail.get(email);
        if (!sub) return;

        const agreement = latestAgreementBySubId.get(sub.subId);
        const installments = agreement ? installmentsByAgreement.get(agreement.agreementId) : undefined;

        result.set(email, {
          subscriptionId: sub.subId,
          hasAgreement: !!agreement,
          status: agreement?.status || null,
          parcelasPagas: installments?.pagas || 0,
          totalParcelas: installments?.total || 0,
        });
      });

      return result;
    },
    enabled: uniqueEmails.length > 0,
  });
}

export interface AgreementByEmailData {
  subscriptionId: string;
  hasAgreement: boolean;
  status: BillingAgreementStatus | null;
  parcelasPagas: number;
  totalParcelas: number;
}
