import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { addDays, format, differenceInCalendarDays } from 'date-fns';
import { isDiaUtil } from '@/lib/businessDays';

export type CobrancaAlertPriority = 'urgente' | 'atencao';

export interface ConsorcioAlert {
  installment_id: string;
  card_id: string;
  nome_completo: string;
  grupo: string | null;
  cota: string | null;
  numero_parcela: number;
  valor_parcela: number;
  data_vencimento: string;
  dias_para_vencer: number;
  priority: CobrancaAlertPriority;
  tem_acao: boolean;
  ultima_acao: string | null;
}

export interface BillingAlert {
  installment_id: string;
  subscription_id: string;
  customer_name: string;
  product_name: string;
  numero_parcela: number;
  valor_original: number;
  data_vencimento: string;
  dias_para_vencer: number;
  priority: CobrancaAlertPriority;
  tem_acao: boolean;
  ultima_acao: string | null;
}

function getNextBusinessDays(count: number): string {
  let date = new Date();
  let businessDaysFound = 0;
  while (businessDaysFound < count) {
    date = addDays(date, 1);
    if (isDiaUtil(date)) businessDaysFound++;
  }
  return format(date, 'yyyy-MM-dd');
}

function getPriority(diasParaVencer: number): CobrancaAlertPriority {
  return diasParaVencer <= 2 ? 'urgente' : 'atencao';
}

export function useConsorcioCobrancaAlerts() {
  return useQuery({
    queryKey: ['consorcio-cobranca-alerts'],
    queryFn: async (): Promise<ConsorcioAlert[]> => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const limitDate = getNextBusinessDays(5);

      // Get upcoming installments
      const { data: installments, error } = await supabase
        .from('consortium_installments')
        .select(`
          id,
          card_id,
          numero_parcela,
          valor_parcela,
          data_vencimento,
          status,
          consortium_cards!consortium_installments_card_id_fkey(
            nome_completo, grupo, cota
          )
        `)
        .in('status', ['pendente', 'atrasado'])
        .gte('data_vencimento', today)
        .lte('data_vencimento', limitDate)
        .order('data_vencimento', { ascending: true })
        .limit(500);

      if (error) throw error;
      if (!installments?.length) return [];

      // Get existing actions for these installments
      const installmentIds = installments.map(i => i.id);
      const { data: acoes } = await supabase
        .from('cobranca_acoes')
        .select('installment_id, tipo_acao, created_at')
        .in('installment_id', installmentIds)
        .order('created_at', { ascending: false });

      const acoesMap = new Map<string, { tipo_acao: string; created_at: string }>();
      acoes?.forEach(a => {
        if (a.installment_id && !acoesMap.has(a.installment_id)) {
          acoesMap.set(a.installment_id, { tipo_acao: a.tipo_acao, created_at: a.created_at });
        }
      });

      return installments
        .map(inst => {
          const card = inst.consortium_cards as any;
          const dias = differenceInCalendarDays(new Date(inst.data_vencimento), new Date());
          const acao = acoesMap.get(inst.id);
          return {
            installment_id: inst.id,
            card_id: inst.card_id,
            nome_completo: card?.nome_completo || 'Sem nome',
            grupo: card?.grupo || null,
            cota: card?.cota || null,
            numero_parcela: inst.numero_parcela,
            valor_parcela: Number(inst.valor_parcela),
            data_vencimento: inst.data_vencimento,
            dias_para_vencer: dias,
            priority: getPriority(dias),
            tem_acao: !!acao,
            ultima_acao: acao?.tipo_acao || null,
          };
        })
        .filter(a => !a.tem_acao); // Only show alerts without actions
    },
  });
}

export function useBillingCobrancaAlerts() {
  return useQuery({
    queryKey: ['billing-cobranca-alerts'],
    queryFn: async (): Promise<BillingAlert[]> => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const limitDate = getNextBusinessDays(5);

      const { data: installments, error } = await supabase
        .from('billing_installments')
        .select(`
          id,
          subscription_id,
          numero_parcela,
          valor_original,
          data_vencimento,
          status,
          billing_subscriptions!billing_installments_subscription_id_fkey(
            customer_name, product_name
          )
        `)
        .in('status', ['pendente', 'atrasado'])
        .gte('data_vencimento', today)
        .lte('data_vencimento', limitDate)
        .order('data_vencimento', { ascending: true })
        .limit(500);

      if (error) throw error;
      if (!installments?.length) return [];

      const installmentIds = installments.map(i => i.id);
      const { data: acoes } = await supabase
        .from('cobranca_acoes')
        .select('billing_installment_id, tipo_acao, created_at')
        .in('billing_installment_id', installmentIds)
        .order('created_at', { ascending: false });

      const acoesMap = new Map<string, { tipo_acao: string; created_at: string }>();
      acoes?.forEach(a => {
        if (a.billing_installment_id && !acoesMap.has(a.billing_installment_id)) {
          acoesMap.set(a.billing_installment_id, { tipo_acao: a.tipo_acao, created_at: a.created_at });
        }
      });

      return installments
        .map(inst => {
          const sub = inst.billing_subscriptions as any;
          const dias = differenceInCalendarDays(new Date(inst.data_vencimento), new Date());
          const acao = acoesMap.get(inst.id);
          return {
            installment_id: inst.id,
            subscription_id: inst.subscription_id,
            customer_name: sub?.customer_name || 'Sem nome',
            product_name: sub?.product_name || '',
            numero_parcela: inst.numero_parcela,
            valor_original: Number(inst.valor_original),
            data_vencimento: inst.data_vencimento,
            dias_para_vencer: dias,
            priority: getPriority(dias),
            tem_acao: !!acao,
            ultima_acao: acao?.tipo_acao || null,
          };
        })
        .filter(a => !a.tem_acao);
    },
  });
}
