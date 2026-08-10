import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, format, addHours } from "date-fns";

export interface UnassignedContractItem {
  deal_id: string | null;
  source: 'caucao_sem_deal' | 'caucao_sem_r1' | 'caucao_sem_sdr' | 'transacao_sem_reuniao';
  segment: 'A' | 'B' | null;
  reference: string;
  /** Data do pagamento da caução/contrato (ISO). */
  paid_at?: string | null;
  /** Valor do negócio/transação quando disponível. */
  value?: number | null;
  /** Motivo legível da não atribuição. */
  reason?: string;
  /** Closer/SDR identificável no slot (sugestão de atribuição). */
  suggested?: string | null;
}

export interface UnassignedContracts {
  total: number;
  a: number;
  b: number;
  unknown: number;
  /** Órfãos que nem os SDRs conseguem atribuir (inclui R1 sem booked_by). */
  sdrTotal: number;
  sdrA: number;
  sdrB: number;
  items: UnassignedContractItem[];
  /** Mesma lista, na ótica da aba SDRs. */
  sdrItems: UnassignedContractItem[];
}

const EMPTY: UnassignedContracts = {
  total: 0, a: 0, b: 0, unknown: 0, sdrTotal: 0, sdrA: 0, sdrB: 0, items: [], sdrItems: [],
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
      const BRT_OFFSET_HOURS = 3;
      const start = addHours(startOfDay(startDate), BRT_OFFSET_HOURS).toISOString();
      const end = addHours(endOfDay(endDate), BRT_OFFSET_HOURS).toISOString();

      // Régua nova: cauções efetivas do período (data da transação + closer da R1).
      const { data: caucoes, error } = await (supabase as any).rpc('caucoes_efetivas', {
        p_from: format(startDate, 'yyyy-MM-dd'),
        p_to: format(endDate, 'yyyy-MM-dd'),
        p_bu: bu,
      });
      if (error) throw error;

      const rows = ((caucoes as any[]) || []);
      const segOf = (s: any): 'A' | 'B' | null => {
        const v = String(s || '').toUpperCase();
        return v === 'A' || v === 'B' ? (v as 'A' | 'B') : null;
      };

      const items: UnassignedContractItem[] = [];
      const sdrItems: UnassignedContractItem[] = [];
      const attributedDeals = new Set(
        rows.filter((r) => r.closer_id).map((r) => r.deal_id).filter(Boolean) as string[],
      );

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

      // Transações A000/Contrato pagas no período sem attendee pago correspondente.
      if (bu === 'incorporador') {
        const { data: txs } = await supabase
          .from('hubla_transactions')
          .select('id, customer_name, product_name, product_code, sale_status, sale_date, linked_deal_id, linked_attendee_id')
          .gte('sale_date', start)
          .lte('sale_date', end)
          .in('sale_status', ['pago', 'paid', 'approved', 'completed']);

        const paidAttendeeIds = new Set(rows.map((r: any) => r.attendee_id));
        const isContrato = (t: any) => {
          const name = (t.product_name || '').toUpperCase();
          const code = (t.product_code || '').toUpperCase();
          return code.startsWith('A000') || name.includes('A000') || name.includes('CONTRATO');
        };

        const orphanDealIds: string[] = [];
        const orphanTxs = (txs || []).filter((t: any) => {
          if (!isContrato(t)) return false;
          if (t.linked_attendee_id && paidAttendeeIds.has(t.linked_attendee_id)) return false;
          if (t.linked_deal_id && attributedDeals.has(t.linked_deal_id)) return false;
          if (t.linked_deal_id) orphanDealIds.push(t.linked_deal_id);
          return true;
        });

        // Um deal já pode ter caução marcada fora da janela (a régua nova move a
        // data para a transação). Nesse caso a transação não é órfã.
        const coveredDeals = new Set<string>();
        if (orphanDealIds.length > 0) {
          const { data: paidElsewhere } = await supabase
            .from('meeting_slot_attendees')
            .select('deal_id')
            .in('deal_id', Array.from(new Set(orphanDealIds)))
            .not('contract_paid_at', 'is', null);
          (paidElsewhere || []).forEach((a: any) => {
            if (a.deal_id) coveredDeals.add(a.deal_id);
          });
        }

        // Segmento dos deals órfãos (quando existirem)
        const segByDeal = new Map<string, 'A' | 'B' | null>();
        if (orphanDealIds.length > 0) {
          const { data: deals } = await supabase
            .from('crm_deals')
            .select('id, icp_segment')
            .in('id', Array.from(new Set(orphanDealIds)));
          (deals || []).forEach((d: any) => {
            const s = (d.icp_segment || '').toUpperCase();
            segByDeal.set(d.id, s === 'A' || s === 'B' ? (s as 'A' | 'B') : null);
          });
        }

        const seenDeal = new Set<string>();
        orphanTxs.forEach((t: any) => {
          if (t.linked_deal_id) {
            if (coveredDeals.has(t.linked_deal_id)) return;
            if (seenDeal.has(t.linked_deal_id)) return;
            seenDeal.add(t.linked_deal_id);
          }
          const item: UnassignedContractItem = {
            deal_id: t.linked_deal_id ?? null,
            source: 'transacao_sem_reuniao',
            segment: t.linked_deal_id ? segByDeal.get(t.linked_deal_id) ?? null : null,
            reference: t.customer_name || t.id,
            paid_at: t.sale_date ?? null,
            value: null,
            reason: t.linked_deal_id
              ? 'Transação de contrato paga sem reunião/caução marcada no período'
              : 'Transação de contrato paga sem negócio vinculado no CRM',
            suggested: null,
          };
          items.push(item);
          sdrItems.push(item);
        });
      }

      const count = (list: UnassignedContractItem[], seg: 'A' | 'B' | null) =>
        list.filter((i) => i.segment === seg).length;

      return {
        total: items.length,
        a: count(items, 'A'),
        b: count(items, 'B'),
        unknown: count(items, null),
        sdrTotal: sdrItems.length,
        sdrA: count(sdrItems, 'A'),
        sdrB: count(sdrItems, 'B'),
        items,
        sdrItems,
      };
    },
    staleTime: 60_000,
  });
}
