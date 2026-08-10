import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, format, addHours } from "date-fns";

export interface UnassignedContractItem {
  deal_id: string | null;
  source: 'attendee_r2_only' | 'attendee_sem_closer' | 'attendee_sem_sdr' | 'transacao_sem_reuniao';
  segment: 'A' | 'B' | null;
  reference: string;
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
}

const EMPTY: UnassignedContracts = {
  total: 0, a: 0, b: 0, unknown: 0, sdrTotal: 0, sdrA: 0, sdrB: 0, items: [],
};

/**
 * Contratos/cauções pagos no período que a atribuição atual NÃO consegue
 * ligar a nenhum Closer (aba Closers) ou SDR (aba SDRs).
 *
 * Motivos cobertos:
 *  - attendee pago em slot de R2 (a atribuição só olha meeting_type = 'r1');
 *  - attendee pago em slot sem closer_id;
 *  - attendee de R1 pago sem booked_by (sem SDR) → só órfão na aba SDRs;
 *  - transação A000/Contrato paga sem attendee marcado como pago no período.
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

      const { data: rows, error } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          deal_id,
          booked_by,
          attendee_name,
          contract_paid_at,
          status,
          is_partner,
          meeting_slots!inner ( meeting_type, closer_id, closers ( bu ) ),
          crm_deals ( icp_segment )
        `)
        .not('contract_paid_at', 'is', null)
        .gte('contract_paid_at', start)
        .lte('contract_paid_at', end)
        .eq('is_partner', false)
        .neq('status', 'cancelled');

      if (error) throw error;

      const all = (rows || []) as any[];
      const buOf = (r: any) => r.meeting_slots?.closers?.bu ?? null;
      const inBu = (r: any) => {
        const b = buOf(r);
        return b === null || b === bu;
      };
      const segOf = (r: any): 'A' | 'B' | null => {
        const s = (r.crm_deals?.icp_segment || '').toUpperCase();
        return s === 'A' || s === 'B' ? (s as 'A' | 'B') : null;
      };

      const scoped = all.filter(inBu);

      // Atribuíveis a closer: R1 com closer_id preenchido.
      const closerAttributed = scoped.filter(
        (r) => r.meeting_slots?.meeting_type === 'r1' && !!r.meeting_slots?.closer_id,
      );
      const attributedDeals = new Set(
        closerAttributed.map((r) => r.deal_id).filter(Boolean) as string[],
      );

      const items: UnassignedContractItem[] = [];
      const sdrItems: UnassignedContractItem[] = [];

      scoped.forEach((r) => {
        const isR1 = r.meeting_slots?.meeting_type === 'r1';
        const hasCloser = !!r.meeting_slots?.closer_id;
        const alreadyCounted = !!r.deal_id && attributedDeals.has(r.deal_id);

        if (!(isR1 && hasCloser)) {
          if (alreadyCounted) return; // mesmo deal já contado por um R1 válido
          const item: UnassignedContractItem = {
            deal_id: r.deal_id ?? null,
            source: isR1 ? 'attendee_sem_closer' : 'attendee_r2_only',
            segment: segOf(r),
            reference: r.attendee_name || r.id,
          };
          items.push(item);
          sdrItems.push(item);
          return;
        }

        // R1 com closer: entra na aba Closers, mas pode faltar SDR.
        if (!r.booked_by) {
          sdrItems.push({
            deal_id: r.deal_id ?? null,
            source: 'attendee_sem_sdr',
            segment: segOf(r),
            reference: r.attendee_name || r.id,
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

        const paidAttendeeIds = new Set(all.map((r) => r.id));
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
            if (seenDeal.has(t.linked_deal_id)) return;
            seenDeal.add(t.linked_deal_id);
          }
          const item: UnassignedContractItem = {
            deal_id: t.linked_deal_id ?? null,
            source: 'transacao_sem_reuniao',
            segment: t.linked_deal_id ? segByDeal.get(t.linked_deal_id) ?? null : null,
            reference: t.customer_name || t.id,
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
      };
    },
    staleTime: 60_000,
  });
}
