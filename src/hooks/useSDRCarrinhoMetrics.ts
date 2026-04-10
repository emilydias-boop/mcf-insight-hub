import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useSdrsFromSquad } from "./useSdrsFromSquad";
import { getCarrinhoMetricBoundaries } from "@/lib/carrinhoWeekBoundaries";

export interface SDRCarrinhoMetric {
  sdr_id: string;
  sdr_name: string;
  sdr_email: string;
  aprovados: number;
}

export function useSDRCarrinhoMetrics(weekStart: Date, weekEnd: Date, squad: string = 'incorporador', config?: CarrinhoConfig, previousConfig?: CarrinhoConfig) {
  const sdrsQuery = useSdrsFromSquad(squad);
  const cutoffKey = config?.carrinhos?.[0]?.horario_corte || '12:00';
  const prevCutoffKey = previousConfig?.carrinhos?.[0]?.horario_corte || '12:00';

  return useQuery({
    queryKey: ['sdr-carrinho-metrics', format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd'), squad, cutoffKey, prevCutoffKey],
    queryFn: async (): Promise<SDRCarrinhoMetric[]> => {
      const sdrs = sdrsQuery.data || [];
      const validSdrEmails = new Set(sdrs.map(s => s.email.toLowerCase()));
      const sdrNameMap = new Map(sdrs.map(s => [s.email.toLowerCase(), s.name]));
      const boundaries = getCarrinhoMetricBoundaries(weekStart, weekEnd, config, previousConfig);

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

      // 6. Get R1 attendees for approved deals to find SDR (booked_by)
      const { data: r1Attendees } = await supabase
        .from('meeting_slot_attendees')
        .select(`id, deal_id, booked_by, meeting_slot:meeting_slots!inner(id, meeting_type)`)
        .in('deal_id', Array.from(approvedDealIds))
        .eq('meeting_slot.meeting_type', 'r1');

      const dealToBookedBy = new Map<string, string>();
      for (const att of r1Attendees || []) {
        if ((att as any).deal_id && (att as any).booked_by && !dealToBookedBy.has((att as any).deal_id)) {
          dealToBookedBy.set((att as any).deal_id, (att as any).booked_by);
        }
      }

      const bookedByIds = new Set<string>(dealToBookedBy.values());
      if (bookedByIds.size === 0) return [];

      const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').in('id', Array.from(bookedByIds));
      const profileEmailMap = new Map<string, string>();
      for (const p of profiles || []) {
        if (p.email) profileEmailMap.set(p.id, p.email.toLowerCase());
      }

      // 7. Aggregate by SDR
      const sdrMap = new Map<string, SDRCarrinhoMetric>();
      let unassignedCount = 0;

      for (const dealId of approvedDealIds) {
        const sdrId = dealToBookedBy.get(dealId);
        if (!sdrId) { unassignedCount++; continue; }
        const sdrEmail = profileEmailMap.get(sdrId);
        if (!sdrEmail || !validSdrEmails.has(sdrEmail)) { unassignedCount++; continue; }

        const sdrName = sdrNameMap.get(sdrEmail) || sdrEmail.split('@')[0];
        if (!sdrMap.has(sdrId)) {
          sdrMap.set(sdrId, { sdr_id: sdrId, sdr_name: sdrName, sdr_email: sdrEmail, aprovados: 0 });
        }
        sdrMap.get(sdrId)!.aprovados++;
      }

      const result = Array.from(sdrMap.values()).sort((a, b) => b.aprovados - a.aprovados);
      if (unassignedCount > 0) {
        result.push({ sdr_id: 'unassigned', sdr_name: 'Sem SDR', sdr_email: '', aprovados: unassignedCount });
      }
      return result;
    },
    enabled: sdrsQuery.isSuccess,
    refetchInterval: 60000,
  });
}
