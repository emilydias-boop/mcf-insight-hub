import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔗 Vinculando Contacts com Origins via Deals');
    const startTime = Date.now();

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Chamar função RPC que vincula contacts baseado nos deals mais recentes
    const { data: linkResult, error: linkError } = await supabase
      .rpc('link_contacts_to_origins_via_deals');

    if (linkError) {
      console.error('❌ Erro ao vincular contacts:', linkError);
      throw linkError;
    }

    const duration = Date.now() - startTime;
    const contactsLinked = linkResult || 0;

    console.log(`✅ ${contactsLinked} contatos vinculados com origins`);

    const summary = {
      success: true,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      results: {
        contacts_linked: contactsLinked,
      },
    };

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('❌ Erro no vínculo:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
