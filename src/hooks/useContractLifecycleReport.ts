import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, differenceInDays, addDays, nextFriday, isFriday, startOfWeek, format } from 'date-fns';
import { getCustomWeekEnd } from '@/lib/dateHelpers';
import { getCarrinhoMetricBoundaries, getCartWeekStart } from '@/lib/carrinhoWeekBoundaries';

function normalizePhoneSuffix(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.slice(-9);
}

export interface ContractLifecycleFilters {
  startDate: Date;
  endDate: Date;
  weekStart?: Date;
  closerR1Id?: string;
  situacao?: string;
}

export type ContractSituacao = 'reembolso' | 'no_show' | 'desistente' | 'realizada' | 'proxima_semana' | 'agendado' | 'pre_agendado' | 'pendente';

export interface ContractLifecycleRow {
  id: string;
  leadName: string | null;
  phone: string | null;
  contractPaidAt: string | null;
  dealId: string | null;
  r1Date: string | null;
  r1CloserName: string | null;
  r1Status: string | null;
  sdrName: string | null;
  hasR2: boolean;
  r2Date: string | null;
  r2CloserName: string | null;
  r2StatusName: string | null;
  r2StatusColor: string | null;
  r2AttendeeStatus: string | null;
  carrinhoStatus: string | null;
  carrinhoWeekStart: string | null;
  diasParado: number | null;
  situacao: ContractSituacao;
  situacaoLabel: string;
}

/** Get the Friday cutoff for a given week start (Thursday).
 *  If weekStart is provided, friday = weekStart + 8 days (the carrinho Friday after the safra).
 *  Otherwise falls back to the current week's Friday.
 */
function getFridayCutoff(weekStart?: Date, horarioCorte?: string): Date {
  const [cutH, cutM] = (horarioCorte || '12:00').split(':').map(Number);

  if (weekStart) {
    // Carrinho Friday = safra Thursday + 8 days
    const friday = addDays(new Date(weekStart), 8);
    friday.setHours(cutH, cutM || 0, 0, 0);
    return friday;
  }

  // Fallback: current week
  const now = new Date();
  const weekEnd = getCustomWeekEnd(now);
  const friday = weekEnd;
  friday.setHours(cutH, cutM || 0, 0, 0);
  return friday;
}

function classifySituacao(
  r1Status: string | null,
  r2AttendeeStatus: string | null,
  r2StatusName: string | null,
  r2Date: string | null,
  fridayCutoff: Date,
  isHublaRefunded: boolean = false,
): { situacao: ContractSituacao; label: string } {
  // 1. Reembolso (R1 status OR Hubla transaction refunded)
  if (r1Status === 'refunded' || isHublaRefunded) {
    return { situacao: 'reembolso', label: '💰 Reembolso' };
  }

  // 2. No-show on R2
  if (r2AttendeeStatus === 'no_show') {
    return { situacao: 'no_show', label: '❌ No-show' };
  }

  // 3. Desistente (via r2_status_options name)
  if (r2StatusName && r2StatusName.toLowerCase().includes('desistente')) {
    return { situacao: 'desistente', label: '🚫 Desistente' };
  }

  // 4. Realizada
  if (r2AttendeeStatus === 'completed' || r2AttendeeStatus === 'contract_paid') {
    return { situacao: 'realizada', label: '✅ Realizada' };
  }

  // 5 & 6. Agendado / Próxima Semana
  if (r2AttendeeStatus === 'invited' || r2AttendeeStatus === 'scheduled') {
    if (r2Date) {
      const r2DateTime = new Date(r2Date);
      if (r2DateTime >= fridayCutoff) {
        return { situacao: 'proxima_semana', label: '📅 Próxima Semana' };
      }
    }
    return { situacao: 'agendado', label: '✅ Agendado' };
  }

  // 6. Pré-agendado
  if (r2AttendeeStatus === 'pre_scheduled') {
    return { situacao: 'pre_agendado', label: '🔜 Pré-agendado' };
  }

  // 7. Pendente (everything else)
  return { situacao: 'pendente', label: '⏳ Pendente' };
}

export function useContractLifecycleReport(filters: ContractLifecycleFilters) {
  return useQuery({
    queryKey: ['contract-lifecycle-report', filters.startDate.toISOString(), filters.endDate.toISOString(), filters.closerR1Id, filters.situacao, filters.weekStart?.toISOString()],
    staleTime: 30000,
    queryFn: async () => {
      // Step 1: Get R1 attendees with contract_paid_at in the period
      const { data: r1Attendees, error: r1Error } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id,
          attendee_name,
          attendee_phone,
          contract_paid_at,
          deal_id,
          status,
          is_partner,
          meeting_slot:meeting_slots!inner(
            id,
            scheduled_at,
            meeting_type,
            booked_by,
            closer:closers!meeting_slots_closer_id_fkey(id, name)
          ),
          deal:crm_deals(
            id,
            name,
            contact_id,
            origin_id,
            contact:crm_contacts(name, phone, email)
          )
        `)
        .eq('meeting_slot.meeting_type', 'r1')
        .not('contract_paid_at', 'is', null)
        .gte('contract_paid_at', startOfDay(filters.startDate).toISOString())
        .lte('contract_paid_at', endOfDay(filters.endDate).toISOString())
        .neq('status', 'cancelled')
        .eq('is_partner', false);

      if (r1Error) throw r1Error;

      // Step 1b: Filter R1 attendees to BU Incorporador origins only
      const { data: buMappings } = await supabase
        .from('bu_origin_mapping')
        .select('entity_type, entity_id')
        .eq('bu', 'incorporador');

      const directOriginIds = (buMappings || [])
        .filter((m: any) => m.entity_type === 'origin')
        .map((m: any) => m.entity_id);
      const groupIds = (buMappings || [])
        .filter((m: any) => m.entity_type === 'group')
        .map((m: any) => m.entity_id);

      let allBUOriginIds = [...directOriginIds];
      if (groupIds.length > 0) {
        const { data: childOrigins } = await supabase
          .from('crm_origins')
          .select('id')
          .in('group_id', groupIds);
        allBUOriginIds.push(...(childOrigins || []).map((o: any) => o.id));
      }
      const incorporadorOriginIds = new Set(allBUOriginIds);

      const filteredR1Attendees = (r1Attendees || []).filter((a: any) => {
        const originId = a.deal?.origin_id;
        if (!originId) return true;
        return incorporadorOriginIds.has(originId);
      });

      // Step 2: Collect booked_by UUIDs and resolve SDR names
      const bookedByIds = [...new Set(
        filteredR1Attendees
          .map((a: any) => a.meeting_slot?.booked_by)
          .filter(Boolean) as string[]
      )];

      let profilesMap: Record<string, string> = {};
      if (bookedByIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', bookedByIds);
        if (profiles) {
          for (const p of profiles) {
            if (p.id && p.full_name) profilesMap[p.id] = p.full_name;
          }
        }
      }

      // Step 3: Collect deal_ids and expand via contact_id for cross-pipeline R2 lookup
      const originalDealIds = filteredR1Attendees
        .map((a: any) => a.deal_id)
        .filter(Boolean) as string[];

      // Build contact → original deal mapping
      const contactToDealMap = new Map<string, string[]>();
      for (const att of filteredR1Attendees as any[]) {
        const cid = att.deal?.contact_id;
        const did = att.deal_id;
        if (cid && did) {
          if (!contactToDealMap.has(cid)) contactToDealMap.set(cid, []);
          const arr = contactToDealMap.get(cid)!;
          if (!arr.includes(did)) arr.push(did);
        }
      }

      // Fetch sibling deals for the same contacts (cross-pipeline)
      const contactIds = [...contactToDealMap.keys()];
      const siblingToOriginal = new Map<string, string>();
      const allDealIdsForR2 = new Set(originalDealIds);

      if (contactIds.length > 0) {
        for (let i = 0; i < contactIds.length; i += 200) {
          const chunk = contactIds.slice(i, i + 200);
          const { data: siblingDeals } = await supabase
            .from('crm_deals')
            .select('id, contact_id')
            .in('contact_id', chunk);

          for (const sd of siblingDeals || []) {
            allDealIdsForR2.add(sd.id);
            if (!originalDealIds.includes(sd.id) && sd.contact_id) {
              const originals = contactToDealMap.get(sd.contact_id) || [];
              if (originals.length > 0) {
                siblingToOriginal.set(sd.id, originals[0]);
              }
            }
          }
        }
      }

      // Step 4: Fetch R2 attendees for expanded deal list
      let r2Map: Record<string, {
        r2Date: string | null;
        r2CloserName: string | null;
        r2StatusName: string | null;
        r2StatusColor: string | null;
        r2StatusId: string | null;
        r2AttendeeStatus: string | null;
        carrinhoStatus: string | null;
        carrinhoWeekStart: string | null;
      }> = {};

      const allDealIdsArray = [...allDealIdsForR2];
      if (allDealIdsArray.length > 0) {
        for (let i = 0; i < allDealIdsArray.length; i += 200) {
          const chunk = allDealIdsArray.slice(i, i + 200);
          const { data: r2Data } = await supabase
            .from('meeting_slot_attendees')
            .select(`
              deal_id,
              status,
              r2_status_id,
              carrinho_status,
              carrinho_week_start,
              r2_status:r2_status_options(id, name, color),
              meeting_slot:meeting_slots!inner(
                scheduled_at,
                meeting_type,
                closer:closers!meeting_slots_closer_id_fkey(id, name)
              )
            `)
            .eq('meeting_slot.meeting_type', 'r2')
            .in('deal_id', chunk)
            .neq('status', 'cancelled');

          if (r2Data) {
            for (const r2 of r2Data as any[]) {
              const ms = r2.meeting_slot;
              if (r2.deal_id && ms) {
                const mappedDealId = siblingToOriginal.get(r2.deal_id) || r2.deal_id;
                const existing = r2Map[mappedDealId];
                const newDate = ms.scheduled_at;
                if (!existing || (newDate && (!existing.r2Date || newDate > existing.r2Date))) {
                  r2Map[mappedDealId] = {
                    r2Date: ms.scheduled_at,
                    r2CloserName: ms.closer?.name || null,
                    r2StatusName: r2.r2_status?.name || null,
                    r2StatusColor: r2.r2_status?.color || null,
                    r2StatusId: r2.r2_status_id,
                    r2AttendeeStatus: r2.status,
                    carrinhoStatus: r2.carrinho_status,
                    carrinhoWeekStart: r2.carrinho_week_start,
                  };
                }
              }
            }
          }
        }
      }

      // Step 4b: Fetch refunded Hubla transactions in the period to cross-reference
      const refundedEmailsSet = new Set<string>();
      const refundedPhonesSet = new Set<string>();
      {
        const { data: refundedTx } = await supabase
          .from('hubla_transactions')
          .select('customer_email, customer_phone, linked_attendee_id')
          .eq('sale_status', 'refunded')
          .ilike('product_name', '%Contrato%')
          .gte('sale_date', startOfDay(filters.startDate).toISOString())
          .lte('sale_date', endOfDay(filters.endDate).toISOString());

        if (refundedTx) {
          for (const tx of refundedTx) {
            if (tx.customer_email) {
              refundedEmailsSet.add(tx.customer_email.toLowerCase().trim());
            }
            if (tx.customer_phone) {
              const suffix = normalizePhoneSuffix(tx.customer_phone);
              if (suffix.length >= 8) {
                refundedPhonesSet.add(suffix);
              }
            }
          }
        }
      }

      // Build maps: attendee id -> contact email/phone for cross-referencing
      const attendeeEmailMap = new Map<string, string>();
      const attendeePhoneMap = new Map<string, string>();
      for (const att of filteredR1Attendees as any[]) {
        const email = att.deal?.contact?.email;
        if (email && att.id) {
          attendeeEmailMap.set(att.id, email.toLowerCase().trim());
        }
        const phone = att.attendee_phone || att.deal?.contact?.phone;
        if (phone && att.id) {
          attendeePhoneMap.set(att.id, phone);
        }
      }

      const now = new Date();
      const fridayCutoff = getFridayCutoff(filters.weekStart);

      // Step 5: Transform into rows
      const rows: ContractLifecycleRow[] = filteredR1Attendees.map((att: any) => {
        const ms = att.meeting_slot;
        const deal = att.deal;
        const r2Info = att.deal_id ? r2Map[att.deal_id] : null;

        const hasR2 = !!r2Info;

        // Check if Hubla marks this as refunded (by email or phone)
        const contactEmail = attendeeEmailMap.get(att.id);
        const contactPhone = attendeePhoneMap.get(att.id);
        const isHublaRefunded = 
          (contactEmail ? refundedEmailsSet.has(contactEmail) : false) ||
          (contactPhone ? refundedPhonesSet.has(normalizePhoneSuffix(contactPhone)) : false);

        // Classify situacao
        const { situacao, label: situacaoLabel } = classifySituacao(
          att.status,
          r2Info?.r2AttendeeStatus || null,
          r2Info?.r2StatusName || null,
          r2Info?.r2Date || null,
          fridayCutoff,
          isHublaRefunded,
        );

        // Calculate dias parado for non-terminal
        let diasParado: number | null = null;
        if (situacao === 'pendente' && att.contract_paid_at) {
          diasParado = differenceInDays(now, new Date(att.contract_paid_at));
        }

        // Resolve SDR name
        const bookedBy = ms?.booked_by;
        const sdrName = bookedBy ? (profilesMap[bookedBy] || null) : null;

        return {
          id: att.id,
          leadName: att.attendee_name || deal?.contact?.name || deal?.name || null,
          phone: att.attendee_phone || deal?.contact?.phone || null,
          contractPaidAt: att.contract_paid_at,
          dealId: att.deal_id,
          r1Date: ms?.scheduled_at || null,
          r1CloserName: ms?.closer?.name || null,
          r1Status: att.status,
          sdrName,
          hasR2,
          r2Date: r2Info?.r2Date || null,
          r2CloserName: r2Info?.r2CloserName || null,
          r2StatusName: r2Info?.r2StatusName || null,
          r2StatusColor: r2Info?.r2StatusColor || null,
          r2AttendeeStatus: r2Info?.r2AttendeeStatus || null,
          carrinhoStatus: r2Info?.carrinhoStatus || null,
          carrinhoWeekStart: r2Info?.carrinhoWeekStart || null,
          diasParado,
          situacao,
          situacaoLabel,
        };
      });

      // Apply filters
      let filtered = rows;
      if (filters.situacao && filters.situacao !== 'all') {
        filtered = rows.filter(r => r.situacao === filters.situacao);
      }

      // Sort by contract_paid_at desc
      filtered.sort((a, b) => {
        const da = a.contractPaidAt ? new Date(a.contractPaidAt).getTime() : 0;
        const db = b.contractPaidAt ? new Date(b.contractPaidAt).getTime() : 0;
        return db - da;
      });

      return filtered;
    },
  });
}

export function useR1ClosersForReport() {
  return useQuery({
    queryKey: ['r1-closers-for-lifecycle-report'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('closers')
        .select('id, name')
        .eq('is_active', true)
        .eq('meeting_type', 'r1')
        .order('name');

      if (error) throw error;
      return data || [];
    },
  });
}
