import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { stage_id } = await req.json();

    if (!stage_id) {
      return new Response(
        JSON.stringify({ error: 'stage_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Check if already exists in crm_stages
    const { data: existing } = await supabase
      .from('crm_stages')
      .select('id')
      .eq('id', stage_id)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ success: true, action: 'already_exists' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch from local_pipeline_stages
    const { data: localStage, error: fetchError } = await supabase
      .from('local_pipeline_stages')
      .select('id, name, color, stage_order, origin_id')
      .eq('id', stage_id)
      .maybeSingle();

    if (fetchError || !localStage) {
      return new Response(
        JSON.stringify({ error: 'Stage not found in local_pipeline_stages', stage_id }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upsert into crm_stages
    const { error: upsertError } = await supabase
      .from('crm_stages')
      .upsert({
        id: localStage.id,
        clint_id: `local-${localStage.id}`,
        stage_name: localStage.name,
        color: localStage.color,
        stage_order: localStage.stage_order,
        origin_id: localStage.origin_id,
        is_active: true,
      }, { onConflict: 'id' });

    if (upsertError) {
      console.error('[ensure-crm-stage-mirror] Upsert error:', upsertError);
      return new Response(
        JSON.stringify({ error: upsertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[ensure-crm-stage-mirror] Mirrored stage ${localStage.name} (${stage_id})`);

    return new Response(
      JSON.stringify({ success: true, action: 'mirrored', stage_name: localStage.name }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[ensure-crm-stage-mirror] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
