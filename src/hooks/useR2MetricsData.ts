import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, endOfDay } from 'date-fns';
import { CarrinhoConfig } from '@/hooks/useCarrinhoConfig';
import { getCarrinhoMetricBoundaries } from '@/lib/carrinhoWeekBoundaries';

export interface CloserConversion {
  closerId: string;
  closerName: string;
  closerColor: string;
  aprovados: number;
  vendas: number;
  conversion: number;
}

export interface R2MetricsData {
  totalLeads: number;
  leadsAtivos: number;
  desistentes: number;
  reprovados: number;
  reembolsos: number;
  proximaSemana: number;
  noShow: number;
  leadsPerdidosPercent: number;
  noShowAttendees: Array<{
    id: string;
    name: string;
    phone: string | null;
    meetingId: string;
  }>;
  selecionados: number;
  vendas: number;
  vendasExtras: number;
  conversaoGeral: number;
  closerConversions: CloserConversion[];
}

const normalizePhone = (phone: string | null): string | null => {
  if (!phone) return null;
  return phone.replace(/\D/g, '').slice(-11);
};

export function useR2MetricsData(weekStart: Date, weekEnd: Date, carrinhoConfig?: CarrinhoConfig) {
  return useQuery({
    queryKey: ['r2-metrics-data', format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd')],
    queryFn: async (): Promise<R2MetricsData> => {
      const boundaries = getCarrinhoMetricBoundaries(weekStart, weekEnd, carrinhoConfig);

      // ===== STEP 1: Safra contracts (Thu-Wed) =====
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

      if (emails.length === 0) {
        return emptyMetrics();
      }

      // ===== STEP 2: Resolve emails → contacts =====
      const { data: contacts } = await supabase
        .from('crm_contacts')
        .select('id, email, phone')
        .in('email', emails);

      const emailToContactId = new Map<string, string>();
      for (const c of contacts || []) {
        if (c.email) emailToContactId.set(c.email.toLowerCase().trim(), c.id);
      }

      const contactIds = Array.from(new Set(Array.from(emailToContactId.values())));
      if (contactIds.length === 0) return emptyMetrics();

      const contactToSaleDate = new Map<string, string>();
      for (const tx of uniqueContracts) {
        const email = (tx.customer_email || '').toLowerCase().trim();
        const cid = emailToContactId.get(email);
        if (cid && !contactToSaleDate.has(cid)) contactToSaleDate.set(cid, tx.sale_date);
      }

      // ===== STEP 3: R2 status options =====
      const { data: statusOptions } = await supabase
        .from('r2_status_options')
        .select('id, name')
        .eq('is_active', true);

      const statusMap = new Map(statusOptions?.map(s => [s.id, s.name.toLowerCase()]) || []);

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
          deal_id,
          contact_id,
          deal:crm_deals(
            id,
            contact:crm_contacts(email, phone)
          ),
          meeting_slot:meeting_slots!inner(
            id,
            status,
            scheduled_at,
            meeting_type,
            closer:closers!meeting_slots_closer_id_fkey(id, name, color)
          )
        `)
        .in('contact_id', contactIds)
        .eq('meeting_slot.meeting_type', 'r2');

      // ===== STEP 5: Group by contact, pick first valid R2 =====
      const contactR2Map = new Map<string, any[]>();
      for (const att of r2Attendees || []) {
        const cid = (att as any).contact_id;
        if (!cid) continue;
        if (!contactR2Map.has(cid)) contactR2Map.set(cid, []);
        contactR2Map.get(cid)!.push(att);
      }

      // Check no-show rescheduling
      const allAttendeeIds = (r2Attendees || []).map(a => a.id);
      const noShowIds = (r2Attendees || [])
        .filter(a => a.status === 'no_show')
        .map(a => a.id);

      let rescheduledIds = new Set<string>();
      if (noShowIds.length > 0) {
        const { data: rescheduledChildren } = await supabase
          .from('meeting_slot_attendees')
          .select('parent_attendee_id')
          .in('parent_attendee_id', noShowIds);
        rescheduledIds = new Set(rescheduledChildren?.map(c => c.parent_attendee_id).filter(Boolean) as string[]);
      }

      // Build leads map (one per contact/contract)
      interface LeadRecord {
        attendee_id: string;
        status: string;
        r2_status: string;
        r2_status_id: string | null;
        scheduled_at: string;
        closer_id: string;
        closer_name: string;
        closer_color: string;
        attendee_name: string | null;
        attendee_phone: string | null;
        contact_email: string | null;
        contact_phone: string | null;
        is_no_show: boolean;
      }

      const leadsByContact = new Map<string, LeadRecord>();

      for (const [contactId, allR2s] of contactR2Map) {
        const saleDate = contactToSaleDate.get(contactId);
        if (!saleDate) continue;
        const saleDateMs = new Date(saleDate).getTime();

        const validR2s = allR2s
          .filter((r: any) => {
            const slot = r.meeting_slot;
            if (!slot?.scheduled_at) return false;
            if (slot.status === 'cancelled') return false;
            return new Date(slot.scheduled_at).getTime() > saleDateMs;
          })
          .sort((a: any, b: any) =>
            new Date(a.meeting_slot.scheduled_at).getTime() - new Date(b.meeting_slot.scheduled_at).getTime()
          );

        if (validR2s.length === 0) continue;

        const att = validR2s[0] as any;
        const slot = att.meeting_slot;
        const closerData = slot?.closer;
        const statusName = att.r2_status_id ? statusMap.get(att.r2_status_id) || '' : '';

        const isNoShow = att.status === 'no_show' && !rescheduledIds.has(att.id);

        leadsByContact.set(contactId, {
          attendee_id: att.id,
          status: att.status,
          r2_status: statusName,
          r2_status_id: att.r2_status_id,
          scheduled_at: slot.scheduled_at,
          closer_id: closerData?.id || 'unknown',
          closer_name: closerData?.name || 'Sem closer',
          closer_color: closerData?.color || '#6B7280',
          attendee_name: att.attendee_name,
          attendee_phone: att.attendee_phone,
          contact_email: att.deal?.contact?.email || null,
          contact_phone: att.deal?.contact?.phone || att.attendee_phone,
          is_no_show: isNoShow,
        });
      }

      // ===== STEP 6: Count metrics =====
      let desistentes = 0;
      let reprovados = 0;
      let proximaSemana = 0;
      let noShow = 0;
      let aprovados = 0;
      let reembolsosCount = 0;

      const approvedEmails: string[] = [];
      const approvedPhones: string[] = [];
      const noShowAttendees: R2MetricsData['noShowAttendees'] = [];

      const closerStats = new Map<string, { name: string; color: string; aprovados: number; vendas: number }>();
      const approvedAttendeeIds = new Set<string>();
      const attendeeIdToCloser = new Map<string, string>();

      leadsByContact.forEach((lead) => {
        const closerId = lead.closer_id;
        if (!closerStats.has(closerId)) {
          closerStats.set(closerId, { name: lead.closer_name, color: lead.closer_color, aprovados: 0, vendas: 0 });
        }

        if (lead.r2_status.includes('desistente')) {
          desistentes++;
        } else if (lead.r2_status.includes('reembolso')) {
          reembolsosCount++;
        } else if (lead.r2_status.includes('reprovado')) {
          reprovados++;
        } else if (lead.r2_status.includes('próxima semana') || lead.r2_status.includes('proxima semana')) {
          proximaSemana++;
        } else if (lead.is_no_show) {
          noShow++;
          noShowAttendees.push({
            id: lead.attendee_id,
            name: lead.attendee_name || 'Sem nome',
            phone: lead.attendee_phone,
            meetingId: lead.attendee_id,
          });
        } else if (lead.r2_status.includes('aprovado') || lead.r2_status.includes('approved')) {
          aprovados++;
          closerStats.get(closerId)!.aprovados++;
          approvedAttendeeIds.add(lead.attendee_id);
          attendeeIdToCloser.set(lead.attendee_id, closerId);

          if (lead.contact_email) approvedEmails.push(lead.contact_email.toLowerCase());
          if (lead.contact_phone) {
            const normalized = normalizePhone(lead.contact_phone);
            if (normalized) approvedPhones.push(normalized);
          }
        }
      });

      const agendadosPendentes = leadsByContact.size - desistentes - reprovados - reembolsosCount - proximaSemana - noShow - aprovados;
      const totalLeads = agendadosPendentes + aprovados;

      // ===== STEP 7: Vendas (using vendasParceria boundaries) =====
      const { data: hublaVendas } = await supabase
        .from('hubla_transactions')
        .select('id, customer_email, customer_phone, net_value, linked_attendee_id')
        .eq('product_category', 'parceria')
        .gte('sale_date', boundaries.vendasParceria.start.toISOString())
        .lte('sale_date', boundaries.vendasParceria.end.toISOString());

      // Vendas extras
      const { data: vendasExtras } = await supabase
        .from('r2_vendas_extras')
        .select('*')
        .eq('week_start', format(weekStart, 'yyyy-MM-dd'));

      // Match sales
      const matchedClosers = new Map<string, number>();
      const countedSaleKeys = new Set<string>();

      hublaVendas?.forEach(venda => {
        const vendaEmail = venda.customer_email?.toLowerCase();
        const vendaPhone = normalizePhone(venda.customer_phone);

        const emailMatch = vendaEmail && approvedEmails.includes(vendaEmail);
        const phoneMatch = vendaPhone && approvedPhones.includes(vendaPhone);
        const linkedMatch = venda.linked_attendee_id && approvedAttendeeIds.has(venda.linked_attendee_id);

        if (emailMatch || phoneMatch || linkedMatch) {
          const saleKey = vendaEmail || vendaPhone || venda.id;
          if (countedSaleKeys.has(saleKey)) return;
          countedSaleKeys.add(saleKey);

          let matchedCloserId: string | null = null;
          if (linkedMatch && venda.linked_attendee_id) {
            matchedCloserId = attendeeIdToCloser.get(venda.linked_attendee_id) || null;
          } else {
            // Match by email/phone to find closer
            for (const [, lead] of leadsByContact) {
              const leadEmail = lead.contact_email?.toLowerCase();
              const leadPhone = normalizePhone(lead.contact_phone);
              if ((vendaEmail && leadEmail === vendaEmail) || (vendaPhone && leadPhone === vendaPhone)) {
                if (lead.r2_status.includes('aprovado') || lead.r2_status.includes('approved')) {
                  matchedCloserId = lead.closer_id;
                  break;
                }
              }
            }
          }

          if (matchedCloserId) {
            matchedClosers.set(matchedCloserId, (matchedClosers.get(matchedCloserId) || 0) + 1);
          }
        }
      });

      const vendas = countedSaleKeys.size;
      matchedClosers.forEach((count, closerId) => {
        const stats = closerStats.get(closerId);
        if (stats) stats.vendas = count;
      });

      const reembolsos = reembolsosCount;
      const leadsPerdidosCount = desistentes + reprovados + reembolsosCount;
      const leadsPerdidosPercent = totalLeads > 0 ? (leadsPerdidosCount / totalLeads) * 100 : 0;
      const leadsAtivos = aprovados;
      const selecionados = aprovados;
      const totalVendasExtras = (vendasExtras?.length || 0);
      const totalVendas = vendas + totalVendasExtras;
      const conversaoGeral = selecionados > 0 ? (totalVendas / selecionados) * 100 : 0;

      const closerConversions: CloserConversion[] = Array.from(closerStats.entries())
        .filter(([_, stats]) => stats.aprovados > 0)
        .map(([closerId, stats]) => ({
          closerId,
          closerName: stats.name,
          closerColor: stats.color,
          aprovados: stats.aprovados,
          vendas: stats.vendas,
          conversion: stats.aprovados > 0 ? (stats.vendas / stats.aprovados) * 100 : 0,
        }))
        .sort((a, b) => b.aprovados - a.aprovados);

      return {
        totalLeads,
        leadsAtivos,
        desistentes,
        reprovados,
        reembolsos,
        proximaSemana,
        noShow,
        leadsPerdidosPercent,
        noShowAttendees,
        selecionados,
        vendas: totalVendas,
        vendasExtras: totalVendasExtras,
        conversaoGeral,
        closerConversions,
      };
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

function emptyMetrics(): R2MetricsData {
  return {
    totalLeads: 0,
    leadsAtivos: 0,
    desistentes: 0,
    reprovados: 0,
    reembolsos: 0,
    proximaSemana: 0,
    noShow: 0,
    leadsPerdidosPercent: 0,
    noShowAttendees: [],
    selecionados: 0,
    vendas: 0,
    vendasExtras: 0,
    conversaoGeral: 0,
    closerConversions: [],
  };
}

// Hook for adding external sales
export function useAddVendaExtra() {
  return {
    addVenda: async (data: {
      weekStart: Date;
      attendeeName: string;
      attendeePhone?: string;
      attendeeEmail?: string;
      closerId?: string;
      notes?: string;
    }) => {
      const { error } = await supabase
        .from('r2_vendas_extras')
        .insert({
          week_start: format(data.weekStart, 'yyyy-MM-dd'),
          attendee_name: data.attendeeName,
          attendee_phone: data.attendeePhone || null,
          attendee_email: data.attendeeEmail || null,
          closer_id: data.closerId || null,
          notes: data.notes || null,
        });

      if (error) throw error;
    },
  };
}
