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
    console.log('🚀 Iniciando sincronização completa do Clint CRM');
    const startTime = Date.now();

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const results: any = {};

    // 1. Sincronizar Origins e Stages primeiro (necessário para contacts e deals)
    console.log('📊 1/4 - Sincronizando Origins e Stages...');
    const { data: originsResult, error: originsError } = await supabase.functions.invoke(
      'sync-origins-stages'
    );
    
    if (originsError) {
      console.error('❌ Erro ao sincronizar origins:', originsError);
      results.origins_stages = { error: originsError.message };
    } else {
      console.log('✅ Origins e Stages sincronizados:', originsResult);
      results.origins_stages = originsResult;
    }

    // Aguardar um pouco para evitar sobrecarga
    await new Promise(r => setTimeout(r, 1000));

    // 2. Sincronizar Contacts (modo automático com checkpoint)
    console.log('📞 2/4 - Sincronizando Contacts...');
    const { data: contactsResult, error: contactsError } = await supabase.functions.invoke(
      'sync-contacts',
      { body: { auto_mode: true } }
    );
    
    if (contactsError) {
      console.error('❌ Erro ao sincronizar contacts:', contactsError);
      results.contacts = { error: contactsError.message };
    } else {
      console.log('✅ Contacts sincronizados:', contactsResult);
      results.contacts = contactsResult;
    }

    await new Promise(r => setTimeout(r, 1000));

    // 3. Sincronizar Deals (modo automático com checkpoint)
    console.log('💼 3/4 - Sincronizando Deals...');
    const { data: dealsResult, error: dealsError } = await supabase.functions.invoke(
      'sync-deals',
      { body: { auto_mode: true } }
    );
    
    if (dealsError) {
      console.error('❌ Erro ao sincronizar deals:', dealsError);
      results.deals = { error: dealsError.message };
    } else {
      console.log('✅ Deals sincronizados:', dealsResult);
      results.deals = dealsResult;
    }

    await new Promise(r => setTimeout(r, 1000));

    // 4. Vincular Contacts aos Origins via Deals
    console.log('🔗 4/4 - Vinculando Contacts aos Origins...');
    const { data: linkResult, error: linkError } = await supabase.functions.invoke(
      'sync-link-contacts'
    );
    
    if (linkError) {
      console.error('❌ Erro ao vincular contacts:', linkError);
      results.link_contacts = { error: linkError.message };
    } else {
      console.log('✅ Contacts vinculados:', linkResult);
      results.link_contacts = linkResult;
    }

    const duration = Date.now() - startTime;

    const summary = {
      success: true,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      message: 'Sincronização orquestrada com sucesso',
      results,
    };

    console.log('✅ Sincronização completa orquestrada:');
    console.log(JSON.stringify(summary, null, 2));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('❌ Erro na sincronização:', error);
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
