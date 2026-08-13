import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveActiveOwnerProfileId } from "../_shared/resolveOwnerProfile.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MatchCondition {
  type?: 'product_name' | 'tags' | 'custom_field' | 'not_contract_paid' | 'not_purchased_products';
  operator?: 'contains' | 'equals' | 'includes_any' | 'includes_all';
  values?: string[];
  field?: string;
  apply_tag?: string;
  all?: MatchCondition[];
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
  auto_distribute: boolean;
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

const CONSORCIO_ORIGINS = [
  '7d7b1cb5-2a44-4552-9eff-c3b798646b78', // Efeito Alavanca + Clube
  'ea7aac02-3a69-422a-9f6e-691c8a04f06a', // Cobrança Consorcio
];

const CONSORCIO_SDRS = [
  { profile_id: '16828627-136e-42ef-9623-62dedfbc9d89', email: 'cleiton.lima@minhacasafinanciada.com' },
  { profile_id: '411e4b5d-8183-4d6a-b841-88c71d50955f', email: 'ithaline.clara@minhacasafinanciada.com' },
];

async function pickConsorcioSdr(supabase: any, targetOriginId: string) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const counts = await Promise.all(
    CONSORCIO_SDRS.map(async (sdr) => {
      const { count } = await supabase
        .from('crm_deals')
        .select('id', { count: 'exact', head: true })
        .eq('origin_id', targetOriginId)
        .eq('owner_profile_id', sdr.profile_id)
        .gte('created_at', since);
      return { sdr, count: count ?? 0 };
    })
  );

  counts.sort((a, b) => a.count - b.count || a.sdr.email.localeCompare(b.sdr.email));
  return counts[0].sdr;
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
    const ok = await matchesConditionAsync(supabase, deal, rule.match_condition);
    if (!ok) {
      continue;
    }

    const applyTag = rule.match_condition?.apply_tag as string | undefined;

    // 4a. Dedup by contact in target origin (add tag if exists)
    let contactEmail: string | null = null;
    let contactPhone: string | null = null;
    if (deal.contact_id) {
      const { data: c } = await supabase
        .from('crm_contacts')
        .select('email, phone')
        .eq('id', deal.contact_id)
        .maybeSingle();
      contactEmail = (c?.email || '').toLowerCase().trim() || null;
      contactPhone = c?.phone || null;
    }
    const phone9 = (contactPhone || '').replace(/\D/g, '').slice(-9);

    let existingInTarget: any = null;
    if (contactEmail || phone9) {
      const { data: contactMatches } = await supabase
        .from('crm_contacts')
        .select('id, email, phone')
        .or([
          contactEmail ? `email.ilike.${contactEmail}` : '',
          phone9 ? `phone.ilike.%${phone9}` : '',
        ].filter(Boolean).join(','))
        .limit(50);
      const contactIds = (contactMatches || [])
        .filter((x: any) => {
          const e = (x.email || '').toLowerCase().trim();
          const p9 = (x.phone || '').replace(/\D/g, '').slice(-9);
          return (contactEmail && e === contactEmail) || (phone9 && p9 === phone9);
        })
        .map((x: any) => x.id);
      if (contactIds.length > 0) {
        const { data: dupDeals } = await supabase
          .from('crm_deals')
          .select('id, tags')
          .in('contact_id', contactIds)
          .eq('origin_id', rule.target_origin_id)
          .limit(1);
        existingInTarget = (dupDeals || [])[0] || null;
      }
    }

    if (existingInTarget) {
      if (applyTag) {
        const currentTags: string[] = Array.isArray(existingInTarget.tags) ? existingInTarget.tags : [];
        if (!currentTags.includes(applyTag)) {
          await supabase
            .from('crm_deals')
            .update({ tags: [...currentTags, applyTag] })
            .eq('id', existingInTarget.id);
        }
      }
      await supabase.from('deal_replication_logs').insert({
        rule_id: rule.id,
        source_deal_id: deal.id,
        target_deal_id: existingInTarget.id,
        status: 'deduped',
        metadata: { rule_name: rule.name, applied_tag: applyTag || null, reason: 'contact_exists_in_target_origin' }
      });
      replicationsCreated.push({ rule_id: rule.id, rule_name: rule.name, target_deal_id: existingInTarget.id, deduped: true });
      continue;
    }

    // 4b. Check if replication already exists (source-based, prevents loops)
    const { data: existingReplica } = await supabase
      .from('crm_deals')
      .select('id')
      .eq('replicated_from_deal_id', deal.id)
      .eq('origin_id', rule.target_origin_id)
      .maybeSingle();

    if (existingReplica) {
      console.log(`Replica already exists for deal ${deal.id} in origin ${rule.target_origin_id}`);
      continue;
    }

    // 5. Create replicated deal
    const preassignedConsorcioOwner = rule.auto_distribute && CONSORCIO_ORIGINS.includes(rule.target_origin_id)
      ? await pickConsorcioSdr(supabase, rule.target_origin_id)
      : null;
    const mergedTags: string[] = Array.isArray(deal.tags) ? [...deal.tags] : [];
    if (applyTag && !mergedTags.includes(applyTag)) mergedTags.push(applyTag);
    const newDeal = {
      name: deal.name,
      value: deal.value,
      contact_id: deal.contact_id,
      origin_id: rule.target_origin_id,
      stage_id: rule.target_stage_id,
      owner_id: preassignedConsorcioOwner?.email ?? deal.owner_id,
      owner_profile_id: preassignedConsorcioOwner?.profile_id ?? null,
      custom_fields: rule.copy_custom_fields ? deal.custom_fields : null,
      tags: mergedTags,
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

    // 6. Auto-distribute if enabled
    let assignedOwner: string | null = preassignedConsorcioOwner?.email ?? null;
    if (rule.auto_distribute) {
      try {
        if (CONSORCIO_ORIGINS.includes(rule.target_origin_id)) {
          console.log(`Auto-distributed consórcio deal ${createdDeal.id} to ${assignedOwner}`);
        } else {
          const { data: nextOwner, error: ownerError } = await supabase
            .rpc('get_next_lead_owner', { p_origin_id: rule.target_origin_id });

          if (ownerError) {
            console.warn(`Auto-distribute warning for rule ${rule.id}: ${ownerError.message}`);
          } else if (nextOwner) {
            assignedOwner = nextOwner;
            const nextOwnerProfileId = await resolveActiveOwnerProfileId(
              supabase, nextOwner, 'REPLICATION][auto-distribute');
            await supabase
              .from('crm_deals')
              .update({ owner_id: nextOwner, owner_profile_id: nextOwnerProfileId })
              .eq('id', createdDeal.id);
            console.log(`Auto-distributed deal ${createdDeal.id} to ${nextOwner}`);
          } else {
            console.warn(`No owner available for auto-distribution in origin ${rule.target_origin_id}`);
          }
        }
      } catch (distError) {
        console.error(`Auto-distribute failed for deal ${createdDeal.id}:`, distError);
      }
    }

    // 7. Log the replication
    await supabase.from('deal_replication_logs').insert({
      rule_id: rule.id,
      source_deal_id: deal.id,
      target_deal_id: createdDeal.id,
      status: 'success',
      metadata: {
        rule_name: rule.name,
        source_origin: item.origin_id,
        target_origin: rule.target_origin_id,
        match_condition: rule.match_condition,
        auto_distributed: rule.auto_distribute,
        assigned_owner: assignedOwner
      }
    });

    // 8. Create activity on source deal
    const distMsg = assignedOwner ? ` — Distribuído para ${assignedOwner}` : '';
    await supabase.from('deal_activities').insert({
      deal_id: deal.id,
      activity_type: 'replication',
      description: `Deal replicado para pipeline "${rule.name}" - ID: ${createdDeal.id}${distMsg}`,
      metadata: {
        rule_id: rule.id,
        target_deal_id: createdDeal.id,
        target_origin_id: rule.target_origin_id,
        assigned_owner: assignedOwner
      }
    });

    // 9. Create activity on target deal
    await supabase.from('deal_activities').insert({
      deal_id: createdDeal.id,
      activity_type: 'creation',
      description: `Deal criado automaticamente via replicação do deal ${deal.id}${distMsg}`,
      metadata: {
        source_deal_id: deal.id,
        rule_id: rule.id,
        rule_name: rule.name,
        assigned_owner: assignedOwner
      }
    });

    replicationsCreated.push({
      rule_id: rule.id,
      rule_name: rule.name,
      target_deal_id: createdDeal.id,
      assigned_owner: assignedOwner
    });

    console.log(`Created replica: ${createdDeal.id} from ${deal.id} via rule ${rule.name}${assignedOwner ? ` → ${assignedOwner}` : ''}`);
  }

  return {
    success: true,
    message: `Processed ${replicationsCreated.length} replications`,
    replications: replicationsCreated.length,
    details: replicationsCreated
  };
}

async function matchesConditionAsync(supabase: any, deal: Deal, condition: MatchCondition | null): Promise<boolean> {
  // If no condition, always match
  if (!condition || Object.keys(condition).length === 0) {
    return true;
  }

  // Compound AND
  if (Array.isArray(condition.all) && condition.all.length > 0) {
    for (const c of condition.all) {
      const ok = await matchesConditionAsync(supabase, deal, c);
      if (!ok) return false;
    }
    return true;
  }

  // Negative: exclude when contact bought "A000 - Contrato"
  if (condition.type === 'not_contract_paid') {
    return !(await contactBoughtProducts(supabase, deal, ['A000', 'CONTRATO']));
  }
  if (condition.type === 'not_purchased_products') {
    const vals = condition.values || [];
    if (vals.length === 0) return true;
    return !(await contactBoughtProducts(supabase, deal, vals));
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

async function contactBoughtProducts(supabase: any, deal: Deal, needles: string[]): Promise<boolean> {
  if (!deal.contact_id) return false;
  const { data: c } = await supabase
    .from('crm_contacts')
    .select('email, phone')
    .eq('id', deal.contact_id)
    .maybeSingle();
  const email = (c?.email || '').toLowerCase().trim();
  const phone9 = (c?.phone || '').replace(/\D/g, '').slice(-9);
  if (!email && !phone9) return false;

  const orParts: string[] = [];
  if (email) orParts.push(`customer_email.ilike.${email}`);
  if (phone9) orParts.push(`customer_phone.ilike.%${phone9}`);

  const { data: tx } = await supabase
    .from('hubla_transactions')
    .select('product_name, sale_status')
    .eq('sale_status', 'completed')
    .or(orParts.join(','))
    .limit(200);
  if (!tx || tx.length === 0) return false;
  const needleUpper = needles.map(n => n.toUpperCase());
  return tx.some((t: any) => {
    const pn = (t.product_name || '').toUpperCase();
    return needleUpper.some(n => pn.includes(n));
  });
}
