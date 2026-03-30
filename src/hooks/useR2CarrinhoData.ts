import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { CarrinhoConfig } from '@/hooks/useCarrinhoConfig';
import { getCarrinhoMetricBoundaries } from '@/lib/carrinhoWeekBoundaries';

export interface R2CarrinhoAttendee {
  id: string;
  attendee_name: string | null;
  attendee_phone: string | null;
  status: string;
  r2_status_id: string | null;
  r2_status_name: string | null;
  carrinho_status: string | null;
  carrinho_updated_at: string | null;
  deal_id: string | null;
  meeting_id: string;
  meeting_status: string;
  scheduled_at: string;
  closer_id: string | null;
  closer_name: string | null;
  closer_color: string | null;
  deal_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  partner_name: string | null;
  r1_date: string | null;
  r1_closer_name: string | null;
  contract_paid_at: string | null;
}

/**
 * Fetches safra contracts (Thu-Wed), resolves to contacts, then fetches
 * R2 attendees for those contacts (first R2 after sale_date).
 */
async function fetchSafraContracts(boundaries: ReturnType<typeof getCarrinhoMetricBoundaries>) {
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
  return Array.from(emailMap.values());
}

async function resolveContactIds(emails: string[]) {
  if (emails.length === 0) return new Map<string, string>();
  const { data: contacts } = await supabase
    .from('crm_contacts')
    .select('id, email')
    .in('email', emails);

  const map = new Map<string, string>();
  for (const c of contacts || []) {
    if (c.email) map.set(c.email.toLowerCase().trim(), c.id);
  }
  return map;
}

export function useR2CarrinhoData(weekStart: Date, weekEnd: Date, filter?: 'agendadas' | 'no_show' | 'realizadas' | 'aprovados', carrinhoConfig?: CarrinhoConfig) {
  return useQuery({
    queryKey: ['r2-carrinho-data', format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd'), filter],
    queryFn: async (): Promise<R2CarrinhoAttendee[]> => {
      const boundaries = getCarrinhoMetricBoundaries(weekStart, weekEnd, carrinhoConfig);

      // ===== STEP 1: Get safra contracts (Thu-Wed) =====
      const uniqueContracts = await fetchSafraContracts(boundaries);
      const emails = uniqueContracts.map(t => (t.customer_email || '').toLowerCase().trim()).filter(Boolean);
      if (emails.length === 0) return [];

      // ===== STEP 2: Resolve emails → contacts =====
      const emailToContactId = await resolveContactIds(emails);
      const contactIds = Array.from(new Set(Array.from(emailToContactId.values())));
      if (contactIds.length === 0) return [];

      // Build contactId → saleDate map
      const contactToSaleDate = new Map<string, string>();
      for (const tx of uniqueContracts) {
        const email = (tx.customer_email || '').toLowerCase().trim();
        const cid = emailToContactId.get(email);
        if (cid && !contactToSaleDate.has(cid)) {
          contactToSaleDate.set(cid, tx.sale_date);
        }
      }

      // ===== STEP 3: Fetch R2 status options =====
      const { data: statusOptions } = await supabase
        .from('r2_status_options')
        .select('id, name');

      const statusMap = (statusOptions || []).reduce((acc, s) => {
        acc[s.id] = s.name;
        return acc;
      }, {} as Record<string, string>);

      const aprovadoStatusId = statusOptions?.find(s =>
        s.name.toLowerCase().includes('aprovado') ||
        s.name.toLowerCase().includes('approved')
      )?.id;

      // ===== STEP 4: Fetch ALL R2 attendees for safra contacts =====
      const { data: r2Attendees } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          attendee_name,
          attendee_phone,
          status,
          r2_status_id,
          carrinho_status,
          carrinho_updated_at,
          deal_id,
          contact_id,
          partner_name,
          contract_paid_at,
          deal:crm_deals(
            id,
            name,
            contact:crm_contacts(
              phone,
              email
            )
          ),
          meeting_slot:meeting_slots!inner(
            id,
            status,
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

      // ===== STEP 5: For each contact, pick first R2 after sale_date =====
      const contactR2Map = new Map<string, typeof r2Attendees>();
      for (const att of r2Attendees) {
        const cid = (att as any).contact_id;
        if (!cid) continue;
        if (!contactR2Map.has(cid)) contactR2Map.set(cid, []);
        contactR2Map.get(cid)!.push(att);
      }

      const attendees: R2CarrinhoAttendee[] = [];

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
        const slot = att.meeting_slot;
        const closerData = slot?.closer;

        // Apply filters
        if (filter === 'agendadas') {
          if (slot.status === 'cancelled' || slot.status === 'rescheduled') continue;
        } else if (filter === 'no_show') {
          if (slot.status !== 'no_show') continue;
        } else if (filter === 'realizadas') {
          if (slot.status !== 'completed') continue;
        } else if (filter === 'aprovados') {
          if (att.r2_status_id !== aprovadoStatusId) continue;
        }

        attendees.push({
          id: att.id,
          attendee_name: att.attendee_name,
          attendee_phone: att.attendee_phone,
          status: att.status,
          r2_status_id: att.r2_status_id,
          r2_status_name: att.r2_status_id ? statusMap[att.r2_status_id] : null,
          carrinho_status: att.carrinho_status,
          carrinho_updated_at: att.carrinho_updated_at,
          deal_id: att.deal_id,
          meeting_id: slot.id,
          meeting_status: slot.status,
          scheduled_at: slot.scheduled_at,
          closer_id: closerData?.id || null,
          closer_name: closerData?.name || null,
          closer_color: closerData?.color || null,
          deal_name: att.deal?.name || null,
          contact_phone: att.deal?.contact?.phone || null,
          contact_email: att.deal?.contact?.email || null,
          partner_name: att.partner_name,
          r1_date: null,
          r1_closer_name: null,
          contract_paid_at: att.contract_paid_at,
        });
      }

      // ===== STEP 6: Fetch R1 data for deal linking =====
      const dealIds = [...new Set(attendees.map(a => a.deal_id).filter(Boolean) as string[])];
      if (dealIds.length > 0) {
        const { data: r1Meetings } = await supabase
          .from('meeting_slots')
          .select(`
            scheduled_at,
            closer:closers!meeting_slots_closer_id_fkey(name),
            meeting_slot_attendees!inner(deal_id)
          `)
          .eq('meeting_type', 'r1')
          .in('meeting_slot_attendees.deal_id', dealIds);

        const r1Map = new Map<string, { date: string; closer_name: string | null }>();
        r1Meetings?.forEach(r1 => {
          const r1Attendees = r1.meeting_slot_attendees as Array<{ deal_id: string | null }>;
          const r1Closer = r1.closer as { name: string } | null;
          r1Attendees.forEach(rAtt => {
            if (rAtt.deal_id && !r1Map.has(rAtt.deal_id)) {
              r1Map.set(rAtt.deal_id, { date: r1.scheduled_at, closer_name: r1Closer?.name || null });
            }
          });
        });

        for (const att of attendees) {
          if (att.deal_id && r1Map.has(att.deal_id)) {
            att.r1_date = r1Map.get(att.deal_id)!.date;
            att.r1_closer_name = r1Map.get(att.deal_id)!.closer_name;
          }
        }
      }

      // Sort by scheduled_at ascending
      attendees.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

      return attendees;
    },
  });
}

export function useUpdateCarrinhoStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      attendeeId,
      status
    }: {
      attendeeId: string;
      status: 'vai_comprar' | 'comprou' | 'nao_comprou' | 'negociando' | 'quer_desistir' | null;
    }) => {
      const { error } = await supabase
        .from('meeting_slot_attendees')
        .update({
          carrinho_status: status,
          carrinho_updated_at: new Date().toISOString(),
        })
        .eq('id', attendeeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r2-carrinho-data'] });
      queryClient.invalidateQueries({ queryKey: ['r2-carrinho-kpis'] });
      toast.success('Status atualizado');
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    },
  });
}
