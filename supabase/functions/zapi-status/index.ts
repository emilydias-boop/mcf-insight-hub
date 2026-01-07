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
    const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID')!;
    const zapiToken = Deno.env.get('ZAPI_TOKEN')!;
    const zapiClientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');
    
    console.log('[zapi-status] Instance ID:', zapiInstanceId);
    console.log('[zapi-status] Token length:', zapiToken?.length || 0);
    console.log('[zapi-status] Client-Token configured:', !!zapiClientToken);
    
    // Headers para todas as requisições Z-API
    const zapiHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (zapiClientToken) {
      zapiHeaders['Client-Token'] = zapiClientToken;
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Read action from body first, then query params as fallback
    let action = 'status';
    
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        action = body.action || 'status';
        console.log('[zapi-status] Action from body:', action);
      } catch {
        console.log('[zapi-status] No body, using query params');
        const url = new URL(req.url);
        action = url.searchParams.get('action') || 'status';
      }
    } else {
      const url = new URL(req.url);
      action = url.searchParams.get('action') || 'status';
    }

    console.log('[zapi-status] Final action:', action);

    let result: Record<string, unknown> = {};

    switch (action) {
      case 'status': {
        // Verificar status da conexão
        const statusUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/status`;
        console.log('[zapi-status] Calling:', statusUrl);
        
        const statusResponse = await fetch(statusUrl, { headers: zapiHeaders });
        const statusData = await statusResponse.json();
        
        console.log('[zapi-status] Status response:', JSON.stringify(statusData));

        // IMPORTANTE: Z-API retorna error: "You are already connected" mesmo quando conectado!
        // Priorizar connected: true sobre qualquer error
        const isConnected = statusData.connected === true;
        
        // Só tratar como erro real se NÃO estiver conectado E tiver error
        if (!isConnected && statusData.error) {
          return new Response(JSON.stringify({ 
            error: statusData.error, 
            message: statusData.message,
            connected: false,
            details: 'Verifique se ZAPI_INSTANCE_ID e ZAPI_TOKEN estão corretos'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Atualizar status no banco
        const status = isConnected ? 'connected' : 'disconnected';
        
        let phoneNumber = null;
        
        // Se conectado, buscar dados do dispositivo para obter o número
        if (isConnected) {
          const deviceUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/device`;
          console.log('[zapi-status] Fetching device info:', deviceUrl);
          
          try {
            const deviceResponse = await fetch(deviceUrl, { headers: zapiHeaders });
            const deviceData = await deviceResponse.json();
            console.log('[zapi-status] Device response:', JSON.stringify(deviceData));
            
            phoneNumber = deviceData.phone || deviceData.wid?.split('@')[0];
          } catch (deviceError) {
            console.error('[zapi-status] Error fetching device:', deviceError);
          }
        }

        console.log('[zapi-status] Updating database - status:', status, 'phone:', phoneNumber);
        const { data: upsertData, error: upsertError } = await supabase
          .from('whatsapp_instances')
          .upsert({
            instance_id: zapiInstanceId,
            token: zapiToken,
            name: 'Principal',
            status: status,
            phone_number: phoneNumber,
            connected_at: isConnected ? new Date().toISOString() : null,
          }, {
            onConflict: 'instance_id',
          })
          .select();
        
        console.log('[zapi-status] Upsert result:', JSON.stringify(upsertData), 'error:', upsertError);

        result = {
          connected: isConnected,
          status: status,
          phone: phoneNumber,
          details: statusData,
        };
        break;
      }

      case 'qrcode': {
        // Primeiro verificar se já está conectado
        const statusUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/status`;
        console.log('[zapi-status] Checking status before QR:', statusUrl);
        
        const statusResponse = await fetch(statusUrl, { headers: zapiHeaders });
        const statusData = await statusResponse.json();
        
        console.log('[zapi-status] Status before QR:', JSON.stringify(statusData));

        // Se já conectado, buscar número do dispositivo e retornar
        if (statusData.connected === true) {
          let phoneNumber = null;
          const deviceUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/device`;
          console.log('[zapi-status] QR - Fetching device info:', deviceUrl);
          
          try {
            const deviceResponse = await fetch(deviceUrl, { headers: zapiHeaders });
            const deviceData = await deviceResponse.json();
            console.log('[zapi-status] QR - Device response:', JSON.stringify(deviceData));
            
            phoneNumber = deviceData.phone || deviceData.wid?.split('@')[0];
          } catch (deviceError) {
            console.error('[zapi-status] QR - Error fetching device:', deviceError);
          }
          
          console.log('[zapi-status] Already connected, updating database with phone:', phoneNumber);
          const { data: upsertData, error: upsertError } = await supabase
            .from('whatsapp_instances')
            .upsert({
              instance_id: zapiInstanceId,
              token: zapiToken,
              name: 'Principal',
              status: 'connected',
              phone_number: phoneNumber,
              connected_at: new Date().toISOString(),
            }, {
              onConflict: 'instance_id',
            })
            .select();
          
          console.log('[zapi-status] QR upsert result:', JSON.stringify(upsertData), 'error:', upsertError);

          return new Response(JSON.stringify({ 
            connected: true,
            alreadyConnected: true,
            message: 'Instância já está conectada',
            phone: phoneNumber,
            status: 'connected'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Obter QR Code para conexão - usar /qr-code/image para base64
        const qrUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/qr-code/image`;
        console.log('[zapi-status] Calling QR:', qrUrl);
        
        const qrResponse = await fetch(qrUrl, { headers: zapiHeaders });
        const qrData = await qrResponse.json();
        
        console.log('[zapi-status] QR response status:', qrResponse.status);
        console.log('[zapi-status] QR response:', JSON.stringify(qrData));

        if (qrData.error || !qrResponse.ok) {
          return new Response(JSON.stringify({ 
            error: qrData.error || 'Erro ao obter QR Code', 
            message: qrData.message || 'Falha na requisição',
            connected: false,
            details: 'Verifique se a instância está desconectada para obter QR Code'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        result = {
          qrcode: qrData.value || qrData.qrcode,
          base64: qrData.value,
          value: qrData.value,
          imageUrl: qrData.value ? `data:image/png;base64,${qrData.value}` : null,
          connected: false,
        };
        break;
      }

      case 'disconnect': {
        // Desconectar instância
        const disconnectUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/disconnect`;
        console.log('[zapi-status] Calling disconnect:', disconnectUrl);
        
        const disconnectResponse = await fetch(disconnectUrl, { headers: zapiHeaders });
        const disconnectData = await disconnectResponse.json();
        
        console.log('[zapi-status] Disconnect response:', JSON.stringify(disconnectData));

        await supabase
          .from('whatsapp_instances')
          .update({ status: 'disconnected', connected_at: null })
          .eq('instance_id', zapiInstanceId);

        result = {
          success: true,
          message: 'Disconnected successfully',
        };
        break;
      }

      case 'restart': {
        // Reiniciar instância
        const restartUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/restart`;
        console.log('[zapi-status] Calling restart:', restartUrl);
        
        const restartResponse = await fetch(restartUrl, { headers: zapiHeaders });
        const restartData = await restartResponse.json();
        
        console.log('[zapi-status] Restart response:', JSON.stringify(restartData));

        result = {
          success: true,
          message: 'Instance restarted',
          details: restartData,
        };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[zapi-status] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
