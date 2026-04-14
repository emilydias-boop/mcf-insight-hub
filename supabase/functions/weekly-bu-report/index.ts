import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DIRECTOR_EMAIL = 'grimaldo.neto@minhacasafinanciada.com';

function getLastCompletedWeek() {
  // Custom week: Saturday to Friday
  const now = new Date();
  const day = now.getDay(); // 0=Sun ... 6=Sat
  // Days since last Saturday
  const daysSinceSat = day === 6 ? 0 : day + 1;
  // Last Friday = most recent Friday
  const lastFriday = new Date(now);
  lastFriday.setDate(now.getDate() - (daysSinceSat === 0 ? 1 : daysSinceSat));
  lastFriday.setHours(23, 59, 59, 999);

  const lastSaturday = new Date(lastFriday);
  lastSaturday.setDate(lastFriday.getDate() - 6);
  lastSaturday.setHours(0, 0, 0, 0);

  return { start: lastSaturday, end: lastFriday };
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('pt-BR');
}
function isoDate(d: Date) {
  return d.toISOString().split('T')[0];
}
function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log('[WEEKLY-BU-REPORT] Starting weekly report generation...');

    const { start, end } = getLastCompletedWeek();
    const startStr = isoDate(start);
    const endStr = isoDate(end);

    console.log(`[WEEKLY-BU-REPORT] Period: ${fmtDate(start)} - ${fmtDate(end)} (${startStr} to ${endStr})`);

    // 1. Fetch weekly_metrics for the period (sat-fri)
    const { data: weeklyMetrics, error: wmErr } = await supabase
      .from('weekly_metrics')
      .select('start_date, end_date, a010_sales, a010_revenue, ob_construir_sales, ob_construir_revenue, ob_vitalicio_sales, ob_vitalicio_revenue, ob_evento_sales, ob_evento_revenue, contract_sales, contract_revenue, clint_revenue, incorporador_50k, faturamento_total, total_revenue, ads_cost, team_cost, office_cost, total_cost, operating_cost, real_cost, operating_profit, roi, roas, cpl, week_label')
      .gte('start_date', startStr)
      .lte('start_date', endStr)
      .limit(1);

    if (wmErr) console.error('[WEEKLY-BU-REPORT] weekly_metrics error:', wmErr.message);

    const wm = weeklyMetrics?.[0] || null;

    // 2. Consórcio: cards sold in period
    const { data: consortiumCards, error: ccErr } = await supabase
      .from('consortium_cards')
      .select('valor_credito, status')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .eq('status', 'ativa');

    if (ccErr) console.error('[WEEKLY-BU-REPORT] consortium_cards error:', ccErr.message);

    const consorcioVendas = consortiumCards?.length || 0;
    const consorcioCredito = consortiumCards?.reduce((s, c) => s + (c.valor_credito || 0), 0) || 0;

    // 3. Crédito: transactions in period
    const { data: creditTx, error: ctErr } = await supabase
      .from('hubla_transactions')
      .select('net_value, product_category')
      .gte('sale_date', startStr)
      .lte('sale_date', endStr)
      .eq('product_category', 'credito');

    if (ctErr) console.error('[WEEKLY-BU-REPORT] hubla_transactions error:', ctErr.message);

    const creditoVendas = creditTx?.length || 0;
    const creditoReceita = creditTx?.reduce((s, t) => s + (t.net_value || 0), 0) || 0;

    // --- Build metrics ---
    const incorp = {
      vendasA010: wm?.a010_sales || 0,
      receitaA010: wm?.a010_revenue || 0,
      contratos: wm?.contract_sales || 0,
      receitaContratos: wm?.contract_revenue || 0,
      obConstruir: wm?.ob_construir_sales || 0,
      obVitalicio: wm?.ob_vitalicio_sales || 0,
      obEvento: wm?.ob_evento_sales || 0,
      incorporador50k: wm?.incorporador_50k || 0,
      clintRevenue: wm?.clint_revenue || 0,
      faturamentoTotal: wm?.faturamento_total || wm?.total_revenue || 0,
    };

    const custos = {
      ads: wm?.ads_cost || 0,
      equipe: wm?.team_cost || 0,
      escritorio: wm?.office_cost || 0,
      total: wm?.total_cost || wm?.real_cost || 0,
    };

    const kpis = {
      lucroOperacional: wm?.operating_profit || 0,
      roi: wm?.roi || 0,
      roas: wm?.roas || 0,
      cpl: wm?.cpl || 0,
    };

    const receitaTotal = incorp.faturamentoTotal + consorcioCredito + creditoReceita;

    // --- Build HTML ---
    const htmlContent = buildEmailHTML({
      periodLabel: `${fmtDate(start)} a ${fmtDate(end)}`,
      weekLabel: wm?.week_label || `${fmtDate(start)} - ${fmtDate(end)}`,
      incorp,
      consorcioVendas,
      consorcioCredito,
      creditoVendas,
      creditoReceita,
      custos,
      kpis,
      receitaTotal,
    });

    // Send via brevo-send
    const { error: sendError } = await supabase.functions.invoke('brevo-send', {
      body: {
        to: DIRECTOR_EMAIL,
        name: 'Grimaldo Neto',
        subject: `📊 Relatório Semanal MCF — ${fmtDate(start)} a ${fmtDate(end)}`,
        htmlContent,
        tags: ['relatorio_semanal', 'bu_performance'],
      },
    });

    if (sendError) {
      console.error('[WEEKLY-BU-REPORT] Error sending email:', sendError);
      throw sendError;
    }

    console.log('[WEEKLY-BU-REPORT] Report sent successfully');

    return new Response(
      JSON.stringify({ success: true, period: `${fmtDate(start)} - ${fmtDate(end)}`, hasData: !!wm }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[WEEKLY-BU-REPORT] Error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// --- HTML builder ---
interface ReportData {
  periodLabel: string;
  weekLabel: string;
  incorp: {
    vendasA010: number;
    receitaA010: number;
    contratos: number;
    receitaContratos: number;
    obConstruir: number;
    obVitalicio: number;
    obEvento: number;
    incorporador50k: number;
    clintRevenue: number;
    faturamentoTotal: number;
  };
  consorcioVendas: number;
  consorcioCredito: number;
  creditoVendas: number;
  creditoReceita: number;
  custos: { ads: number; equipe: number; escritorio: number; total: number };
  kpis: { lucroOperacional: number; roi: number; roas: number; cpl: number };
  receitaTotal: number;
}

function buildEmailHTML(d: ReportData): string {
  const kpiCard = (label: string, value: string, color = '#1a1a2e') => `
    <td style="padding:6px;">
      <div style="background:#fff;border:1px solid #e9ecef;border-radius:8px;padding:14px 10px;text-align:center;">
        <div style="font-size:20px;font-weight:700;color:${color};">${value}</div>
        <div style="font-size:11px;color:#6c757d;margin-top:4px;">${label}</div>
      </div>
    </td>`;

  const metricRow = (label: string, vendas: number | string, receita: string) => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;color:#333;">${label}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;text-align:center;font-weight:600;">${vendas}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;text-align:right;color:#16a34a;font-weight:600;">R$ ${receita}</td>
    </tr>`;

  const custoRow = (label: string, valor: number) => `
    <tr>
      <td style="padding:8px 14px;border-bottom:1px solid #f0f0f0;color:#333;">${label}</td>
      <td style="padding:8px 14px;border-bottom:1px solid #f0f0f0;text-align:right;color:#dc2626;font-weight:600;">R$ ${fmtBRL(valor)}</td>
    </tr>`;

  const lucroColor = d.kpis.lucroOperacional >= 0 ? '#16a34a' : '#dc2626';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table width="680" cellpadding="0" cellspacing="0" style="max-width:680px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:24px 28px;border-radius:10px 10px 0 0;">
              <h1 style="margin:0;color:#fff;font-size:20px;font-weight:600;">📊 Relatório Semanal MCF</h1>
              <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">Semana de ${d.periodLabel}</p>
            </td>
          </tr>

          <tr>
            <td style="background:#fff;padding:28px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">

              <!-- KPI Cards -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  ${kpiCard('Receita Total', `R$ ${(d.receitaTotal / 1000).toFixed(1)}k`, '#16a34a')}
                  ${kpiCard('Lucro Operac.', `R$ ${fmtBRL(d.kpis.lucroOperacional)}`, lucroColor)}
                  ${kpiCard('ROI', `${d.kpis.roi.toFixed(1)}%`)}
                  ${kpiCard('ROAS', `${d.kpis.roas.toFixed(2)}x`)}
                </tr>
              </table>

              <!-- Incorporador -->
              <h2 style="font-size:15px;color:#1a1a2e;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid #1a1a2e;">🏗️ Incorporador</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;font-size:13px;">
                <thead>
                  <tr style="background:#f8f9fa;">
                    <th style="padding:10px 14px;text-align:left;font-size:11px;color:#6c757d;text-transform:uppercase;">Produto</th>
                    <th style="padding:10px 14px;text-align:center;font-size:11px;color:#6c757d;text-transform:uppercase;">Vendas</th>
                    <th style="padding:10px 14px;text-align:right;font-size:11px;color:#6c757d;text-transform:uppercase;">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  ${metricRow('A010', d.incorp.vendasA010, fmtBRL(d.incorp.receitaA010))}
                  ${metricRow('Contratos', d.incorp.contratos, fmtBRL(d.incorp.receitaContratos))}
                  ${metricRow('OB Construir', d.incorp.obConstruir, '—')}
                  ${metricRow('OB Vitalício', d.incorp.obVitalicio, '—')}
                  ${metricRow('OB Evento', d.incorp.obEvento, '—')}
                  ${metricRow('Incorporador 50K', d.incorp.incorporador50k, '—')}
                  ${metricRow('Clint (Ultrameta)', '—', fmtBRL(d.incorp.clintRevenue))}
                  <tr style="background:#f0fdf4;">
                    <td style="padding:10px 14px;font-weight:700;color:#1a1a2e;">Total Incorporador</td>
                    <td style="padding:10px 14px;text-align:center;font-weight:700;">${d.incorp.vendasA010 + d.incorp.contratos}</td>
                    <td style="padding:10px 14px;text-align:right;font-weight:700;color:#16a34a;">R$ ${fmtBRL(d.incorp.faturamentoTotal)}</td>
                  </tr>
                </tbody>
              </table>

              <!-- Consórcio -->
              <h2 style="font-size:15px;color:#1a1a2e;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid #f59e0b;">🤝 Consórcio</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;font-size:13px;">
                <tbody>
                  ${metricRow('Cartas Vendidas', d.consorcioVendas, fmtBRL(d.consorcioCredito))}
                </tbody>
              </table>

              <!-- Crédito -->
              <h2 style="font-size:15px;color:#1a1a2e;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid #3b82f6;">💳 Crédito</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;font-size:13px;">
                <tbody>
                  ${metricRow('Vendas Crédito', d.creditoVendas, fmtBRL(d.creditoReceita))}
                </tbody>
              </table>

              <!-- Custos -->
              <h2 style="font-size:15px;color:#1a1a2e;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid #dc2626;">💰 Custos</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;font-size:13px;">
                <tbody>
                  ${custoRow('Anúncios (Ads)', d.custos.ads)}
                  ${custoRow('Equipe', d.custos.equipe)}
                  ${custoRow('Escritório', d.custos.escritorio)}
                  <tr style="background:#fef2f2;">
                    <td style="padding:10px 14px;font-weight:700;color:#1a1a2e;">Total Custos</td>
                    <td style="padding:10px 14px;text-align:right;font-weight:700;color:#dc2626;">R$ ${fmtBRL(d.custos.total)}</td>
                  </tr>
                </tbody>
              </table>

              <!-- CPL -->
              ${d.kpis.cpl > 0 ? `
              <div style="background:#f8f9fa;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:20px;text-align:center;">
                <span style="font-size:12px;color:#6c757d;">CPL (Custo por Lead):</span>
                <span style="font-size:16px;font-weight:700;color:#1a1a2e;margin-left:8px;">R$ ${fmtBRL(d.kpis.cpl)}</span>
              </div>` : ''}

              <!-- CTA -->
              <div style="text-align:center;margin-top:24px;">
                <a href="https://mcf-insight-hub.lovable.app" target="_blank"
                   style="display:inline-block;background:linear-gradient(135deg,#1a1a2e,#16213e);color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:500;">
                  Ver Dashboard Completo →
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f1f3f5;padding:14px 28px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb;border-top:none;">
              <p style="margin:0;color:#adb5bd;font-size:11px;text-align:center;">
                Relatório gerado automaticamente por MCF Gestão em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
