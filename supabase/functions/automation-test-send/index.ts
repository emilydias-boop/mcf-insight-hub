// Test-send a WhatsApp template end-to-end (admin-only).
// Builds the same variable map as automation-processor and dispatches via Twilio.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestSendBody {
  templateId: string;
  phone: string;          // phone do destinatário (vai abrir o WhatsApp)
  name?: string;          // nome do contato (variável {{nome}})
  ownerPhone?: string;    // telefone do dono p/ wa_agendar_token (default = phone)
  ownerName?: string;     // nome do dono p/ {{dono_nome}}
  role?: 'sdr' | 'closer'; // muda mensagem padrão do botão
  variableOverrides?: Record<string, string>; // overrides explícitos por nome de variável
}

function buildToken(phone: string, text: string): string {
  const cleaned = phone.replace(/\D/g, '');
  const payload = JSON.stringify({ p: cleaned, t: text });
  return btoa(payload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function replaceVariables(template: string, vars: Record<string, string>): string {
  return (template || '').replace(/\{\{\s*([\w_]+)\s*\}\}/g, (_, k) => vars[k] ?? '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Validate caller + admin role
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claimsData.claims.sub as string;

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await admin.rpc('has_role', { _user_id: userId, _role: 'admin' });
    const { data: isManager } = await admin.rpc('has_role', { _user_id: userId, _role: 'manager' });
    if (!isAdmin && !isManager) {
      return new Response(JSON.stringify({ error: 'Forbidden — admin/manager only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json() as TestSendBody;
    if (!body.templateId || !body.phone) {
      return new Response(JSON.stringify({ error: 'templateId and phone are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load template
    const { data: template, error: tplErr } = await admin
      .from('automation_templates')
      .select('id, name, channel, content, variables, twilio_template_sid, approval_status, buttons_config')
      .eq('id', body.templateId)
      .maybeSingle();

    if (tplErr || !template) {
      return new Response(JSON.stringify({ error: 'Template not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (template.channel !== 'whatsapp') {
      return new Response(JSON.stringify({ error: 'Only WhatsApp templates supported here' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!template.twilio_template_sid) {
      return new Response(JSON.stringify({ error: 'Template não tem twilio_template_sid — crie no Twilio primeiro' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build variables (same shape as automation-processor)
    const ownerPhone = (body.ownerPhone || body.phone).replace(/\D/g, '');
    const ownerName = body.ownerName || 'Equipe MCF';
    const contactName = body.name || 'Cliente Teste';
    const msgPorPapel = body.role === 'closer'
      ? 'Olá, quero confirmar minha reunião'
      : 'Olá, quero agendar minha reunião';

    const variables: Record<string, string> = {
      nome: contactName,
      email: '',
      telefone: body.phone,
      sdr: ownerName,
      dono_nome: ownerName,
      dono_telefone: ownerPhone,
      dono_link_wa: ownerPhone ? `https://wa.me/${ownerPhone}` : '',
      dono_link_wa_agendar: ownerPhone
        ? `https://wa.me/${ownerPhone}?text=${encodeURIComponent(msgPorPapel)}`
        : '',
      wa_agendar_text: encodeURIComponent(msgPorPapel),
      wa_agendar_token: ownerPhone ? buildToken(ownerPhone, msgPorPapel) : '',
      data: new Date().toLocaleDateString('pt-BR'),
      link: '',
    };

    // Aplica overrides explícitos do dialog (têm prioridade sobre os derivados)
    if (body.variableOverrides && typeof body.variableOverrides === 'object') {
      for (const [k, v] of Object.entries(body.variableOverrides)) {
        if (typeof v === 'string') variables[k] = v;
      }
    }

    const templateVarNames: string[] = Array.isArray(template.variables) ? template.variables : [];

    // Validação: rejeita se alguma variável obrigatória do template ficar vazia.
    const missing: string[] = [];
    templateVarNames.forEach((name) => {
      const v = variables[name];
      if (!v || typeof v !== 'string' || v.trim().length === 0) missing.push(name);
    });
    if (missing.length > 0) {
      return new Response(JSON.stringify({
        success: false,
        error: `Variáveis obrigatórias vazias: ${missing.join(', ')}`,
        missingVariables: missing,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const contentVariables: Record<string, string> = {};
    templateVarNames.forEach((name, idx) => {
      contentVariables[String(idx + 1)] = variables[name];
    });

    const renderedContent = replaceVariables(template.content || '', variables);

    // Send via Twilio
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromNumber = Deno.env.get('TWILIO_WHATSAPP_FROM');
    if (!accountSid || !authToken || !fromNumber) {
      return new Response(JSON.stringify({ error: 'Twilio credentials not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let normalizedTo = body.phone.replace(/\D/g, '');
    if (!normalizedTo.startsWith('55')) normalizedTo = '55' + normalizedTo;
    const toWhatsApp = 'whatsapp:+' + normalizedTo;
    const fromWhatsApp = fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`;

    const formData = new URLSearchParams();
    formData.append('From', fromWhatsApp);
    formData.append('To', toWhatsApp);
    formData.append('ContentSid', template.twilio_template_sid);
    formData.append('ContentVariables', JSON.stringify(contentVariables));
    formData.append('StatusCallback', `${supabaseUrl}/functions/v1/twilio-status-webhook`);

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = btoa(`${accountSid}:${authToken}`);
    const twResp = await fetch(twilioUrl, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });
    const twResult = await twResp.json();

    // Log into automation_logs (best-effort)
    try {
      await admin.from('automation_logs').insert({
        template_id: template.id,
        channel: 'whatsapp',
        recipient: toWhatsApp,
        status: twResp.ok ? 'sent' : 'failed',
        external_id: twResult.sid ?? null,
        error_message: twResp.ok ? null : (twResult.message || 'Twilio error'),
        metadata: { test_send: true, by: userId, content_variables: contentVariables },
      });
    } catch (_e) { /* table may not exist or have different schema; ignore */ }

    if (!twResp.ok) {
      return new Response(JSON.stringify({
        success: false,
        error: twResult.message || 'Twilio error',
        code: twResult.code,
        details: twResult,
        contentVariables,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      success: true,
      messageSid: twResult.sid,
      status: twResult.status,
      to: toWhatsApp,
      contentVariables,
      renderedContent,
      templateName: template.name,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e: any) {
    console.error('[automation-test-send] error:', e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});