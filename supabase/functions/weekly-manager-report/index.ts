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
    email: 'jessica.bellini.r2@minhacasafinanciada.com',
  },
  consorcio: {
    name: 'Thobson Motta',
    email: 'thobson.motta@minhacasafinanciada.com',
  },
};

// ── R2 Status IDs (from r2_status_options) ──
const APROVADO_ID = '24d9a326-378b-4191-a4b3-d0ec8b9d23eb';
const PENDENTE_ID = '516be861-4c84-4d5a-9e57-27d3103d70a3';
const EM_ANALISE_ID = 'dda1c476-8884-4447-b0a0-328bd1dad957';
const FORA_IDS = [
  'b97f3afa-1b19-4621-966d-b32c61de6c2e', // Reembolso
  '407b14d6-8561-45ef-9c40-c9ca1e1c89e7', // Desistente
  '66fd400b-2172-4aef-a883-53812ff6ef43', // Reprovado
  '1b805ad7-5cab-4797-bc2d-2afd60a95870', // Próxima Semana
  'b1d37f3e-ed3c-4edc-aa51-05fde410cdda', // Cancelado
];

// ── Date helpers ──
function fmtDate(d: Date) {
  return d.toISOString().split('T')[0];
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Incorporador week: Thu 00:00 → Wed 23:59 of last completed week */
function getIncorpWeek() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun … 6=Sat
  // Find last Wednesday (end of previous cart week)
  const daysSinceWed = (day + 7 - 3) % 7 || 7; // at least 1 day ago
  const wed = new Date(now);
  wed.setDate(now.getDate() - daysSinceWed);
  wed.setHours(23, 59, 59, 999);

  const thu = new Date(wed);
  thu.setDate(wed.getDate() - 6);
  thu.setHours(0, 0, 0, 0);

  return { start: thu, end: wed };
}

/** Consórcio week: Mon 00:00 → Sun 23:59 of last completed week */
function getConsorcioWeek() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const daysSinceSun = day === 0 ? 0 : day; // 0 if Sun
  // If today is Mon, daysSinceSun=1 → lastSun = yesterday
  const lastSun = new Date(now);
  // We want the PREVIOUS completed week, so go back to last Sunday
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
  .container { max-width: 680px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #fff; padding: 32px 40px; }
  .header h1 { margin: 0 0 4px; font-size: 22px; }
  .header p { margin: 0; opacity: 0.8; font-size: 13px; }
  .content { padding: 32px 40px; }
  .kpi-row { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
  .kpi { flex: 1; min-width: 120px; background: #f8f9fc; border-radius: 10px; padding: 16px; text-align: center; border: 1px solid #e8eaf0; }
  .kpi .value { font-size: 28px; font-weight: 700; color: #1a1a2e; }
  .kpi .label { font-size: 11px; color: #666; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
  th { background: #f0f2f5; padding: 10px 12px; text-align: left; font-weight: 600; color: #333; border-bottom: 2px solid #ddd; }
  td { padding: 9px 12px; border-bottom: 1px solid #eee; }
  tr:last-child td { border-bottom: none; }
  .section-title { font-size: 16px; font-weight: 700; margin: 28px 0 12px; color: #1a1a2e; border-left: 4px solid #6366f1; padding-left: 12px; }
  .highlight { color: #6366f1; font-weight: 700; }
  .footer { text-align: center; padding: 20px; font-size: 11px; color: #999; }
  .totals td { font-weight: 700; background: #f8f9fc; }
`;

// ══════════════════════════════════════════════════
// INCORPORADOR REPORT
// ══════════════════════════════════════════════════
async function buildIncorporadorReport(supabase: any) {
  const { start, end } = getIncorpWeek();
  const startISO = start.toISOString();
  const endISO = end.toISOString();
  const startStr = fmtDate(start);
  const endStr = fmtDate(end);

  // 1. Team members (incorporador squad)
  const { data: teamProfiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .contains('squad', ['incorporador']);
  
  const { data: teamRoles } = await supabase
    .from('user_roles')
    .select('user_id, role')
    .in('user_id', (teamProfiles || []).map((p: any) => p.id));

  const roleMap = new Map<string, string>();
  for (const r of teamRoles || []) roleMap.set(r.user_id, r.role);

  const sdrs = (teamProfiles || []).filter((p: any) => roleMap.get(p.id) === 'sdr');
  const closers = (teamProfiles || []).filter((p: any) => roleMap.get(p.id) === 'closer');
  const sdrIds = sdrs.map((s: any) => s.id);
  const closerIds = closers.map((c: any) => c.id);

  // 2. Contratos pagos (Qui-Qua)
  const { data: contratosTx } = await supabase
    .from('hubla_transactions')
    .select('customer_email, hubla_id, source, product_name, installment_number, sale_status')
    .eq('product_name', 'A000 - Contrato')
    .in('sale_status', ['completed', 'refunded'])
    .in('source', ['hubla', 'manual', 'make', 'mcfpay', 'kiwify'])
    .gte('sale_date', startISO)
    .lte('sale_date', endISO);

  const validContratos = (contratosTx || []).filter((t: any) => {
    if (t.hubla_id?.startsWith('newsale-')) return false;
    if (t.source === 'make' && t.product_name?.toLowerCase() === 'contrato') return false;
    if (t.installment_number && t.installment_number > 1) return false;
    return true;
  });
  const emailSet = new Set(validContratos.map((t: any) => (t.customer_email || '').toLowerCase().trim()).filter(Boolean));
  const contratosPagos = emailSet.size;

  // 3. A010 sales
  const { data: a010Sales } = await supabase
    .from('hubla_transactions')
    .select('id, net_value')
    .eq('product_category', 'a010')
    .in('sale_status', ['completed', 'refunded'])
    .gte('sale_date', startISO)
    .lte('sale_date', endISO);
  const a010Count = (a010Sales || []).length;
  const a010Revenue = (a010Sales || []).reduce((s: number, t: any) => s + (t.net_value || 0), 0);

  // 4. R2 attendees for the week (via scheduled_at in window + encaixados)
  const { data: r2Attendees } = await supabase
    .from('meeting_slot_attendees')
    .select('id, status, r2_status_id, booked_by, attendee_name, meeting_slot:meeting_slots!inner(id, status, scheduled_at, meeting_type, closer_id)')
    .eq('meeting_slot.meeting_type', 'r2')
    .gte('meeting_slot.scheduled_at', startISO)
    .lte('meeting_slot.scheduled_at', endISO);

  // Also get encaixados for the week
  const weekStartStr = fmtDate(start); // Thu date
  const { data: encaixados } = await supabase
    .from('meeting_slot_attendees')
    .select('id, status, r2_status_id, booked_by, attendee_name, meeting_slot:meeting_slots!inner(id, status, scheduled_at, meeting_type, closer_id)')
    .eq('meeting_slot.meeting_type', 'r2')
    .eq('carrinho_week_start', weekStartStr);

  // Merge (dedupe by id)
  const allIds = new Set((r2Attendees || []).map((a: any) => a.id));
  const merged = [...(r2Attendees || [])];
  for (const enc of encaixados || []) {
    if (!allIds.has(enc.id)) { merged.push(enc); allIds.add(enc.id); }
  }

  // KPIs
  let r2Agendadas = 0, r2Realizadas = 0, aprovados = 0, pendentes = 0, emAnalise = 0, foraDoCarrinho = 0;
  for (const att of merged) {
    const slot = (att as any).meeting_slot;
    if (!slot) continue;
    if (slot.status !== 'cancelled' && slot.status !== 'rescheduled') r2Agendadas++;
    if (att.status === 'completed' || att.status === 'presente' || slot.status === 'completed') r2Realizadas++;
    if (att.r2_status_id === APROVADO_ID) aprovados++;
    else if (att.r2_status_id === PENDENTE_ID) pendentes++;
    else if (att.r2_status_id === EM_ANALISE_ID) emAnalise++;
    else if (att.r2_status_id && FORA_IDS.includes(att.r2_status_id)) foraDoCarrinho++;
  }

  // 5. SDR table: count R2 bookings and aprovados per SDR
  const sdrStats = new Map<string, { agendadas: number; aprovados: number }>();
  for (const s of sdrs) sdrStats.set(s.id, { agendadas: 0, aprovados: 0 });

  for (const att of merged) {
    const bookedBy = (att as any).booked_by;
    if (bookedBy && sdrStats.has(bookedBy)) {
      const slot = (att as any).meeting_slot;
      if (slot && slot.status !== 'cancelled' && slot.status !== 'rescheduled') {
        sdrStats.get(bookedBy)!.agendadas++;
      }
      if (att.r2_status_id === APROVADO_ID) {
        sdrStats.get(bookedBy)!.aprovados++;
      }
    }
  }

  // 6. Closer table: count R2 realizadas and aprovados per closer
  const closerStats = new Map<string, { realizadas: number; aprovados: number }>();
  for (const c of closers) closerStats.set(c.id, { realizadas: 0, aprovados: 0 });

  for (const att of merged) {
    const slot = (att as any).meeting_slot;
    if (!slot) continue;
    const closerId = slot.closer_id;
    if (closerId && closerStats.has(closerId)) {
      if (att.status === 'completed' || att.status === 'presente' || slot.status === 'completed') {
        closerStats.get(closerId)!.realizadas++;
      }
      if (att.r2_status_id === APROVADO_ID) {
        closerStats.get(closerId)!.aprovados++;
      }
    }
  }

  // Build HTML
  const sdrRows = sdrs.map((s: any) => {
    const stats = sdrStats.get(s.id)!;
    return `<tr><td>${s.full_name}</td><td style="text-align:center">${stats.agendadas}</td><td style="text-align:center">${stats.aprovados}</td></tr>`;
  }).join('');
  const sdrTotals = sdrs.reduce((acc, s: any) => {
    const st = sdrStats.get(s.id)!;
    return { agendadas: acc.agendadas + st.agendadas, aprovados: acc.aprovados + st.aprovados };
  }, { agendadas: 0, aprovados: 0 });

  const closerRows = closers.map((c: any) => {
    const stats = closerStats.get(c.id)!;
    return `<tr><td>${c.full_name}</td><td style="text-align:center">${stats.realizadas}</td><td style="text-align:center">${stats.aprovados}</td></tr>`;
  }).join('');
  const closerTotals = closers.reduce((acc, c: any) => {
    const st = closerStats.get(c.id)!;
    return { realizadas: acc.realizadas + st.realizadas, aprovados: acc.aprovados + st.aprovados };
  }, { realizadas: 0, aprovados: 0 });

  const periodLabel = `${startStr.split('-').reverse().join('/')} a ${endStr.split('-').reverse().join('/')}`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${STYLES}</style></head><body>
<div class="container">
  <div class="header">
    <h1>📊 Relatório Semanal — Incorporador</h1>
    <p>Período: ${periodLabel} (Carrinho R2)</p>
  </div>
  <div class="content">
    <div class="kpi-row">
      <div class="kpi"><div class="value">${contratosPagos}</div><div class="label">Contratos Pagos</div></div>
      <div class="kpi"><div class="value">${r2Agendadas}</div><div class="label">R2 Agendadas</div></div>
      <div class="kpi"><div class="value">${r2Realizadas}</div><div class="label">R2 Realizadas</div></div>
      <div class="kpi"><div class="value highlight">${aprovados}</div><div class="label">Aprovados</div></div>
    </div>
    <div class="kpi-row">
      <div class="kpi"><div class="value">${pendentes}</div><div class="label">Pendentes</div></div>
      <div class="kpi"><div class="value">${emAnalise}</div><div class="label">Em Análise</div></div>
      <div class="kpi"><div class="value">${foraDoCarrinho}</div><div class="label">Fora do Carrinho</div></div>
      <div class="kpi"><div class="value">${a010Count}</div><div class="label">Vendas A010</div></div>
    </div>

    <div class="section-title">Performance SDRs</div>
    <table>
      <tr><th>SDR</th><th style="text-align:center">R2 Agendadas</th><th style="text-align:center">Aprovados</th></tr>
      ${sdrRows}
      <tr class="totals"><td>TOTAL</td><td style="text-align:center">${sdrTotals.agendadas}</td><td style="text-align:center">${sdrTotals.aprovados}</td></tr>
    </table>

    <div class="section-title">Performance Closers</div>
    <table>
      <tr><th>Closer</th><th style="text-align:center">R2 Realizadas</th><th style="text-align:center">Aprovados</th></tr>
      ${closerRows}
      <tr class="totals"><td>TOTAL</td><td style="text-align:center">${closerTotals.realizadas}</td><td style="text-align:center">${closerTotals.aprovados}</td></tr>
    </table>

    <div class="section-title">Resumo Financeiro</div>
    <table>
      <tr><td>Vendas A010</td><td style="text-align:right">${a010Count} vendas</td><td style="text-align:right">${fmtBRL(a010Revenue)}</td></tr>
      <tr><td>Contratos Pagos</td><td style="text-align:right">${contratosPagos} contratos</td><td></td></tr>
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

  // 1. Cards sold in the period
  const { data: cards } = await supabase
    .from('consortium_cards')
    .select('id, data_contratacao, valor_credito, valor_comissao, vendedor_name, vendedor_id')
    .gte('data_contratacao', startStr)
    .lte('data_contratacao', endStr);

  const allCards = cards || [];
  const totalCards = allCards.length;
  const totalCredito = allCards.reduce((s: number, c: any) => s + (Number(c.valor_credito) || 0), 0);
  const totalComissao = allCards.reduce((s: number, c: any) => s + (Number(c.valor_comissao) || 0), 0);

  // 2. Sales by day
  const byDay = new Map<string, { count: number; credito: number }>();
  for (const c of allCards) {
    const day = c.data_contratacao;
    if (!byDay.has(day)) byDay.set(day, { count: 0, credito: 0 });
    const d = byDay.get(day)!;
    d.count++;
    d.credito += Number(c.valor_credito) || 0;
  }
  // Sort by date
  const sortedDays = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  // 3. Sales by vendedor
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
