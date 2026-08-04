import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BODY = `Olá, {{1}}! Passando pra lembrar da sua reunião com a MCF Capital.
Data e horário: {{2}}
Especialista: {{3}}
Link: {{4}}

Contamos com sua presença!
— MCF Capital`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const sid = Deno.env.get('TWILIO_ACCOUNT_SID')!;
    const token = Deno.env.get('TWILIO_AUTH_TOKEN')!;
    const auth = 'Basic ' + btoa(`${sid}:${token}`);

    const createRes = await fetch('https://content.twilio.com/v1/Content', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        friendly_name: 'lembrete_reuniao_r1_mcf_capital',
        language: 'pt_BR',
        variables: { '1': 'Nome', '2': '01/01/2026 às 10:00', '3': 'Especialista', '4': 'https://meet.google.com/abc' },
        types: { 'twilio/text': { body: BODY } },
      }),
    });
    const created = await createRes.json();
    if (!createRes.ok) {
      return new Response(JSON.stringify({ step: 'create', status: createRes.status, created }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const contentSid = created.sid;

    const apprRes = await fetch(`https://content.twilio.com/v1/Content/${contentSid}/ApprovalRequests/whatsapp`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'lembrete_reuniao_r1_mcf_capital', category: 'UTILITY' }),
    });
    const approval = await apprRes.json();

    return new Response(JSON.stringify({ contentSid, approvalStatus: apprRes.status, approval }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
