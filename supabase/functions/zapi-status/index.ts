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

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'status';

    let result: Record<string, unknown> = {};

    switch (action) {
      case 'status': {
        // Verificar status da conexão
        const statusUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/status`;
        const statusResponse = await fetch(statusUrl);
        const statusData = await statusResponse.json();
        
        console.log('Z-API status:', statusData);

        // Atualizar status no banco
        const status = statusData.connected ? 'connected' : 'disconnected';
        const phoneNumber = statusData.phone || statusData.wid?.split('@')[0];

        await supabase
          .from('whatsapp_instances')
          .upsert({
            instance_id: zapiInstanceId,
            token: zapiToken,
            name: 'Principal',
            status: status,
            phone_number: phoneNumber,
            connected_at: statusData.connected ? new Date().toISOString() : null,
          }, {
            onConflict: 'instance_id',
          });

        result = {
          connected: statusData.connected,
          status: status,
          phone: phoneNumber,
          details: statusData,
        };
        break;
      }

      case 'qrcode': {
        // Obter QR Code para conexão
        const qrUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/qr-code`;
        const qrResponse = await fetch(qrUrl);
        const qrData = await qrResponse.json();
        
        console.log('Z-API QR Code response:', qrData);

        result = {
          qrcode: qrData.value || qrData.qrcode,
          base64: qrData.value,
          imageUrl: qrData.value ? `data:image/png;base64,${qrData.value}` : null,
        };
        break;
      }

      case 'disconnect': {
        // Desconectar instância
        const disconnectUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/disconnect`;
        const disconnectResponse = await fetch(disconnectUrl);
        const disconnectData = await disconnectResponse.json();
        
        console.log('Z-API disconnect response:', disconnectData);

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
        const restartResponse = await fetch(restartUrl);
        const restartData = await restartResponse.json();
        
        console.log('Z-API restart response:', restartData);

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
    console.error('Z-API status error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
