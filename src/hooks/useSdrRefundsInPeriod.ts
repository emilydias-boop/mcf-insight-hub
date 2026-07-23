import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

/**
 * Retorna quantos reembolsos A000 (MCF Pay + reconciliações manuais) foram
 * atribuídos a cada SDR no período — ANCORADOS na data da R1 que originou o
 * contrato (e não no dia em que o reembolso foi processado).
 *
 * Âncora:
 *   1) scheduled_at da R1 mais recente do deal (meeting_type='r1').
 *   2) fallback: contract_paid_at do deal (marca como "outside").
 *   3) fallback final: created_at do próprio reembolso (sem âncora).
 *
 * Escopo: apenas Painel Comercial. Financeiro continua na data real.
 */
export function useSdrRefundsInPeriod(startDate: Date | null, endDate: Date | null) {
  return useQuery({
    queryKey: ['sdr-refunds-in-period-r1anchor', startDate?.toISOString(), endDate?.toISOString()],
    enabled: !!startDate && !!endDate,
    staleTime: 60_000,
    queryFn: async () => {
      if (!startDate || !endDate) return new Map<string, number>();
      const startISO = format(startDate, 'yyyy-MM-dd') + 'T00:00:00';
      const startMs = new Date(startISO).getTime();
      const endISO = format(endDate, 'yyyy-MM-dd') + 'T23:59:59';
      const endMs = new Date(endISO).getTime();

      // Reembolsos com created_at >= start (sem cap superior): a R1 ancorada
      // no período pode ter reembolso disparado depois do endDate.
      const { data: mcf } = await supabase
        .from('deal_activities')
        .select('deal_id, metadata, created_at')
        .eq('activity_type', 'refund_mcf_pay')
        .gte('created_at', startISO);

      const seenTx = new Set<string>();
      // deal_id -> data do reembolso (fallback final para âncora)
      const refundByDeal = new Map<string, string>();
      (mcf || []).forEach((r: any) => {
        const amount = Number(r?.metadata?.amount);
        const txId = r?.metadata?.transaction_id as string | undefined;
        if (!r?.deal_id || amount !== 497) return; // A000 = R$497
        if (txId) {
          if (seenTx.has(txId)) return;
          seenTx.add(txId);
        }
        if (!refundByDeal.has(r.deal_id)) refundByDeal.set(r.deal_id, r.created_at);
      });

      // Reconciliações manuais (refund_hubla com source=manual_reconciliation_*).
      const { data: manual } = await supabase
        .from('deal_activities')
        .select('deal_id, metadata, created_at')
        .eq('activity_type', 'refund_hubla')
        .gte('created_at', startISO);
      (manual || []).forEach((r: any) => {
        const src = String(r?.metadata?.source || '');
        if (!r?.deal_id) return;
        if (!src.startsWith('manual_reconciliation')) return;
        const txId = r?.metadata?.hubla_transaction_id as string | undefined;
        if (txId) {
          if (seenTx.has(txId)) return;
          seenTx.add(txId);
        }
        if (!refundByDeal.has(r.deal_id)) refundByDeal.set(r.deal_id, r.created_at);
      });
      const ids = Array.from(refundByDeal.keys());
      if (ids.length === 0) return new Map<string, number>();

      // R1 mais recente por deal (booked_by = SDR; scheduled_at = âncora)
      const { data: attendees } = await supabase
        .from('meeting_slot_attendees')
        .select('deal_id, booked_by, meeting_slot:meeting_slots!inner(scheduled_at, meeting_type)')
        .in('deal_id', ids)
        .eq('meeting_slot.meeting_type', 'r1');

      // deal_id -> { userId (booked_by), r1Ts }
      const r1ByDeal = new Map<string, { userId: string | null; ts: number }>();
      (attendees as any[] || []).forEach((att) => {
        const ts = new Date(att.meeting_slot?.scheduled_at || 0).getTime();
        if (!ts) return;
        const prev = r1ByDeal.get(att.deal_id);
        if (!prev || ts > prev.ts) {
          r1ByDeal.set(att.deal_id, { userId: (att.booked_by as string | null) ?? null, ts });
        }
      });

      // Resolver UUIDs booked_by -> email
      const userIds = Array.from(
        new Set(
          Array.from(r1ByDeal.values())
            .map((v) => v.userId)
            .filter((v): v is string => !!v)
        )
      );
      const uuidToEmail = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', userIds);
        (profs as any[] || []).forEach((p) => {
          if (p.email) uuidToEmail.set(p.id, String(p.email).toLowerCase());
        });
      }

      // Buscar contract_paid_at e owner (fallback SDR)
      const { data: deals } = await supabase
        .from('crm_deals')
        .select('id, owner_id, contract_paid_at')
        .in('id', ids);
      const dealInfo = new Map<string, { ownerEmail: string | null; contractPaidAt: string | null }>();
      (deals as any[] || []).forEach((d) => {
        dealInfo.set(d.id, {
          ownerEmail: d.owner_id ? String(d.owner_id).toLowerCase() : null,
          contractPaidAt: d.contract_paid_at ?? null,
        });
      });

      // Agregar: para cada deal, resolver âncora + SDR; só conta se âncora no período.
      const byEmail = new Map<string, number>();
      for (const dealId of ids) {
        const r1 = r1ByDeal.get(dealId);
        const info = dealInfo.get(dealId);

        let anchorMs: number | null = null;
        if (r1?.ts) anchorMs = r1.ts;
        else if (info?.contractPaidAt) anchorMs = new Date(info.contractPaidAt).getTime();
        else {
          const rAt = refundByDeal.get(dealId);
          anchorMs = rAt ? new Date(rAt).getTime() : null;
        }
        if (anchorMs == null || anchorMs < startMs || anchorMs > endMs) continue;

        const sdrEmail =
          (r1?.userId && uuidToEmail.get(r1.userId)) || info?.ownerEmail || null;
        if (!sdrEmail) continue;
        byEmail.set(sdrEmail, (byEmail.get(sdrEmail) || 0) + 1);
      }
      return byEmail;
    },
  });
}