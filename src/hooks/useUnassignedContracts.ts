import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, format, addHours } from "date-fns";

export interface UnassignedContractItem {
  deal_id: string | null;
  source: 'attendee_r2_only' | 'attendee_sem_closer' | 'attendee_sem_sdr' | 'transacao_sem_reuniao';
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
          meeting_slots!inner ( meeting_type, closer_id, closers ( bu, name ) ),
          crm_deals ( icp_segment, value )
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

      // Nomes dos SDRs (booked_by) para sugestão de atribuição.
      const bookedIds = Array.from(
        new Set(scoped.map((r) => r.booked_by).filter(Boolean) as string[]),
      );
      const sdrNames = new Map<string, string>();
      if (bookedIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', bookedIds);
        (profs || []).forEach((p: any) => sdrNames.set(p.id, p.full_name));
      }

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
        const closerName = r.meeting_slots?.closers?.name || null;
        const sdrName = r.booked_by ? sdrNames.get(r.booked_by) || null : null;

        if (!(isR1 && hasCloser)) {
          if (alreadyCounted) return; // mesmo deal já contado por um R1 válido
          const item: UnassignedContractItem = {
            deal_id: r.deal_id ?? null,
            source: isR1 ? 'attendee_sem_closer' : 'attendee_r2_only',
            segment: segOf(r),
            reference: r.attendee_name || r.id,
            paid_at: r.contract_paid_at ?? null,
            value: r.crm_deals?.value ?? null,
            reason: isR1
              ? 'Caução marcada em reunião de R1 sem closer definido no slot'
              : `Caução marcada em slot de R2${closerName ? ` (closer: ${closerName})` : ''} — a atribuição só considera R1`,
            suggested: closerName || sdrName,
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
            paid_at: r.contract_paid_at ?? null,
            value: r.crm_deals?.value ?? null,
            reason: 'Reunião de R1 sem SDR que agendou (booked_by vazio)',
            suggested: closerName,
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
