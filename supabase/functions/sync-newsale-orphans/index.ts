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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse parameters
    const { 
      start_date, 
      end_date, 
      dry_run = false,
      net_value_factor = 0.88 
    } = await req.json().catch(() => ({}));

    const startDate = start_date || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = end_date || new Date().toISOString().split('T')[0];

    console.log(`[sync-newsale-orphans] Starting sync for period ${startDate} to ${endDate}`);
    console.log(`[sync-newsale-orphans] dry_run: ${dry_run}, net_value_factor: ${net_value_factor}`);

    // Step 1: Find all newsale- A010 transactions that are not yet counted
    const { data: newsaleTransactions, error: fetchError } = await supabase
      .from('hubla_transactions')
      .select('id, hubla_id, customer_email, customer_name, product_price, sale_date, net_value, count_in_dashboard')
      .like('hubla_id', 'newsale-%')
      .eq('product_category', 'a010')
      .eq('count_in_dashboard', false)
      .gte('sale_date', startDate)
      .lte('sale_date', endDate + 'T23:59:59');

    if (fetchError) {
      console.error('[sync-newsale-orphans] Error fetching newsale transactions:', fetchError);
      throw fetchError;
    }

    console.log(`[sync-newsale-orphans] Found ${newsaleTransactions?.length || 0} newsale- A010 candidates`);

    // Step 2: Find orphans - newsale- without a corresponding full transaction
    const orphans: typeof newsaleTransactions = [];

    for (const newsale of newsaleTransactions || []) {
      if (!newsale.customer_email) {
        console.log(`[sync-newsale-orphans] Skipping ${newsale.hubla_id} - no email`);
        continue;
      }

      // Check if there's a matching full transaction (not newsale-)
      const saleDateObj = new Date(newsale.sale_date);
      const dayBefore = new Date(saleDateObj.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const dayAfter = new Date(saleDateObj.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const { data: matchingFull, error: matchError } = await supabase
        .from('hubla_transactions')
        .select('id, hubla_id')
        .not('hubla_id', 'like', 'newsale-%')
        .eq('product_category', 'a010')
        .ilike('customer_email', newsale.customer_email)
        .gte('sale_date', dayBefore)
        .lte('sale_date', dayAfter + 'T23:59:59')
        .limit(1);

      if (matchError) {
        console.error(`[sync-newsale-orphans] Error checking match for ${newsale.hubla_id}:`, matchError);
        continue;
      }

      if (!matchingFull || matchingFull.length === 0) {
        // This is an orphan - no matching full transaction
        orphans.push(newsale);
        console.log(`[sync-newsale-orphans] Orphan found: ${newsale.hubla_id} - ${newsale.customer_email} - R$${newsale.product_price}`);
      } else {
        console.log(`[sync-newsale-orphans] ${newsale.hubla_id} has matching full: ${matchingFull[0].hubla_id}`);
      }
    }

    console.log(`[sync-newsale-orphans] Total orphans found: ${orphans.length}`);

    // Step 3: Promote orphans
    const promotedResults: Array<{
      hubla_id: string;
      customer_email: string;
      customer_name: string;
      product_price: number;
      calculated_net_value: number;
    }> = [];

    let totalNetValueAdded = 0;

    for (const orphan of orphans) {
      const calculatedNetValue = Math.round((orphan.product_price || 0) * net_value_factor * 100) / 100;
      
      if (!dry_run) {
        const { error: updateError } = await supabase
          .from('hubla_transactions')
          .update({
            count_in_dashboard: true,
            net_value: calculatedNetValue,
            source: 'hubla_sync'
          })
          .eq('id', orphan.id);

        if (updateError) {
          console.error(`[sync-newsale-orphans] Error updating ${orphan.hubla_id}:`, updateError);
          continue;
        }

        console.log(`[sync-newsale-orphans] Promoted: ${orphan.hubla_id} - net_value: R$${calculatedNetValue}`);
      } else {
        console.log(`[sync-newsale-orphans] [DRY RUN] Would promote: ${orphan.hubla_id} - net_value: R$${calculatedNetValue}`);
      }

      promotedResults.push({
        hubla_id: orphan.hubla_id,
        customer_email: orphan.customer_email,
        customer_name: orphan.customer_name,
        product_price: orphan.product_price || 0,
        calculated_net_value: calculatedNetValue
      });

      totalNetValueAdded += calculatedNetValue;
    }

    const response = {
      success: true,
      dry_run,
      period: { start_date: startDate, end_date: endDate },
      net_value_factor,
      total_newsale_candidates: newsaleTransactions?.length || 0,
      total_orphans_found: orphans.length,
      total_promoted: promotedResults.length,
      total_net_value_added: Math.round(totalNetValueAdded * 100) / 100,
      promoted_transactions: promotedResults
    };

    console.log(`[sync-newsale-orphans] Complete. Promoted ${promotedResults.length} orphans, added R$${totalNetValueAdded.toFixed(2)} net value`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[sync-newsale-orphans] Error:', errorMessage);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
