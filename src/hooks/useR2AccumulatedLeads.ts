import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subWeeks } from 'date-fns';
import { getCartWeekStart, getCartWeekEnd, getCarrinhoMetricBoundaries } from '@/lib/carrinhoWeekBoundaries';

export interface R2AccumulatedLead {
  id: string;
  attendee_name: string | null;
  attendee_phone: string | null;
  contact_phone: string | null;
  deal_name: string | null;
  closer_name: string | null;
  closer_color: string | null;
  scheduled_at: string;
  origin_type: 'proxima_semana' | 'sem_r2';
  origin_week_label: string;
  r2_status_name: string | null;
  r2_status_color: string | null;
  contact_email: string | null;
  meeting_id: string | null;
}

/**
 * Busca leads acumulados de semanas anteriores:
 * 1. Leads com status "Próxima Semana" das últimas 4 safras
 * 2. Contratos sem R2 aprovada/agendada das últimas 4 safras
 */
export function useR2AccumulatedLeads(currentWeekStart: Date, currentWeekEnd: Date) {
  return useQuery({
    queryKey: ['r2-accumulated-leads', format(currentWeekStart, 'yyyy-MM-dd')],
    queryFn: async (): Promise<R2AccumulatedLead[]> => {
      const results: R2AccumulatedLead[] = [];

      // Get "Próxima Semana" status ID
      const { data: statusOptions } = await supabase
        .from('r2_status_options')
        .select('id, name, color')
        .eq('is_active', true);

      const proximaSemanaStatus = statusOptions?.find(
        s => s.name.toLowerCase() === 'próxima semana'
      );
      const aprovadoStatus = statusOptions?.find(
        s => s.name.toLowerCase() === 'aprovado'
      );

      // Definitive statuses that mean the lead is already handled
      const definitiveStatusNames = ['aprovado', 'reembolso', 'desistente', 'reprovado', 'cancelado'];
      const definitiveStatusIds = new Set(
        (statusOptions || [])
          .filter(s => definitiveStatusNames.includes(s.name.toLowerCase()))
          .map(s => s.id)
      );

      // Scan previous 4 weeks
      for (let i = 1; i <= 4; i++) {
        const prevDate = subWeeks(currentWeekStart, i);
        const prevStart = getCartWeekStart(prevDate);
        const prevEnd = getCartWeekEnd(prevDate);
        const boundaries = getCarrinhoMetricBoundaries(prevStart, prevEnd);

        const weekLabel = `${format(prevStart, 'dd/MM')} - ${format(prevEnd, 'dd/MM')}`;

        // Get safra contracts
        const { data: contratosTx } = await supabase
          .from('hubla_transactions')
          .select('customer_email, sale_date, hubla_id, source, product_name, installment_number, sale_status')
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
        for (const tx of validTx) {
          const email = (tx.customer_email || '').toLowerCase().trim();
          if (email && !emailMap.has(email)) emailMap.set(email, tx);
        }
        const uniqueContracts = Array.from(emailMap.values());
        const emails = uniqueContracts.map(t => (t.customer_email || '').toLowerCase().trim()).filter(Boolean);
        if (emails.length === 0) continue;

        // Resolve contacts
        const { data: contacts } = await supabase
          .from('crm_contacts')
          .select('id, email, phone')
          .in('email', emails);

        const emailToContact = new Map<string, { id: string; email: string | null; phone: string | null }>();
        for (const c of contacts || []) {
          if (c.email) emailToContact.set(c.email.toLowerCase().trim(), c);
        }

        const contactIds = Array.from(new Set(Array.from(emailToContact.values()).map(c => c.id)));
        if (contactIds.length === 0) continue;

        // Build contactId → saleDate + email
        const contactToSaleInfo = new Map<string, { saleDate: string; email: string }>();
        for (const tx of uniqueContracts) {
          const email = (tx.customer_email || '').toLowerCase().trim();
          const contact = emailToContact.get(email);
          if (contact && !contactToSaleInfo.has(contact.id)) {
            contactToSaleInfo.set(contact.id, { saleDate: tx.sale_date, email });
          }
        }

        // Fetch R2 attendees for these contacts
        const { data: r2Attendees } = await supabase
          .from('meeting_slot_attendees')
          .select(`
            id,
            attendee_name,
            attendee_phone,
            r2_status_id,
            deal_id,
            contact_id,
            meeting_slot:meeting_slots!inner(
              id,
              scheduled_at,
              meeting_type,
              closer:closers!meeting_slots_closer_id_fkey(
                id,
                name,
                color
              )
            )
          `)
          .in('contact_id', contactIds)
          .eq('meeting_slot.meeting_type', 'r2');

        // Fetch deals for names
        const allDealIds = (r2Attendees || []).map((a: any) => a.deal_id).filter(Boolean);
        const { data: deals } = allDealIds.length > 0
          ? await supabase.from('crm_deals').select('id, name').in('id', allDealIds)
          : { data: null };
        const dealMap = new Map<string, any>();
        if (deals) deals.forEach(d => dealMap.set(d.id, d));

        // Group R2s by contact
        const contactR2Map = new Map<string, any[]>();
        for (const att of r2Attendees || []) {
          const cid = (att as any).contact_id;
          if (!cid) continue;
          if (!contactR2Map.has(cid)) contactR2Map.set(cid, []);
          contactR2Map.get(cid)!.push(att);
        }

        const statusMap = new Map<string, { name: string; color: string }>();
        (statusOptions || []).forEach(s => statusMap.set(s.id, s));

        for (const [contactId, saleInfo] of contactToSaleInfo) {
          const contactData = emailToContact.get(saleInfo.email);
          const allR2s = contactR2Map.get(contactId) || [];
          const saleDateMs = new Date(saleInfo.saleDate).getTime();

          // First R2 after sale
          const validR2s = allR2s
            .filter((r: any) => {
              const slot = r.meeting_slot;
              if (!slot?.scheduled_at) return false;
              return new Date(slot.scheduled_at).getTime() > saleDateMs;
            })
            .sort((a: any, b: any) =>
              new Date(a.meeting_slot.scheduled_at).getTime() - new Date(b.meeting_slot.scheduled_at).getTime()
            );

          if (validR2s.length === 0) {
            // No R2 at all → sem_r2
            results.push({
              id: `sem-r2-${contactId}-${i}`,
              attendee_name: null,
              attendee_phone: null,
              contact_phone: contactData?.phone || null,
              deal_name: null,
              closer_name: null,
              closer_color: null,
              scheduled_at: saleInfo.saleDate,
              origin_type: 'sem_r2',
              origin_week_label: weekLabel,
              r2_status_name: null,
              r2_status_color: null,
              contact_email: saleInfo.email,
              meeting_id: null,
            });
            continue;
          }

          const att = validR2s[0] as any;
          const slot = att.meeting_slot;
          const closerData = Array.isArray(slot?.closer) ? slot.closer[0] : slot?.closer;
          const status = att.r2_status_id ? statusMap.get(att.r2_status_id) : null;
          const deal = att.deal_id ? dealMap.get(att.deal_id) : null;

          // Check if "Próxima Semana"
          if (proximaSemanaStatus && att.r2_status_id === proximaSemanaStatus.id) {
            results.push({
              id: att.id,
              attendee_name: att.attendee_name,
              attendee_phone: att.attendee_phone,
              contact_phone: contactData?.phone || null,
              deal_name: deal?.name || null,
              closer_name: closerData?.name || null,
              closer_color: closerData?.color || null,
              scheduled_at: slot.scheduled_at,
              origin_type: 'proxima_semana',
              origin_week_label: weekLabel,
              r2_status_name: status?.name || null,
              r2_status_color: status?.color || null,
              contact_email: saleInfo.email,
              meeting_id: slot.id,
            });
            continue;
          }

          // If approved or has no "fora" status, skip (already handled)
          if (aprovadoStatus && att.r2_status_id === aprovadoStatus.id) continue;
          // If has any other non-fora status, skip
          if (att.r2_status_id) continue;

          // No status set → sem_r2 (pending)
          results.push({
            id: att.id,
            attendee_name: att.attendee_name,
            attendee_phone: att.attendee_phone,
            contact_phone: contactData?.phone || null,
            deal_name: deal?.name || null,
            closer_name: closerData?.name || null,
            closer_color: closerData?.color || null,
            scheduled_at: slot.scheduled_at,
            origin_type: 'sem_r2',
            origin_week_label: weekLabel,
            r2_status_name: status?.name || 'Sem status',
            r2_status_color: status?.color || null,
            contact_email: saleInfo.email,
            meeting_id: slot.id,
          });
        }
      }

      return results;
    },
    staleTime: 5 * 60 * 1000,
  });
}
