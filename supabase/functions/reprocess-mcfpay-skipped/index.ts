import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json().catch(() => ({}));
    const batchLimit = body.limit || 15;

    // Fetch skipped mcfpay webhooks
    const { data: skipped, error } = await supabase
      .from('bu_webhook_logs')
      .select('id, payload')
      .eq('bu_type', 'asaas')
      .eq('status', 'skipped')
      .order('created_at', { ascending: true })
      .limit(batchLimit);

    if (error) throw error;

    console.log(`🔄 Reprocessando ${skipped?.length || 0} webhooks skipped`);

    const results = { total: skipped?.length || 0, success: 0, errors: 0, duplicates: 0, details: [] as any[] };

    for (const webhook of skipped || []) {
      try {
        // Call the asaas-webhook-handler with the original payload
        const resp = await fetch(`${supabaseUrl}/functions/v1/asaas-webhook-handler`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify(webhook.payload),
        });

        const result = await resp.json();

        if (result.success) {
          // Mark old log as reprocessed
          await supabase
            .from('bu_webhook_logs')
            .update({ status: 'reprocessed', processed_at: new Date().toISOString() })
            .eq('id', webhook.id);
          
          results.success++;
          results.details.push({ id: webhook.id, status: 'success', product: result.product });
        } else if (result.duplicate) {
          await supabase
            .from('bu_webhook_logs')
            .update({ status: 'reprocessed', processed_at: new Date().toISOString() })
            .eq('id', webhook.id);
          results.duplicates++;
        } else {
          results.errors++;
          results.details.push({ id: webhook.id, status: 'error', error: result.error });
        }
      } catch (err: any) {
        console.error(`❌ Erro webhook ${webhook.id}:`, err.message);
        results.errors++;
      }
    }

    console.log(`📊 Resultado: ${results.success} ok, ${results.duplicates} duplicados, ${results.errors} erros`);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
