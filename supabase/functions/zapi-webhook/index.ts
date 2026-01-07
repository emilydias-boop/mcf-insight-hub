import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    console.log('Z-API Webhook received:', JSON.stringify(payload, null, 2));

    // Z-API envia diferentes tipos de eventos
    const eventType = payload.type || payload.event;
    
    // Processar mensagens recebidas E enviadas por mim (fromMe)
    if (eventType === 'ReceivedCallback' || payload.isStatusReply === false) {
      const message = payload;
      const fromMe = message.fromMe === true;
      const fromApi = message.fromApi === true;
      
      // Se foi enviada pela API (CRM), já foi salva pelo zapi-send-message
      // Pular para evitar duplicação
      if (fromMe && fromApi) {
        console.log('Message sent from API (CRM), skipping - already saved');
        return new Response(JSON.stringify({ success: true, skipped: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      console.log('Processing message - fromMe:', fromMe, 'fromApi:', fromApi);
      
      const phone = message.phone || message.from?.replace('@c.us', '');
      const instanceId = message.instanceId;
      
      if (!phone) {
        console.log('No phone number in message, skipping');
        return new Response(JSON.stringify({ success: true, skipped: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Buscar ou criar conversa
      const remoteJid = phone.includes('@') ? phone : `${phone}@c.us`;
      
      // Identificar se é grupo
      const isGroup = message.isGroup === true || remoteJid.includes('@g.us') || remoteJid.includes('-group@');
      const chatName = message.chatName;
      
      // Buscar instância ativa
      const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('id')
        .eq('instance_id', instanceId)
        .single();

      if (!instance) {
        console.log('Instance not found for:', instanceId);
        // Usar primeira instância disponível se não encontrar
        const { data: defaultInstance } = await supabase
          .from('whatsapp_instances')
          .select('id')
          .limit(1)
          .single();
        
        if (!defaultInstance) {
          return new Response(JSON.stringify({ success: false, error: 'No instance found' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      const instanceUuid = instance?.id;

      // Buscar conversa existente ou criar nova
      let { data: conversation } = await supabase
        .from('whatsapp_conversations')
        .select('*')
        .eq('remote_jid', remoteJid)
        .maybeSingle();

      if (!conversation && instanceUuid) {
        // Tentar vincular ao contato pelo telefone
        const cleanPhone = phone.replace(/\D/g, '');
        const { data: contact } = await supabase
          .from('crm_contacts')
          .select('id, name')
          .or(`phone.ilike.%${cleanPhone}%,phone.ilike.%${cleanPhone.slice(-9)}%`)
          .limit(1)
          .maybeSingle();

        // Criar nova conversa
        const { data: newConversation, error: createError } = await supabase
          .from('whatsapp_conversations')
          .insert({
            instance_id: instanceUuid,
            remote_jid: remoteJid,
            contact_id: contact?.id || null,
            // Usar chatName quando fromMe é true (pois senderName seria o nome do agente, não do destinatário)
            contact_name: isGroup 
              ? (chatName || 'Grupo') 
              : (fromMe ? (chatName || contact?.name || phone) : (message.senderName || contact?.name || phone)),
            contact_phone: cleanPhone,
            last_message: message.text?.message || message.text || '[Mídia]',
            last_message_at: new Date().toISOString(),
            unread_count: fromMe ? 0 : 1,
            is_group: isGroup,
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating conversation:', createError);
        } else {
          conversation = newConversation;
        }
      }

      if (conversation) {
        // Salvar mensagem
        const messageContent = message.text?.message || message.text || '[Mídia]';
        
        const { error: msgError } = await supabase
          .from('whatsapp_messages')
          .insert({
            conversation_id: conversation.id,
            message_id_whatsapp: message.messageId || message.id?.id,
            content: messageContent,
            direction: fromMe ? 'outbound' : 'inbound',
            status: fromMe ? 'sent' : 'received',
            sender_name: fromMe ? null : (message.senderName || conversation.contact_name),
            sent_at: new Date(message.momment || Date.now()).toISOString(),
            metadata: {
              raw: payload,
              phone: phone,
              fromMe: fromMe,
              fromApi: fromApi,
            },
          });

        if (msgError) {
          console.error('Error saving message:', msgError);
        }

        // Atualizar conversa - não incrementar unread_count se a mensagem foi enviada por nós
        await supabase
          .from('whatsapp_conversations')
          .update({
            last_message: messageContent,
            last_message_at: new Date().toISOString(),
            unread_count: fromMe 
              ? (conversation.unread_count || 0)
              : (conversation.unread_count || 0) + 1,
          })
          .eq('id', conversation.id);

        console.log('Message saved successfully for conversation:', conversation.id, '- fromMe:', fromMe);
      }
    }

    // Processar status de mensagem (enviada, entregue, lida)
    if (eventType === 'MessageStatusCallback' || payload.status) {
      const status = payload.status?.toLowerCase() || 'sent';
      const messageId = payload.id?.id || payload.messageId;

      if (messageId) {
        const updateData: Record<string, unknown> = { status };
        
        if (status === 'delivered' || status === 'received') {
          updateData.delivered_at = new Date().toISOString();
        }
        if (status === 'read' || status === 'viewed') {
          updateData.read_at = new Date().toISOString();
          updateData.status = 'read';
        }

        await supabase
          .from('whatsapp_messages')
          .update(updateData)
          .eq('message_id_whatsapp', messageId);

        console.log('Message status updated:', messageId, status);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
