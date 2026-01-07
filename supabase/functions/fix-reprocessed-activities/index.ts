// Fix reprocessed activities - Delete ALL reprocessed duplicates
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const body = await req.json().catch(() => ({}));
    const dry_run = body.dry_run !== false;

    // Get all reprocessed activities
    const { data: toDelete, error: findError } = await supabase
      .from('deal_activities')
      .select('id')
      .eq('metadata->>reprocessed', 'true');

    if (findError) throw findError;

    const count = toDelete?.length || 0;
    let deletedCount = 0;

    if (!dry_run && count > 0) {
      const ids = toDelete.map(d => d.id);
      for (let i = 0; i < ids.length; i += 100) {
        const batch = ids.slice(i, i + 100);
        const { error } = await supabase.from('deal_activities').delete().in('id', batch);
        if (!error) deletedCount += batch.length;
      }
    }

    return new Response(
      JSON.stringify({ success: true, dry_run, found: count, deleted: deletedCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
