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

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // GET - Diagnóstico
    if (req.method === 'GET') {
      console.log('[BACKFILL-OWNERS] Running diagnostics...');

      // Contar deals sem owner_id
      const { count: totalWithoutOwner } = await supabase
        .from('crm_deals')
        .select('*', { count: 'exact', head: true })
        .is('owner_id', null);

      // Contar deals Hubla (não podem ser corrigidos)
      const { count: hublaDeals } = await supabase
        .from('crm_deals')
        .select('*', { count: 'exact', head: true })
        .is('owner_id', null)
        .like('clint_id', 'hubla-deal-%');

      const clintDealsWithoutOwner = (totalWithoutOwner || 0) - (hublaDeals || 0);
      
      return new Response(JSON.stringify({
        success: true,
        diagnostics: {
          total_deals_without_owner: totalWithoutOwner || 0,
          hubla_deals_uncorrectable: hublaDeals || 0,
          clint_deals_to_fix: clintDealsWithoutOwner
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST - Executar backfill usando query SQL otimizada
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const dryRun = body.dry_run !== false;
      const batchSize = Math.min(body.batch_size || 200, 500);

      console.log(`[BACKFILL-OWNERS] Starting backfill - dry_run: ${dryRun}, batch_size: ${batchSize}`);

      // Query otimizada: buscar deals sem owner E seus webhooks correspondentes em uma única query
      // Usando uma subquery para pegar o deal_user do webhook
      const { data: dealsWithOwners, error: queryError } = await supabase
        .rpc('get_deals_missing_owners_with_webhook_data', { batch_limit: batchSize });

      // Se a função RPC não existir, usar abordagem alternativa
      if (queryError && queryError.message.includes('function')) {
        console.log('[BACKFILL-OWNERS] RPC not available, using fallback approach');
        
        // Fallback: buscar webhooks com deal_user e atualizar deals correspondentes
        const { data: webhooksWithOwner, error: webhookError } = await supabase
          .from('webhook_events')
          .select('event_data')
          .eq('event_type', 'deal.stage_changed')
          .not('event_data->>deal_user', 'is', null)
          .order('created_at', { ascending: false })
          .limit(batchSize * 2);

        if (webhookError) {
          throw webhookError;
        }

        // Extrair deal_id -> owner mapping
        const ownerMap = new Map<string, string>();
        for (const wh of (webhooksWithOwner || [])) {
          const eventData = wh.event_data as any;
          const dealId = eventData?.deal_id;
          const owner = eventData?.deal_user;
          if (dealId && owner && !ownerMap.has(dealId)) {
            ownerMap.set(dealId, owner);
          }
        }

        console.log(`[BACKFILL-OWNERS] Found ${ownerMap.size} unique deal_id -> owner mappings`);

        // Buscar deals sem owner que estão no map
        const clintIds = Array.from(ownerMap.keys());
        if (clintIds.length === 0) {
          return new Response(JSON.stringify({
            success: true,
            message: 'No webhooks with deal_user found',
            stats: { processed: 0, updated: 0, not_found: 0, remaining: 0 }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { data: dealsToUpdate, error: dealsError } = await supabase
          .from('crm_deals')
          .select('id, clint_id, name')
          .is('owner_id', null)
          .in('clint_id', clintIds)
          .limit(batchSize);

        if (dealsError) {
          throw dealsError;
        }

        console.log(`[BACKFILL-OWNERS] Found ${dealsToUpdate?.length || 0} deals to update`);

        let updated = 0;
        const updates: Array<{ deal_id: string; deal_name: string; owner_id: string }> = [];

        for (const deal of (dealsToUpdate || [])) {
          const ownerEmail = ownerMap.get(deal.clint_id);
          if (ownerEmail) {
            if (!dryRun) {
              const { error: updateError } = await supabase
                .from('crm_deals')
                .update({ owner_id: ownerEmail })
                .eq('id', deal.id);

              if (!updateError) {
                updated++;
                updates.push({ deal_id: deal.id, deal_name: deal.name, owner_id: ownerEmail });
              } else {
                console.error(`[BACKFILL-OWNERS] Error updating deal ${deal.id}:`, updateError);
              }
            } else {
              updated++;
              updates.push({ deal_id: deal.id, deal_name: deal.name, owner_id: ownerEmail });
            }
          }
        }

        const { count: remaining } = await supabase
          .from('crm_deals')
          .select('*', { count: 'exact', head: true })
          .is('owner_id', null)
          .not('clint_id', 'like', 'hubla-deal-%');

        console.log(`[BACKFILL-OWNERS] Completed - Updated: ${updated}, Remaining: ${remaining}`);

        return new Response(JSON.stringify({
          success: true,
          dry_run: dryRun,
          stats: {
            processed: dealsToUpdate?.length || 0,
            updated,
            not_found: (dealsToUpdate?.length || 0) - updated,
            remaining: remaining || 0
          },
          sample_updates: updates.slice(0, 20)
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (queryError) {
        throw queryError;
      }

      // Processar resultados da RPC
      let updated = 0;
      const updates: Array<{ deal_id: string; deal_name: string; owner_id: string }> = [];

      for (const row of (dealsWithOwners || [])) {
        if (row.owner_email) {
          if (!dryRun) {
            const { error: updateError } = await supabase
              .from('crm_deals')
              .update({ owner_id: row.owner_email })
              .eq('id', row.deal_id);

            if (!updateError) {
              updated++;
              updates.push({ deal_id: row.deal_id, deal_name: row.deal_name, owner_id: row.owner_email });
            }
          } else {
            updated++;
            updates.push({ deal_id: row.deal_id, deal_name: row.deal_name, owner_id: row.owner_email });
          }
        }
      }

      const { count: remaining } = await supabase
        .from('crm_deals')
        .select('*', { count: 'exact', head: true })
        .is('owner_id', null)
        .not('clint_id', 'like', 'hubla-deal-%');

      return new Response(JSON.stringify({
        success: true,
        dry_run: dryRun,
        stats: {
          processed: dealsWithOwners?.length || 0,
          updated,
          not_found: (dealsWithOwners?.length || 0) - updated,
          remaining: remaining || 0
        },
        sample_updates: updates.slice(0, 20)
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[BACKFILL-OWNERS] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
