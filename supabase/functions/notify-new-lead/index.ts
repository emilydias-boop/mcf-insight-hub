import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuração de SDRs notificáveis (espelhar do frontend)
const NOTIFIABLE_SDRS = [
  {
    userId: 'c7005c87-76fc-43a9-8bfa-e1b41f48a9b7',
    userName: 'Caroline Correa',
    whatsappPhone: '5519992937317', // Número da Caroline
    groupId: 'a6f3cbfc-0567-427f-a405-5a869aaa6010', // Perpétuo X1
  },
];

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { deal_id, deal_name, contact_name, origin_name, user_id } = await req.json();
    
    console.log('[notify-new-lead] Recebido:', { deal_id, deal_name, contact_name, origin_name, user_id });
    
    // Buscar SDR a ser notificado
    const sdr = NOTIFIABLE_SDRS.find(s => s.userId === user_id);
    if (!sdr?.whatsappPhone) {
      console.log('[notify-new-lead] Usuário não tem telefone configurado:', user_id);
      return new Response(JSON.stringify({ skipped: true, reason: 'No phone configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Enviar via Z-API
    const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID');
    const zapiToken = Deno.env.get('ZAPI_TOKEN');
    const zapiClientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');

    if (!zapiInstanceId || !zapiToken) {
      console.error('[notify-new-lead] Z-API credentials not configured');
      return new Response(JSON.stringify({ error: 'Z-API not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const message = `🚨 *Novo Lead no Perpétuo X1!*

👤 *Lead:* ${deal_name || contact_name || 'Sem nome'}
📋 *Contato:* ${contact_name || 'N/A'}
📍 *Origem:* ${origin_name || 'Perpétuo X1'}

Acesse o CRM para atender! 🏃‍♀️

https://mcf-insight-hub.lovable.app/crm/negocios`;

    const zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`;
    
    const zapiHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (zapiClientToken) {
      zapiHeaders['Client-Token'] = zapiClientToken;
    }

    console.log('[notify-new-lead] Enviando WhatsApp para:', sdr.whatsappPhone);

    const zapiResponse = await fetch(zapiUrl, {
      method: 'POST',
      headers: zapiHeaders,
      body: JSON.stringify({
        phone: sdr.whatsappPhone,
        message: message,
      }),
    });

    const result = await zapiResponse.json();
    console.log('[notify-new-lead] Z-API response:', result);

    if (!zapiResponse.ok) {
      console.error('[notify-new-lead] Z-API error:', result);
      return new Response(JSON.stringify({ error: 'Z-API error', details: result }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[notify-new-lead] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
