import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getSaudacao(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function formatDateBR(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { boletoId, mode } = await req.json();
    if (!boletoId) throw new Error('boletoId is required');
    if (!mode || !['twilio', 'wame'].includes(mode)) throw new Error('mode must be "twilio" or "wame"');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch boleto + card data
    const { data: boleto, error } = await supabase
      .from('consorcio_boletos')
      .select('*, consortium_cards(nome_completo, razao_social, telefone, telefone_comercial, email, email_comercial)')
      .eq('id', boletoId)
      .single();

    if (error || !boleto) throw new Error('Boleto não encontrado');
    
    const card = (boleto as any).consortium_cards;
    if (!card) throw new Error('Carta não vinculada ao boleto');

    // Try multiple phone sources
    let telefone = card.telefone || card.telefone_comercial;
    
    // Fallback: search crm_contacts by email or name
    if (!telefone) {
      const email = card.email || card.email_comercial;
      if (email) {
        const { data: contact } = await supabase
          .from('crm_contacts')
          .select('phone')
          .eq('email', email.toLowerCase())
          .not('phone', 'is', null)
          .limit(1)
          .single();
        if (contact?.phone) telefone = contact.phone;
      }
    }
    
    if (!telefone) {
      const searchName = card.nome_completo || card.razao_social;
      if (searchName) {
        const { data: contact } = await supabase
          .from('crm_contacts')
          .select('phone')
          .ilike('name', searchName)
          .not('phone', 'is', null)
          .limit(1)
          .single();
        if (contact?.phone) telefone = contact.phone;
      }
    }

    if (!telefone) throw new Error('Cliente sem telefone cadastrado. Cadastre o telefone na carta ou no CRM.');

    const nome = card.nome_completo || card.razao_social || boleto.nome_extraido || 'Cliente';
    const primeiroNome = nome.split(' ')[0];
    const saudacao = getSaudacao();
    
    const vencimento = boleto.vencimento_extraido ? formatDateBR(boleto.vencimento_extraido) : 'N/A';
    const mesRef = boleto.vencimento_extraido ? MESES[parseInt(boleto.vencimento_extraido.split('-')[1]) - 1] : '';
    const linhaDigitavel = boleto.linha_digitavel || '';

    const mensagem = `${saudacao} ${primeiroNome}, tudo bem?\n\nSegue o seu boleto referente à parcela${boleto.installment_id ? '' : ''} do mês de ${mesRef}, com vencimento em ${vencimento}.\n\nLinha digitável: ${linhaDigitavel}\n\nQualquer dúvida estou à disposição! 😊`;

    if (mode === 'wame') {
      // Return wa.me URL
      let normalizedPhone = telefone.replace(/\D/g, '');
      if (!normalizedPhone.startsWith('55')) normalizedPhone = '55' + normalizedPhone;
      
      const wameUrl = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(mensagem)}`;

      // Mark as sent
      await supabase
        .from('consorcio_boletos')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', boletoId);

      return new Response(JSON.stringify({ success: true, wameUrl, mensagem }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Twilio mode
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromNumber = Deno.env.get('TWILIO_WHATSAPP_FROM');

    if (!accountSid || !authToken) throw new Error('Twilio credentials not configured');
    if (!fromNumber) throw new Error('TWILIO_WHATSAPP_FROM not configured');

    let normalizedTo = telefone.replace(/\D/g, '');
    if (!normalizedTo.startsWith('55')) normalizedTo = '55' + normalizedTo;
    normalizedTo = 'whatsapp:+' + normalizedTo;

    const fromWhatsApp = fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`;

    // Generate signed URL for the PDF
    const { data: signedUrl } = await supabase.storage
      .from('consorcio-boletos')
      .createSignedUrl(boleto.storage_path, 3600); // 1 hour

    const formData = new URLSearchParams();
    formData.append('From', fromWhatsApp);
    formData.append('To', normalizedTo);
    formData.append('Body', mensagem);
    if (signedUrl?.signedUrl) {
      formData.append('MediaUrl', signedUrl.signedUrl);
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = btoa(`${accountSid}:${authToken}`);

    const twilioResp = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const result = await twilioResp.json();

    if (!twilioResp.ok) {
      console.error('[SEND-BOLETO] Twilio error:', result);
      return new Response(JSON.stringify({ success: false, error: result.message || 'Twilio error' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mark as sent
    await supabase
      .from('consorcio_boletos')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', boletoId);

    return new Response(JSON.stringify({ success: true, messageSid: result.sid }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[SEND-BOLETO] Error:', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
