import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const NOVO_LEAD_STAGE_ID = 'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b';
    
    // Find backfill deals that got assigned to wrong stage (Lead Gratuito)
    const { data: deals, error } = await supabase
      .from('crm_deals')
      .select('id, stage_id')
      .contains('tags', ['Backfill-Offer'])
      .neq('stage_id', NOVO_LEAD_STAGE_ID);

    if (error) throw error;

    let updated = 0;
    for (const deal of deals || []) {
      const { error: ue } = await supabase
        .from('crm_deals')
        .update({ stage_id: NOVO_LEAD_STAGE_ID })
        .eq('id', deal.id);
      if (!ue) updated++;
    }

    return new Response(JSON.stringify({ 
      success: true, 
      found: deals?.length || 0, 
      updated 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
