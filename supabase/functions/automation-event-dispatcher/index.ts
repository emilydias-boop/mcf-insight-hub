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
  attendee_id?: string;
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


// Nomes das variáveis {{nome}} na ordem da 1ª aparição, sem repetir.
// Mesma RE_VAR da fase A (src/lib/automationMetaTemplate.ts): não importar nada de src/.
function nomesNoTexto(texto: string | null | undefined): string[] {
  const nomes: string[] = [];
  for (const m of String(texto || '').matchAll(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g)) {
    if (!nomes.includes(m[1])) nomes.push(m[1]);
  }
  return nomes;
}

// A Meta recusa parâmetro vazio, com quebra de linha/tab ou com 4+ espaços seguidos.
function valorParam(v: string | null | undefined): string {
  const s = String(v ?? '').replace(/[\n\t]+/g, ' ').replace(/ {4,}/g, ' ').trim();
  return s || '—';
}

async function enviarMetaWa(
  supabase: any,
  body: Record<string, unknown>,
): Promise<{ success: boolean; messageId?: string; code: string; incerto: boolean; detalhe?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('meta-wa-send', { body });
    if (error) {
      let code = 'erro_invoke';
      let detalhe = error.message;
      try {
        const resp = (error as any)?.context?.response ?? (error as any)?.context;
        if (resp && typeof resp.text === 'function') {
          const txt = await resp.text();
          let j: any = null;
          try { j = JSON.parse(txt); } catch (_) { /* corpo não é JSON */ }
          if (j?.code) code = String(j.code);
          detalhe = `HTTP ${resp.status ?? '?'}${j?.campo ? ` campo=${j.campo}` : ''}${j?.esperado != null ? ` esperado=${j.esperado}` : ''}`;
        }
      } catch (_) { /* ignore */ }
      return { success: false, code, incerto: false, detalhe };
    }
    return {
      success: data?.success === true,
      messageId: data?.messageId || undefined,
      code: String(data?.code ?? ''),
      incerto: data?.incerto === true,
      detalhe: data?.erro_titulo || data?.motivo || undefined,
    };
  } catch (e: any) {
    return { success: false, code: 'erro_invoke', incerto: false, detalhe: e?.message };
  }
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
    const { event, registration_id, attendee_id, force = false } = body;

    if (!event) {
      return new Response(
        JSON.stringify({ success: false, error: 'event is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log('[event-dispatcher] event=', event, 'reg=', registration_id, 'attendee=', attendee_id, 'force=', force);

    // 1) Load flows
    const { data: flows, error: flowsErr } = await supabase
      .from('automation_flows')
      .select(`
        id, name, channel, subject, body_template, template_id, is_active, trigger_type, trigger_event,
        template:automation_templates(id, name, approval_status, twilio_template_sid, content, buttons_config, meta_template_name, meta_language)
      `)
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
    let attendeeRow: any = null;

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
    } else if (event === 'attendee_contract_paid') {
      if (!attendee_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'attendee_id required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      const { data: att, error: attErr } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id, attendee_name, attendee_phone, is_partner, deal_id,
          boas_vindas_r2_whatsapp_enviado_em,
          deal:crm_deals!meeting_slot_attendees_deal_id_fkey(
            id,
            contact:crm_contacts(name, phone, email)
          )
        `)
        .eq('id', attendee_id)
        .maybeSingle();
      if (attErr) throw attErr;
      if (!att) {
        return new Response(
          JSON.stringify({ success: false, error: 'attendee not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      if (att.is_partner) {
        return new Response(
          JSON.stringify({ success: true, dispatched: 0, message: 'partner attendee — skipped' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      attendeeRow = att;
      const contact: any = (att as any).deal?.contact ?? null;
      const rawName = (att.attendee_name || contact?.name || 'Cliente').trim();
      const firstName = rawName.split(/\s+/)[0] || 'Cliente';
      ctx = {
        nome: firstName,
        email: contact?.email || null,
        telefone: att.attendee_phone || contact?.phone || null,
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
        const already = !force && (
          (event === 'attendee_contract_paid' && attendeeRow?.boas_vindas_r2_whatsapp_enviado_em) ||
          (event !== 'attendee_contract_paid' && regRow?.boas_vindas_whatsapp_enviado_em)
        );
        if (already) {
          results.push({ flow: flow.name, channel: 'whatsapp', skipped: 'already_sent' });
        } else {
          try {
            const tpl: any = (flow as any).template ?? null;
            if (!tpl || !tpl.meta_template_name) {
              // Sem template da Meta não sai nada (a Twilio e o texto livre não são mais usados).
              results.push({ flow: flow.name, channel: 'whatsapp', skipped: 'sem template da Meta', template: tpl?.name ?? null });
            } else {
              // Variáveis disponíveis no evento (as mesmas que render() já usa no texto do e-mail).
              const vars: Record<string, string> = {
                nome: ctx.nome || '',
                email: ctx.email || '',
                telefone: ctx.telefone || '',
                grupo: ctx.grupo || '',
                cota: ctx.cota || '',
              };
              const bodyParams = nomesNoTexto(tpl.content).map((n) => valorParam(vars[n] ?? vars[n.toLowerCase()]));
              const btn0: any = Array.isArray(tpl.buttons_config) ? tpl.buttons_config[0] : null;
              const varBotao = btn0 && String(btn0.type || '').toLowerCase() === 'url'
                ? nomesNoTexto(String(btn0.url || ''))[0]
                : undefined;
              const valorBotao = varBotao ? String(vars[varBotao] ?? vars[varBotao.toLowerCase()] ?? '').trim() : '';
              if (varBotao && !valorBotao) {
                results.push({ flow: flow.name, channel: 'whatsapp', skipped: `variável do botão sem valor no evento: ${varBotao}`, template: tpl.name });
              } else {
                const r = await enviarMetaWa(supabase, {
                  to: ctx.telefone,
                  template_name: tpl.meta_template_name,
                  language: tpl.meta_language || 'pt_BR',
                  body_params: bodyParams,
                  button_params: varBotao ? [valorBotao] : [],
                  origem: 'automacao',
                  // attendee_id (contrato pago) ou registration_id (carta de consórcio): não reenvia o mesmo evento
                  ref_id: attendeeRow?.id ?? regRow?.id ?? null,
                  deal_id: regRow?.deal_id ?? attendeeRow?.deal_id ?? null,
                  nome: ctx.nome || undefined,
                });
                if (r.success) {
                  if (regRow) {
                    await supabase
                      .from('consorcio_pending_registrations')
                      .update({ boas_vindas_whatsapp_enviado_em: new Date().toISOString() })
                      .eq('id', regRow.id);
                  }
                  if (attendeeRow) {
                    await supabase
                      .from('meeting_slot_attendees')
                      .update({ boas_vindas_r2_whatsapp_enviado_em: new Date().toISOString() })
                      .eq('id', attendeeRow.id);
                  }
                  results.push({ flow: flow.name, channel: 'whatsapp', sent: true, messageId: r.messageId });
                } else if (r.code === 'duplicado') {
                  // Já existe envio deste evento na Meta: marca para o dispatcher não tentar de novo.
                  if (regRow) await supabase.from('consorcio_pending_registrations').update({ boas_vindas_whatsapp_enviado_em: new Date().toISOString() }).eq('id', regRow.id);
                  if (attendeeRow) await supabase.from('meeting_slot_attendees').update({ boas_vindas_r2_whatsapp_enviado_em: new Date().toISOString() }).eq('id', attendeeRow.id);
                  results.push({ flow: flow.name, channel: 'whatsapp', skipped: 'duplicado' });
                } else {
                  console.error('[event-dispatcher] whatsapp meta error', r.code, r.detalhe || '');
                  results.push({ flow: flow.name, channel: 'whatsapp', error: r.code, incerto: r.incerto, detalhe: r.detalhe });
                }
              }
            }
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