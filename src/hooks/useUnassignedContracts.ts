import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface UnassignedContractItem {
  deal_id: string | null;
  source: 'caucao_sem_deal' | 'caucao_sem_r1' | 'caucao_sem_sdr' | 'transacao_sem_reuniao';
  segment: 'A' | 'B' | 'C' | null;
  reference: string;
  /** Data do pagamento da caução/contrato (ISO). */
  paid_at?: string | null;
  /** Valor do negócio/transação quando disponível. */
  value?: number | null;
  /** Motivo legível da não atribuição. */
  reason?: string;
  /** Closer/SDR identificável no slot (sugestão de atribuição). */
  suggested?: string | null;
  /** Transação Hubla/MCF Pay órfã (só nas linhas 'transacao_sem_reuniao'). */
  transaction_id?: string | null;
}

export interface UnassignedContracts {
  total: number;
  a: number;
  b: number;
  /** Segmento C — contado explicitamente para não cair no resíduo "sem ICP". */
  c: number;
  unknown: number;
  /** Órfãos que nem os SDRs conseguem atribuir (inclui R1 sem booked_by). */
  sdrTotal: number;
  sdrA: number;
  sdrB: number;
  sdrC: number;
  items: UnassignedContractItem[];
  /** Mesma lista, na ótica da aba SDRs. */
  sdrItems: UnassignedContractItem[];
}

const EMPTY: UnassignedContracts = {
  total: 0, a: 0, b: 0, c: 0, unknown: 0, sdrTotal: 0, sdrA: 0, sdrB: 0, sdrC: 0,
  items: [], sdrItems: [],
};

/**
 * Cauções do período (régua nova: data da transação A000/Contrato + closer da
 * última R1 do negócio) que ainda NÃO conseguem ser atribuídas a um Closer
 * (aba Closers) ou SDR (aba SDRs).
 *
 * Motivos cobertos:
 *  - caução sem negócio no CRM (sem deal → sem segmento/R1);
 *  - caução de negócio sem nenhuma R1 registrada (closer não identificável);
 *  - caução cuja R1 não tem SDR que agendou → só órfã na aba SDRs;
 *  - transação A000/Contrato paga sem nenhuma caução marcada.
 */
export function useUnassignedContracts(
  startDate: Date,
  endDate: Date,
  bu: string = 'incorporador',
) {
  return useQuery({
    queryKey: ['unassigned-contracts', format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd'), bu],
    queryFn: async (): Promise<UnassignedContracts> => {

      // Régua nova: cauções efetivas do período (data da transação + closer da R1).
      const { data: caucoes, error } = await (supabase as any).rpc('caucoes_efetivas', {
        p_from: format(startDate, 'yyyy-MM-dd'),
        p_to: format(endDate, 'yyyy-MM-dd'),
        p_bu: bu,
      });
      if (error) throw error;

      const rows = ((caucoes as any[]) || []);
      // Segmento C também é reconhecido: sem isso, um contrato não atribuído de
      // lead C caía silenciosamente no resíduo "sem ICP".
      const segOf = (s: any): 'A' | 'B' | 'C' | null => {
        const v = String(s || '').toUpperCase();
        return v === 'A' || v === 'B' || v === 'C' ? (v as 'A' | 'B' | 'C') : null;
      };

      const items: UnassignedContractItem[] = [];
      const sdrItems: UnassignedContractItem[] = [];

      rows.forEach((r: any) => {
        const base = {
          deal_id: (r.deal_id as string | null) ?? null,
          segment: segOf(r.segment),
          reference: r.lead_name || r.attendee_id,
          paid_at: r.eff_date ?? r.contract_paid_at ?? null,
          value: r.valor ?? null,
        };

        if (!r.closer_id) {
          const item: UnassignedContractItem = {
            ...base,
            source: r.deal_id ? 'caucao_sem_r1' : 'caucao_sem_deal',
            reason: r.deal_id
              ? 'Negócio sem nenhuma R1 registrada — não há closer para atribuir'
              : 'Caução sem negócio vinculado no CRM (sem R1 e sem segmento)',
            suggested: r.sdr_name || null,
          };
          items.push(item);
          sdrItems.push(item);
          return;
        }

        // Com closer: entra na aba Closers; pode faltar o SDR da R1.
        if (!r.sdr_id) {
          sdrItems.push({
            ...base,
            source: 'caucao_sem_sdr',
            reason: 'R1 do negócio sem SDR que agendou (booked_by vazio)',
            suggested: r.closer_name || null,
          });
        }
      });

      // Contratos pagos no período sem caução marcada ("órfãos").
      //
      // A régua dos órfãos agora mora na RPC caucoes_orfas (fonte única, a mesma
      // da Visão Diária): já exclui recorrência e recompra e casa a pessoa por
      // e-mail, telefone, CPF e negócio vinculado.
      if (bu === 'incorporador') {
        const { data: orfas, error: orfasError } = await (supabase as any).rpc('caucoes_orfas', {
          p_from: format(startDate, 'yyyy-MM-dd'),
          p_to: format(endDate, 'yyyy-MM-dd'),
        });
        if (orfasError) throw orfasError;

        const orfasRows = (orfas as any[]) || [];

        // Segmento dos deals vinculados (quando existirem)
        const orfasDealIds = Array.from(
          new Set(orfasRows.map((r: any) => r.linked_deal_id).filter(Boolean) as string[]),
        );
        const segByDeal = new Map<string, 'A' | 'B' | 'C' | null>();
        if (orfasDealIds.length > 0) {
          const { data: deals } = await supabase
            .from('crm_deals')
            .select('id, icp_segment')
            .in('id', orfasDealIds);
          (deals || []).forEach((d: any) => {
            segByDeal.set(d.id, segOf(d.icp_segment));
          });
        }

        orfasRows.forEach((r: any) => {
          const item: UnassignedContractItem = {
            deal_id: r.linked_deal_id ?? null,
            source: 'transacao_sem_reuniao',
            segment: r.linked_deal_id ? segByDeal.get(r.linked_deal_id) ?? null : null,
            reference: r.customer_name || r.transaction_id,
            paid_at: r.sale_date ?? null,
            value: r.net_value ?? null,
            reason: r.linked_deal_id
              ? 'Transação de contrato paga sem reunião/caução marcada no período'
              : 'Transação de contrato paga sem negócio vinculado no CRM',
            suggested: null,
            transaction_id: r.transaction_id,
          };
          items.push(item);
          sdrItems.push(item);
        });
      }

      const count = (list: UnassignedContractItem[], seg: 'A' | 'B' | 'C' | null) =>
        list.filter((i) => i.segment === seg).length;

      return {
        total: items.length,
        a: count(items, 'A'),
        b: count(items, 'B'),
        c: count(items, 'C'),
        unknown: count(items, null),
        sdrTotal: sdrItems.length,
        sdrA: count(sdrItems, 'A'),
        sdrB: count(sdrItems, 'B'),
        sdrC: count(sdrItems, 'C'),
        items,
        sdrItems,
      };
    },
    staleTime: 60_000,
  });
}
