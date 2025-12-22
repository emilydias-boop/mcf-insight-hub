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
    const zapiClientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');
    
    // Headers para Z-API
    const zapiHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (zapiClientToken) {
      zapiHeaders['Client-Token'] = zapiClientToken;
    }
    
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

    // Buscar nome do usuário para prefixo
    let prefix = '';
    if (senderId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', senderId)
        .single();

      if (profile) {
        const name = senderName || profile.full_name || 'Atendente';
        const formattedName = name.split(' ').map((word: string) => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
        prefix = `*${formattedName}:*\n\n`;
      }
    } else if (senderName) {
      const formattedName = senderName.split(' ').map((word: string) => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ');
      prefix = `*${formattedName}:*\n\n`;
    }

    // Adicionar prefixo à mensagem
    const messageWithPrefix = prefix + content;

    // Extrair número do telefone do remote_jid
    const phone = conversation.remote_jid.replace('@c.us', '').replace('@s.whatsapp.net', '');

    // Enviar via Z-API
    const zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`;
    
    console.log('Sending message to Z-API:', { phone, contentLength: messageWithPrefix.length });

    const zapiResponse = await fetch(zapiUrl, {
      method: 'POST',
      headers: zapiHeaders,
      body: JSON.stringify({
        phone: phone,
        message: messageWithPrefix,
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
          prefix: prefix,
          full_message: messageWithPrefix,
          zapi_response: zapiResult,
        },
      })
      .select()
      .single();

    if (msgError) {
      console.error('Error saving message:', msgError);
    }

    // Atualizar conversa e atribuir owner se não tiver
    const updateData: Record<string, unknown> = {
      last_message: content,
      last_message_at: new Date().toISOString(),
      unread_count: 0,
    };
    
    // Se a conversa não tem owner e temos senderId, atribuir o SDR como dono
    if (!conversation.owner_id && senderId) {
      updateData.owner_id = senderId;
      console.log('Assigning owner_id to conversation:', { conversationId, ownerId: senderId });
    }
    
    await supabase
      .from('whatsapp_conversations')
      .update(updateData)
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
