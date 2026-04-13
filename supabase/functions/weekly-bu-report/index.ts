import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DIRECTOR_EMAIL = 'grimaldo.neto@minhacasafinanciada.com';

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

    // Calculate previous week range (Monday to Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    const lastSunday = new Date(now);
    lastSunday.setDate(now.getDate() - mondayOffset);
    lastSunday.setHours(23, 59, 59, 999);
    
    const lastMonday = new Date(lastSunday);
    lastMonday.setDate(lastSunday.getDate() - 6);
    lastMonday.setHours(0, 0, 0, 0);

    const startDate = lastMonday.toISOString();
    const endDate = lastSunday.toISOString();

    const formatDate = (d: Date) => d.toLocaleDateString('pt-BR');

    console.log(`[WEEKLY-BU-REPORT] Period: ${formatDate(lastMonday)} - ${formatDate(lastSunday)}`);

    // --- Incorporador: deals created / revenue from weekly metrics ---
    const { data: weeklyMetrics } = await supabase
      .from('weekly_metrics')
      .select('origin_name, leads_count, meetings_scheduled, deals_won, revenue')
      .gte('week_start', startDate.split('T')[0])
      .lte('week_start', endDate.split('T')[0]);

    // --- Consórcio: cards sold ---
    const { data: consortiumCards } = await supabase
      .from('consortium_cards')
      .select('valor_credito, status')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .eq('status', 'ativa');

    // --- Aggregate by BU ---
    const buData: Record<string, { leads: number; reunioes: number; vendas: number; receita: number }> = {
      'Incorporador': { leads: 0, reunioes: 0, vendas: 0, receita: 0 },
      'Consórcio': { leads: 0, reunioes: 0, vendas: 0, receita: 0 },
      'Crédito': { leads: 0, reunioes: 0, vendas: 0, receita: 0 },
    };

    if (weeklyMetrics) {
      for (const m of weeklyMetrics) {
        // Map origin names to BU - simplified mapping
        const bu = 'Incorporador';
        buData[bu].leads += m.leads_count || 0;
        buData[bu].reunioes += m.meetings_scheduled || 0;
        buData[bu].vendas += m.deals_won || 0;
        buData[bu].receita += m.revenue || 0;
      }
    }

    if (consortiumCards) {
      buData['Consórcio'].vendas += consortiumCards.length;
      buData['Consórcio'].receita += consortiumCards.reduce((sum, c) => sum + (c.valor_credito || 0), 0);
    }

    // --- Build HTML email ---
    const buRows = Object.entries(buData).map(([bu, data]) => `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #e9ecef;font-weight:600;color:#1a1a2e;">${bu}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #e9ecef;text-align:center;">${data.leads}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #e9ecef;text-align:center;">${data.reunioes}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #e9ecef;text-align:center;">${data.vendas}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #e9ecef;text-align:right;font-weight:600;color:#16a34a;">
          R$ ${data.receita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </td>
      </tr>
    `).join('');

    const totalReceita = Object.values(buData).reduce((s, d) => s + d.receita, 0);
    const totalVendas = Object.values(buData).reduce((s, d) => s + d.vendas, 0);
    const totalLeads = Object.values(buData).reduce((s, d) => s + d.leads, 0);
    const totalReunioes = Object.values(buData).reduce((s, d) => s + d.reunioes, 0);

    const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="700" cellpadding="0" cellspacing="0" style="max-width:700px;width:100%;">
          <tr>
            <td style="background-color:#1a1a2e;padding:24px 32px;border-radius:8px 8px 0 0;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">📊 Relatório Semanal MCF</h1>
              <p style="margin:8px 0 0;color:#a0aec0;font-size:14px;">
                Semana de ${formatDate(lastMonday)} a ${formatDate(lastSunday)}
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8f9fa;padding:32px;border-left:1px solid #e9ecef;border-right:1px solid #e9ecef;">
              <!-- Summary Cards -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="padding:8px;">
                    <div style="background:#fff;border:1px solid #e9ecef;border-radius:8px;padding:16px;text-align:center;">
                      <div style="font-size:24px;font-weight:700;color:#1a1a2e;">${totalLeads}</div>
                      <div style="font-size:12px;color:#6c757d;margin-top:4px;">Leads</div>
                    </div>
                  </td>
                  <td style="padding:8px;">
                    <div style="background:#fff;border:1px solid #e9ecef;border-radius:8px;padding:16px;text-align:center;">
                      <div style="font-size:24px;font-weight:700;color:#1a1a2e;">${totalReunioes}</div>
                      <div style="font-size:12px;color:#6c757d;margin-top:4px;">Reuniões</div>
                    </div>
                  </td>
                  <td style="padding:8px;">
                    <div style="background:#fff;border:1px solid #e9ecef;border-radius:8px;padding:16px;text-align:center;">
                      <div style="font-size:24px;font-weight:700;color:#16a34a;">${totalVendas}</div>
                      <div style="font-size:12px;color:#6c757d;margin-top:4px;">Vendas</div>
                    </div>
                  </td>
                  <td style="padding:8px;">
                    <div style="background:#fff;border:1px solid #e9ecef;border-radius:8px;padding:16px;text-align:center;">
                      <div style="font-size:24px;font-weight:700;color:#16a34a;">R$ ${(totalReceita / 1000).toFixed(0)}k</div>
                      <div style="font-size:12px;color:#6c757d;margin-top:4px;">Receita</div>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- BU Table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e9ecef;border-radius:8px;overflow:hidden;">
                <thead>
                  <tr style="background-color:#f1f3f5;">
                    <th style="padding:12px 16px;text-align:left;font-size:12px;color:#6c757d;text-transform:uppercase;">BU</th>
                    <th style="padding:12px 16px;text-align:center;font-size:12px;color:#6c757d;text-transform:uppercase;">Leads</th>
                    <th style="padding:12px 16px;text-align:center;font-size:12px;color:#6c757d;text-transform:uppercase;">Reuniões</th>
                    <th style="padding:12px 16px;text-align:center;font-size:12px;color:#6c757d;text-transform:uppercase;">Vendas</th>
                    <th style="padding:12px 16px;text-align:right;font-size:12px;color:#6c757d;text-transform:uppercase;">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  ${buRows}
                  <tr style="background-color:#f8f9fa;">
                    <td style="padding:12px 16px;font-weight:700;color:#1a1a2e;">Total</td>
                    <td style="padding:12px 16px;text-align:center;font-weight:700;">${totalLeads}</td>
                    <td style="padding:12px 16px;text-align:center;font-weight:700;">${totalReunioes}</td>
                    <td style="padding:12px 16px;text-align:center;font-weight:700;">${totalVendas}</td>
                    <td style="padding:12px 16px;text-align:right;font-weight:700;color:#16a34a;">
                      R$ ${totalReceita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
              
              <div style="text-align:center;margin-top:24px;">
                <a href="https://mcf-insight-hub.lovable.app" target="_blank" 
                   style="display:inline-block;background-color:#1a1a2e;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:500;">
                  Ver Dashboard Completo
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f1f3f5;padding:16px 32px;border-radius:0 0 8px 8px;border:1px solid #e9ecef;border-top:none;">
              <p style="margin:0;color:#adb5bd;font-size:12px;text-align:center;">
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

    // Send via brevo-send
    const { error: sendError } = await supabase.functions.invoke('brevo-send', {
      body: {
        to: DIRECTOR_EMAIL,
        name: 'Grimaldo Neto',
        subject: `📊 Relatório Semanal MCF — ${formatDate(lastMonday)} a ${formatDate(lastSunday)}`,
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
      JSON.stringify({ success: true, period: `${formatDate(lastMonday)} - ${formatDate(lastSunday)}` }),
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
