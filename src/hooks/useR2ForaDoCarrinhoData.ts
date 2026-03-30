import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { CarrinhoConfig } from '@/hooks/useCarrinhoConfig';
import { getCarrinhoMetricBoundaries } from '@/lib/carrinhoWeekBoundaries';

export interface R2ForaDoCarrinhoAttendee {
  id: string;
  attendee_name: string | null;
  attendee_phone: string | null;
  r2_status_id: string | null;
  r2_status_name: string;
  r2_status_color: string;
  motivo: string | null;
  closer_name: string | null;
  closer_color: string | null;
  scheduled_at: string;
  deal_name: string | null;
  contact_phone: string | null;
  meeting_id: string;
}

const FORA_DO_CARRINHO_STATUSES = ['Reembolso', 'Desistente', 'Reprovado', 'Próxima Semana', 'Cancelado'];

export function useR2ForaDoCarrinhoData(weekStart: Date, weekEnd: Date, carrinhoConfig?: CarrinhoConfig) {
  return useQuery({
    queryKey: ['r2-fora-carrinho-data', format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd')],
    queryFn: async (): Promise<R2ForaDoCarrinhoAttendee[]> => {
      const boundaries = getCarrinhoMetricBoundaries(weekStart, weekEnd, carrinhoConfig);

      // ===== STEP 1: Get safra contracts (Thu-Wed) =====
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
      if (emails.length === 0) return [];

      // ===== STEP 2: Resolve emails → contacts =====
      const { data: contacts } = await supabase
        .from('crm_contacts')
        .select('id, email')
        .in('email', emails);

      const emailToContactId = new Map<string, string>();
      for (const c of contacts || []) {
        if (c.email) emailToContactId.set(c.email.toLowerCase().trim(), c.id);
      }

      const contactIds = Array.from(new Set(Array.from(emailToContactId.values())));
      if (contactIds.length === 0) return [];

      // Build contactId → saleDate
      const contactToSaleDate = new Map<string, string>();
      for (const tx of uniqueContracts) {
        const email = (tx.customer_email || '').toLowerCase().trim();
        const cid = emailToContactId.get(email);
        if (cid && !contactToSaleDate.has(cid)) contactToSaleDate.set(cid, tx.sale_date);
      }

      // ===== STEP 3: Fetch status options =====
      const { data: statusOptions } = await supabase
        .from('r2_status_options')
        .select('id, name, color')
        .eq('is_active', true);

      const foraStatusIds = statusOptions
        ?.filter(s => FORA_DO_CARRINHO_STATUSES.some(name =>
          s.name.toLowerCase() === name.toLowerCase()
        ))
        .map(s => s.id) || [];

      if (foraStatusIds.length === 0) return [];

      const statusMap = new Map<string, { id: string; name: string; color: string }>();
      (statusOptions || []).forEach(s => statusMap.set(s.id, s));

      // ===== STEP 4: Fetch R2 attendees for safra contacts =====
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

      if (!r2Attendees) return [];

      // ===== STEP 5: Group by contact, pick first R2 after sale_date with fora status =====
      const contactR2Map = new Map<string, typeof r2Attendees>();
      for (const att of r2Attendees) {
        const cid = (att as any).contact_id;
        if (!cid) continue;
        if (!contactR2Map.has(cid)) contactR2Map.set(cid, []);
        contactR2Map.get(cid)!.push(att);
      }

      // Fetch deal info for motivo
      const allDealIds = r2Attendees.map(a => (a as any).deal_id).filter(Boolean);
      const { data: deals } = allDealIds.length > 0
        ? await supabase
            .from('crm_deals')
            .select('id, name, custom_fields, contact:crm_contacts(phone)')
            .in('id', allDealIds)
        : { data: null };

      const dealMap = new Map<string, any>();
      if (deals) deals.forEach(d => dealMap.set(d.id, d));

      const result: R2ForaDoCarrinhoAttendee[] = [];

      for (const [contactId, allR2s] of contactR2Map) {
        const saleDate = contactToSaleDate.get(contactId);
        if (!saleDate) continue;
        const saleDateMs = new Date(saleDate).getTime();

        // Filter R2s after contract, sort ascending
        const validR2s = allR2s
          .filter(r => {
            const slot = (r as any).meeting_slot;
            if (!slot?.scheduled_at) return false;
            return new Date(slot.scheduled_at).getTime() > saleDateMs;
          })
          .sort((a, b) => {
            const slotA = (a as any).meeting_slot;
            const slotB = (b as any).meeting_slot;
            return new Date(slotA.scheduled_at).getTime() - new Date(slotB.scheduled_at).getTime();
          });

        if (validR2s.length === 0) continue;

        const att = validR2s[0] as any;

        // Only include if has a "fora do carrinho" status
        if (!att.r2_status_id || !foraStatusIds.includes(att.r2_status_id)) continue;

        const slot = att.meeting_slot;
        const closerData = Array.isArray(slot?.closer) ? slot.closer[0] : slot?.closer;
        const status = statusMap.get(att.r2_status_id);
        const deal = att.deal_id ? dealMap.get(att.deal_id) : null;
        const customFields = deal?.custom_fields as Record<string, unknown> | null | undefined;

        const motivo = (customFields?.justificativa_reembolso as string | undefined)
          || (customFields?.motivo_sem_interesse as string | undefined)
          || (customFields?.motivo_desistencia as string | undefined)
          || (customFields?.motivo_reprovado as string | undefined)
          || null;

        const contactData = deal?.contact;
        const contactPhone = Array.isArray(contactData)
          ? contactData[0]?.phone
          : contactData?.phone;

        result.push({
          id: att.id,
          attendee_name: att.attendee_name,
          attendee_phone: att.attendee_phone,
          r2_status_id: att.r2_status_id,
          r2_status_name: status?.name || 'Desconhecido',
          r2_status_color: status?.color || '#6B7280',
          motivo,
          closer_name: closerData?.name || null,
          closer_color: closerData?.color || null,
          scheduled_at: slot.scheduled_at,
          deal_name: deal?.name || null,
          contact_phone: contactPhone || null,
          meeting_id: slot.id,
        });
      }

      return result.sort((a, b) =>
        new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()
      );
    },
  });
}
