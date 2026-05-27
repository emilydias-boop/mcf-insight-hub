import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.searchParams.get('path');
    if (!path) {
      return new Response('Missing path', { status: 400, headers: corsHeaders });
    }
    // Restringe a arquivos de NFSe para evitar acesso arbitrário
    if (!path.includes('nfse') || path.includes('..')) {
      return new Response('Invalid path', { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data, error } = await supabase.storage
      .from('user-files')
      .createSignedUrl(path, 60 * 10); // 10 minutos para o redirect

    if (error || !data?.signedUrl) {
      console.error('[NFSE-DOWNLOAD] sign error', error);
      return new Response('Arquivo não encontrado ou expirado', { status: 404, headers: corsHeaders });
    }

    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: data.signedUrl },
    });
  } catch (err: any) {
    console.error('[NFSE-DOWNLOAD] error', err);
    return new Response('Erro interno', { status: 500, headers: corsHeaders });
  }
});