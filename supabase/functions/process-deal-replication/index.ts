import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MatchCondition {
  type: 'product_name' | 'tags' | 'custom_field';
  operator: 'contains' | 'equals' | 'includes_any' | 'includes_all';
  values: string[];
  field?: string;
}

interface ReplicationRule {
  id: string;
  name: string;
  source_origin_id: string;
  source_stage_id: string;
  target_origin_id: string;
  target_stage_id: string;
  match_condition: MatchCondition | null;
  is_active: boolean;
  copy_custom_fields: boolean;
  copy_tasks: boolean;
  priority: number;
}

interface Deal {
  id: string;
  name: string;
  value: number | null;
  contact_id: string | null;
  origin_id: string;
  stage_id: string;
  owner_id: string | null;
  custom_fields: Record<string, any> | null;
  tags: string[] | null;
  replicated_from_deal_id: string | null;
}

interface QueueItem {
  id: string;
  deal_id: string;
  stage_id: string;
  origin_id: string;
  status: string;
  attempts: number;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const { deal_id, process_queue } = body;

    let itemsToProcess: QueueItem[] = [];

    // Process specific deal or process queue
    if (deal_id) {
      // Direct call with deal_id
      const { data: deal } = await supabase
        .from('crm_deals')
        .select('*')
        .eq('id', deal_id)
        .single();
      
      if (deal) {
        itemsToProcess = [{
          id: 'direct',
          deal_id: deal.id,
          stage_id: deal.stage_id,
          origin_id: deal.origin_id,
          status: 'pending',
          attempts: 0
        }];
      }
    } else if (process_queue) {
      // Process pending items from queue
      const { data: queueItems } = await supabase
        .from('deal_replication_queue')
        .select('*')
        .eq('status', 'pending')
        .lt('attempts', 3)
        .order('created_at', { ascending: true })
        .limit(50);
      
      itemsToProcess = queueItems || [];
    }

    if (itemsToProcess.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No items to process',
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const results = [];

    for (const item of itemsToProcess) {
      try {
        const result = await processReplication(supabase, item);
        results.push({ deal_id: item.deal_id, ...result });

        // Mark as processed in queue
        if (item.id !== 'direct') {
          await supabase
            .from('deal_replication_queue')
            .update({ 
              status: 'processed', 
              processed_at: new Date().toISOString() 
            })
            .eq('id', item.id);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error processing deal ${item.deal_id}:`, error);
        
        // Update attempts in queue
        if (item.id !== 'direct') {
          await supabase
            .from('deal_replication_queue')
            .update({ 
              attempts: item.attempts + 1,
              error_message: errorMessage,
              status: item.attempts >= 2 ? 'failed' : 'pending'
            })
            .eq('id', item.id);
        }
        
        results.push({ deal_id: item.deal_id, success: false, error: errorMessage });
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      processed: results.length,
      results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in process-deal-replication:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function processReplication(supabase: any, item: QueueItem) {
  // 1. Get the deal
  const { data: deal, error: dealError } = await supabase
    .from('crm_deals')
    .select('*')
    .eq('id', item.deal_id)
    .single();

  if (dealError || !deal) {
    throw new Error(`Deal not found: ${item.deal_id}`);
  }

  // Skip if already replicated (prevent loops)
  if (deal.replicated_from_deal_id) {
    return { success: true, message: 'Skipped - deal is a replica', replications: 0 };
  }

  // 2. Get active rules for this origin + stage
  const { data: rules, error: rulesError } = await supabase
    .from('deal_replication_rules')
    .select('*')
    .eq('source_origin_id', item.origin_id)
    .eq('source_stage_id', item.stage_id)
    .eq('is_active', true)
    .order('priority', { ascending: true });

  if (rulesError) {
    throw new Error(`Error fetching rules: ${rulesError.message}`);
  }

  if (!rules || rules.length === 0) {
    return { success: true, message: 'No matching rules', replications: 0 };
  }

  const replicationsCreated = [];

  for (const rule of rules as ReplicationRule[]) {
    // 3. Check match condition
    if (!matchesCondition(deal, rule.match_condition)) {
      continue;
    }

    // 4. Check if replication already exists
    const { data: existingReplica } = await supabase
      .from('crm_deals')
      .select('id')
      .eq('replicated_from_deal_id', deal.id)
      .eq('origin_id', rule.target_origin_id)
      .single();

    if (existingReplica) {
      console.log(`Replica already exists for deal ${deal.id} in origin ${rule.target_origin_id}`);
      continue;
    }

    // 5. Create replicated deal
    const newDeal = {
      name: deal.name,
      value: deal.value,
      contact_id: deal.contact_id,
      origin_id: rule.target_origin_id,
      stage_id: rule.target_stage_id,
      owner_id: deal.owner_id,
      custom_fields: rule.copy_custom_fields ? deal.custom_fields : null,
      tags: deal.tags,
      replicated_from_deal_id: deal.id,
      replicated_at: new Date().toISOString(),
      data_source: 'replication',
      clint_id: `replicated-${deal.id}-${rule.target_origin_id}`
    };

    const { data: createdDeal, error: createError } = await supabase
      .from('crm_deals')
      .insert(newDeal)
      .select()
      .single();

    if (createError) {
      console.error(`Error creating replica for rule ${rule.id}:`, createError);
      continue;
    }

    // 6. Log the replication
    await supabase.from('deal_replication_logs').insert({
      rule_id: rule.id,
      source_deal_id: deal.id,
      target_deal_id: createdDeal.id,
      status: 'success',
      metadata: {
        rule_name: rule.name,
        source_origin: item.origin_id,
        target_origin: rule.target_origin_id,
        match_condition: rule.match_condition
      }
    });

    // 7. Create activity on source deal
    await supabase.from('deal_activities').insert({
      deal_id: deal.id,
      activity_type: 'replication',
      description: `Deal replicado para pipeline "${rule.name}" - ID: ${createdDeal.id}`,
      metadata: {
        rule_id: rule.id,
        target_deal_id: createdDeal.id,
        target_origin_id: rule.target_origin_id
      }
    });

    // 8. Create activity on target deal
    await supabase.from('deal_activities').insert({
      deal_id: createdDeal.id,
      activity_type: 'creation',
      description: `Deal criado automaticamente via replicação do deal ${deal.id}`,
      metadata: {
        source_deal_id: deal.id,
        rule_id: rule.id,
        rule_name: rule.name
      }
    });

    replicationsCreated.push({
      rule_id: rule.id,
      rule_name: rule.name,
      target_deal_id: createdDeal.id
    });

    console.log(`Created replica: ${createdDeal.id} from ${deal.id} via rule ${rule.name}`);
  }

  return {
    success: true,
    message: `Processed ${replicationsCreated.length} replications`,
    replications: replicationsCreated.length,
    details: replicationsCreated
  };
}

function matchesCondition(deal: Deal, condition: MatchCondition | null): boolean {
  // If no condition, always match
  if (!condition || Object.keys(condition).length === 0) {
    return true;
  }

  const { type, operator, values, field } = condition;

  if (!values || values.length === 0) {
    return true;
  }

  switch (type) {
    case 'product_name':
      const dealName = (deal.name || '').toLowerCase();
      switch (operator) {
        case 'contains':
          return values.some(v => dealName.includes(v.toLowerCase()));
        case 'equals':
          return values.some(v => dealName === v.toLowerCase());
        default:
          return values.some(v => dealName.includes(v.toLowerCase()));
      }

    case 'tags':
      const dealTags = (deal.tags || []).map(t => t.toLowerCase());
      switch (operator) {
        case 'includes_any':
          return values.some(v => dealTags.includes(v.toLowerCase()));
        case 'includes_all':
          return values.every(v => dealTags.includes(v.toLowerCase()));
        default:
          return values.some(v => dealTags.includes(v.toLowerCase()));
      }

    case 'custom_field':
      if (!field || !deal.custom_fields) return false;
      const fieldValue = String(deal.custom_fields[field] || '').toLowerCase();
      switch (operator) {
        case 'contains':
          return values.some(v => fieldValue.includes(v.toLowerCase()));
        case 'equals':
          return values.some(v => fieldValue === v.toLowerCase());
        default:
          return values.some(v => fieldValue.includes(v.toLowerCase()));
      }

    default:
      return true;
  }
}
