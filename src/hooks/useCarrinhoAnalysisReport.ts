import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { getUFFromPhone, getClusterFromUF } from '@/lib/dddToUF';

function classifyChannel(opts: {
  tags: string[];
  originName: string | null;
  leadChannel: string | null;
  dataSource: string | null;
  hasA010: boolean;
}): string {
  const { tags, originName, leadChannel, dataSource, hasA010 } = opts;
  const allTags = tags.map(t => {
    if (typeof t === 'string') {
      if (t.startsWith('{')) {
        try { const p = JSON.parse(t); return (p?.name || t).toUpperCase(); } catch { return t.toUpperCase(); }
      }
      return t.toUpperCase();
    }
    return (t as any)?.name?.toUpperCase() || '';
  });

  // Also check originName and leadChannel as additional signals
  const originUpper = (originName || '').toUpperCase();
  const channelUpper = (leadChannel || '').toUpperCase();

  // 1. Tags are primary source
  if (allTags.some(t => t.includes('ANAMNESE-INSTA') || t.includes('ANAMNESE INSTA'))) return 'ANAMNESE-INSTA';
  if (allTags.some(t => t.includes('ANAMNESE'))) return 'ANAMNESE';
  if (allTags.some(t => t.includes('BIO-INSTAGRAM') || t.includes('BIO INSTAGRAM'))) return 'BIO-INSTAGRAM';
  if (allTags.some(t => t.includes('LEAD-LIVE') || t.includes('LIVE'))) return 'LIVE';
  if (allTags.some(t => t.includes('LEAD-FORM') || t.includes('LEAD FORM'))) return 'LEAD-FORM';
  if (allTags.some(t => t.includes('A010') && t.includes('MAKE'))) return 'A010 (MAKE)';
  if (allTags.some(t => t === 'A010' || t.startsWith('A010 '))) return 'A010';
  if (allTags.some(t => t.includes('HUBLA'))) return 'HUBLA';
  if (allTags.some(t => t.includes('BASE CLINT'))) return 'BASE CLINT';

  // 2. Origin name (from crm_origins) as secondary source
  if (originUpper.includes('ANAMNESE-INSTA') || originUpper.includes('ANAMNESE INSTA')) return 'ANAMNESE-INSTA';
  if (originUpper.includes('ANAMNESE')) return 'ANAMNESE';
  if (originUpper.includes('BIO-INSTAGRAM') || originUpper.includes('BIO INSTAGRAM')) return 'BIO-INSTAGRAM';

  // 3. lead_channel as tertiary source
  if (channelUpper.includes('ANAMNESE-INSTA')) return 'ANAMNESE-INSTA';
  if (channelUpper.includes('ANAMNESE')) return 'ANAMNESE';
  if (channelUpper.includes('LIVE')) return 'LIVE';
  if (channelUpper.includes('LEAD-FORM')) return 'LEAD-FORM';

  // 4. Fallback
  if (dataSource === 'csv') return 'CSV';
  if (hasA010) return 'HUBLA (A010)';
  if (dataSource === 'webhook') return 'WEBHOOK';
  return '';
}

// Extract the best raw tag from a deal's tags for fallback display
function getBestRawTag(tags: string[]): string | null {
  const NOISE = new Set(['CSV', 'REPLICATION', 'BASE CLINT', 'CLIENTDATA-INSIDE', 'CLIENTDATA', 'WEBHOOK']);
  for (const raw of tags) {
    const t = typeof raw === 'string' ? raw.trim() : '';
    if (!t) continue;
    const upper = t.toUpperCase();
    if (NOISE.has(upper)) continue;
    // Return the first non-noise tag
    return upper;
  }
  return null;
}

export interface LeadCarrinhoCompleto {
  nome: string;
  telefone: string;
  email: string;
  estado: string;
  cluster: string;
  // A010
  dataA010: string | null;
  // Classificação
  classificado: boolean;
  sdrName: string | null;
  // R1
  r1Agendada: boolean;
  dataR1: string | null;
  r1Realizada: boolean;
  closerR1: string | null;
  // Contrato
  dataContrato: string;
  valorContrato: number;
  // R2
  r2Agendada: boolean;
  dataR2: string | null;
  r2Realizada: boolean;
  closerR2: string | null;
  statusR2: string | null;
  // Desfecho
  comprouParceria: boolean;
  dataParceria: string | null;
  reembolso: boolean;
  isOutside: boolean;
  canalEntrada: string | null;
  // Gap
  motivoGap: string | null;
  tipoGap: 'operacional' | 'legitima' | null;
  observacao: string | null;
}

export interface CarrinhoAnalysisKPIs {
  entradasA010: number;
  classificados: number;
  r1Agendadas: number;
  r1Realizadas: number;
  contratosPagos: number;
  r2Agendadas: number;
  gapContratoR2: number;
  r2Realizadas: number;
  aprovados: number;
  reprovados: number;
  proximaSemana: number;
  reembolsos: number;
  parceriasVendidas: number;
}

export interface FunnelStep {
  label: string;
  count: number;
  pct: number;
}

export interface MotivoPerda {
  motivo: string;
  count: number;
  pct: number;
  tipo: 'legitima' | 'operacional';
}

export interface StateAnalysis {
  uf: string;
  cluster: string;
  contratos: number;
  r2Agendadas: number;
  r2Realizadas: number;
  aprovados: number;
  reembolsos: number;
  parcerias: number;
}

export interface CarrinhoAnalysisData {
  kpis: CarrinhoAnalysisKPIs;
  funnelSteps: FunnelStep[];
  motivosPerda: MotivoPerda[];
  analysisByState: StateAnalysis[];
  leads: LeadCarrinhoCompleto[];
}

function normalizePhoneSuffix(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : '';
}

function classifyGap(
  lead: { reembolso: boolean; isOutside: boolean; r2Agendada: boolean; contactExists: boolean; dealExists: boolean; statusR2Lower: string | null },
): { motivo: string; tipo: 'operacional' | 'legitima' } {
  if (lead.reembolso) return { motivo: 'Reembolso', tipo: 'legitima' };
  // Outside NÃO é motivo legítimo — lead outside continua no funil normalmente
  if (lead.statusR2Lower?.includes('próxima') || lead.statusR2Lower?.includes('proxima')) return { motivo: 'Próxima semana', tipo: 'legitima' };
  if (!lead.contactExists) return { motivo: 'Sem contato no CRM', tipo: 'operacional' };
  if (!lead.dealExists) return { motivo: 'Cadastro incompleto', tipo: 'operacional' };
  if (lead.contactExists && !lead.r2Agendada) return { motivo: 'Sem agendamento', tipo: 'operacional' };
  return { motivo: 'Outro motivo', tipo: 'operacional' };
}

export function useCarrinhoAnalysisReport(startDate: Date | null, endDate: Date | null) {
  return useQuery({
    queryKey: ['carrinho-analysis-v2', startDate?.toISOString(), endDate?.toISOString()],
    enabled: !!startDate && !!endDate,
    queryFn: async (): Promise<CarrinhoAnalysisData> => {
      if (!startDate || !endDate) throw new Error('Datas não definidas');

      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');

      // 1. Anchor: Contratos pagos na semana
      const { data: transactions } = await supabase
        .from('hubla_transactions')
        .select('id, hubla_id, source, customer_name, customer_email, customer_phone, product_name, product_category, sale_date, net_value, sale_status, linked_attendee_id, installment_number')
        .eq('product_name', 'A000 - Contrato')
        .in('sale_status', ['completed', 'refunded'])
        .in('source', ['hubla', 'manual', 'make', 'mcfpay', 'kiwify'])
        .gte('sale_date', startStr)
        .lte('sale_date', endStr + 'T23:59:59')
        .order('sale_date', { ascending: true });

      const validTx = (transactions || []).filter(t => {
        if (t.hubla_id?.startsWith('newsale-')) return false;
        if (t.source === 'make' && t.product_name?.toLowerCase() === 'contrato') return false;
        if (t.installment_number && t.installment_number > 1) return false;
        return true;
      });

      // Dedupe by email
      const emailMap = new Map<string, typeof validTx[0]>();
      for (const t of validTx) {
        const email = (t.customer_email || '').toLowerCase().trim();
        if (email && !emailMap.has(email)) emailMap.set(email, t);
      }
      const uniqueContracts = Array.from(emailMap.values());
      const emails = uniqueContracts.map(t => (t.customer_email || '').toLowerCase().trim()).filter(Boolean);

      if (emails.length === 0) {
        return {
          kpis: { entradasA010: 0, classificados: 0, r1Agendadas: 0, r1Realizadas: 0, contratosPagos: 0, r2Agendadas: 0, gapContratoR2: 0, r2Realizadas: 0, aprovados: 0, reprovados: 0, proximaSemana: 0, reembolsos: 0, parceriasVendidas: 0 },
          funnelSteps: [], motivosPerda: [], analysisByState: [], leads: [],
        };
      }

      // 2. Parallel queries with emails
      const [a010Result, contactsResult, refundsResult, parceriasResult, r2StatusResult] = await Promise.all([
        // A010 purchases (retroactive)
        supabase.from('hubla_transactions')
          .select('customer_email, sale_date')
          .in('product_category', ['a010'])
          .in('customer_email', emails)
          .order('sale_date', { ascending: true }),
        // CRM contacts
        supabase.from('crm_contacts')
          .select('id, email, phone')
          .in('email', emails),
        // Refunds
        supabase.from('hubla_transactions')
          .select('customer_email')
          .in('customer_email', emails)
          .eq('sale_status', 'refunded'),
        // Parcerias
        supabase.from('hubla_transactions')
          .select('customer_email, sale_date, product_name')
          .eq('product_category', 'parceria')
          .in('sale_status', ['completed', 'paid'])
          .in('customer_email', emails),
        // R2 status options
        supabase.from('r2_status_options').select('id, name').eq('is_active', true),
      ]);

      // Build lookup maps
      const a010Map = new Map<string, string>(); // email → earliest sale_date
      for (const a of a010Result.data || []) {
        const e = (a.customer_email || '').toLowerCase().trim();
        if (e && !a010Map.has(e)) a010Map.set(e, a.sale_date);
      }

      const contactMap = new Map<string, { id: string; phone: string | null }>(); // email → contact
      for (const c of contactsResult.data || []) {
        if (c.email) contactMap.set(c.email.toLowerCase().trim(), { id: c.id, phone: c.phone });
      }

      const refundEmails = new Set((refundsResult.data || []).map(r => (r.customer_email || '').toLowerCase().trim()));

      const parceriaMap = new Map<string, { date: string; product: string }>();
      for (const p of parceriasResult.data || []) {
        const e = (p.customer_email || '').toLowerCase().trim();
        if (e && !parceriaMap.has(e)) parceriaMap.set(e, { date: p.sale_date || '', product: p.product_name || '' });
      }

      const statusNameMap = new Map<string, string>();
      for (const s of r2StatusResult.data || []) statusNameMap.set(s.id, s.name);

      // 3. Get contact_ids for CRM queries
      const contactIds = Array.from(new Set(
        Array.from(contactMap.values()).map(c => c.id)
      ));

      // Parallel: deals, R1 attendees, R2 attendees
      const [dealsResult, r1Result, r2Result] = await Promise.all([
        contactIds.length > 0
          ? supabase.from('crm_deals')
              .select('id, contact_id, owner_profile_id, custom_fields, data_source, tags, origin:crm_origins(name), owner:profiles!crm_deals_owner_profile_id_fkey(name)')
              .in('contact_id', contactIds)
          : Promise.resolve({ data: [] }),
        contactIds.length > 0
          ? supabase.from('meeting_slot_attendees')
              .select('contact_id, status, meeting_slot:meeting_slots!inner(scheduled_at, meeting_type, closer:closers(name))')
              .in('contact_id', contactIds)
              .eq('meeting_slots.meeting_type', 'r1')
          : Promise.resolve({ data: [] }),
        contactIds.length > 0
          ? supabase.from('meeting_slot_attendees')
              .select('id, contact_id, status, r2_status_id, meeting_slot:meeting_slots!inner(scheduled_at, meeting_type, status, closer:closers(name))')
              .in('contact_id', contactIds)
              .eq('meeting_slots.meeting_type', 'r2')
          : Promise.resolve({ data: [] }),
      ]);

      // Also try matching R2 by linked_attendee_id
      const linkedIds = uniqueContracts.map(t => t.linked_attendee_id).filter(Boolean) as string[];
      let linkedR2Map = new Map<string, any>();
      if (linkedIds.length > 0) {
        const { data: linkedR2 } = await supabase
          .from('meeting_slot_attendees')
          .select('id, contact_id, status, r2_status_id, meeting_slot:meeting_slots!inner(scheduled_at, meeting_type, status, closer:closers(name))')
          .in('id', linkedIds)
          .eq('meeting_slots.meeting_type', 'r2');
        for (const a of linkedR2 || []) linkedR2Map.set(a.id, a);
      }

      // Build deal map: contact_id → deal (merge tags from ALL deals)
      const dealMap = new Map<string, { id: string; sdrName: string | null; dataSource: string | null; tags: string[]; originName: string | null; leadChannel: string | null }>();
      for (const d of dealsResult.data || []) {
        if (d.contact_id) {
          const sdrName = (d as any).owner?.name || null;
          const dataSource = (d as any).data_source || null;
          const tags: string[] = ((d as any).tags || []).map((t: any) => typeof t === 'string' ? t : t?.name || '');
          const originName = (d as any).origin?.name || null;
          const leadChannel = (d as any).custom_fields?.lead_channel || null;
          if (dealMap.has(d.contact_id)) {
            const existing = dealMap.get(d.contact_id)!;
            existing.tags = [...new Set([...existing.tags, ...tags])];
            if (!existing.sdrName && sdrName) existing.sdrName = sdrName;
            if (!existing.dataSource && dataSource) existing.dataSource = dataSource;
            // Prefer more informative origin (non-null, non-generic)
            if (!existing.originName && originName) existing.originName = originName;
            if (!existing.leadChannel && leadChannel) existing.leadChannel = leadChannel;
          } else {
            dealMap.set(d.contact_id, { id: d.id, sdrName, dataSource, tags, originName, leadChannel });
          }
        }
      }


      // Build R1 map: contact_id → best R1
      const r1Map = new Map<string, { date: string; realized: boolean; closerName: string | null }>();
      for (const a of r1Result.data || []) {
        const cid = (a as any).contact_id;
        const slot = a.meeting_slot as any;
        if (!cid || !slot?.scheduled_at) continue;
        const existing = r1Map.get(cid);
        if (!existing || slot.scheduled_at < existing.date) {
          const realized = a.status === 'completed' || a.status === 'presente' || slot.status === 'completed';
          r1Map.set(cid, { date: slot.scheduled_at, realized, closerName: slot.closer?.name || null });
        }
      }

      // Build R2 map: contact_id → best R2
      const r2Map = new Map<string, { id: string; date: string; realized: boolean; closerName: string | null; statusId: string | null; slotStatus: string }>();
      for (const a of r2Result.data || []) {
        const cid = (a as any).contact_id;
        const slot = a.meeting_slot as any;
        if (!cid || !slot?.scheduled_at) continue;
        const existing = r2Map.get(cid);
        // Keep latest R2
        if (!existing || slot.scheduled_at > existing.date) {
          const realized = a.status === 'completed' || a.status === 'presente' || slot.status === 'completed';
          r2Map.set(cid, {
            id: a.id,
            date: slot.scheduled_at,
            realized,
            closerName: slot.closer?.name || null,
            statusId: (a as any).r2_status_id || null,
            slotStatus: slot.status || '',
          });
        }
      }

      // === PHONE FALLBACK: Find contacts by phone when email-based contact has no deals ===
      const phoneSuffixesForLookup: string[] = [];
      const suffixToEmail = new Map<string, string[]>();
      for (const tx of uniqueContracts) {
        const email = (tx.customer_email || '').toLowerCase().trim();
        const contact = contactMap.get(email);
        const contactId = contact?.id;
        if (!contactId || !dealMap.has(contactId)) {
          const suffix = normalizePhoneSuffix(tx.customer_phone);
          if (suffix) {
            phoneSuffixesForLookup.push(suffix);
            if (!suffixToEmail.has(suffix)) suffixToEmail.set(suffix, []);
            suffixToEmail.get(suffix)!.push(email);
          }
        }
      }

      if (phoneSuffixesForLookup.length > 0) {
        const uniqueSuffixes = [...new Set(phoneSuffixesForLookup)];
        const phoneQueries = uniqueSuffixes.map(suffix =>
          supabase.from('crm_contacts')
            .select('id, email, phone')
            .ilike('phone', `%${suffix}`)
        );
        const phoneResults = await Promise.all(phoneQueries);

        const suffixToContacts = new Map<string, { id: string; phone: string | null }[]>();
        for (let i = 0; i < uniqueSuffixes.length; i++) {
          const suffix = uniqueSuffixes[i];
          const contacts = (phoneResults[i].data || [])
            .filter(c => normalizePhoneSuffix(c.phone) === suffix);
          if (contacts.length > 0) {
            suffixToContacts.set(suffix, contacts.map(c => ({ id: c.id, phone: c.phone })));
          }
        }

        // Replace contactMap entries with phone-matched contacts that have deals
        for (const tx of uniqueContracts) {
          const email = (tx.customer_email || '').toLowerCase().trim();
          const currentContact = contactMap.get(email);
          if (currentContact && dealMap.has(currentContact.id)) continue;

          const suffix = normalizePhoneSuffix(tx.customer_phone);
          if (!suffix) continue;
          const phoneContacts = suffixToContacts.get(suffix);
          if (!phoneContacts) continue;

          for (const pc of phoneContacts) {
            if (dealMap.has(pc.id)) {
              contactMap.set(email, { id: pc.id, phone: pc.phone });
              break;
            }
          }
          // Even if no deal, use phone contact if we had none
          if (!contactMap.get(email) && phoneContacts.length > 0) {
            contactMap.set(email, { id: phoneContacts[0].id, phone: phoneContacts[0].phone });
          }
        }

        // Re-fetch deals/R1/R2 for new contact IDs
        const newContactIds = Array.from(new Set(
          Array.from(contactMap.values()).map(c => c.id)
        )).filter(id => !contactIds.includes(id));

        if (newContactIds.length > 0) {
          const [newDeals, newR1, newR2] = await Promise.all([
            supabase.from('crm_deals')
              .select('id, contact_id, owner_profile_id, custom_fields, data_source, tags, origin:crm_origins(name), owner:profiles!crm_deals_owner_profile_id_fkey(name)')
              .in('contact_id', newContactIds),
            supabase.from('meeting_slot_attendees')
              .select('contact_id, status, meeting_slot:meeting_slots!inner(scheduled_at, meeting_type, closer:closers(name))')
              .in('contact_id', newContactIds)
              .eq('meeting_slots.meeting_type', 'r1'),
            supabase.from('meeting_slot_attendees')
              .select('id, contact_id, status, r2_status_id, meeting_slot:meeting_slots!inner(scheduled_at, meeting_type, status, closer:closers(name))')
              .in('contact_id', newContactIds)
              .eq('meeting_slots.meeting_type', 'r2'),
          ]);

          for (const d of newDeals.data || []) {
            if (d.contact_id) {
              const sdrName = (d as any).owner?.name || null;
              const dataSource = (d as any).data_source || null;
              const tags: string[] = ((d as any).tags || []).map((t: any) => typeof t === 'string' ? t : t?.name || '');
              const originName = (d as any).origin?.name || null;
              const leadChannel = (d as any).custom_fields?.lead_channel || null;
              if (dealMap.has(d.contact_id)) {
                const existing = dealMap.get(d.contact_id)!;
                existing.tags = [...new Set([...existing.tags, ...tags])];
                if (!existing.sdrName && sdrName) existing.sdrName = sdrName;
                if (!existing.originName && originName) existing.originName = originName;
                if (!existing.leadChannel && leadChannel) existing.leadChannel = leadChannel;
              } else {
                dealMap.set(d.contact_id, { id: d.id, sdrName, dataSource, tags, originName, leadChannel });
              }
            }
          }
          for (const a of newR1.data || []) {
            const cid = (a as any).contact_id;
            const slot = a.meeting_slot as any;
            if (!cid || !slot?.scheduled_at) continue;
            if (!r1Map.has(cid) || slot.scheduled_at < r1Map.get(cid)!.date) {
              const realized = a.status === 'completed' || a.status === 'presente' || slot.status === 'completed';
              r1Map.set(cid, { date: slot.scheduled_at, realized, closerName: slot.closer?.name || null });
            }
          }
          for (const a of newR2.data || []) {
            const cid = (a as any).contact_id;
            const slot = a.meeting_slot as any;
            if (!cid || !slot?.scheduled_at) continue;
            if (!r2Map.has(cid) || slot.scheduled_at > r2Map.get(cid)!.date) {
              const realized = a.status === 'completed' || a.status === 'presente' || slot.status === 'completed';
              r2Map.set(cid, {
                id: a.id, date: slot.scheduled_at, realized,
                closerName: slot.closer?.name || null,
                statusId: (a as any).r2_status_id || null,
                slotStatus: slot.status || '',
              });
            }
          }
        }
      }

      // 4. Build leads
      const leads: LeadCarrinhoCompleto[] = [];
      const motivosCount = new Map<string, { count: number; tipo: 'operacional' | 'legitima' }>();
      const stateData = new Map<string, StateAnalysis>();

      for (const tx of uniqueContracts) {
        const email = (tx.customer_email || '').toLowerCase().trim();
        const phone = tx.customer_phone || '';
        const contact = contactMap.get(email);
        const contactId = contact?.id;
        const uf = getUFFromPhone(phone || contact?.phone);
        const cluster = getClusterFromUF(uf);

        const hasRefund = refundEmails.has(email);
        const a010Date = a010Map.get(email) || null;
        const deal = contactId ? dealMap.get(contactId) : null;
        const r1 = contactId ? r1Map.get(contactId) : null;

        // R2: try linked first, then by contact
        let r2 = tx.linked_attendee_id ? linkedR2Map.get(tx.linked_attendee_id) : null;
        let r2Data: typeof r2Map extends Map<string, infer V> ? V : never | null = null;
        if (r2) {
          const slot = r2.meeting_slot as any;
          r2Data = {
            id: r2.id,
            date: slot?.scheduled_at || '',
            realized: r2.status === 'completed' || r2.status === 'presente' || slot?.status === 'completed',
            closerName: slot?.closer?.name || null,
            statusId: r2.r2_status_id || null,
            slotStatus: slot?.status || '',
          };
        } else if (contactId) {
          r2Data = r2Map.get(contactId) || null;
        }

        const r2StatusName = r2Data?.statusId ? statusNameMap.get(r2Data.statusId) || null : null;
        const r2StatusLower = r2StatusName?.toLowerCase() || null;

        const isOutside = r1?.date ? new Date(tx.sale_date) < new Date(r1.date) : false;
        const isR2Agendada = !!r2Data;
        const isR2Realizada = r2Data?.realized || false;

        const parceria = parceriaMap.get(email);

        // Gap classification for leads without R2
        let motivoGap: string | null = null;
        let tipoGap: 'operacional' | 'legitima' | null = null;
        if (!isR2Agendada) {
          const gap = classifyGap({
            reembolso: hasRefund,
            isOutside,
            r2Agendada: isR2Agendada,
            contactExists: !!contact,
            dealExists: !!deal,
            statusR2Lower: r2StatusLower,
          });
          motivoGap = gap.motivo;
          tipoGap = gap.tipo;

          const existing = motivosCount.get(gap.motivo);
          if (existing) existing.count++;
          else motivosCount.set(gap.motivo, { count: 1, tipo: gap.tipo });
        }

        // State aggregation
        if (!stateData.has(uf)) {
          stateData.set(uf, { uf, cluster, contratos: 0, r2Agendadas: 0, r2Realizadas: 0, aprovados: 0, reembolsos: 0, parcerias: 0 });
        }
        const sd = stateData.get(uf)!;
        sd.contratos++;
        if (isR2Agendada) sd.r2Agendadas++;
        if (isR2Realizada) sd.r2Realizadas++;
        if (r2StatusLower?.includes('aprov')) sd.aprovados++;
        if (hasRefund) sd.reembolsos++;
        if (parceria) sd.parcerias++;

        leads.push({
          nome: tx.customer_name || 'Sem nome',
          telefone: phone,
          email,
          estado: uf,
          cluster,
          dataA010: a010Date,
          classificado: !!deal,
          sdrName: deal?.sdrName || null,
          r1Agendada: !!r1,
          dataR1: r1?.date || null,
          r1Realizada: r1?.realized || false,
          closerR1: r1?.closerName || null,
          dataContrato: tx.sale_date,
          valorContrato: tx.net_value || 0,
          r2Agendada: isR2Agendada,
          dataR2: r2Data?.date || null,
          r2Realizada: isR2Realizada,
          closerR2: r2Data?.closerName || null,
          statusR2: r2StatusName || null,
          comprouParceria: !!parceria,
          dataParceria: parceria?.date || null,
          reembolso: hasRefund,
          isOutside,
          canalEntrada: classifyChannel({
            tags: deal?.tags || [],
            originName: deal?.originName || null,
            leadChannel: deal?.leadChannel || null,
            dataSource: deal?.dataSource || null,
            hasA010: !!a010Date,
          }) || null,
          motivoGap,
          tipoGap,
          observacao: null,
        });
      }

      // KPIs
      const contratosPagos = leads.length;
      const entradasA010 = leads.filter(l => l.dataA010).length;
      const classificados = leads.filter(l => l.classificado).length;
      const r1Agendadas = leads.filter(l => l.r1Agendada).length;
      const r1Realizadas = leads.filter(l => l.r1Realizada).length;
      const r2Agendadas = leads.filter(l => l.r2Agendada).length;
      const r2Realizadas = leads.filter(l => l.r2Realizada).length;
      const aprovados = leads.filter(l => l.statusR2?.toLowerCase().includes('aprov')).length;
      const reprovados = leads.filter(l => l.statusR2?.toLowerCase().includes('reprov')).length;
      const proximaSemana = leads.filter(l => {
        const s = l.statusR2?.toLowerCase() || '';
        return s.includes('próxima') || s.includes('proxima');
      }).length;
      const reembolsos = leads.filter(l => l.reembolso).length;
      const parceriasVendidas = leads.filter(l => l.comprouParceria).length;

      const kpis: CarrinhoAnalysisKPIs = {
        entradasA010,
        classificados,
        r1Agendadas,
        r1Realizadas,
        contratosPagos,
        r2Agendadas,
        gapContratoR2: contratosPagos - r2Agendadas,
        r2Realizadas,
        aprovados,
        reprovados,
        proximaSemana,
        reembolsos,
        parceriasVendidas,
      };

      const funnelSteps: FunnelStep[] = [
        { label: 'A010', count: entradasA010, pct: contratosPagos > 0 ? (entradasA010 / contratosPagos) * 100 : 0 },
        { label: 'Classificação', count: classificados, pct: contratosPagos > 0 ? (classificados / contratosPagos) * 100 : 0 },
        { label: 'R1 Agendada', count: r1Agendadas, pct: contratosPagos > 0 ? (r1Agendadas / contratosPagos) * 100 : 0 },
        { label: 'R1 Realizada', count: r1Realizadas, pct: contratosPagos > 0 ? (r1Realizadas / contratosPagos) * 100 : 0 },
        { label: 'Contrato Pago', count: contratosPagos, pct: 100 },
        { label: 'R2 Agendada', count: r2Agendadas, pct: contratosPagos > 0 ? (r2Agendadas / contratosPagos) * 100 : 0 },
        { label: 'R2 Realizada', count: r2Realizadas, pct: contratosPagos > 0 ? (r2Realizadas / contratosPagos) * 100 : 0 },
        { label: 'Parceria Vendida', count: parceriasVendidas, pct: contratosPagos > 0 ? (parceriasVendidas / contratosPagos) * 100 : 0 },
      ];

      const totalGap = leads.filter(l => !l.r2Agendada).length || 1;
      const motivosPerda: MotivoPerda[] = Array.from(motivosCount.entries())
        .map(([motivo, { count, tipo }]) => ({ motivo, count, pct: (count / totalGap) * 100, tipo }))
        .sort((a, b) => b.count - a.count);

      const analysisByState: StateAnalysis[] = Array.from(stateData.values())
        .sort((a, b) => b.contratos - a.contratos);

      return { kpis, funnelSteps, motivosPerda, analysisByState, leads };
    },
  });
}
