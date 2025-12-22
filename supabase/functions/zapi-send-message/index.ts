import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID')!;
    const zapiToken = Deno.env.get('ZAPI_TOKEN')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { conversationId, content, senderId, senderName } = await req.json();

    if (!conversationId || !content) {
      return new Response(JSON.stringify({ error: 'conversationId and content are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar conversa
    const { data: conversation, error: convError } = await supabase
      .from('whatsapp_conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar assinatura do usuário se tiver senderId
    let signature = '';
    if (senderId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, whatsapp_signature')
        .eq('id', senderId)
        .single();

      if (profile) {
        const name = senderName || profile.full_name || 'Atendente';
        signature = profile.whatsapp_signature || `\n\n— *${name}* | MCF`;
      }
    } else if (senderName) {
      signature = `\n\n— *${senderName}* | MCF`;
    }

    // Adicionar assinatura à mensagem
    const messageWithSignature = content + signature;

    // Extrair número do telefone do remote_jid
    const phone = conversation.remote_jid.replace('@c.us', '').replace('@s.whatsapp.net', '');

    // Enviar via Z-API
    const zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`;
    
    console.log('Sending message to Z-API:', { phone, contentLength: messageWithSignature.length });

    const zapiResponse = await fetch(zapiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: phone,
        message: messageWithSignature,
      }),
    });

    const zapiResult = await zapiResponse.json();
    console.log('Z-API response:', zapiResult);

    if (!zapiResponse.ok) {
      console.error('Z-API error:', zapiResult);
      return new Response(JSON.stringify({ error: 'Failed to send message via Z-API', details: zapiResult }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Salvar mensagem no banco
    const { data: savedMessage, error: msgError } = await supabase
      .from('whatsapp_messages')
      .insert({
        conversation_id: conversationId,
        message_id_whatsapp: zapiResult.messageId || zapiResult.id,
        content: content, // Salvar sem assinatura para exibição
        direction: 'outbound',
        status: 'sent',
        sender_id: senderId,
        sender_name: senderName,
        sent_at: new Date().toISOString(),
        metadata: {
          signature: signature,
          full_message: messageWithSignature,
          zapi_response: zapiResult,
        },
      })
      .select()
      .single();

    if (msgError) {
      console.error('Error saving message:', msgError);
    }

    // Atualizar conversa
    await supabase
      .from('whatsapp_conversations')
      .update({
        last_message: content,
        last_message_at: new Date().toISOString(),
        unread_count: 0,
      })
      .eq('id', conversationId);

    return new Response(JSON.stringify({ 
      success: true, 
      message: savedMessage,
      zapiResult 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Send message error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
