import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[RECONCILE-CLINT-IDS] Starting reconciliation job...');
  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Call the database function that does the reconciliation
    const { data, error } = await supabase.rpc('reconcile_hubla_clint_ids');

    if (error) {
      console.error('[RECONCILE-CLINT-IDS] Error calling reconcile function:', error);
      throw error;
    }

    const duration = Date.now() - startTime;
    console.log('[RECONCILE-CLINT-IDS] Reconciliation completed:', {
      result: data,
      duration_ms: duration
    });

    return new Response(JSON.stringify({
      success: true,
      result: data,
      duration_ms: duration,
      executed_at: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[RECONCILE-CLINT-IDS] Fatal error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      duration_ms: duration
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
