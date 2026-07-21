import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface RefundItem {
  refund_at: string;
  source: 'hubla' | 'mcf_pay';
  amount: number | null;
  deal_id: string;
  customer_name: string | null;
  customer_email: string | null;
  closer_name: string | null;
  sdr_email: string | null;
  sdr_name: string | null;
}

export interface OrphanRefund {
  refund_at: string;
  source: 'hubla' | 'mcf_pay';
  amount: number | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  reason: string;
  transaction_id: string | null;
}

export interface RefundDetails {
  items: RefundItem[];
  orphans: OrphanRefund[];
}

/**
 * Detalhes de reembolsos A000 - Contrato no período:
 * - items: reembolsos com deal vinculado (nome do cliente, SDR e Closer atribuídos)
 * - orphans: reembolsos que não conseguiram achar o deal (Hubla sem linked_deal_id
 *   ou MCF Pay com deal_not_found nos dispatch logs)
 */
export function useRefundDetailsInPeriod(startDate: Date | null, endDate: Date | null) {
  return useQuery<RefundDetails>({
    queryKey: ['refund-details-in-period', startDate?.toISOString(), endDate?.toISOString()],
    enabled: !!startDate && !!endDate,
    staleTime: 60_000,
    queryFn: async () => {
      if (!startDate || !endDate) return { items: [], orphans: [] };
      const start = format(startDate, 'yyyy-MM-dd') + 'T00:00:00';
      const end = format(endDate, 'yyyy-MM-dd') + 'T23:59:59';

      // Fonte de verdade: MCF Pay. Hubla é replicação, então NÃO entra aqui
      // para bater 1:1 com o Painel Comercial do MCF Pay.
      const { data: mcf } = await supabase
        .from('deal_activities')
        .select('deal_id, metadata, created_at')
        .eq('activity_type', 'refund_mcf_pay')
        .gte('created_at', start)
        .lte('created_at', end);

      // Reembolsos A000 reconciliados manualmente (refund_hubla com
      // source=manual_reconciliation_*). Preenchem casos em que o webhook
      // MCF Pay não gerou refund_mcf_pay na época (ex.: Thompson).
      const { data: manual } = await supabase
        .from('deal_activities')
        .select('deal_id, metadata, created_at')
        .eq('activity_type', 'refund_hubla')
        .gte('created_at', start)
        .lte('created_at', end);

      // MCF Pay orphans (deal_not_found nos dispatch logs)
      const { data: mcfOrphanLogs } = await supabase
        .from('mcf_pay_dispatch_logs')
        .select('created_at, payload, response, error_message')
        .eq('error_message', 'deal_not_found')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false });

      const items: RefundItem[] = [];
      const orphans: OrphanRefund[] = [];
      const dealIds = new Set<string>();

      // Dedup por transaction_id (retries do webhook) e por deal_id (mesmo
      // deal reembolsado mais de uma vez no mesmo período fica com o evento
      // mais recente por transação única).
      const seenTx = new Set<string>();
      const mcfRefundsById = new Map<string, { at: string; amount: number | null }>();
      (mcf || []).forEach((r: any) => {
        const amount = Number(r?.metadata?.amount);
        const txId = r?.metadata?.transaction_id as string | undefined;
        if (!r?.deal_id || amount !== 497) return; // A000 = R$497
        if (txId) {
          if (seenTx.has(txId)) return;
          seenTx.add(txId);
        }
        dealIds.add(r.deal_id);
        // mantém o primeiro (evento original — MCF Pay dispara antes)
        if (!mcfRefundsById.has(r.deal_id)) {
          mcfRefundsById.set(r.deal_id, { at: r.created_at, amount });
        }
      });

      (manual || []).forEach((r: any) => {
        const src = String(r?.metadata?.source || '');
        if (!r?.deal_id || !src.startsWith('manual_reconciliation')) return;
        const txId = r?.metadata?.hubla_transaction_id as string | undefined;
        if (txId) {
          if (seenTx.has(txId)) return;
          seenTx.add(txId);
        }
        dealIds.add(r.deal_id);
        if (!mcfRefundsById.has(r.deal_id)) {
          mcfRefundsById.set(r.deal_id, { at: r.created_at, amount: 497 });
        }
      });

      // Dedup MCF orphan logs by transaction_id (webhook retries)
      const seenOrphanTx = new Set<string>();
      (mcfOrphanLogs || []).forEach((log: any) => {
        const event = log.payload?.event;
        if (event !== 'payment.refunded') return;
        const tried = log.response?.tried ?? {};
        const txId = tried.transaction_id ?? null;
        if (txId && seenOrphanTx.has(txId)) return;
        if (txId) seenOrphanTx.add(txId);
        orphans.push({
          refund_at: log.created_at,
          source: 'mcf_pay',
          amount: typeof log.payload?.data?.amount === 'number' ? log.payload.data.amount : null,
          customer_name: tried.customer_name ?? null,
          customer_email: tried.customer_email ?? null,
          customer_phone: tried.customer_phone ?? null,
          reason: 'MCF Pay: nenhum contato/deal encontrado',
          transaction_id: txId,
        });
      });

      const dealIdArr = Array.from(dealIds);
      if (dealIdArr.length === 0) {
        return { items, orphans };
      }

      // Fetch deals + contacts
      const { data: deals } = await supabase
        .from('crm_deals')
        .select('id, owner_id, contact:crm_contacts(name, email)')
        .in('id', dealIdArr);
      const dealMap = new Map<string, any>();
      (deals as any[] || []).forEach((d) => dealMap.set(d.id, d));

      // Fetch R1 attendees for closer resolution (most recent R1 per deal)
      const { data: attendees } = await supabase
        .from('meeting_slot_attendees')
        .select('deal_id, booked_by, meeting_slot:meeting_slots!inner(closer_id, scheduled_at, meeting_type)')
        .in('deal_id', dealIdArr)
        .eq('meeting_slot.meeting_type', 'r1');

      const latestByDeal = new Map<string, { closerId: string | null; bookedBy: string | null; ts: number }>();
      (attendees as any[] || []).forEach((att) => {
        const slot = att.meeting_slot;
        const ts = new Date(slot?.scheduled_at || 0).getTime();
        const prev = latestByDeal.get(att.deal_id);
        if (!prev || ts > prev.ts) {
          latestByDeal.set(att.deal_id, {
            closerId: slot?.closer_id ?? null,
            bookedBy: att.booked_by ?? null,
            ts,
          });
        }
      });

      // Resolve closer names
      const closerIds = Array.from(new Set(Array.from(latestByDeal.values()).map((v) => v.closerId).filter(Boolean))) as string[];
      const closerMap = new Map<string, string>();
      if (closerIds.length > 0) {
        const { data: closers } = await supabase
          .from('closers')
          .select('id, name')
          .in('id', closerIds);
        (closers as any[] || []).forEach((c) => closerMap.set(c.id, c.name));
      }

      // Resolve booked_by UUIDs → email/name (SDR)
      const bookedByIds = Array.from(new Set(Array.from(latestByDeal.values()).map((v) => v.bookedBy).filter(Boolean))) as string[];
      const sdrMap = new Map<string, { email: string | null; name: string | null }>();
      if (bookedByIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', bookedByIds);
        (profs as any[] || []).forEach((p) => {
          sdrMap.set(p.id, {
            email: p.email ? String(p.email).toLowerCase() : null,
            name: p.full_name || p.email || null,
          });
        });
      }

      // Emit MCF Pay items
      mcfRefundsById.forEach((val, dealId) => {
        const deal = dealMap.get(dealId);
        const latest = latestByDeal.get(dealId);
        const sdr = latest?.bookedBy ? sdrMap.get(latest.bookedBy) : null;
        const sdrEmail = sdr?.email ?? ((deal?.owner_id || '').toLowerCase() || null);
        items.push({
          refund_at: val.at,
          source: 'mcf_pay',
          amount: val.amount,
          deal_id: dealId,
          customer_name: deal?.contact?.name ?? null,
          customer_email: deal?.contact?.email ?? null,
          closer_name: latest?.closerId ? closerMap.get(latest.closerId) ?? null : null,
          sdr_email: sdrEmail,
          sdr_name: sdr?.name ?? sdrEmail ?? null,
        });
      });

      items.sort((a, b) => new Date(b.refund_at).getTime() - new Date(a.refund_at).getTime());
      orphans.sort((a, b) => new Date(b.refund_at).getTime() - new Date(a.refund_at).getTime());

      return { items, orphans };
    },
  });
}