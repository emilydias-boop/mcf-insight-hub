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

// ── Closer IDs from closers table (incorporador, active) ──
const R1_CLOSER_IDS = [
  { id: 'ae78cf12-a9aa-4c51-855f-a64f5373d339', name: 'Cristiane Gomes' },
  { id: '1ed213d0-c4ff-466a-abac-2e50400963e4', name: 'Jessica Bellini' },
  { id: '697b1c04-6dd0-4955-8f33-2e0bcfaad007', name: 'Julio' },
  { id: '2396c873-a59c-4e07-bcd8-82b6f330b969', name: 'Mateus Macedo' },
  { id: '1c10697f-2456-48ff-bbdb-ee6cbe5f4e4a', name: 'Thayna' },
];
const R2_CLOSER_IDS = [
  { id: 'f598dc41-8468-4372-a720-14fb0250d95a', name: 'Claudia Carielo' },
  { id: 'a762c12f-3ee0-49b9-aec7-3feef61e9976', name: 'Jessica Bellini' },
  { id: '76ede8f4-92fa-4fce-95bf-0db0fed1a0fd', name: 'Jessica Martins' },
];

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

  // Apply BRT offset so UTC queries match BRT boundaries
  return {
    carrinhoWeek: { start: toBRT(sat), end: toBRT(fri) },
    safraContratos: { start: toBRT(thu), end: toBRT(wed) },
    // Keep raw dates for labels
    labels: { carrinhoStart: sat, carrinhoEnd: fri, safraStart: thu, safraEnd: wed },
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
  const totalComRecorrencia = allContratos.length; // e.g. 41
  const recorrencias = allContratos.filter((t: any) => (t.installment_number || 0) > 1).length; // e.g. 3
  const contratosComReembolso = totalComRecorrencia - recorrencias; // e.g. 38
  const contratosReembolsados = allContratos.filter((t: any) => t.sale_status === 'refunded' && (t.installment_number || 1) <= 1).length; // e.g. 11
  const contratosLiquidos = contratosComReembolso - contratosReembolsados; // e.g. 27

  // ══ 2. R1 MEETINGS (carrinho week Sáb-Sex) ══
  const { data: r1Attendees } = await supabase
    .from('meeting_slot_attendees')
    .select('id, status, booked_by, is_partner, contract_paid_at, meeting_slot:meeting_slots!inner(id, status, scheduled_at, meeting_type, closer_id, lead_type, booked_by)')
    .eq('meeting_slot.meeting_type', 'r1')
    .gte('meeting_slot.scheduled_at', carrinhoStartISO)
    .lte('meeting_slot.scheduled_at', carrinhoEndISO);

  const r1NonPartner = (r1Attendees || []).filter((a: any) => !a.is_partner);

  let r1Agendadas = 0, r1Realizadas = 0, r1NoShow = 0;
  for (const att of r1NonPartner) {
    const slot = (att as any).meeting_slot;
    if (!slot) continue;
    if (att.status !== 'cancelled' && att.status !== 'rescheduled') {
      r1Agendadas++;
      if (att.status === 'completed' || att.status === 'presente' || att.status === 'contract_paid') {
        r1Realizadas++;
      } else if (att.status === 'no_show') {
        r1NoShow++;
      }
    }
  }

  // ══ 3. R2 MEETINGS (carrinho week Sáb-Sex) ══
  const { data: r2Attendees } = await supabase
    .from('meeting_slot_attendees')
    .select('id, status, r2_status_id, booked_by, is_partner, attendee_name, contract_paid_at, meeting_slot:meeting_slots!inner(id, status, scheduled_at, meeting_type, closer_id, lead_type)')
    .eq('meeting_slot.meeting_type', 'r2')
    .gte('meeting_slot.scheduled_at', carrinhoStartISO)
    .lte('meeting_slot.scheduled_at', carrinhoEndISO);

  // Also include encaixados for this carrinho week
  const weekStartStr = fmtDate(carrinhoStart);
  const { data: encaixados } = await supabase
    .from('meeting_slot_attendees')
    .select('id, status, r2_status_id, booked_by, is_partner, attendee_name, contract_paid_at, meeting_slot:meeting_slots!inner(id, status, scheduled_at, meeting_type, closer_id, lead_type)')
    .eq('meeting_slot.meeting_type', 'r2')
    .eq('carrinho_week_start', weekStartStr);

  const allIds = new Set((r2Attendees || []).map((a: any) => a.id));
  const merged: any[] = [...(r2Attendees || [])];
  for (const enc of encaixados || []) {
    if (!allIds.has(enc.id)) { merged.push(enc); allIds.add(enc.id); }
  }
  const r2NonPartner = merged.filter((a: any) => !a.is_partner);

  let r2Agendadas = 0, r2Realizadas = 0, aprovados = 0, pendentes = 0, emAnalise = 0, foraDoCarrinho = 0, proximaSemana = 0, reprovados = 0;
  let originLive = 0, originA010 = 0;

  for (const att of r2NonPartner) {
    const slot = (att as any).meeting_slot;
    if (!slot) continue;
    // R2 Agendadas: excluir cancelled, rescheduled E pre_scheduled
    if (att.status !== 'cancelled' && att.status !== 'rescheduled' && att.status !== 'pre_scheduled') {
      r2Agendadas++;
      if (slot.lead_type === 'A') originA010++;
      else if (slot.lead_type === 'B') originLive++;
    }
    if (att.status === 'completed' || att.status === 'presente' || slot.status === 'completed') r2Realizadas++;
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

  let pieGradient = '';
  if (pieTotal > 0) {
    let cumPct = 0;
    const stops: string[] = [];
    for (const d of pieData) {
      const segPct = (d.value / pieTotal) * 100;
      stops.push(`${d.color} ${cumPct}% ${cumPct + segPct}%`);
      cumPct += segPct;
    }
    pieGradient = `conic-gradient(${stops.join(', ')})`;
  } else {
    pieGradient = 'conic-gradient(#e5e7eb 0% 100%)';
  }

  const pieLegendHtml = pieData.map(d =>
    `<div><span class="pie-legend-dot" style="background:${d.color}"></span>${d.label}: <strong>${d.value}</strong> (${pct(d.value, pieTotal)})</div>`
  ).join('');

  // ══ 4. SDR RANKING ══
  // For each SDR: R1 agendadas, R1 realizadas, no-show, contratos (via contract_paid_at on R1 attendees booked by them)
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

  // Count R1 metrics per SDR (booked_by = SDR user_id on the slot)
  for (const att of r1NonPartner) {
    const slot = (att as any).meeting_slot;
    if (!slot) continue;
    const booker = slot.booked_by || att.booked_by;
    if (booker && sdrStatsMap.has(booker)) {
      const st = sdrStatsMap.get(booker)!;
      if (att.status !== 'cancelled' && att.status !== 'rescheduled') {
        st.agendados++;
        if (att.status === 'completed' || att.status === 'presente' || att.status === 'contract_paid') {
          st.r1Realizadas++;
        } else if (att.status === 'no_show') {
          st.noShow++;
        }
        if (att.status === 'contract_paid' || att.contract_paid_at) {
          st.contratos++;
        }
      }
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
    const noShowRate = s.agendados > 0 ? pct(s.noShow, s.agendados) : '-';
    const convRate = s.r1Realizadas > 0 ? pct(s.contratos, s.r1Realizadas) : '-';
    const metaStr = s.meta > 0 ? `${s.agendados}/${s.meta}` : `${s.agendados}`;
    return `<tr class="${rankClass}">
      <td>${idx + 1}º</td>
      <td>${s.name}</td>
      <td style="text-align:center">${metaStr}</td>
      <td style="text-align:center">${s.r1Realizadas}</td>
      <td style="text-align:center">${s.noShow}</td>
      <td style="text-align:center">${s.contratos}</td>
      <td style="text-align:center">${noShowRate}</td>
      <td style="text-align:center">${convRate}</td>
      <td style="text-align:center">${s.calls}</td>
    </tr>`;
  }).join('');

  const sdrTotals = sdrList.reduce((acc, s) => ({
    agendados: acc.agendados + s.agendados,
    r1Realizadas: acc.r1Realizadas + s.r1Realizadas,
    noShow: acc.noShow + s.noShow,
    contratos: acc.contratos + s.contratos,
    calls: acc.calls + s.calls,
  }), { agendados: 0, r1Realizadas: 0, noShow: 0, contratos: 0, calls: 0 });

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
      if (att.status !== 'cancelled' && att.status !== 'rescheduled') {
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
    return `<tr>
      <td>${st.name}</td>
      <td style="text-align:center">${st.r1Agendadas}</td>
      <td style="text-align:center">${st.r1Realizadas}</td>
      <td style="text-align:center">${st.contratos}</td>
    </tr>`;
  }).join('');

  const r1CloserTotals = R1_CLOSER_IDS.reduce((acc, c) => {
    const st = closerR1Map.get(c.id)!;
    return { r1Ag: acc.r1Ag + st.r1Agendadas, r1Re: acc.r1Re + st.r1Realizadas, cont: acc.cont + st.contratos };
  }, { r1Ag: 0, r1Re: 0, cont: 0 });

  // ══ 6. CLOSER R2 PERFORMANCE ══
  interface CloserR2Stats { name: string; r2Agendadas: number; r2Realizadas: number; aprovados: number; reprovados: number; vendasParceria: number; produtos: Map<string, number>; }
  const closerR2Map = new Map<string, CloserR2Stats>();
  for (const c of R2_CLOSER_IDS) closerR2Map.set(c.id, { name: c.name, r2Agendadas: 0, r2Realizadas: 0, aprovados: 0, reprovados: 0, vendasParceria: 0, produtos: new Map() });

  for (const att of r2NonPartner) {
    const slot = (att as any).meeting_slot;
    if (!slot) continue;
    const cid = slot.closer_id;
    if (cid && closerR2Map.has(cid)) {
      const st = closerR2Map.get(cid)!;
      if (att.status !== 'cancelled' && att.status !== 'rescheduled') st.r2Agendadas++;
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
        const prodKey = (tx.product_name || 'Outro').trim();
        st.produtos.set(prodKey, (st.produtos.get(prodKey) || 0) + 1);
      }
    }
  }

  const closerR2Rows = R2_CLOSER_IDS.map(c => {
    const st = closerR2Map.get(c.id)!;
    const prodList = [...st.produtos.entries()].map(([p, n]) => `${p}: ${n}`).join(', ') || '-';
    return `<tr>
      <td>${st.name}</td>
      <td style="text-align:center">${st.r2Agendadas}</td>
      <td style="text-align:center">${st.r2Realizadas}</td>
      <td style="text-align:center"><span class="badge badge-green">${st.aprovados}</span></td>
      <td style="text-align:center"><span class="badge badge-red">${st.reprovados}</span></td>
      <td style="text-align:center">${st.vendasParceria}</td>
      <td style="font-size:10px">${prodList}</td>
    </tr>`;
  }).join('');

  const r2CloserTotals = R2_CLOSER_IDS.reduce((acc, c) => {
    const st = closerR2Map.get(c.id)!;
    return { r2Ag: acc.r2Ag + st.r2Agendadas, r2Re: acc.r2Re + st.r2Realizadas, aprov: acc.aprov + st.aprovados, reprov: acc.reprov + st.reprovados, vendas: acc.vendas + st.vendasParceria };
  }, { r2Ag: 0, r2Re: 0, aprov: 0, reprov: 0, vendas: 0 });

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
      <div class="kpi"><div class="value">${contratosTotal}</div><div class="label">Total c/ Reemb.</div></div>
      <div class="kpi red"><div class="value">${contratosReembolsados}</div><div class="label">Reembolsos</div></div>
      <div class="kpi green"><div class="value">${contratosLiquidos}</div><div class="label">Contratos Líq.</div></div>
    </div>

    <div class="sub-title">Reuniões R1</div>
    <div class="kpi-row">
      <div class="kpi"><div class="value">${r1Agendadas}</div><div class="label">R1 Agendada</div></div>
      <div class="kpi"><div class="value">${r1Realizadas}</div><div class="label">R1 Realizada</div></div>
      <div class="kpi red"><div class="value">${r1NoShow}</div><div class="label">No-Show R1</div></div>
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
      <div class="kpi blue"><div class="value">${originLive}</div><div class="label">LIVE</div></div>
      <div class="kpi"><div class="value">${originA010}</div><div class="label">A010</div></div>
      <div class="kpi"><div class="value">${r2Agendadas - originLive - originA010}</div><div class="label">Outros / N/A</div></div>
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results: { bu: string; manager: string; success: boolean; error?: string }[] = [];

    // 1. Incorporador report for Jessica
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

    // 2. Consórcio report for Thobson
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
