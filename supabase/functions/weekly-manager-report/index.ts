import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Managers ──
const MANAGERS = {
  incorporador: {
    name: 'Jessica Bellini',
    email: 'jessica.bellini@minhacasafinanciada.com',
  },
  consorcio: {
    name: 'Thobson Motta',
    email: 'thobson.motta@minhacasafinanciada.com',
  },
};

// ── R2 Status IDs ──
const APROVADO_ID = '24d9a326-378b-4191-a4b3-d0ec8b9d23eb';
const PENDENTE_ID = '516be861-4c84-4d5a-9e57-27d3103d70a3';
const EM_ANALISE_ID = 'dda1c476-8884-4447-b0a0-328bd1dad957';
const PROXIMA_SEMANA_ID = '1b805ad7-5cab-4797-bc2d-2afd60a95870';
const REPROVADO_ID = '66fd400b-2172-4aef-a883-53812ff6ef43';
const REEMBOLSO_ID = 'b97f3afa-1b19-4621-966d-b32c61de6c2e';
const DESISTENTE_ID = '407b14d6-8561-45ef-9c40-c9ca1e1c89e7';
const CANCELADO_ID = 'b1d37f3e-ed3c-4edc-aa51-05fde410cdda';
const FORA_IDS = [REEMBOLSO_ID, DESISTENTE_ID, REPROVADO_ID, CANCELADO_ID]; // Próxima Semana contada separadamente

// Closers are now fetched dynamically from the database

// ── Date helpers ──
function fmtDate(d: Date) {
  return d.toISOString().split('T')[0];
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function pct(num: number, den: number) {
  if (den === 0) return '0%';
  return `${Math.round((num / den) * 100)}%`;
}

/** BRT offset: +3h to align UTC queries with BRT midnight/end-of-day */
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;

function toBRT(d: Date, offsetMs: number = BRT_OFFSET_MS): Date {
  return new Date(d.getTime() + offsetMs);
}

/** Incorporador periods: two distinct ranges
 *  - carrinhoWeek: Sáb 00:00 BRT → Sex 23:59:59 BRT (operational week for R1, R2, SDR, Closers)
 *  - safraContratos: Qui 00:00 BRT → Qua 23:59:59 BRT (offset for contract counting)
 *  - carrinhoThursday: Thu within the Fri of the carrinho week (for carrinho_config key)
 *  All returned dates are in UTC but represent BRT boundaries (+3h offset applied)
 */
function getIncorpPeriods() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun..6=Sat

  // Find last Friday (end of carrinho week)
  const daysSinceFri = (day + 7 - 5) % 7 || 7;
  const fri = new Date(now);
  fri.setDate(now.getDate() - daysSinceFri);
  fri.setHours(23, 59, 59, 999);

  // Saturday = Friday - 6 days
  const sat = new Date(fri);
  sat.setDate(fri.getDate() - 6);
  sat.setHours(0, 0, 0, 0);

  // Safra contratos: Thu = Sat - 2 days, Wed = Fri - 2 days
  const thu = new Date(sat);
  thu.setDate(sat.getDate() - 2);
  thu.setHours(0, 0, 0, 0);

  const wed = new Date(fri);
  wed.setDate(fri.getDate() - 2);
  wed.setHours(23, 59, 59, 999);

  // Carrinho Thursday = Friday - 1 day (Thu within the operational week, used for config key)
  const carrinhoThu = new Date(fri);
  carrinhoThu.setDate(fri.getDate() - 1);
  carrinhoThu.setHours(0, 0, 0, 0);

  // Apply BRT offset so UTC queries match BRT boundaries
  return {
    carrinhoWeek: { start: toBRT(sat), end: toBRT(fri) },
    safraContratos: { start: toBRT(thu), end: toBRT(wed) },
    // Keep raw dates for labels
    labels: { carrinhoStart: sat, carrinhoEnd: fri, safraStart: thu, safraEnd: wed, carrinhoThursday: carrinhoThu },
  };
}

/** Consórcio week: Mon 00:00 → Sun 23:59 of last completed week */
function getConsorcioWeek() {
  const now = new Date();
  const day = now.getDay();
  const daysSinceSun = day === 0 ? 0 : day;
  const lastSun = new Date(now);
  lastSun.setDate(now.getDate() - (daysSinceSun || 7));
  lastSun.setHours(23, 59, 59, 999);

  const mon = new Date(lastSun);
  mon.setDate(lastSun.getDate() - 6);
  mon.setHours(0, 0, 0, 0);

  return { start: mon, end: lastSun };
}

function dayLabel(d: string) {
  const date = new Date(d + 'T12:00:00');
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return `${days[date.getDay()]} ${d.split('-')[2]}/${d.split('-')[1]}`;
}

// ── HTML shared styles ──
const STYLES = `
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 20px; color: #1a1a2e; }
  .container { max-width: 720px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #fff; padding: 32px 40px; }
  .header h1 { margin: 0 0 4px; font-size: 22px; }
  .header p { margin: 0; opacity: 0.8; font-size: 13px; }
  .content { padding: 32px 40px; }
  .kpi-row { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
  .kpi { flex: 1; min-width: 100px; background: #f8f9fc; border-radius: 10px; padding: 14px 10px; text-align: center; border: 1px solid #e8eaf0; }
  .kpi .value { font-size: 26px; font-weight: 700; color: #1a1a2e; }
  .kpi .label { font-size: 10px; color: #666; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  .kpi.green .value { color: #059669; }
  .kpi.red .value { color: #dc2626; }
  .kpi.blue .value { color: #2563eb; }
  .kpi.purple .value { color: #7c3aed; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }
  th { background: #f0f2f5; padding: 8px 10px; text-align: left; font-weight: 600; color: #333; border-bottom: 2px solid #ddd; font-size: 11px; }
  td { padding: 7px 10px; border-bottom: 1px solid #eee; }
  tr:last-child td { border-bottom: none; }
  .section-title { font-size: 16px; font-weight: 700; margin: 28px 0 12px; color: #1a1a2e; border-left: 4px solid #6366f1; padding-left: 12px; }
  .sub-title { font-size: 13px; font-weight: 600; margin: 16px 0 8px; color: #444; }
  .highlight { color: #6366f1; font-weight: 700; }
  .footer { text-align: center; padding: 20px; font-size: 11px; color: #999; }
  .totals td { font-weight: 700; background: #f8f9fc; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; }
  .badge-green { background: #d1fae5; color: #065f46; }
  .badge-red { background: #fee2e2; color: #991b1b; }
  .badge-yellow { background: #fef3c7; color: #92400e; }
  .badge-blue { background: #dbeafe; color: #1e40af; }
  .rank-1 { background: #fef9c3; }
  .rank-2 { background: #f0fdf4; }
  .rank-3 { background: #fdf2f8; }
  .pie-container { display: flex; align-items: center; gap: 24px; margin: 16px 0 24px; }
  .pie-chart { width: 140px; height: 140px; border-radius: 50%; flex-shrink: 0; }
  .pie-legend { font-size: 12px; line-height: 2; }
  .pie-legend-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
  .kpi-hint { font-size: 9px; color: #888; margin-top: 4px; line-height: 1.2; padding: 0 4px; }
  .legend-note { font-size: 11px; color: #555; font-style: italic; margin: 4px 0 12px; padding: 8px 12px; background: #f8f9fc; border-left: 3px solid #cbd5e1; border-radius: 4px; }
  .pie-row { display: flex; gap: 16px; flex-wrap: wrap; margin: 16px 0 24px; }
  .pie-block { flex: 1; min-width: 280px; }
  .pie-block-title { font-size: 12px; font-weight: 600; color: #444; margin-bottom: 8px; text-align: center; }
`;

// ══════════════════════════════════════════════════
// INCORPORADOR REPORT (4 SECTIONS)
// ══════════════════════════════════════════════════
async function buildIncorporadorReport(supabase: any) {
  const periods = getIncorpPeriods();
  const { start: carrinhoStart, end: carrinhoEnd } = periods.carrinhoWeek;
  const { start: safraStart, end: safraEnd } = periods.safraContratos;

  const carrinhoStartISO = carrinhoStart.toISOString();
  const carrinhoEndISO = carrinhoEnd.toISOString();
  const safraStartISO = safraStart.toISOString();
  const safraEndISO = safraEnd.toISOString();

  console.log(`[INCORP] Carrinho week: ${carrinhoStartISO} → ${carrinhoEndISO}`);
  console.log(`[INCORP] Safra contratos: ${safraStartISO} → ${safraEndISO}`);

  // Use raw dates for labels (not BRT-shifted)
  const { labels } = periods;
  const carrinhoStartStr = fmtDate(labels.carrinhoStart);
  const carrinhoEndStr = fmtDate(labels.carrinhoEnd);
  const safraStartStr = fmtDate(labels.safraStart);
  const safraEndStr = fmtDate(labels.safraEnd);

  const periodLabel = `${carrinhoStartStr.split('-').reverse().join('/')} a ${carrinhoEndStr.split('-').reverse().join('/')}`;
  const safraLabel = `${safraStartStr.split('-').reverse().join('/')} a ${safraEndStr.split('-').reverse().join('/')}`;

  // ── Carrinho week start for encaixados query (use label date, not BRT shifted) ──

  // ── SDR list (profiles with role=sdr and squad=incorporador) ──
  const { data: sdrProfiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .contains('squad', ['incorporador']);

  const { data: allRoles } = await supabase
    .from('user_roles')
    .select('user_id, role')
    .in('user_id', (sdrProfiles || []).map((p: any) => p.id));

  const roleMap = new Map<string, string>();
  for (const r of allRoles || []) roleMap.set(r.user_id, r.role);

  const sdrs = (sdrProfiles || []).filter((p: any) => roleMap.get(p.id) === 'sdr');
  const sdrIds = sdrs.map((s: any) => s.id);

  // ── SDR comp plans for meta ──
  const { data: sdrEmployees } = await supabase
    .from('employees')
    .select('id, user_id, nome_completo')
    .in('user_id', sdrIds);

  const employeeIdMap = new Map<string, string>();
  for (const e of sdrEmployees || []) employeeIdMap.set(e.user_id, e.id);

  const employeeIds = (sdrEmployees || []).map((e: any) => e.id);
  const { data: compPlans } = await supabase
    .from('sdr_comp_plan')
    .select('sdr_id, meta_reunioes_agendadas, dias_uteis, vigencia_inicio, vigencia_fim')
    .in('sdr_id', employeeIds.length > 0 ? employeeIds : ['none'])
    .gte('vigencia_fim', carrinhoStartStr)
    .lte('vigencia_inicio', carrinhoEndStr);

  const metaMap = new Map<string, number>();
  for (const cp of compPlans || []) {
    const metaMensal = cp.meta_reunioes_agendadas || 0;
    const diasUteis = cp.dias_uteis || 20;
    const metaSemanal = Math.round((metaMensal / diasUteis) * 5);
    metaMap.set(cp.sdr_id, metaSemanal);
  }

  // ══ 0. SDR METRICS VIA RPC (same as dashboard) ══
  // Fetch SDR emails from sdr table (same logic as useSdrsFromSquad)
  const { data: sdrTableRows } = await supabase
    .from('sdr')
    .select('id, name, email, role_type')
    .eq('active', true)
    .eq('squad', 'incorporador')
    .eq('role_type', 'sdr');

  const validSdrEmails = new Set(
    (sdrTableRows || [])
      .filter((s: any) => s.email)
      .map((s: any) => s.email.toLowerCase())
  );

  console.log(`[INCORP] Valid SDR emails from sdr table: ${validSdrEmails.size}`);

  // Call the same RPC the dashboard uses for SDR metrics
  const { data: rpcMetricsRaw, error: rpcError } = await supabase.rpc('get_sdr_metrics_from_agenda', {
    start_date: carrinhoStartStr,
    end_date: carrinhoEndStr,
    sdr_email_filter: null,
    bu_filter: 'incorporador'
  });

  if (rpcError) console.error('[INCORP] RPC get_sdr_metrics_from_agenda error:', rpcError);

  // Parse RPC response (may return { metrics: [...] } or direct array)
  const rpcResponse = rpcMetricsRaw as any;
  const rpcMetrics: any[] = rpcResponse?.metrics || (Array.isArray(rpcResponse) ? rpcResponse : []);

  // Filter by valid SDR emails
  const filteredRpcMetrics = rpcMetrics.filter((m: any) =>
    validSdrEmails.has(m.sdr_email?.toLowerCase() || '')
  );

  // Aggregate RPC totals for KPIs
  const rpcTotals = filteredRpcMetrics.reduce((acc: any, m: any) => ({
    agendamentos: acc.agendamentos + (m.agendamentos || 0),
    r1_agendada: acc.r1_agendada + (m.r1_agendada || 0),
    r1_realizada: acc.r1_realizada + (m.r1_realizada || 0),
    no_shows: acc.no_shows + (m.no_shows || 0),
    contratos: acc.contratos + (m.contratos || 0),
  }), { agendamentos: 0, r1_agendada: 0, r1_realizada: 0, no_shows: 0, contratos: 0 });

  console.log(`[INCORP] RPC totals: agendamentos=${rpcTotals.agendamentos}, r1_agendada=${rpcTotals.r1_agendada}, r1_realizada=${rpcTotals.r1_realizada}, no_shows=${rpcTotals.no_shows}`);

  // ══ 1. CONTRATOS PAGOS (safra Qui-Qua) ══
  const { data: contratosTx } = await supabase
    .from('hubla_transactions')
    .select('id, customer_email, hubla_id, source, product_name, installment_number, sale_status')
    .eq('product_name', 'A000 - Contrato')
    .in('sale_status', ['completed', 'refunded'])
    .in('source', ['hubla', 'manual', 'make', 'mcfpay', 'kiwify'])
    .gte('sale_date', safraStartISO)
    .lte('sale_date', safraEndISO);

  // Remove newsale- prefix entries and make-sourced "contrato" entries
  const allContratos = (contratosTx || []).filter((t: any) => {
    if (t.hubla_id?.startsWith('newsale-')) return false;
    if (t.source === 'make' && t.product_name?.toLowerCase() === 'contrato') return false;
    return true;
  });
  const totalComRecorrencia = allContratos.length;
  const recorrencias = allContratos.filter((t: any) => (t.installment_number || 0) > 1).length;
  const contratosComReembolso = totalComRecorrencia - recorrencias;
  const contratosReembolsados = allContratos.filter((t: any) => t.sale_status === 'refunded' && (t.installment_number || 1) <= 1).length;
  const contratosLiquidos = contratosComReembolso - contratosReembolsados;

  // ══ 2. R1 MEETINGS (carrinho week Sáb-Sex) — filtered by BU incorporador ══
  // Dynamically fetch R1 closers from DB instead of hardcoded list
  const { data: r1ClosersDB } = await supabase
    .from('closers')
    .select('id, name')
    .eq('bu', 'incorporador')
    .eq('is_active', true)
    .or('meeting_type.is.null,meeting_type.eq.r1');

  const R1_CLOSER_IDS = (r1ClosersDB || []).map((c: any) => ({ id: c.id, name: c.name }));
  const incorporadorCloserIds = R1_CLOSER_IDS.map((c: any) => c.id);
  console.log(`[INCORP] R1 closers (dynamic): ${R1_CLOSER_IDS.map((c: any) => c.name).join(', ')} (${incorporadorCloserIds.length} total)`);

  // Still fetch R1 attendees for closer breakdown (uses scheduled_at which is correct for closer view)
  const { data: r1Attendees } = await supabase
    .from('meeting_slot_attendees')
    .select('id, status, booked_by, is_partner, contract_paid_at, meeting_slot:meeting_slots!inner(id, status, scheduled_at, meeting_type, closer_id, lead_type, booked_by)')
    .eq('meeting_slot.meeting_type', 'r1')
    .in('meeting_slot.closer_id', incorporadorCloserIds.length > 0 ? incorporadorCloserIds : ['none'])
    .gte('meeting_slot.scheduled_at', carrinhoStartISO)
    .lte('meeting_slot.scheduled_at', carrinhoEndISO);

  const r1NonPartner = (r1Attendees || []).filter((a: any) => !a.is_partner);

  // ══ 3. R2 MEETINGS — use carrinho config boundaries (horario_corte) ══
  // Dynamically fetch R2 closers from DB
  const { data: r2ClosersDB } = await supabase
    .from('closers')
    .select('id, name')
    .eq('bu', 'incorporador')
    .eq('is_active', true)
    .eq('meeting_type', 'r2');

  const R2_CLOSER_IDS = (r2ClosersDB || []).map((c: any) => ({ id: c.id, name: c.name }));
  console.log(`[INCORP] R2 closers (dynamic): ${R2_CLOSER_IDS.map((c: any) => c.name).join(', ')} (${R2_CLOSER_IDS.length} total)`);

  // Use carrinhoThursday for config key (cart system uses Thu as week start)
  const carrinhoThuStr = fmtDate(labels.carrinhoThursday);
  const carrinhoWeekKey = `carrinho_config_${carrinhoThuStr}`;
  const prevThursday = new Date(labels.carrinhoThursday);
  prevThursday.setDate(prevThursday.getDate() - 7);
  const prevCarrinhoWeekKey = `carrinho_config_${fmtDate(prevThursday)}`;

  console.log(`[INCORP] Carrinho config keys: ${carrinhoWeekKey} / ${prevCarrinhoWeekKey}`);

  const [configResult, prevConfigResult] = await Promise.all([
    supabase.from('settings').select('value').eq('key', carrinhoWeekKey).maybeSingle(),
    supabase.from('settings').select('value').eq('key', prevCarrinhoWeekKey).maybeSingle(),
  ]);

  // Fallback to global config, then default 12:00
  let currentCutoff = '12:00';
  let previousCutoff = '12:00';
  if (configResult.data?.value?.carrinhos?.[0]?.horario_corte) {
    currentCutoff = configResult.data.value.carrinhos[0].horario_corte;
  } else {
    // Try global fallback
    const { data: globalConfig } = await supabase.from('settings').select('value').eq('key', 'carrinho_config').maybeSingle();
    if (globalConfig?.value?.carrinhos?.[0]?.horario_corte) currentCutoff = globalConfig.value.carrinhos[0].horario_corte;
  }
  if (prevConfigResult.data?.value?.carrinhos?.[0]?.horario_corte) {
    previousCutoff = prevConfigResult.data.value.carrinhos[0].horario_corte;
  } else {
    previousCutoff = currentCutoff; // fallback to current
  }

  // R2 boundaries: full operational week (Sáb 00:00 BRT → Sex 23:59 BRT)
  // carrinhoStart = Saturday, carrinhoEnd = Friday
  const r2Start = new Date(labels.carrinhoStart);
  r2Start.setHours(3, 0, 0, 0); // 00:00 BRT = 03:00 UTC
  const r2End = new Date(labels.carrinhoEnd);
  r2End.setDate(r2End.getDate() + 1);
  r2End.setHours(2, 59, 59, 999); // 23:59:59 BRT = 02:59:59 UTC next day

  const r2StartISO = r2Start.toISOString();
  const r2EndISO = r2End.toISOString();

  console.log(`[INCORP] R2 boundaries (full week): ${r2StartISO} → ${r2EndISO}`);

  const { data: r2Attendees } = await supabase
    .from('meeting_slot_attendees')
    .select('id, status, r2_status_id, booked_by, is_partner, attendee_name, contract_paid_at, deal_id, meeting_slot:meeting_slots!inner(id, status, scheduled_at, meeting_type, closer_id, lead_type)')
    .eq('meeting_slot.meeting_type', 'r2')
    .gte('meeting_slot.scheduled_at', r2StartISO)
    .lte('meeting_slot.scheduled_at', r2EndISO);

  // Also include encaixados for this carrinho week (uses Thu date as week start)
  const weekStartStr = carrinhoThuStr;
  const { data: encaixados } = await supabase
    .from('meeting_slot_attendees')
    .select('id, status, r2_status_id, booked_by, is_partner, attendee_name, contract_paid_at, deal_id, meeting_slot:meeting_slots!inner(id, status, scheduled_at, meeting_type, closer_id, lead_type)')
    .eq('meeting_slot.meeting_type', 'r2')
    .eq('carrinho_week_start', weekStartStr);

  const allIds = new Set((r2Attendees || []).map((a: any) => a.id));
  const merged: any[] = [...(r2Attendees || [])];
  for (const enc of encaixados || []) {
    if (!allIds.has(enc.id)) { merged.push(enc); allIds.add(enc.id); }
  }
  const r2NonPartner = merged.filter((a: any) => !a.is_partner);

  // ── Classify R2 lead origins: A010 > ANAMNESE > LIVE ──
  const r2DealIds = r2NonPartner.map((a: any) => a.deal_id).filter(Boolean);
  let dealContactMap: Record<string, { email: string | null }> = {};
  let a010EmailSet = new Set<string>();
  let anamneseDealIds = new Set<string>();

  if (r2DealIds.length > 0) {
    // Fetch deal → contact email
    const { data: dealContacts } = await supabase
      .from('crm_deals')
      .select('id, crm_contacts(email)')
      .in('id', r2DealIds);

    for (const dc of dealContacts || []) {
      const contact = (dc as any).crm_contacts;
      dealContactMap[dc.id] = {
        email: contact?.email || null,
      };
    }

    // Batch check which emails are A010 buyers
    const allEmails = Object.values(dealContactMap)
      .map(c => c.email?.toLowerCase())
      .filter(Boolean) as string[];
    const uniqueEmails = [...new Set(allEmails)];

    if (uniqueEmails.length > 0) {
      const { data: a010Records } = await supabase
        .from('hubla_transactions')
        .select('customer_email')
        .eq('product_category', 'a010')
        .in('sale_status', ['completed', 'paid'])
        .in('customer_email', uniqueEmails);
      a010EmailSet = new Set((a010Records || []).map((r: any) => r.customer_email?.toLowerCase()).filter(Boolean));
    }

    // Detect ANAMNESE via deal_activities (stage UUID + name)
    const { data: anamnaseStages } = await supabase
      .from('crm_stages')
      .select('id')
      .ilike('stage_name', '%anamnes%');
    const anamnaseStageIds = new Set((anamnaseStages || []).map((s: any) => s.id));

    const { data: dealActivities } = await supabase
      .from('deal_activities')
      .select('deal_id, to_stage, from_stage')
      .in('deal_id', r2DealIds);

    for (const da of dealActivities || []) {
      const toStage = (da as any).to_stage || '';
      const fromStage = (da as any).from_stage || '';
      if (
        anamnaseStageIds.has(toStage) || anamnaseStageIds.has(fromStage) ||
        toStage.toUpperCase().includes('ANAMNES') ||
        fromStage.toUpperCase().includes('ANAMNES')
      ) {
        anamneseDealIds.add((da as any).deal_id);
      }
    }
    console.log(`[INCORP] Anamnese stages found: ${anamnaseStageIds.size}, deals with anamnese: ${anamneseDealIds.size}`);
  }

  let r2Agendadas = 0, r2Realizadas = 0, aprovados = 0, pendentes = 0, emAnalise = 0, foraDoCarrinho = 0, proximaSemana = 0, reprovados = 0;
  let originA010 = 0, originAnamnese = 0, originLive = 0;

  // R2 Agendadas = total non-partner (no status filter)
  r2Agendadas = r2NonPartner.length;

  for (const att of r2NonPartner) {
    const slot = (att as any).meeting_slot;
    if (!slot) continue;

    // Classify origin: A010 > ANAMNESE > LIVE (for ALL agendadas)
    const dcInfo = dealContactMap[(att as any).deal_id];
    const email = dcInfo?.email?.toLowerCase();
    if (email && a010EmailSet.has(email)) {
      originA010++;
    } else if ((att as any).deal_id && anamneseDealIds.has((att as any).deal_id)) {
      originAnamnese++;
    } else {
      originLive++;
    }

    // R2 Realizadas: all except true no-shows (no_show + slot not completed)
    if (!(att.status === 'no_show' && slot.status !== 'completed')) {
      r2Realizadas++;
    }

    if (att.r2_status_id === APROVADO_ID) aprovados++;
    else if (att.r2_status_id === PENDENTE_ID) pendentes++;
    else if (att.r2_status_id === EM_ANALISE_ID) emAnalise++;
    else if (att.r2_status_id === PROXIMA_SEMANA_ID) proximaSemana++;
    else if (att.r2_status_id === REPROVADO_ID) reprovados++;
    else if (att.r2_status_id && FORA_IDS.includes(att.r2_status_id)) foraDoCarrinho++;
  }

  // Pie chart data for R2 status
  const pieData = [
    { label: 'Aprovados', value: aprovados, color: '#059669' },
    { label: 'Pendentes', value: pendentes, color: '#f59e0b' },
    { label: 'Em Análise', value: emAnalise, color: '#3b82f6' },
    { label: 'Próxima Sem.', value: proximaSemana, color: '#8b5cf6' },
    { label: 'Reprovados', value: reprovados, color: '#ef4444' },
    { label: 'Fora (Outros)', value: foraDoCarrinho, color: '#6b7280' },
  ].filter(d => d.value > 0);
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);

  function buildPie(data: { label: string; value: number; color: string }[], total: number) {
    if (total === 0) return { gradient: 'conic-gradient(#e5e7eb 0% 100%)', legend: '<div style="color:#999;font-size:11px">Sem dados</div>' };
    let cumPct = 0;
    const stops: string[] = [];
    for (const d of data) {
      const segPct = (d.value / total) * 100;
      stops.push(`${d.color} ${cumPct}% ${cumPct + segPct}%`);
      cumPct += segPct;
    }
    const legend = data.map(d =>
      `<div><span class="pie-legend-dot" style="background:${d.color}"></span>${d.label}: <strong>${d.value}</strong> (${pct(d.value, total)})</div>`
    ).join('');
    return { gradient: `conic-gradient(${stops.join(', ')})`, legend };
  }

  const r2Pie = buildPie(pieData, pieTotal);
  const pieGradient = r2Pie.gradient;
  const pieLegendHtml = r2Pie.legend;

  // ── 2ª Pizza: Contratos Fechados (líquido) por Origem ──
  const contratosLiquidosTx = allContratos.filter((t: any) =>
    t.sale_status !== 'refunded' && (t.installment_number || 1) <= 1
  );
  const contratosEmails = contratosLiquidosTx
    .map((t: any) => t.customer_email?.toLowerCase())
    .filter(Boolean) as string[];
  const uniqueContratosEmails = [...new Set(contratosEmails)];

  // Quais desses emails passaram por estágio Anamnese?
  let contratosAnamneseEmails = new Set<string>();
  if (uniqueContratosEmails.length > 0) {
    const { data: contratosDeals } = await supabase
      .from('crm_deals')
      .select('id, crm_contacts!inner(email)')
      .in('crm_contacts.email', uniqueContratosEmails);
    const dealIdsByEmail = new Map<string, string[]>();
    for (const d of contratosDeals || []) {
      const email = (d as any).crm_contacts?.email?.toLowerCase();
      if (!email) continue;
      if (!dealIdsByEmail.has(email)) dealIdsByEmail.set(email, []);
      dealIdsByEmail.get(email)!.push(d.id);
    }
    // Cross-check com anamneseDealIds populados na seção R2
    // Para contratos fora dos R2 dessa semana, fazemos fetch adicional
    const allDealIds = [...dealIdsByEmail.values()].flat();
    const newDealIds = allDealIds.filter(id => !anamneseDealIds.has(id) && !r2DealIds.includes(id));
    if (newDealIds.length > 0) {
      const { data: anamnaseStages2 } = await supabase
        .from('crm_stages')
        .select('id')
        .ilike('stage_name', '%anamnes%');
      const stageIds2 = new Set((anamnaseStages2 || []).map((s: any) => s.id));
      const { data: extraActs } = await supabase
        .from('deal_activities')
        .select('deal_id, to_stage, from_stage')
        .in('deal_id', newDealIds);
      for (const da of extraActs || []) {
        const ts = (da as any).to_stage || '';
        const fs = (da as any).from_stage || '';
        if (stageIds2.has(ts) || stageIds2.has(fs) || ts.toUpperCase().includes('ANAMNES') || fs.toUpperCase().includes('ANAMNES')) {
          anamneseDealIds.add((da as any).deal_id);
        }
      }
    }
    for (const [email, dealIds] of dealIdsByEmail) {
      if (dealIds.some(id => anamneseDealIds.has(id))) {
        contratosAnamneseEmails.add(email);
      }
    }
  }

  let contratosA010 = 0, contratosAnamnese = 0, contratosLive = 0;
  for (const email of contratosEmails) {
    if (a010EmailSet.has(email)) contratosA010++;
    else if (contratosAnamneseEmails.has(email)) contratosAnamnese++;
    else contratosLive++;
  }

  const contratosPieData = [
    { label: 'A010', value: contratosA010, color: '#f59e0b' },
    { label: 'ANAMNESE', value: contratosAnamnese, color: '#3b82f6' },
    { label: 'LIVE', value: contratosLive, color: '#10b981' },
  ].filter(d => d.value > 0);
  const contratosPieTotal = contratosPieData.reduce((s, d) => s + d.value, 0);
  const contratosPie = buildPie(contratosPieData, contratosPieTotal);

  // ══ 4. SDR RANKING (from RPC data — same source as dashboard) ══
  // Build a map of SDR profile id → email for calls lookup
  const sdrIdToEmail = new Map<string, string>();
  for (const s of sdrs) {
    // Find email from profiles (sdrs has id + full_name from profiles query)
    const profile = (sdrProfiles || []).find((p: any) => p.id === s.id);
    // We need email - fetch from profiles
  }
  // Fetch SDR profile emails
  const { data: sdrProfileEmails } = await supabase
    .from('profiles')
    .select('id, email')
    .in('id', sdrIds.length > 0 ? sdrIds : ['none']);
  
  for (const p of sdrProfileEmails || []) {
    if (p.email) sdrIdToEmail.set(p.id, p.email.toLowerCase());
  }
  const sdrEmailToId = new Map<string, string>();
  for (const [id, email] of sdrIdToEmail) sdrEmailToId.set(email, id);

  interface SdrStats {
    name: string;
    meta: number;
    agendados: number;
    r1Realizadas: number;
    noShow: number;
    contratos: number;
    calls: number;
  }
  const sdrStatsMap = new Map<string, SdrStats>();
  for (const s of sdrs) {
    const empId = employeeIdMap.get(s.id);
    const meta = empId ? (metaMap.get(empId) || 0) : 0;
    sdrStatsMap.set(s.id, { name: s.full_name, meta, agendados: 0, r1Realizadas: 0, noShow: 0, contratos: 0, calls: 0 });
  }

  // Populate SDR stats from RPC metrics (agendamentos = booked_at based, matching dashboard)
  for (const m of filteredRpcMetrics) {
    const email = m.sdr_email?.toLowerCase() || '';
    const userId = sdrEmailToId.get(email);
    if (userId && sdrStatsMap.has(userId)) {
      const st = sdrStatsMap.get(userId)!;
      st.agendados = m.agendamentos || 0;
      st.r1Realizadas = m.r1_realizada || 0;
      st.noShow = m.no_shows || 0;
      st.contratos = m.contratos || 0;
    }
  }

  // Calls per SDR
  const { data: callsData } = await supabase
    .from('calls')
    .select('user_id')
    .in('user_id', sdrIds.length > 0 ? sdrIds : ['none'])
    .gte('started_at', carrinhoStartISO)
    .lte('started_at', carrinhoEndISO);

  for (const c of callsData || []) {
    if (sdrStatsMap.has(c.user_id)) {
      sdrStatsMap.get(c.user_id)!.calls++;
    }
  }

  // Sort SDRs by contratos desc, then r1Realizadas desc
  const sdrList = [...sdrStatsMap.entries()]
    .map(([id, st]) => ({ id, ...st }))
    .sort((a, b) => b.contratos - a.contratos || b.r1Realizadas - a.r1Realizadas);

  const sdrRows = sdrList.map((s, idx) => {
    const rankClass = idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : '';
    const noShowBase = s.r1Realizadas + s.noShow;
    const compRate = noShowBase > 0 ? pct(s.r1Realizadas, noShowBase) : '-';
    const noShowRate = noShowBase > 0 ? pct(s.noShow, noShowBase) : '-';
    const convRate = s.r1Realizadas > 0 ? pct(s.contratos, s.r1Realizadas) : '-';
    const metaPct = s.meta > 0 ? pct(s.agendados, s.meta) : '-';
    return `<tr class="${rankClass}">
      <td>${idx + 1}º</td>
      <td>${s.name}</td>
      <td style="text-align:center">${s.meta || '-'}</td>
      <td style="text-align:center">${s.agendados}</td>
      <td style="text-align:center">${metaPct}</td>
      <td style="text-align:center">${s.r1Realizadas}</td>
      <td style="text-align:center">${s.noShow}</td>
      <td style="text-align:center">${compRate}</td>
      <td style="text-align:center">${noShowRate}</td>
      <td style="text-align:center">${s.contratos}</td>
      <td style="text-align:center">${convRate}</td>
      <td style="text-align:center">${s.calls}</td>
    </tr>`;
  }).join('');

  const sdrTotals = sdrList.reduce((acc, s) => ({
    meta: acc.meta + s.meta,
    agendados: acc.agendados + s.agendados,
    r1Realizadas: acc.r1Realizadas + s.r1Realizadas,
    noShow: acc.noShow + s.noShow,
    contratos: acc.contratos + s.contratos,
    calls: acc.calls + s.calls,
  }), { meta: 0, agendados: 0, r1Realizadas: 0, noShow: 0, contratos: 0, calls: 0 });
  const sdrTotalsBase = sdrTotals.r1Realizadas + sdrTotals.noShow;

  // ══ 5. CLOSER R1 PERFORMANCE ══
  interface CloserR1Stats { name: string; r1Agendadas: number; r1Realizadas: number; contratos: number; r2Marcadas: number; aprovados: number; }
  const closerR1Map = new Map<string, CloserR1Stats>();
  for (const c of R1_CLOSER_IDS) closerR1Map.set(c.id, { name: c.name, r1Agendadas: 0, r1Realizadas: 0, contratos: 0, r2Marcadas: 0, aprovados: 0 });

  for (const att of r1NonPartner) {
    const slot = (att as any).meeting_slot;
    if (!slot) continue;
    const cid = slot.closer_id;
    if (cid && closerR1Map.has(cid)) {
      const st = closerR1Map.get(cid)!;
      if (att.status !== 'cancelled') {
        st.r1Agendadas++;
        if (att.status === 'completed' || att.status === 'presente' || att.status === 'contract_paid') st.r1Realizadas++;
        if (att.status === 'contract_paid' || att.contract_paid_at) st.contratos++;
      }
    }
  }

  // R2 marcadas per R1 closer: count R2 attendees where R1 closer booked or originated them
  // We approximate by counting R2 attendees that have booked_by matching SDRs that booked R1s for this closer
  // Actually simpler: count R2 attendees per R1 closer is not directly trackable. 
  // Instead, for R2 metrics of each R1 closer, we check attendees of R2 that came from R1 closers
  // Since we don't have a direct link, we skip r2Marcadas for now and set to 0.

  // For aprovados per R1 closer: same issue. We'll just show R1 metrics.
  const closerR1Rows = R1_CLOSER_IDS.map(c => {
    const st = closerR1Map.get(c.id)!;
    const compRate = st.r1Agendadas > 0 ? pct(st.r1Realizadas, st.r1Agendadas) : '-';
    const convRate = st.r1Realizadas > 0 ? pct(st.contratos, st.r1Realizadas) : '-';
    return `<tr>
      <td>${st.name}</td>
      <td style="text-align:center">${st.r1Agendadas}</td>
      <td style="text-align:center">${st.r1Realizadas}</td>
      <td style="text-align:center">${compRate}</td>
      <td style="text-align:center">${st.contratos}</td>
      <td style="text-align:center">${convRate}</td>
    </tr>`;
  }).join('');

  const r1CloserTotals = R1_CLOSER_IDS.reduce((acc, c) => {
    const st = closerR1Map.get(c.id)!;
    return { r1Ag: acc.r1Ag + st.r1Agendadas, r1Re: acc.r1Re + st.r1Realizadas, cont: acc.cont + st.contratos };
  }, { r1Ag: 0, r1Re: 0, cont: 0 });

  // ══ 6. CLOSER R2 PERFORMANCE ══
  interface CloserR2Stats { name: string; r2Agendadas: number; r2Realizadas: number; aprovados: number; reprovados: number; vendasParceria: number; receitaParceria: number; produtos: Map<string, number>; }
  const closerR2Map = new Map<string, CloserR2Stats>();
  for (const c of R2_CLOSER_IDS) closerR2Map.set(c.id, { name: c.name, r2Agendadas: 0, r2Realizadas: 0, aprovados: 0, reprovados: 0, vendasParceria: 0, receitaParceria: 0, produtos: new Map() });

  for (const att of r2NonPartner) {
    const slot = (att as any).meeting_slot;
    if (!slot) continue;
    const cid = slot.closer_id;
    if (cid && closerR2Map.has(cid)) {
      const st = closerR2Map.get(cid)!;
      if (att.status !== 'cancelled' && att.status !== 'rescheduled') st.r2Agendadas++; // R2 keeps excluding rescheduled
      if (att.status === 'completed' || att.status === 'presente' || slot.status === 'completed') st.r2Realizadas++;
      if (att.r2_status_id === APROVADO_ID) st.aprovados++;
      if (att.r2_status_id === REPROVADO_ID) st.reprovados++;
    }
  }

  // Partnership sales per R2 closer: match approved attendees' emails with hubla_transactions for A001/A009 products
  const { data: parceriaTx } = await supabase
    .from('hubla_transactions')
    .select('id, product_name, net_value, customer_email, linked_attendee_id')
    .or('product_name.ilike.%A001%,product_name.ilike.%A009%')
    .in('sale_status', ['completed', 'refunded'])
    .gte('sale_date', carrinhoStartISO)
    .lte('sale_date', carrinhoEndISO);

  // Map attendee_id -> closer_id for R2 attendees
  const attendeeCloserMap = new Map<string, string>();
  for (const att of r2NonPartner) {
    const slot = (att as any).meeting_slot;
    if (slot?.closer_id) attendeeCloserMap.set(att.id, slot.closer_id);
  }

  for (const tx of parceriaTx || []) {
    if (tx.linked_attendee_id && attendeeCloserMap.has(tx.linked_attendee_id)) {
      const closerId = attendeeCloserMap.get(tx.linked_attendee_id)!;
      if (closerR2Map.has(closerId)) {
        const st = closerR2Map.get(closerId)!;
        st.vendasParceria++;
        st.receitaParceria += tx.net_value || 0;
        const prodKey = (tx.product_name || 'Outro').trim();
        st.produtos.set(prodKey, (st.produtos.get(prodKey) || 0) + 1);
      }
    }
  }

  const closerR2Rows = R2_CLOSER_IDS.map(c => {
    const st = closerR2Map.get(c.id)!;
    const convR2 = st.r2Realizadas > 0 ? pct(st.aprovados, st.r2Realizadas) : '-';
    const ticketMedio = st.vendasParceria > 0 ? fmtBRL(st.receitaParceria / st.vendasParceria) : '-';
    return `<tr>
      <td>${st.name}</td>
      <td style="text-align:center">${st.r2Agendadas}</td>
      <td style="text-align:center">${st.r2Realizadas}</td>
      <td style="text-align:center"><span class="badge badge-green">${st.aprovados}</span></td>
      <td style="text-align:center"><span class="badge badge-red">${st.reprovados}</span></td>
      <td style="text-align:center">${convR2}</td>
      <td style="text-align:center">${st.vendasParceria}</td>
      <td style="text-align:right">${fmtBRL(st.receitaParceria)}</td>
      <td style="text-align:right">${ticketMedio}</td>
    </tr>`;
  }).join('');

  const r2CloserTotals = R2_CLOSER_IDS.reduce((acc, c) => {
    const st = closerR2Map.get(c.id)!;
    return { r2Ag: acc.r2Ag + st.r2Agendadas, r2Re: acc.r2Re + st.r2Realizadas, aprov: acc.aprov + st.aprovados, reprov: acc.reprov + st.reprovados, vendas: acc.vendas + st.vendasParceria, receita: acc.receita + st.receitaParceria };
  }, { r2Ag: 0, r2Re: 0, aprov: 0, reprov: 0, vendas: 0, receita: 0 });


  // ══ 7. RESUMO FINANCEIRO ══
  // A010 sales
  const { data: a010Sales } = await supabase
    .from('hubla_transactions')
    .select('id, net_value')
    .eq('product_category', 'a010')
    .in('sale_status', ['completed', 'refunded'])
    .gte('sale_date', carrinhoStartISO)
    .lte('sale_date', carrinhoEndISO);
  const a010Count = (a010Sales || []).length;
  const a010Revenue = (a010Sales || []).reduce((s: number, t: any) => s + (t.net_value || 0), 0);

  // Partnership by product (A001, A009 etc)
  const parceriaByProduct = new Map<string, { count: number; revenue: number }>();
  for (const tx of parceriaTx || []) {
    const pname = (tx.product_name || 'Outro').trim();
    if (!parceriaByProduct.has(pname)) parceriaByProduct.set(pname, { count: 0, revenue: 0 });
    const p = parceriaByProduct.get(pname)!;
    p.count++;
    p.revenue += tx.net_value || 0;
  }

  const finRows = [
    `<tr><td>Vendas A010</td><td style="text-align:center">${a010Count}</td><td style="text-align:right">${fmtBRL(a010Revenue)}</td></tr>`,
    `<tr><td>Contratos (A000)</td><td style="text-align:center">${contratosLiquidos}</td><td style="text-align:right">-</td></tr>`,
  ];
  for (const [prod, stats] of [...parceriaByProduct.entries()].sort((a, b) => b[1].count - a[1].count)) {
    finRows.push(`<tr><td>Parceria — ${prod}</td><td style="text-align:center">${stats.count}</td><td style="text-align:right">${fmtBRL(stats.revenue)}</td></tr>`);
  }
  const totalParceria = [...parceriaByProduct.values()].reduce((s, p) => s + p.revenue, 0);
  const totalParceriaCount = [...parceriaByProduct.values()].reduce((s, p) => s + p.count, 0);
  finRows.push(`<tr class="totals"><td>TOTAL PARCERIA</td><td style="text-align:center">${totalParceriaCount}</td><td style="text-align:right">${fmtBRL(totalParceria)}</td></tr>`);

  // ══ BUILD HTML ══
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${STYLES}</style></head><body>
<div class="container">
  <div class="header">
    <h1>📊 Relatório Semanal — Incorporador</h1>
    <p>Semana do Carrinho: ${periodLabel} (Sáb-Sex)</p>
    <p style="font-size:11px;opacity:0.7">Safra Contratos: ${safraLabel} (Qui-Qua)</p>
  </div>
  <div class="content">

    <!-- SEÇÃO 1: KPIs DO CARRINHO -->
    <div class="section-title">1. KPIs do Carrinho</div>

    <div class="sub-title">Contratos (Safra ${safraLabel})</div>
    <div class="kpi-row">
      <div class="kpi"><div class="value">${totalComRecorrencia}</div><div class="label">Total Transações</div></div>
      <div class="kpi"><div class="value">${recorrencias}</div><div class="label">Recorrências</div></div>
      <div class="kpi blue"><div class="value">${contratosComReembolso}</div><div class="label">Com Reembolso</div></div>
      <div class="kpi red"><div class="value">${contratosReembolsados}</div><div class="label">Reembolsos</div></div>
      <div class="kpi green"><div class="value">${contratosLiquidos}</div><div class="label">Contratos Líq.</div></div>
    </div>

    <div class="sub-title">Reuniões R1</div>
    <div class="kpi-row">
      <div class="kpi"><div class="value">${rpcTotals.agendamentos}</div><div class="label">Agendamentos</div></div>
      <div class="kpi"><div class="value">${rpcTotals.r1_realizada}</div><div class="label">R1 Realizada</div></div>
      <div class="kpi red"><div class="value">${rpcTotals.no_shows}</div><div class="label">No-Show R1</div></div>
    </div>

    <div class="sub-title">Reuniões R2</div>
    <div class="kpi-row">
      <div class="kpi"><div class="value">${r2Agendadas}</div><div class="label">R2 Agendada</div></div>
      <div class="kpi"><div class="value">${r2Realizadas}</div><div class="label">R2 Realizada</div></div>
      <div class="kpi green"><div class="value">${aprovados}</div><div class="label">Aprovados</div></div>
      <div class="kpi purple"><div class="value">${proximaSemana}</div><div class="label">Próx. Semana</div></div>
      <div class="kpi red"><div class="value">${foraDoCarrinho}</div><div class="label">Fora Carrinho</div></div>
    </div>

    <div class="sub-title">Origem dos Leads (R2)</div>
    <div class="kpi-row">
      <div class="kpi" style="border-top:3px solid #f59e0b"><div class="value">${originA010}</div><div class="label">A010</div></div>
      <div class="kpi blue"><div class="value">${originAnamnese}</div><div class="label">ANAMNESE</div></div>
      <div class="kpi green"><div class="value">${originLive}</div><div class="label">LIVE</div></div>
    </div>

    <div class="sub-title">Distribuição R2 — Status</div>
    <div class="pie-container">
      <div class="pie-chart" style="background: ${pieGradient};"></div>
      <div class="pie-legend">${pieLegendHtml}</div>
    </div>

    <!-- SEÇÃO 2: RANKING SDRs -->
    <div class="section-title">2. Ranking SDRs</div>
    <table>
      <tr>
        <th>#</th><th>SDR</th><th style="text-align:center">Meta/Agend.</th>
        <th style="text-align:center">R1 Real.</th><th style="text-align:center">No-Show</th>
        <th style="text-align:center">Contratos</th><th style="text-align:center">% No-Show</th>
        <th style="text-align:center">% Conv.</th><th style="text-align:center">Ligações</th>
      </tr>
      ${sdrRows || '<tr><td colspan="9" style="text-align:center;color:#999">Sem SDRs</td></tr>'}
      <tr class="totals">
        <td></td><td>TOTAL</td>
        <td style="text-align:center">${sdrTotals.agendados}</td>
        <td style="text-align:center">${sdrTotals.r1Realizadas}</td>
        <td style="text-align:center">${sdrTotals.noShow}</td>
        <td style="text-align:center">${sdrTotals.contratos}</td>
        <td style="text-align:center">${pct(sdrTotals.noShow, sdrTotals.agendados)}</td>
        <td style="text-align:center">${pct(sdrTotals.contratos, sdrTotals.r1Realizadas)}</td>
        <td style="text-align:center">${sdrTotals.calls}</td>
      </tr>
    </table>

    <!-- SEÇÃO 3: CLOSERS -->
    <div class="section-title">3. Performance Closers</div>
    
    <div class="sub-title">Closers R1</div>
    <table>
      <tr><th>Closer R1</th><th style="text-align:center">R1 Agendada</th><th style="text-align:center">R1 Realizada</th><th style="text-align:center">Contratos</th></tr>
      ${closerR1Rows}
      <tr class="totals"><td>TOTAL</td><td style="text-align:center">${r1CloserTotals.r1Ag}</td><td style="text-align:center">${r1CloserTotals.r1Re}</td><td style="text-align:center">${r1CloserTotals.cont}</td></tr>
    </table>

    <div class="sub-title">Closers R2</div>
    <table>
      <tr><th>Closer R2</th><th style="text-align:center">R2 Agend.</th><th style="text-align:center">R2 Real.</th><th style="text-align:center">Aprovados</th><th style="text-align:center">Reprov.</th><th style="text-align:center">Vendas Parc.</th><th>Produtos</th></tr>
      ${closerR2Rows}
      <tr class="totals">
        <td>TOTAL</td>
        <td style="text-align:center">${r2CloserTotals.r2Ag}</td>
        <td style="text-align:center">${r2CloserTotals.r2Re}</td>
        <td style="text-align:center">${r2CloserTotals.aprov}</td>
        <td style="text-align:center">${r2CloserTotals.reprov}</td>
        <td style="text-align:center">${r2CloserTotals.vendas}</td>
        <td></td>
      </tr>
    </table>

    <!-- SEÇÃO 4: RESUMO FINANCEIRO -->
    <div class="section-title">4. Resumo Financeiro</div>
    <table>
      <tr><th>Tipo</th><th style="text-align:center">Qtd</th><th style="text-align:right">Valor</th></tr>
      ${finRows.join('')}
    </table>

  </div>
  <div class="footer">MCF Gestão — Relatório gerado automaticamente em ${new Date().toLocaleDateString('pt-BR')}</div>
</div>
</body></html>`;
}

// ══════════════════════════════════════════════════
// CONSÓRCIO REPORT
// ══════════════════════════════════════════════════
async function buildConsorcioReport(supabase: any) {
  const { start, end } = getConsorcioWeek();
  const startStr = fmtDate(start);
  const endStr = fmtDate(end);

  const { data: cards } = await supabase
    .from('consortium_cards')
    .select('id, data_contratacao, valor_credito, valor_comissao, vendedor_name, vendedor_id')
    .gte('data_contratacao', startStr)
    .lte('data_contratacao', endStr);

  const allCards = cards || [];
  const totalCards = allCards.length;
  const totalCredito = allCards.reduce((s: number, c: any) => s + (Number(c.valor_credito) || 0), 0);
  const totalComissao = allCards.reduce((s: number, c: any) => s + (Number(c.valor_comissao) || 0), 0);

  const byDay = new Map<string, { count: number; credito: number }>();
  for (const c of allCards) {
    const day = c.data_contratacao;
    if (!byDay.has(day)) byDay.set(day, { count: 0, credito: 0 });
    const d = byDay.get(day)!;
    d.count++;
    d.credito += Number(c.valor_credito) || 0;
  }
  const sortedDays = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const byVendedor = new Map<string, { name: string; count: number; credito: number; comissao: number }>();
  for (const c of allCards) {
    const name = c.vendedor_name || 'Sem vendedor';
    const key = c.vendedor_id || name;
    if (!byVendedor.has(key)) byVendedor.set(key, { name, count: 0, credito: 0, comissao: 0 });
    const v = byVendedor.get(key)!;
    v.count++;
    v.credito += Number(c.valor_credito) || 0;
    v.comissao += Number(c.valor_comissao) || 0;
  }
  const sortedVendedores = [...byVendedor.values()].sort((a, b) => b.count - a.count);

  const periodLabel = `${startStr.split('-').reverse().join('/')} a ${endStr.split('-').reverse().join('/')}`;

  const dayRows = sortedDays.map(([day, stats]) =>
    `<tr><td>${dayLabel(day)}</td><td style="text-align:center">${stats.count}</td><td style="text-align:right">${fmtBRL(stats.credito)}</td></tr>`
  ).join('');

  const vendedorRows = sortedVendedores.map(v =>
    `<tr><td>${v.name}</td><td style="text-align:center">${v.count}</td><td style="text-align:right">${fmtBRL(v.credito)}</td><td style="text-align:right">${fmtBRL(v.comissao)}</td></tr>`
  ).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${STYLES}
    .header { background: linear-gradient(135deg, #065f46 0%, #047857 100%); }
  </style></head><body>
<div class="container">
  <div class="header">
    <h1>📊 Relatório Semanal — Consórcio</h1>
    <p>Período: ${periodLabel}</p>
  </div>
  <div class="content">
    <div class="kpi-row">
      <div class="kpi"><div class="value">${totalCards}</div><div class="label">Cartas Vendidas</div></div>
      <div class="kpi"><div class="value">${fmtBRL(totalCredito)}</div><div class="label">Valor de Crédito</div></div>
      <div class="kpi"><div class="value">${fmtBRL(totalComissao)}</div><div class="label">Comissão Total</div></div>
    </div>

    <div class="section-title">Vendas por Dia</div>
    <table>
      <tr><th>Dia</th><th style="text-align:center">Cartas</th><th style="text-align:right">Crédito</th></tr>
      ${dayRows || '<tr><td colspan="3" style="text-align:center;color:#999">Sem vendas no período</td></tr>'}
      <tr class="totals"><td>TOTAL</td><td style="text-align:center">${totalCards}</td><td style="text-align:right">${fmtBRL(totalCredito)}</td></tr>
    </table>

    <div class="section-title">Performance por Vendedor</div>
    <table>
      <tr><th>Vendedor</th><th style="text-align:center">Cartas</th><th style="text-align:right">Crédito</th><th style="text-align:right">Comissão</th></tr>
      ${vendedorRows || '<tr><td colspan="4" style="text-align:center;color:#999">Sem dados</td></tr>'}
    </table>
  </div>
  <div class="footer">MCF Gestão — Relatório gerado automaticamente em ${new Date().toLocaleDateString('pt-BR')}</div>
</div>
</body></html>`;
}

// ── Main ──
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const buFilter = body?.buFilter || null;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results: { bu: string; manager: string; success: boolean; error?: string }[] = [];

    // 1. Incorporador report for Jessica
    if (!buFilter || buFilter === 'incorporador') {
    try {
      const incorpHtml = await buildIncorporadorReport(supabase);
      const { data: sendResult, error: sendError } = await supabase.functions.invoke('brevo-send', {
        body: {
          to: MANAGERS.incorporador.email,
          name: MANAGERS.incorporador.name,
          subject: '📊 Relatório Semanal Incorporador — Carrinho R2',
          htmlContent: incorpHtml,
          tags: ['weekly-manager-report', 'incorporador'],
        },
      });
      if (sendError) throw sendError;
      results.push({ bu: 'incorporador', manager: MANAGERS.incorporador.name, success: true });
      console.log('[WEEKLY-MANAGER] Incorporador report sent to', MANAGERS.incorporador.email);
    } catch (e: any) {
      console.error('[WEEKLY-MANAGER] Error sending incorporador report:', e.message);
      results.push({ bu: 'incorporador', manager: MANAGERS.incorporador.name, success: false, error: e.message });
    }
    }

    // 2. Consórcio report for Thobson
    if (!buFilter || buFilter === 'consorcio') {
    try {
      const consorcioHtml = await buildConsorcioReport(supabase);
      const { data: sendResult, error: sendError } = await supabase.functions.invoke('brevo-send', {
        body: {
          to: MANAGERS.consorcio.email,
          name: MANAGERS.consorcio.name,
          subject: '📊 Relatório Semanal Consórcio — Vendas de Cartas',
          htmlContent: consorcioHtml,
          tags: ['weekly-manager-report', 'consorcio'],
        },
      });
      if (sendError) throw sendError;
      results.push({ bu: 'consorcio', manager: MANAGERS.consorcio.name, success: true });
      console.log('[WEEKLY-MANAGER] Consórcio report sent to', MANAGERS.consorcio.email);
    } catch (e: any) {
      console.error('[WEEKLY-MANAGER] Error sending consórcio report:', e.message);
      results.push({ bu: 'consorcio', manager: MANAGERS.consorcio.name, success: false, error: e.message });
    }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[WEEKLY-MANAGER] Fatal error:', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
