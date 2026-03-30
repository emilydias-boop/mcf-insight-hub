import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { getCarrinhoWeekBoundaries } from '@/lib/carrinhoWeekBoundaries';
import { getUFFromPhone, getClusterFromUF } from '@/lib/dddToUF';
import { getDeduplicatedGross } from '@/lib/incorporadorPricing';

const VALID_CHANNELS = new Set(['A010', 'LIVE', 'ANAMNESE', 'ANAMNESE-INSTA', 'OUTSIDE', 'LANÇAMENTO']);

function normalizeChannel(raw: string): string {
  if (VALID_CHANNELS.has(raw)) return raw;
  const upper = raw.toUpperCase();
  if (upper.includes('ANAMNESE-INSTA') || upper.includes('ANAMNESE INSTA')) return 'ANAMNESE-INSTA';
  if (upper.includes('ANAMNESE')) return 'ANAMNESE';
  if (upper.includes('A010')) return 'A010';
  if (upper.includes('LANÇAMENTO') || upper.includes('LANCAMENTO')) return 'LANÇAMENTO';
  if (upper.includes('OUTSIDE')) return 'OUTSIDE';
  return 'LIVE';
}

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
  if (hasA010) return 'A010';
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
  parceriaBruto: number | null;
  parceriaLiquido: number | null;
  reembolso: boolean;
  isOutside: boolean;
  canalEntrada: string | null;
  // Audit fields for canal classification debugging
  _audit?: {
    rawTags: string[];
    rawOriginName: string | null;
    rawLeadChannel: string | null;
    rawDataSource: string | null;
    saleOrigin: string | null;
    hasA010: boolean;
    hasR1: boolean;
    hasDeal: boolean;
    hasContact: boolean;
    classifiedResult: string;
    reason: string;
  };
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
  // New cross-metrics
  totalR1RealizadasSemana: number;
  taxaContratoR1: number;
  aprovadosComParceria: number;
  aprovadosSemParceria: number;
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

type ContactLookup = { id: string; phone: string | null };

type DealLookup = {
  id: string;
  sdrName: string | null;
  dataSource: string | null;
  tags: string[];
  originName: string | null;
  leadChannel: string | null;
  isIncorporador: boolean;
};

type R1Lookup = {
  date: string;
  realized: boolean;
  closerName: string | null;
  bookedByName: string | null;
  bookedById: string | null;
};

type R2Lookup = {
  id: string;
  date: string;
  realized: boolean;
  closerName: string | null;
  statusId: string | null;
  slotStatus: string;
};

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

function mergeDealsIntoMap(rows: any[] | null | undefined, dealMap: Map<string, DealLookup>, incorporadorOriginIds?: Set<string>) {
  for (const d of rows || []) {
    if (!d.contact_id) continue;

    const sdrName = (d as any).owner?.full_name || null;
    const dataSource = (d as any).data_source || null;
    const tags: string[] = ((d as any).tags || []).map((t: any) => typeof t === 'string' ? t : t?.name || '');
    const originName = (d as any).origin?.name || null;
    const leadChannel = (d as any).custom_fields?.lead_channel || null;
    const isIncorporador = !!(d.origin_id && incorporadorOriginIds?.has(d.origin_id));

    if (dealMap.has(d.contact_id)) {
      const existing = dealMap.get(d.contact_id)!;
      // Always merge tags from all deals
      existing.tags = [...new Set([...existing.tags, ...tags])];

      // Prioritize incorporador deal for SDR/origin/channel
      if (!existing.isIncorporador && isIncorporador) {
        existing.id = d.id;
        existing.sdrName = sdrName;
        existing.dataSource = dataSource;
        existing.originName = originName;
        existing.leadChannel = leadChannel;
        existing.isIncorporador = true;
      } else {
        if (!existing.sdrName && sdrName) existing.sdrName = sdrName;
        if (!existing.dataSource && dataSource) existing.dataSource = dataSource;
        if (!existing.originName && originName) existing.originName = originName;
        if (!existing.leadChannel && leadChannel) existing.leadChannel = leadChannel;
      }
      continue;
    }

    dealMap.set(d.contact_id, {
      id: d.id,
      sdrName,
      dataSource,
      tags,
      originName,
      leadChannel,
      isIncorporador,
    });
  }
}

function mergeR1IntoMap(rows: any[] | null | undefined, r1Map: Map<string, R1Lookup>) {
  for (const a of rows || []) {
    const cid = (a as any).contact_id;
    const slot = a.meeting_slot as any;
    if (!cid || !slot?.scheduled_at) continue;

    const existing = r1Map.get(cid);
    if (!existing || slot.scheduled_at < existing.date) {
      const realized = a.status === 'completed' || a.status === 'presente' || slot.status === 'completed';
      r1Map.set(cid, {
        date: slot.scheduled_at,
        realized,
        closerName: slot.closer?.name || null,
        bookedByName: null,
        bookedById: (a as any).booked_by || null,
      });
    }
  }
}

function mergeR2IntoMap(rows: any[] | null | undefined, r2Map: Map<string, R2Lookup>) {
  for (const a of rows || []) {
    const cid = (a as any).contact_id;
    const slot = a.meeting_slot as any;
    if (!cid || !slot?.scheduled_at) continue;

    const existing = r2Map.get(cid);
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
}

function getContactScore(contactId: string, dealMap: Map<string, DealLookup>, r1Map: Map<string, R1Lookup>, r2Map: Map<string, R2Lookup>) {
  return (dealMap.has(contactId) ? 4 : 0) + (r2Map.has(contactId) ? 2 : 0) + (r1Map.has(contactId) ? 1 : 0);
}

function pickBestPhoneMatchedContact(
  currentContact: ContactLookup | undefined,
  phoneContacts: ContactLookup[],
  dealMap: Map<string, DealLookup>,
  r1Map: Map<string, R1Lookup>,
  r2Map: Map<string, R2Lookup>,
): ContactLookup | undefined {
  const candidates = [
    ...(currentContact ? [currentContact] : []),
    ...phoneContacts.filter(contact => contact.id !== currentContact?.id),
  ];

  if (candidates.length === 0) return currentContact;

  return candidates.reduce((best, candidate) => {
    const bestScore = getContactScore(best.id, dealMap, r1Map, r2Map);
    const candidateScore = getContactScore(candidate.id, dealMap, r1Map, r2Map);
    return candidateScore > bestScore ? candidate : best;
  });
}

export function useCarrinhoAnalysisReport(startDate: Date | null, endDate: Date | null) {
  return useQuery({
    queryKey: ['carrinho-analysis-v2', startDate?.toISOString(), endDate?.toISOString()],
    enabled: !!startDate && !!endDate,
    queryFn: async (): Promise<CarrinhoAnalysisData> => {
      if (!startDate || !endDate) throw new Error('Datas não definidas');

      // Use unified week boundaries (Sat→Sat) for consistency with Carrinho R2
      const { effectiveStart, effectiveEnd } = getCarrinhoWeekBoundaries(startDate, endDate);
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');

      // Fetch incorporador origin IDs for SDR prioritization
      const [buOriginMappings, buGroupMappings] = await Promise.all([
        supabase.from('bu_origin_mapping').select('entity_id').eq('bu', 'incorporador').eq('entity_type', 'origin'),
        supabase.from('bu_origin_mapping').select('entity_id').eq('bu', 'incorporador').eq('entity_type', 'group'),
      ]);
      const incorporadorOriginIds = new Set((buOriginMappings.data || []).map(o => o.entity_id));
      // Expand group mappings: fetch origins belonging to incorporador groups
      const groupIds = (buGroupMappings.data || []).map(g => g.entity_id);
      if (groupIds.length > 0) {
        const { data: groupOrigins } = await supabase
          .from('crm_origins')
          .select('id')
          .in('group_id', groupIds);
        for (const o of groupOrigins || []) incorporadorOriginIds.add(o.id);
      }

      // 1. Anchor: Contratos pagos na semana
      const { data: transactions } = await supabase
        .from('hubla_transactions')
        .select('id, hubla_id, source, customer_name, customer_email, customer_phone, product_name, product_category, sale_date, net_value, sale_status, linked_attendee_id, installment_number, sale_origin')
        .eq('product_name', 'A000 - Contrato')
        .in('sale_status', ['completed', 'refunded'])
        .in('source', ['hubla', 'manual', 'make', 'mcfpay', 'kiwify'])
        .gte('sale_date', effectiveStart.toISOString())
        .lt('sale_date', effectiveEnd.toISOString())
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
          .or('product_category.eq.a010,product_name.ilike.%a010%')
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
          .select('id, customer_email, sale_date, product_name, product_price, net_value, gross_override, installment_number')
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

      const contactMap = new Map<string, ContactLookup>(); // email → contact (initially last one wins, re-evaluated after deals load)
      const allContactsByEmail = new Map<string, ContactLookup[]>(); // email → ALL contacts
      for (const c of contactsResult.data || []) {
        if (c.email) {
          const eKey = c.email.toLowerCase().trim();
          contactMap.set(eKey, { id: c.id, phone: c.phone });
          if (!allContactsByEmail.has(eKey)) allContactsByEmail.set(eKey, []);
          allContactsByEmail.get(eKey)!.push({ id: c.id, phone: c.phone });
        }
      }

      const refundEmails = new Set((refundsResult.data || []).map(r => (r.customer_email || '').toLowerCase().trim()));

      // Build reference price lookup from product_configurations for parceria products
      const parceriaProductNames = [...new Set((parceriasResult.data || []).map(p => p.product_name).filter(Boolean))];
      let refPriceLookup = new Map<string, number>();
      if (parceriaProductNames.length > 0) {
        const { data: pcData } = await supabase
          .from('product_configurations')
          .select('product_name, reference_price')
          .in('product_name', parceriaProductNames);
        for (const pc of pcData || []) {
          refPriceLookup.set(pc.product_name.toLowerCase().trim(), pc.reference_price);
        }
      }

      const parceriaMap = new Map<string, { date: string; product: string; grossValue: number | null; netValue: number | null }>();
      for (const p of parceriasResult.data || []) {
        const e = (p.customer_email || '').toLowerCase().trim();
        if (e && !parceriaMap.has(e)) {
          const refPrice = p.product_name ? refPriceLookup.get(p.product_name.toLowerCase().trim()) : undefined;
          const grossValue = getDeduplicatedGross({
            product_name: p.product_name,
            product_price: p.product_price,
            installment_number: p.installment_number,
            gross_override: p.gross_override,
            reference_price: refPrice ?? null,
          }, true);
          parceriaMap.set(e, { date: p.sale_date || '', product: p.product_name || '', grossValue, netValue: p.net_value ?? null });
        }
      }

      const statusNameMap = new Map<string, string>();
      for (const s of r2StatusResult.data || []) statusNameMap.set(s.id, s.name);

      // 2.1 A010 fallback by phone suffix when email does not match exactly
      const a010PhoneCandidates = new Map<string, string[]>();
      for (const tx of uniqueContracts) {
        const email = (tx.customer_email || '').toLowerCase().trim();
        if (!email || a010Map.has(email)) continue;

        const suffix = normalizePhoneSuffix(tx.customer_phone);
        if (!suffix) continue;

        if (!a010PhoneCandidates.has(suffix)) a010PhoneCandidates.set(suffix, []);
        a010PhoneCandidates.get(suffix)!.push(email);
      }

      if (a010PhoneCandidates.size > 0) {
        const suffixes = Array.from(a010PhoneCandidates.keys());
        const a010PhoneResults = await Promise.all(
          suffixes.map(suffix =>
            supabase.from('hubla_transactions')
              .select('customer_phone, sale_date')
              .or('product_category.eq.a010,product_name.ilike.%a010%')
              .ilike('customer_phone', `%${suffix}`)
              .order('sale_date', { ascending: true })
          )
        );

        for (let i = 0; i < suffixes.length; i++) {
          const suffix = suffixes[i];
          const matchedRows = (a010PhoneResults[i].data || []).filter(row => normalizePhoneSuffix(row.customer_phone) === suffix);
          const earliestSaleDate = matchedRows[0]?.sale_date;
          if (!earliestSaleDate) continue;

          for (const email of a010PhoneCandidates.get(suffix) || []) {
            if (!a010Map.has(email)) a010Map.set(email, earliestSaleDate);
          }
        }
      }

      // 3. Get contact_ids for CRM queries — use ALL contacts, not just one per email
      const contactIds = Array.from(new Set(
        Array.from(allContactsByEmail.values()).flat().map(c => c.id)
      ));

      // Parallel: deals, R1 attendees, R2 attendees
      const [dealsResult, r1Result, r2Result] = await Promise.all([
        contactIds.length > 0
          ? supabase.from('crm_deals')
              .select('id, contact_id, origin_id, owner_profile_id, custom_fields, data_source, tags, origin:crm_origins(name), owner:profiles!crm_deals_owner_profile_id_fkey(full_name)')
              .in('contact_id', contactIds)
          : Promise.resolve({ data: [] }),
        contactIds.length > 0
          ? supabase.from('meeting_slot_attendees')
              .select('contact_id, status, booked_by, meeting_slot:meeting_slots!inner(scheduled_at, meeting_type, closer:closers(name))')
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
      const dealMap = new Map<string, DealLookup>();
      mergeDealsIntoMap(dealsResult.data, dealMap, incorporadorOriginIds);


      // Build R1 map: contact_id → best R1
      const r1Map = new Map<string, R1Lookup>();
      mergeR1IntoMap(r1Result.data, r1Map);

      // Resolve booked_by names for R1
      const bookedByIds = new Set<string>();
      for (const r1 of r1Map.values()) {
        if (r1.bookedById) bookedByIds.add(r1.bookedById);
      }
      if (bookedByIds.size > 0) {
        const { data: bookerProfiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', Array.from(bookedByIds));
        const bookerNameMap = new Map<string, string>();
        for (const p of bookerProfiles || []) {
          if (p.full_name) bookerNameMap.set(p.id, p.full_name);
        }
        for (const r1 of r1Map.values()) {
          if (r1.bookedById && bookerNameMap.has(r1.bookedById)) {
            r1.bookedByName = bookerNameMap.get(r1.bookedById)!;
          }
        }
      }

      // Build R2 map: contact_id → best R2
      const r2Map = new Map<string, R2Lookup>();
      mergeR2IntoMap(r2Result.data, r2Map);

      // === RE-PICK BEST CONTACT PER EMAIL after deals/R1/R2 are loaded ===
      for (const [email, contacts] of allContactsByEmail.entries()) {
        if (contacts.length <= 1) continue;
        const current = contactMap.get(email);
        let bestContact = current || contacts[0];
        let bestScore = getContactScore(bestContact.id, dealMap, r1Map, r2Map);

        for (const candidate of contacts) {
          if (candidate.id === bestContact.id) continue;
          const score = getContactScore(candidate.id, dealMap, r1Map, r2Map);
          if (score > bestScore) {
            bestContact = candidate;
            bestScore = score;
          }
        }

        // Update contactMap to point to the best contact
        contactMap.set(email, bestContact);

        // Merge tags from ALL contacts' deals into the best contact's deal entry
        for (const candidate of contacts) {
          if (candidate.id === bestContact.id) continue;
          const otherDeal = dealMap.get(candidate.id);
          if (!otherDeal) continue;
          const bestDeal = dealMap.get(bestContact.id);
          if (bestDeal) {
            bestDeal.tags = [...new Set([...bestDeal.tags, ...otherDeal.tags])];
            if (!bestDeal.sdrName && otherDeal.sdrName) bestDeal.sdrName = otherDeal.sdrName;
            if (!bestDeal.originName && otherDeal.originName) bestDeal.originName = otherDeal.originName;
            if (!bestDeal.leadChannel && otherDeal.leadChannel) bestDeal.leadChannel = otherDeal.leadChannel;
            if (!bestDeal.dataSource && otherDeal.dataSource) bestDeal.dataSource = otherDeal.dataSource;
          } else {
            dealMap.set(bestContact.id, { ...otherDeal });
          }
          // Merge R1
          const otherR1 = r1Map.get(candidate.id);
          const bestR1 = r1Map.get(bestContact.id);
          if (otherR1 && (!bestR1 || otherR1.date < bestR1.date)) {
            r1Map.set(bestContact.id, otherR1);
          }
          // Merge R2
          const otherR2 = r2Map.get(candidate.id);
          const bestR2 = r2Map.get(bestContact.id);
          if (otherR2 && !bestR2) {
            r2Map.set(bestContact.id, otherR2);
          }
        }
      }

      const phoneSuffixesForLookup: string[] = [];
      for (const tx of uniqueContracts) {
        const email = (tx.customer_email || '').toLowerCase().trim();
        const contact = contactMap.get(email);
        const contactId = contact?.id;
        if (!contactId || !dealMap.has(contactId)) {
          const suffix = normalizePhoneSuffix(tx.customer_phone);
          if (suffix) phoneSuffixesForLookup.push(suffix);
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

        const suffixToContacts = new Map<string, ContactLookup[]>();
        for (let i = 0; i < uniqueSuffixes.length; i++) {
          const suffix = uniqueSuffixes[i];
          const contacts = (phoneResults[i].data || [])
            .filter(c => normalizePhoneSuffix(c.phone) === suffix);
          if (contacts.length > 0) {
            suffixToContacts.set(suffix, contacts.map(c => ({ id: c.id, phone: c.phone })));
          }
        }

        // Re-fetch deals/R1/R2 for all phone-matched contacts not queried yet
        const newContactIds = Array.from(new Set(
          Array.from(suffixToContacts.values()).flat().map(c => c.id)
        )).filter(id => !contactIds.includes(id));

        if (newContactIds.length > 0) {
          const [newDeals, newR1, newR2] = await Promise.all([
            supabase.from('crm_deals')
              .select('id, contact_id, origin_id, owner_profile_id, custom_fields, data_source, tags, origin:crm_origins(name), owner:profiles!crm_deals_owner_profile_id_fkey(full_name)')
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

          mergeDealsIntoMap(newDeals.data, dealMap, incorporadorOriginIds);
          mergeR1IntoMap(newR1.data, r1Map);
          mergeR2IntoMap(newR2.data, r2Map);
        }

        // Choose the best contact candidate using deals/R1/R2 evidence from phone matches
        // AND merge tags from ALL phone-matched contacts into the best contact's deal entry
        for (const tx of uniqueContracts) {
          const email = (tx.customer_email || '').toLowerCase().trim();
          const suffix = normalizePhoneSuffix(tx.customer_phone);
          if (!suffix) continue;

          const currentContact = contactMap.get(email);
          const phoneContacts = suffixToContacts.get(suffix) || [];
          const bestContact = pickBestPhoneMatchedContact(currentContact, phoneContacts, dealMap, r1Map, r2Map);

          if (bestContact) {
            contactMap.set(email, bestContact);

            // Merge tags/data from ALL phone-matched contacts into bestContact's deal entry
            const allCandidates = [
              ...(currentContact ? [currentContact] : []),
              ...phoneContacts,
            ];
            for (const candidate of allCandidates) {
              if (candidate.id === bestContact.id) continue;
              const otherDeal = dealMap.get(candidate.id);
              if (!otherDeal) continue;
              const bestDeal = dealMap.get(bestContact.id);
              if (bestDeal) {
                bestDeal.tags = [...new Set([...bestDeal.tags, ...otherDeal.tags])];
                if (!bestDeal.sdrName && otherDeal.sdrName) bestDeal.sdrName = otherDeal.sdrName;
                if (!bestDeal.originName && otherDeal.originName) bestDeal.originName = otherDeal.originName;
                if (!bestDeal.leadChannel && otherDeal.leadChannel) bestDeal.leadChannel = otherDeal.leadChannel;
              } else {
                // Copy the other deal as the best contact's deal
                dealMap.set(bestContact.id, { ...otherDeal });
              }
              // Also merge R1 from other contacts
              const otherR1 = r1Map.get(candidate.id);
              const bestR1 = r1Map.get(bestContact.id);
              if (otherR1 && (!bestR1 || otherR1.date < bestR1.date)) {
                r1Map.set(bestContact.id, otherR1);
              }
            }
          }
        }
      }

      // === R1 EMAIL FALLBACK: For emails without R1, search R1 across all contacts with same email ===
      const emailsWithoutR1: string[] = [];
      for (const tx of uniqueContracts) {
        const email = (tx.customer_email || '').toLowerCase().trim();
        const contact = contactMap.get(email);
        if (contact && !r1Map.has(contact.id)) {
          emailsWithoutR1.push(email);
        } else if (!contact) {
          emailsWithoutR1.push(email);
        }
      }

      if (emailsWithoutR1.length > 0) {
        const uniqueR1Emails = [...new Set(emailsWithoutR1)];
        const { data: r1ByEmail } = await supabase
          .from('meeting_slot_attendees')
          .select('contact_id, status, booked_by, meeting_slot:meeting_slots!inner(scheduled_at, meeting_type, closer:closers(name)), contact:crm_contacts!inner(email)')
          .eq('meeting_slots.meeting_type', 'r1')
          .in('crm_contacts.email', uniqueR1Emails);

        for (const a of r1ByEmail || []) {
          const contactEmail = ((a as any).contact?.email || '').toLowerCase().trim();
          const contact = contactMap.get(contactEmail);
          if (!contact) continue;
          const slot = (a as any).meeting_slot;
          if (!slot?.scheduled_at) continue;
          const existing = r1Map.get(contact.id);
          if (!existing || slot.scheduled_at < existing.date) {
            const realized = a.status === 'completed' || a.status === 'presente' || slot.status === 'completed';
            r1Map.set(contact.id, { date: slot.scheduled_at, realized, closerName: slot.closer?.name || null, bookedByName: null, bookedById: (a as any).booked_by || null });
          }
        }

        // Second pass: resolve booked_by names for fallback R1 entries
        const newBookedByIds = new Set<string>();
        for (const r1 of r1Map.values()) {
          if (r1.bookedById && !r1.bookedByName) newBookedByIds.add(r1.bookedById);
        }
        if (newBookedByIds.size > 0) {
          const { data: newProfiles } = await supabase
            .from('profiles').select('id, full_name')
            .in('id', Array.from(newBookedByIds));
          for (const p of newProfiles || []) {
            if (!p.full_name) continue;
            for (const r1 of r1Map.values()) {
              if (r1.bookedById === p.id) r1.bookedByName = p.full_name;
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
        // r1 will be re-read after email fallback enrichment (see r1Fresh below)

        // R2: try linked first, then by contact
        let r2 = tx.linked_attendee_id ? linkedR2Map.get(tx.linked_attendee_id) : null;
         let r2Data: R2Lookup | null = null;
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

        // Re-read r1 after email fallback
        const r1Fresh = contactId ? r1Map.get(contactId) : null;
        const isOutside = r1Fresh?.date ? new Date(tx.sale_date) < new Date(r1Fresh.date) : false;
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
          sdrName: r1Fresh?.bookedByName || deal?.sdrName || null,
          r1Agendada: !!r1Fresh,
          dataR1: r1Fresh?.date || null,
          r1Realizada: r1Fresh?.realized || false,
          closerR1: r1Fresh?.closerName || null,
          dataContrato: tx.sale_date,
          valorContrato: tx.net_value || 0,
          r2Agendada: isR2Agendada,
          dataR2: r2Data?.date || null,
          r2Realizada: isR2Realizada,
          closerR2: r2Data?.closerName || null,
          statusR2: r2StatusName || null,
          comprouParceria: !!parceria,
          dataParceria: parceria?.date || null,
          parceriaBruto: parceria?.grossValue ?? null,
          parceriaLiquido: parceria?.netValue ?? null,
          reembolso: hasRefund,
          isOutside,
          canalEntrada: normalizeChannel((() => {
            const prodLower = (tx.product_name || '').toLowerCase();
            const saleOrigin = (tx as any).sale_origin;
            const dealTags = deal?.tags || [];

            // 1. Lançamento: sale_origin ou produto "contrato mcf"
            if (saleOrigin === 'launch' || prodLower.includes('contrato mcf')) return 'LANÇAMENTO';

            // 2. Tags / origin / channel from CRM deal
            const classified = classifyChannel({
              tags: dealTags,
              originName: deal?.originName || null,
              leadChannel: deal?.leadChannel || null,
              dataSource: deal?.dataSource || null,
              hasA010: !!a010Date,
            });
            if (classified) return classified;
            // Fallback: best raw tag
            const rawTag = getBestRawTag(dealTags);
            if (rawTag) return rawTag;
            // Fallback: origin name
            if (deal?.originName) return deal.originName.toUpperCase();
            // Fallback: lead channel
            if (deal?.leadChannel) return deal.leadChannel.toUpperCase();

            // 3. Outside = comprou antes da R1
            if (isOutside) return 'OUTSIDE';

            // 4. A010
            if (a010Date) return 'A010';

            // 5. Default: LIVE
            return 'LIVE';
          })()),
          _audit: (() => {
            const dealTags = deal?.tags || [];
            const saleOrigin = (tx as any).sale_origin;
            const classified = classifyChannel({
              tags: dealTags,
              originName: deal?.originName || null,
              leadChannel: deal?.leadChannel || null,
              dataSource: deal?.dataSource || null,
              hasA010: !!a010Date,
            });
            let reason = 'fallback:LIVE';
            const prodLower = (tx.product_name || '').toLowerCase();
            if (saleOrigin === 'launch' || prodLower.includes('contrato mcf')) reason = 'sale_origin=launch';
            else if (classified) reason = `classifyChannel=${classified}`;
            else if (getBestRawTag(dealTags)) reason = `rawTag=${getBestRawTag(dealTags)}`;
            else if (deal?.originName) reason = `originName=${deal.originName}`;
            else if (deal?.leadChannel) reason = `leadChannel=${deal.leadChannel}`;
            else if (isOutside) reason = 'isOutside=true';
            else if (a010Date) reason = 'hasA010';
            return {
              rawTags: dealTags,
              rawOriginName: deal?.originName || null,
              rawLeadChannel: deal?.leadChannel || null,
              rawDataSource: deal?.dataSource || null,
              saleOrigin: saleOrigin || null,
              hasA010: !!a010Date,
              hasR1: !!r1Fresh,
              hasDeal: !!deal,
              hasContact: !!contact,
              classifiedResult: classified,
              reason,
            };
          })(),
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
