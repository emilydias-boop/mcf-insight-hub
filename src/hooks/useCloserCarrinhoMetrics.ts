import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { getCarrinhoMetricBoundaries } from "@/lib/carrinhoWeekBoundaries";

export interface CloserCarrinhoMetric {
  closer_id: string;
  closer_name: string;
  closer_color: string | null;
  aprovados: number;
}

export function useCloserCarrinhoMetrics(weekStart: Date, weekEnd: Date) {
  return useQuery({
    queryKey: ['closer-carrinho-metrics', format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd')],
    queryFn: async (): Promise<CloserCarrinhoMetric[]> => {
      const boundaries = getCarrinhoMetricBoundaries(weekStart, weekEnd);

      // 1. Fetch contracts of the safra (Thu-Wed)
      const { data: contratosTx } = await supabase
        .from('hubla_transactions')
        .select('customer_email, sale_date, hubla_id, source, product_name, installment_number')
        .eq('product_name', 'A000 - Contrato')
        .in('sale_status', ['completed', 'refunded'])
        .in('source', ['hubla', 'manual', 'make', 'mcfpay', 'kiwify'])
        .gte('sale_date', boundaries.contratos.start.toISOString())
        .lte('sale_date', boundaries.contratos.end.toISOString());

      const validTx = (contratosTx || []).filter(t => {
        if (t.hubla_id?.startsWith('newsale-')) return false;
        if (t.source === 'make' && t.product_name?.toLowerCase() === 'contrato') return false;
        if (t.installment_number && t.installment_number > 1) return false;
        return true;
      });

      const emailMap = new Map<string, typeof validTx[0]>();
      for (const t of validTx) {
        const email = (t.customer_email || '').toLowerCase().trim();
        if (email && !emailMap.has(email)) emailMap.set(email, t);
      }
      const uniqueContracts = Array.from(emailMap.values());
      const emails = uniqueContracts.map(t => (t.customer_email || '').toLowerCase().trim()).filter(Boolean);
      if (emails.length === 0) return [];

      // 2. Resolve emails → contacts
      const { data: contacts } = await supabase.from('crm_contacts').select('id, email').in('email', emails);
      const emailToContactId = new Map<string, string>();
      for (const c of contacts || []) {
        if (c.email) emailToContactId.set(c.email.toLowerCase().trim(), c.id);
      }
      const contactIds = Array.from(new Set(Array.from(emailToContactId.values())));
      if (contactIds.length === 0) return [];

      // 3. Fetch R2 status "aprovado"
      const { data: statusOptions } = await supabase.from('r2_status_options').select('id, name').ilike('name', '%aprov%');
      const aprovadoStatusIds = statusOptions?.map(s => s.id) || [];
      if (aprovadoStatusIds.length === 0) return [];

      // 4. Fetch ALL R2 attendees for safra contacts (no date filter)
      const { data: r2Attendees } = await supabase
        .from('meeting_slot_attendees')
        .select(`id, contact_id, r2_status_id, deal_id, meeting_slot:meeting_slots!inner(id, scheduled_at, meeting_type, status)`)
        .in('contact_id', contactIds)
        .eq('meeting_slot.meeting_type', 'r2')
        .in('r2_status_id', aprovadoStatusIds)
        .not('meeting_slot.status', 'in', '("cancelled","rescheduled")');

      // 5. For each contract, find first approved R2 after sale_date
      const approvedDealIds = new Set<string>();
      for (const tx of uniqueContracts) {
        const email = (tx.customer_email || '').toLowerCase().trim();
        const contactId = emailToContactId.get(email);
        if (!contactId) continue;

        const contactR2s = (r2Attendees || [])
          .filter((a: any) => a.contact_id === contactId)
          .filter((a: any) => new Date(a.meeting_slot?.scheduled_at).getTime() > new Date(tx.sale_date).getTime())
          .sort((a: any, b: any) => new Date(a.meeting_slot?.scheduled_at).getTime() - new Date(b.meeting_slot?.scheduled_at).getTime());

        if (contactR2s.length > 0 && contactR2s[0].deal_id) {
          approvedDealIds.add(contactR2s[0].deal_id);
        }
      }

      if (approvedDealIds.size === 0) return [];

      // 6. Get R1 attendees for approved deals to find Closer
      const { data: r1Attendees } = await supabase
        .from('meeting_slot_attendees')
        .select(`id, deal_id, meeting_slot_id, meeting_slot:meeting_slots!inner(id, meeting_type, closer_id)`)
        .in('deal_id', Array.from(approvedDealIds))
        .eq('meeting_slot.meeting_type', 'r1');

      const dealToCloserId = new Map<string, string>();
      for (const att of r1Attendees || []) {
        if ((att as any).deal_id && (att as any).meeting_slot?.closer_id && !dealToCloserId.has((att as any).deal_id)) {
          dealToCloserId.set((att as any).deal_id, (att as any).meeting_slot.closer_id);
        }
      }

      const closerIds = new Set<string>(dealToCloserId.values());
      if (closerIds.size === 0) return [];

      const { data: closers } = await supabase.from('closers').select('id, name, color').in('id', Array.from(closerIds));
      const closerInfoMap = new Map<string, { name: string; color: string | null }>();
      for (const c of closers || []) {
        closerInfoMap.set(c.id, { name: c.name, color: c.color });
      }

      // 7. Aggregate by Closer
      const closerMap = new Map<string, CloserCarrinhoMetric>();
      let unassignedCount = 0;

      for (const dealId of approvedDealIds) {
        const closerId = dealToCloserId.get(dealId);
        if (!closerId) { unassignedCount++; continue; }
        const closerInfo = closerInfoMap.get(closerId);
        if (!closerInfo) { unassignedCount++; continue; }

        if (!closerMap.has(closerId)) {
          closerMap.set(closerId, { closer_id: closerId, closer_name: closerInfo.name, closer_color: closerInfo.color, aprovados: 0 });
        }
        closerMap.get(closerId)!.aprovados++;
      }

      const result = Array.from(closerMap.values()).filter(m => m.aprovados > 0).sort((a, b) => b.aprovados - a.aprovados);
      if (unassignedCount > 0) {
        result.push({ closer_id: 'unassigned', closer_name: 'Sem Closer', closer_color: '#6B7280', aprovados: unassignedCount });
      }
      return result;
    },
    refetchInterval: 60000,
  });
}
