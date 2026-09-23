import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, format, addHours } from "date-fns";

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
      // Segmento C também é reconhecido: sem isso, um contrato não atribuído de
      // lead C caía silenciosamente no resíduo "sem ICP".
      const segOf = (s: any): 'A' | 'B' | 'C' | null => {
        const v = String(s || '').toUpperCase();
        return v === 'A' || v === 'B' || v === 'C' ? (v as 'A' | 'B' | 'C') : null;
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
      //
      // Régua: o MCF Pay grava a transação SEM linked_deal_id/linked_attendee_id
      // (o cron link-mcfpay-contracts só preenche a cada 6h), então casar só por
      // esses vínculos contava a mesma venda duas vezes — uma na caução e outra
      // como "órfã". O casamento por e-mail/telefone aqui espelha a RPC
      // caucoes_efetivas; parcelas recorrentes são excluídas via
      // get_first_transaction_ids (mesma RPC usada em useR1CloserMetrics).
      if (bu === 'incorporador') {
        const { data: txs } = await supabase
          .from('hubla_transactions')
          .select('id, customer_name, customer_email, customer_phone, product_name, product_code, sale_status, sale_date, net_value, product_price, source, event_type, linked_deal_id, linked_attendee_id')
          .gte('sale_date', start)
          .lte('sale_date', end)
          .in('sale_status', ['pago', 'paid', 'approved', 'completed'])
          .gt('net_value', 0);

        // Só a primeira transação de cada cliente (exclui parcelas recorrentes
        // mensais, ex.: Hubla R$ 38,13 todo dia 23 de contratos de fev/mar).
        const { data: firstIdsRows } = await supabase.rpc('get_first_transaction_ids' as any);
        const firstTransactionIds = new Set<string>(
          (firstIdsRows as any[] | null || []).map((r: any) => r.id as string),
        );

        const paidAttendeeIds = new Set(rows.map((r: any) => r.attendee_id));
        const isContrato = (t: any) => {
          const name = (t.product_name || '').toUpperCase();
          const code = (t.product_code || '').toUpperCase();
          return code.startsWith('A000') || name.includes('A000') || name.includes('CONTRATO');
        };

        // Sets de e-mail/telefone das cauções do período (mesmos campos que a
        // RPC usa no casamento) para descontar transações já contadas como caução.
        const caucaoDealIds = Array.from(
          new Set(rows.map((r: any) => r.deal_id).filter(Boolean) as string[]),
        );
        const caucaoEmails = new Set<string>();
        const caucaoPhones = new Set<string>();
        if (caucaoDealIds.length > 0) {
          const { data: caucaoDeals } = await supabase
            .from('crm_deals')
            .select('id, contact_id, custom_fields')
            .in('id', caucaoDealIds);
          const contactIds = Array.from(
            new Set((caucaoDeals || []).map((d: any) => d.contact_id).filter(Boolean) as string[]),
          );
          const contactsById = new Map<string, { email: string | null; phone: string | null }>();
          if (contactIds.length > 0) {
            const { data: caucaoContacts } = await supabase
              .from('crm_contacts')
              .select('id, email, phone')
              .in('id', contactIds);
            (caucaoContacts || []).forEach((c: any) => {
              contactsById.set(c.id, { email: c.email, phone: c.phone });
            });
          }
          (caucaoDeals || []).forEach((d: any) => {
            const contact = d.contact_id ? contactsById.get(d.contact_id) : null;
            const email = (contact?.email || (d.custom_fields as any)?.email || '')
              .trim()
              .toLowerCase();
            if (email) caucaoEmails.add(email);
            const phoneRaw = contact?.phone || (d.custom_fields as any)?.telefone || '';
            const phone9 = phoneRaw.replace(/\D/g, '').slice(-9);
            if (phone9) caucaoPhones.add(phone9);
          });
        }

        const orphanDealIds: string[] = [];
        const orphanTxs = (txs || []).filter((t: any) => {
          if (!isContrato(t)) return false;
          // Filtros espelhando caucoes_efetivas (COALESCE → null vira '').
          const evt = (t.event_type || '').toLowerCase();
          if (evt.includes('refund')) return false;
          if (evt.includes('payment_received') || evt.includes('payment.received')) return false;
          const src = (t.source || '').toLowerCase();
          if (src.includes('asaas')) return false;
          // Exclui parcelas recorrentes: só a primeira transação do cliente.
          if (!firstTransactionIds.has(t.id)) return false;
          // Vínculos diretos já cobertos por caução.
          if (t.linked_attendee_id && paidAttendeeIds.has(t.linked_attendee_id)) return false;
          if (t.linked_deal_id && attributedDeals.has(t.linked_deal_id)) return false;
          // Casamento por e-mail/telefone — mesma venda já entrou como caução.
          const email = (t.customer_email || '').trim().toLowerCase();
          if (email && caucaoEmails.has(email)) return false;
          const phone9 = (t.customer_phone || '').replace(/\D/g, '').slice(-9);
          if (phone9 && caucaoPhones.has(phone9)) return false;
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
        const segByDeal = new Map<string, 'A' | 'B' | 'C' | null>();
        if (orphanDealIds.length > 0) {
          const { data: deals } = await supabase
            .from('crm_deals')
            .select('id, icp_segment')
            .in('id', Array.from(new Set(orphanDealIds)));
          (deals || []).forEach((d: any) => {
            const s = (d.icp_segment || '').toUpperCase();
            segByDeal.set(d.id, segOf(s));
          });
        }

        // Dedupe final: por deal (com vínculo) e por e-mail normalizado (sem
        // vínculo — mesmo cliente com duas transações no período conta uma vez).
        const seenDeal = new Set<string>();
        const seenEmail = new Set<string>();
        orphanTxs.forEach((t: any) => {
          if (t.linked_deal_id) {
            if (coveredDeals.has(t.linked_deal_id)) return;
            if (seenDeal.has(t.linked_deal_id)) return;
            seenDeal.add(t.linked_deal_id);
          } else {
            const email = (t.customer_email || '').trim().toLowerCase();
            if (email) {
              if (seenEmail.has(email)) return;
              seenEmail.add(email);
            }
          }
          const item: UnassignedContractItem = {
            deal_id: t.linked_deal_id ?? null,
            source: 'transacao_sem_reuniao',
            segment: t.linked_deal_id ? segByDeal.get(t.linked_deal_id) ?? null : null,
            reference: t.customer_name || t.id,
            paid_at: t.sale_date ?? null,
            value: t.net_value ?? t.product_price ?? null,
            reason: t.linked_deal_id
              ? 'Transação de contrato paga sem reunião/caução marcada no período'
              : 'Transação de contrato paga sem negócio vinculado no CRM',
            suggested: null,
            transaction_id: t.id,
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
