import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface R2PendingLead {
  id: string;
  attendee_name: string;
  attendee_phone: string | null;
  deal_id: string | null;
  status: string;
  contract_paid_at: string;
  contact_id: string | null;
  /** 'recente' = contrato pago nos últimos 30 dias | 'antigo' = antes disso */
  grupo?: 'recente' | 'antigo';
  /** Dias desde o pagamento do contrato (fuso America/Sao_Paulo). */
  dias_desde_contrato?: number;
  meeting_slot: {
    id: string;
    scheduled_at: string;
    closer_id: string | null;
    status?: string;
    closer?: {
      id: string;
      name: string;
    } | null;
  };
  deal?: {
    id: string;
    name: string;
    contact?: {
      id: string;
      name: string;
      phone: string | null;
      email: string | null;
    } | null;
  } | null;
}

/**
 * Leads com contrato pago na R1 que ainda não têm R2.
 *
 * Todo o cálculo (excluir reembolsados, compras de parceria, R2 agendada em
 * outro cadastro, reunião pós-contrato feita na agenda R1, dedup por contato)
 * é feito no banco pela RPC `r2_pendentes_agendar()`, que devolve uma linha
 * por lead já ordenada pelo contrato mais recente.
 */
export function useR2PendingLeads() {
  return useQuery({
    queryKey: ['r2-pending-leads'],
    queryFn: async (): Promise<R2PendingLead[]> => {
      const { data, error } = await supabase.rpc('r2_pendentes_agendar');
      if (error) throw error;

      return (data || []).map((r) => ({
        id: r.id,
        attendee_name: r.attendee_name ?? '',
        attendee_phone: r.attendee_phone ?? null,
        deal_id: r.deal_id ?? null,
        status: r.status ?? '',
        contract_paid_at: r.contract_paid_at,
        contact_id: r.contact_id ?? null,
        grupo: r.grupo === 'antigo' ? 'antigo' : 'recente',
        dias_desde_contrato: r.dias_desde_contrato ?? undefined,
        meeting_slot: {
          id: r.slot_id,
          scheduled_at: r.slot_scheduled_at,
          closer_id: r.slot_closer_id ?? null,
          status: r.slot_status ?? undefined,
          closer: r.r1_closer_id
            ? { id: r.r1_closer_id, name: r.r1_closer_name ?? '' }
            : null,
        },
        deal: r.deal_id
          ? {
              id: r.deal_id,
              name: r.deal_name ?? '',
              contact: r.contact_id
                ? {
                    id: r.contact_id,
                    name: r.contact_name ?? '',
                    phone: r.contact_phone ?? null,
                    email: r.contact_email ?? null,
                  }
                : null,
            }
          : null,
      })) as R2PendingLead[];
    },
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Get the count of pending R2 leads (badge da aba "Pendentes").
 * Conta apenas os leads do grupo 'recente' (contrato nos últimos 30 dias).
 */
export function useR2PendingLeadsCount() {
  const { data: pendingLeads } = useR2PendingLeads();
  return (pendingLeads || []).filter((lead) => lead.grupo === 'recente').length;
}

/**
 * Quebra dos pendentes em "safra atual" vs "semanas anteriores",
 * usando o contract_paid_at de cada lead vs. o corte de abertura
 * desta safra (previousCutoff do carrinho — Sex 12:00 da semana anterior).
 *
 * Regra: o ciclo do carrinho ABRE no corte da sexta. Quem pagou contrato antes
 * desse corte (mesmo na própria quinta da safra) é considerado "vindo de semana anterior".
 */
export function useR2PendingLeadsBreakdown(previousCutoff: Date | null | undefined) {
  const { data: pendingLeads } = useR2PendingLeads();
  const total = pendingLeads?.length || 0;
  if (!pendingLeads || !previousCutoff) {
    return { total, semanasAnteriores: 0, safraAtual: total };
  }
  const cutoffTs = previousCutoff.getTime();
  let semanasAnteriores = 0;
  for (const lead of pendingLeads) {
    const ref = lead.contract_paid_at;
    if (!ref) continue;
    const t = new Date(ref).getTime();
    if (!Number.isNaN(t) && t < cutoffTs) semanasAnteriores++;
  }
  return {
    total,
    semanasAnteriores,
    safraAtual: Math.max(0, total - semanasAnteriores),
  };
}
