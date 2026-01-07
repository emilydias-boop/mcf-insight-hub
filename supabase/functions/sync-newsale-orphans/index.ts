import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalize name for comparison (remove accents, lowercase, trim)
function normalizeName(name: string | null): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

// Extract first and last name for fuzzy matching
function getNameParts(name: string): { first: string; last: string } {
  const normalized = normalizeName(name);
  const parts = normalized.split(' ').filter(p => p.length > 0);
  return {
    first: parts[0] || '',
    last: parts[parts.length - 1] || ''
  };
}

// Check if two names are similar enough
function namesMatch(name1: string | null, name2: string | null): boolean {
  if (!name1 || !name2) return false;
  
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);
  
  // Exact match after normalization
  if (n1 === n2) return true;
  
  // Check first and last name match
  const parts1 = getNameParts(name1);
  const parts2 = getNameParts(name2);
  
  // Both first and last name must match
  if (parts1.first === parts2.first && parts1.last === parts2.last) {
    return true;
  }
  
  return false;
}

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

    // Step 2: Get ALL counted A010 transactions in the period (for name matching)
    const { data: countedTransactions, error: countedError } = await supabase
      .from('hubla_transactions')
      .select('id, hubla_id, customer_email, customer_name, sale_date')
      .eq('product_category', 'a010')
      .eq('count_in_dashboard', true)
      .gte('sale_date', startDate)
      .lte('sale_date', endDate + 'T23:59:59');

    if (countedError) {
      console.error('[sync-newsale-orphans] Error fetching counted transactions:', countedError);
      throw countedError;
    }

    console.log(`[sync-newsale-orphans] Found ${countedTransactions?.length || 0} counted A010 transactions for comparison`);

    // Step 3: Find true orphans - newsale- without matching full transaction (by email OR name)
    const orphans: typeof newsaleTransactions = [];
    const skippedByEmail: Array<{ newsale: string; matched: string; reason: string }> = [];
    const skippedByName: Array<{ newsale: string; newsaleName: string; matched: string; matchedName: string }> = [];

    for (const newsale of newsaleTransactions || []) {
      const saleDateObj = new Date(newsale.sale_date);
      const dayBefore = new Date(saleDateObj.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const dayAfter = new Date(saleDateObj.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Check 1: Match by email (existing logic)
      let matchedByEmail = false;
      if (newsale.customer_email) {
        const { data: matchingFull } = await supabase
          .from('hubla_transactions')
          .select('id, hubla_id, customer_name')
          .not('hubla_id', 'like', 'newsale-%')
          .eq('product_category', 'a010')
          .ilike('customer_email', newsale.customer_email)
          .gte('sale_date', dayBefore)
          .lte('sale_date', dayAfter + 'T23:59:59')
          .limit(1);

        if (matchingFull && matchingFull.length > 0) {
          matchedByEmail = true;
          skippedByEmail.push({
            newsale: newsale.hubla_id,
            matched: matchingFull[0].hubla_id,
            reason: `email match: ${newsale.customer_email}`
          });
          console.log(`[sync-newsale-orphans] ${newsale.hubla_id} matched by email to ${matchingFull[0].hubla_id}`);
          continue;
        }
      }

      // Check 2: Match by name in counted transactions (within date range)
      let matchedByName = false;
      if (newsale.customer_name && countedTransactions) {
        for (const counted of countedTransactions) {
          const countedDate = new Date(counted.sale_date);
          const countedDateStr = countedDate.toISOString().split('T')[0];
          
          // Check if dates are within 1 day
          if (countedDateStr >= dayBefore && countedDateStr <= dayAfter) {
            if (namesMatch(newsale.customer_name, counted.customer_name)) {
              matchedByName = true;
              skippedByName.push({
                newsale: newsale.hubla_id,
                newsaleName: newsale.customer_name,
                matched: counted.hubla_id,
                matchedName: counted.customer_name || ''
              });
              console.log(`[sync-newsale-orphans] ${newsale.hubla_id} (${newsale.customer_name}) matched by NAME to ${counted.hubla_id} (${counted.customer_name})`);
              break;
            }
          }
        }
      }

      if (matchedByName) continue;

      // This is a true orphan - no matching transaction by email OR name
      orphans.push(newsale);
      console.log(`[sync-newsale-orphans] TRUE ORPHAN: ${newsale.hubla_id} - ${newsale.customer_name} (${newsale.customer_email}) - R$${newsale.product_price}`);
    }

    console.log(`[sync-newsale-orphans] Total true orphans found: ${orphans.length}`);
    console.log(`[sync-newsale-orphans] Skipped by email match: ${skippedByEmail.length}`);
    console.log(`[sync-newsale-orphans] Skipped by name match: ${skippedByName.length}`);

    // Step 4: Promote true orphans
    const promotedResults: Array<{
      hubla_id: string;
      customer_email: string | null;
      customer_name: string | null;
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
      summary: {
        total_newsale_candidates: newsaleTransactions?.length || 0,
        skipped_by_email_match: skippedByEmail.length,
        skipped_by_name_match: skippedByName.length,
        total_true_orphans: orphans.length,
        total_promoted: promotedResults.length,
        total_net_value_added: Math.round(totalNetValueAdded * 100) / 100
      },
      skipped_by_email: skippedByEmail,
      skipped_by_name: skippedByName,
      promoted_transactions: promotedResults
    };

    console.log(`[sync-newsale-orphans] Complete. Promoted ${promotedResults.length} true orphans, added R$${totalNetValueAdded.toFixed(2)} net value`);

    return new Response(JSON.stringify(response, null, 2), {
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
