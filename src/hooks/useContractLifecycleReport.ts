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
  isPaidContract: boolean;
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
      // Step 1a: Fetch paid contracts from hubla_transactions (aligned with Carrinho)
      const contractBoundaryStart = startOfDay(filters.startDate).toISOString();
      const contractBoundaryEnd = endOfDay(filters.endDate).toISOString();

      const { data: hublaTx, error: hublaError } = await supabase
        .from('hubla_transactions')
        .select('customer_email, sale_date, hubla_id, source, product_name, installment_number, sale_status')
        .eq('product_name', 'A000 - Contrato')
        .in('sale_status', ['completed', 'refunded'])
        .in('source', ['hubla', 'manual', 'make', 'mcfpay', 'kiwify'])
        .gte('sale_date', contractBoundaryStart)
        .lte('sale_date', contractBoundaryEnd);

      if (hublaError) throw hublaError;

      // Apply Carrinho exclusion filters & deduplicate by email
      const emailTxMap = new Map<string, { email: string; saleDate: string; isRefunded: boolean }>();
      for (const tx of (hublaTx || []) as any[]) {
        // Exclude newsale- duplicates
        if (tx.hubla_id && String(tx.hubla_id).startsWith('newsale-')) continue;
        // Exclude make+contrato lowercase
        if (tx.source === 'make' && tx.product_name?.toLowerCase() === 'contrato') continue;
        // Exclude installment > 1
        if (tx.installment_number && tx.installment_number > 1) continue;

        const email = (tx.customer_email || '').toLowerCase().trim();
        if (!email) continue;

        const existing = emailTxMap.get(email);
        const isRefunded = tx.sale_status === 'refunded';
        if (!existing) {
          emailTxMap.set(email, { email, saleDate: tx.sale_date, isRefunded });
        } else {
          // If we already have a completed and this is refunded, mark as refunded
          if (isRefunded) existing.isRefunded = true;
        }
      }

      const uniqueEmails = [...emailTxMap.keys()];

      // Step 1b: Resolve emails → contacts → deals → R1 attendees
      // First fetch BU origin mapping
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

      // Fetch contacts by email
      let allContacts: any[] = [];
      for (let i = 0; i < uniqueEmails.length; i += 200) {
        const chunk = uniqueEmails.slice(i, i + 200);
        const { data: contacts } = await supabase
          .from('crm_contacts')
          .select('id, name, email, phone')
          .in('email', chunk);
        if (contacts) allContacts.push(...contacts);
      }

      // Build email → contact_ids map
      const emailToContactIds = new Map<string, string[]>();
      for (const c of allContacts) {
        const em = (c.email || '').toLowerCase().trim();
        if (!emailToContactIds.has(em)) emailToContactIds.set(em, []);
        emailToContactIds.get(em)!.push(c.id);
      }

      // Fetch deals by contact_ids
      const allContactIds = allContacts.map((c: any) => c.id);
      let allDeals: any[] = [];
      for (let i = 0; i < allContactIds.length; i += 200) {
        const chunk = allContactIds.slice(i, i + 200);
        const { data: deals } = await supabase
          .from('crm_deals')
          .select('id, name, contact_id, origin_id')
          .in('contact_id', chunk);
        if (deals) allDeals.push(...deals);
      }

      // Filter deals by BU incorporador
      const buDeals = allDeals.filter((d: any) => {
        if (!d.origin_id) return true;
        return incorporadorOriginIds.has(d.origin_id);
      });

      // Build contact_id → deal mapping
      const contactToDealIds = new Map<string, string[]>();
      for (const d of buDeals) {
        if (!contactToDealIds.has(d.contact_id)) contactToDealIds.set(d.contact_id, []);
        contactToDealIds.get(d.contact_id)!.push(d.id);
      }

      // Fetch R1 attendees for these deals
      const buDealIds = buDeals.map((d: any) => d.id);
      let allR1Attendees: any[] = [];
      for (let i = 0; i < buDealIds.length; i += 200) {
        const chunk = buDealIds.slice(i, i + 200);
        const { data: r1Data } = await supabase
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
          .in('deal_id', chunk)
          .neq('status', 'cancelled')
          .eq('is_partner', false);
        if (r1Data) allR1Attendees.push(...r1Data);
      }

      // Build email → R1 attendee (best one per email)
      const emailToR1 = new Map<string, any>();
      for (const att of allR1Attendees as any[]) {
        const email = (att.deal?.contact?.email || '').toLowerCase().trim();
        if (!email) continue;
        const existing = emailToR1.get(email);
        if (!existing) {
          emailToR1.set(email, att);
        } else {
          // Prefer the one with contract_paid_at, then most recent
          const existingPaid = !!existing.contract_paid_at;
          const newPaid = !!att.contract_paid_at;
          if ((!existingPaid && newPaid) || (existingPaid === newPaid && (att.meeting_slot?.scheduled_at || '') > (existing.meeting_slot?.scheduled_at || ''))) {
            emailToR1.set(email, att);
          }
        }
      }

      // Build final filteredR1Attendees: one row per unique email from Hubla
      let filteredR1Attendees: any[] = [];
      const processedEmails = new Set<string>();

      for (const [email, txInfo] of emailTxMap) {
        if (processedEmails.has(email)) continue;
        processedEmails.add(email);

        const r1Att = emailToR1.get(email);
        if (r1Att) {
          // Override refund status from Hubla transaction
          if (txInfo.isRefunded && r1Att.status !== 'refunded') {
            r1Att._hublaRefunded = true;
          }
          r1Att._hublaSaleDate = txInfo.saleDate;
          r1Att._isPaidFromHubla = true;
          filteredR1Attendees.push(r1Att);
        } else {
          // Create synthetic row — no R1 found for this email
          const contactIds = emailToContactIds.get(email) || [];
          let bestDeal: any = null;
          for (const cid of contactIds) {
            const dids = contactToDealIds.get(cid) || [];
            for (const did of dids) {
              const deal = buDeals.find((d: any) => d.id === did);
              if (deal) { bestDeal = deal; break; }
            }
            if (bestDeal) break;
          }
          const contact = allContacts.find((c: any) => (c.email || '').toLowerCase().trim() === email);
          filteredR1Attendees.push({
            id: `synthetic-hubla-${email}`,
            attendee_name: contact?.name || email,
            attendee_phone: contact?.phone || null,
            contract_paid_at: txInfo.saleDate,
            deal_id: bestDeal?.id || null,
            status: txInfo.isRefunded ? 'refunded' : 'outside',
            is_partner: false,
            meeting_slot: null,
            deal: bestDeal ? { ...bestDeal, contact: contact || null } : null,
            _hublaRefunded: txInfo.isRefunded,
            _hublaSaleDate: txInfo.saleDate,
            _isPaidFromHubla: true,
          });
        }
      }

      // Step 1c — Leads com R2 Aprovado na janela do carrinho (fora da safra)
      // Step 1d — Leads encaixados via carrinho_week_start
      if (filters.weekStart) {
        const weekStart = filters.weekStart;
        const weekEnd = addDays(weekStart, 6); // Qui + 6 = Qua

        // Fetch aprovado status ID
        const { data: statusOptions } = await supabase
          .from('r2_status_options')
          .select('id, name')
          .eq('is_active', true);
        const aprovadoId = statusOptions?.find((s: any) =>
          s.name.toLowerCase().includes('aprovado')
        )?.id;

        // Carrinho metric boundaries (Friday-to-Friday window)
        const boundaries = getCarrinhoMetricBoundaries(weekStart, weekEnd);
        const r2WindowStart = boundaries.aprovados.start;
        const r2WindowEnd = boundaries.aprovados.end;

        // Carrinho week start string for encaixados
        const cartWeekStart = getCartWeekStart(weekStart);
        const cartWeekStartStr = format(cartWeekStart, 'yyyy-MM-dd');

        // Collect deal_ids already captured
        const existingDealIds = new Set(
          filteredR1Attendees.map((a: any) => a.deal_id).filter(Boolean)
        );

        // --- Step 1c: R2 Aprovado in window ---
        let extraDealIdsFromR2: string[] = [];
        if (aprovadoId) {
          const r2AprovadoQuery = supabase
            .from('meeting_slot_attendees')
            .select(`
              deal_id,
              carrinho_week_start,
              meeting_slot:meeting_slots!inner(
                scheduled_at,
                meeting_type
              )
            `)
            .eq('meeting_slot.meeting_type', 'r2')
            .eq('r2_status_id', aprovadoId)
            .neq('status', 'cancelled')
            .gte('meeting_slot.scheduled_at', r2WindowStart.toISOString())
            .lte('meeting_slot.scheduled_at', r2WindowEnd.toISOString());

          const { data: r2AprovadoData } = await r2AprovadoQuery;

          if (r2AprovadoData) {
            for (const r2 of r2AprovadoData as any[]) {
              // Skip leads assigned to a different carrinho week
              const r2WeekStart = (r2 as any).carrinho_week_start;
              if (r2WeekStart && r2WeekStart !== cartWeekStartStr) continue;
              if (r2.deal_id && !existingDealIds.has(r2.deal_id)) {
                extraDealIdsFromR2.push(r2.deal_id);
                existingDealIds.add(r2.deal_id);
              }
            }
          }
        }

        // --- Step 1d: Encaixados (carrinho_week_start) ---
        let extraDealIdsFromEncaixados: string[] = [];
        {
          const { data: encaixadosData } = await supabase
            .from('meeting_slot_attendees')
            .select(`
              deal_id,
              meeting_slot:meeting_slots!inner(
                meeting_type
              )
            `)
            .eq('meeting_slot.meeting_type', 'r2')
            .eq('carrinho_week_start', cartWeekStartStr)
            .neq('status', 'cancelled');

          if (encaixadosData) {
            for (const enc of encaixadosData as any[]) {
              if (enc.deal_id && !existingDealIds.has(enc.deal_id)) {
                extraDealIdsFromEncaixados.push(enc.deal_id);
                existingDealIds.add(enc.deal_id);
              }
            }
          }
        }

        // --- Fetch R1 attendees for the extra deal_ids ---
        const allExtraDealIds = [...extraDealIdsFromR2, ...extraDealIdsFromEncaixados];
        if (allExtraDealIds.length > 0) {
          const foundR1DealIds = new Set<string>();

          // First try to find R1 attendees by deal_id
          for (let i = 0; i < allExtraDealIds.length; i += 200) {
            const chunk = allExtraDealIds.slice(i, i + 200);
            const { data: extraR1 } = await supabase
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
              .in('deal_id', chunk)
              .neq('status', 'cancelled')
              .eq('is_partner', false);

            if (extraR1 && extraR1.length > 0) {
              const validExtra = (extraR1 as any[]).filter((a: any) => {
                const originId = a.deal?.origin_id;
                if (!originId) return true;
                return incorporadorOriginIds.has(originId);
              });
              filteredR1Attendees = [...filteredR1Attendees, ...validExtra];
              for (const a of validExtra) {
                if (a.deal_id) foundR1DealIds.add(a.deal_id);
              }
            }
          }

          // For remaining extra deal_ids (no R1 found), create synthetic rows
          const remainingDealIds = allExtraDealIds.filter(d => !foundR1DealIds.has(d));
          if (remainingDealIds.length > 0) {
            for (let i = 0; i < remainingDealIds.length; i += 200) {
              const chunk = remainingDealIds.slice(i, i + 200);
              const { data: dealInfo } = await supabase
                .from('crm_deals')
                .select('id, name, contact_id, origin_id, contact:crm_contacts(name, phone, email)')
                .in('id', chunk);

              if (dealInfo) {
                for (const deal of dealInfo as any[]) {
                  const originId = deal.origin_id;
                  if (originId && !incorporadorOriginIds.has(originId)) continue;
                  filteredR1Attendees.push({
                    id: `synthetic-${deal.id}`,
                    attendee_name: deal.contact?.name || deal.name || null,
                    attendee_phone: deal.contact?.phone || null,
                    contract_paid_at: null,
                    deal_id: deal.id,
                    status: 'outside',
                    is_partner: false,
                    meeting_slot: null,
                    deal: deal,
                  });
                }
              }
            }
          }
        }
      }

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
      // Calculate carrinho window for R2 prioritization
      const r2PrioBoundaries = filters.weekStart
        ? getCarrinhoMetricBoundaries(filters.weekStart, addDays(filters.weekStart, 6))
        : null;
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
            // Use carrinho window to prioritize R2 within the correct period
            const r2Window = r2PrioBoundaries?.r2Meetings;
            const isInWindow = (dateStr: string) => {
              if (!r2Window) return false;
              const d = new Date(dateStr);
              return d >= r2Window.start && d <= r2Window.end;
            };

            for (const r2 of r2Data as any[]) {
              const ms = r2.meeting_slot;
              if (r2.deal_id && ms) {
                const mappedDealId = siblingToOriginal.get(r2.deal_id) || r2.deal_id;
                const existing = r2Map[mappedDealId];
                const newDate = ms.scheduled_at;
                const newInWindow = newDate ? isInWindow(newDate) : false;
                const existingInWindow = existing?.r2Date ? isInWindow(existing.r2Date) : false;

                // Priority: in-window > out-of-window; within same category, most recent wins
                const shouldReplace = !existing
                  || (newInWindow && !existingInWindow)
                  || (newInWindow === existingInWindow && newDate && (!existing.r2Date || newDate > existing.r2Date));

                if (shouldReplace) {
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

      const now = new Date();
      const fridayCutoff = getFridayCutoff(filters.weekStart);

      // Step 5: Transform into rows
      const rows: ContractLifecycleRow[] = filteredR1Attendees.map((att: any) => {
        const ms = att.meeting_slot;
        const deal = att.deal;
        const r2Info = att.deal_id ? r2Map[att.deal_id] : null;

        const hasR2 = !!r2Info;

        // Refund status comes directly from Hubla transaction (set in Step 1a)
        const isHublaRefunded = !!att._hublaRefunded;

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
          isPaidContract: !!att._isPaidFromHubla,
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
