// Automation Event Dispatcher — envia mensagens (Email/WhatsApp) a partir de
// fluxos configurados em automation_flows com trigger_type='system_event'.
//
// Chamada esperada:
//   POST { event: 'consorcio_carta_cadastrada', registration_id: uuid, force?: boolean }
//
// Comportamento:
//   - Para cada flow ativo (trigger_type=system_event, trigger_event=event),
//     resolve placeholders ({{nome}}, {{email}}, {{telefone}}) a partir do
//     registro pendente e envia via canal do flow (email/whatsapp/both).
//   - Idempotência via consorcio_pending_registrations.boas_vindas_*_enviado_em
//     (ignorada se force=true).
//   - Não bloqueia: erros por canal são apenas logados.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DispatchRequest {
  event: string;
  registration_id?: string;
  force?: boolean;
}

interface Ctx {
  nome: string;
  email: string | null;
  telefone: string | null;
  grupo?: string;
  cota?: string;
}

function render(tpl: string | null | undefined, ctx: Ctx): string {
  if (!tpl) return '';
  return tpl
    .replaceAll('{{nome}}', ctx.nome || '')
    .replaceAll('{{email}}', ctx.email || '')
    .replaceAll('{{telefone}}', ctx.telefone || '')
    .replaceAll('{{grupo}}', ctx.grupo || '')
    .replaceAll('{{cota}}', ctx.cota || '');
}

function textToHtml(text: string): string {
  const safe = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#333;white-space:pre-wrap;">${safe}</div>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body: DispatchRequest = await req.json();
    const { event, registration_id, force = false } = body;

    if (!event) {
      return new Response(
        JSON.stringify({ success: false, error: 'event is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log('[event-dispatcher] event=', event, 'reg=', registration_id, 'force=', force);

    // 1) Load flows
    const { data: flows, error: flowsErr } = await supabase
      .from('automation_flows')
      .select('id, name, channel, subject, body_template, is_active, trigger_type, trigger_event')
      .eq('trigger_type', 'system_event')
      .eq('trigger_event', event)
      .eq('is_active', true);

    if (flowsErr) throw flowsErr;
    if (!flows || flows.length === 0) {
      return new Response(
        JSON.stringify({ success: true, dispatched: 0, message: 'no active flows for event' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 2) Build context for consorcio_carta_cadastrada
    let ctx: Ctx = { nome: 'Cliente', email: null, telefone: null };
    let regRow: any = null;

    if (event === 'consorcio_carta_cadastrada') {
      if (!registration_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'registration_id required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      const { data: reg, error: regErr } = await supabase
        .from('consorcio_pending_registrations')
        .select('id, tipo_pessoa, nome_completo, razao_social, email, email_comercial, telefone, telefone_comercial, deal_id, boas_vindas_email_enviado_em, boas_vindas_whatsapp_enviado_em')
        .eq('id', registration_id)
        .maybeSingle();
      if (regErr) throw regErr;
      if (!reg) {
        return new Response(
          JSON.stringify({ success: false, error: 'registration not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      regRow = reg;
      ctx = {
        nome: (reg.tipo_pessoa === 'pj' ? reg.razao_social : reg.nome_completo) || 'Cliente',
        email: (reg.tipo_pessoa === 'pj' ? reg.email_comercial : reg.email) || null,
        telefone: (reg.tipo_pessoa === 'pj' ? reg.telefone_comercial : reg.telefone) || reg.telefone || null,
      };
    }

    // 3) Dispatch each flow
    const results: any[] = [];
    for (const flow of flows) {
      const channel = (flow.channel || 'email') as 'email' | 'whatsapp' | 'both';
      const subject = render(flow.subject, ctx) || 'Notificação';
      const bodyText = render(flow.body_template, ctx);

      const wantEmail = channel === 'email' || channel === 'both';
      const wantWhats = channel === 'whatsapp' || channel === 'both';

      // EMAIL
      if (wantEmail && ctx.email) {
        const already = regRow?.boas_vindas_email_enviado_em && !force;
        if (already) {
          results.push({ flow: flow.name, channel: 'email', skipped: 'already_sent' });
        } else {
          try {
            const { error: mailErr } = await supabase.functions.invoke('brevo-send', {
              body: {
                to: ctx.email,
                name: ctx.nome,
                subject,
                htmlContent: textToHtml(bodyText),
                tags: ['automation', event],
                dealId: regRow?.deal_id,
                cc: [
                  { email: 'emily.dias@minhacasafinanciada.com', name: 'Emily Dias' },
                  { email: 'antony.nicolas@minhacasafinanciada.com', name: 'Antony Nicolas' },
                ],
              },
            });
            if (mailErr) throw mailErr;
            if (regRow) {
              await supabase
                .from('consorcio_pending_registrations')
                .update({ boas_vindas_email_enviado_em: new Date().toISOString() })
                .eq('id', regRow.id);
            }
            results.push({ flow: flow.name, channel: 'email', sent: true });
          } catch (e: any) {
            console.error('[event-dispatcher] email error', e?.message || e);
            results.push({ flow: flow.name, channel: 'email', error: e?.message || String(e) });
          }
        }
      } else if (wantEmail) {
        results.push({ flow: flow.name, channel: 'email', skipped: 'no_email' });
      }

      // WHATSAPP
      if (wantWhats && ctx.telefone) {
        const already = regRow?.boas_vindas_whatsapp_enviado_em && !force;
        if (already) {
          results.push({ flow: flow.name, channel: 'whatsapp', skipped: 'already_sent' });
        } else {
          try {
            const { error: waErr } = await supabase.functions.invoke('twilio-whatsapp-send', {
              body: {
                to: ctx.telefone,
                body: bodyText,
                dealId: regRow?.deal_id,
              },
            });
            if (waErr) throw waErr;
            if (regRow) {
              await supabase
                .from('consorcio_pending_registrations')
                .update({ boas_vindas_whatsapp_enviado_em: new Date().toISOString() })
                .eq('id', regRow.id);
            }
            results.push({ flow: flow.name, channel: 'whatsapp', sent: true });
          } catch (e: any) {
            console.error('[event-dispatcher] whatsapp error', e?.message || e);
            results.push({ flow: flow.name, channel: 'whatsapp', error: e?.message || String(e) });
          }
        }
      } else if (wantWhats) {
        results.push({ flow: flow.name, channel: 'whatsapp', skipped: 'no_phone' });
      }
    }

    return new Response(
      JSON.stringify({ success: true, event, dispatched: results.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('[event-dispatcher] error', error?.message || error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});