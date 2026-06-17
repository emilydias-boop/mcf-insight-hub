import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Backfill de hubla_transactions.linked_deal_id para transações Kiwify
 * que foram ingeridas sem o vínculo (bug histórico do kiwify-webhook-handler).
 *
 * Match: lower(customer_email) = lower(crm_contacts.email)
 *        + janela ±7 dias entre transaction.created_at e deal.created_at
 *        + deal mais próximo no tempo se houver vários
 *
 * Body JSON (todos opcionais):
 *   { dry_run?: boolean (default true)
 *   , since?: string ISO (default '2026-01-01')
 *   , until?: string ISO (default now)
 *   , window_days?: number (default 7)
 *   , limit?: number (default 5000) }
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let params: any = {};
  try {
    params = await req.json();
  } catch {
    params = {};
  }

  const dryRun = params.dry_run !== false; // default true
  const since = params.since || '2026-01-01T00:00:00Z';
  const until = params.until || new Date().toISOString();
  const windowDays = Number(params.window_days ?? 7);
  const limit = Number(params.limit ?? 5000);

  console.log(`[backfill-linked-deal-id] dry_run=${dryRun} since=${since} until=${until} window=${windowDays}d limit=${limit}`);

  // 1. Pegar transações Kiwify sem linked_deal_id
  const { data: orphanTxs, error: txError } = await supabase
    .from('hubla_transactions')
    .select('id, customer_email, created_at, hubla_id')
    .eq('source', 'kiwify')
    .is('linked_deal_id', null)
    .gte('created_at', since)
    .lt('created_at', until)
    .not('customer_email', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (txError) {
    return new Response(JSON.stringify({ error: txError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const stats = {
    candidates: orphanTxs?.length ?? 0,
    updated: 0,
    no_contact: 0,
    no_deal_in_window: 0,
    multiple_matches: 0,
    errors: 0,
    samples_updated: [] as any[],
    samples_no_match: [] as any[],
  };

  const windowMs = windowDays * 24 * 60 * 60 * 1000;

  for (const tx of orphanTxs ?? []) {
    const email = (tx.customer_email || '').toLowerCase().trim();
    if (!email) continue;

    // Buscar contatos por email
    const { data: contacts } = await supabase
      .from('crm_contacts')
      .select('id')
      .ilike('email', email)
      .limit(10);

    if (!contacts || contacts.length === 0) {
      stats.no_contact++;
      if (stats.samples_no_match.length < 10) {
        stats.samples_no_match.push({ tx_id: tx.id, email, reason: 'no_contact' });
      }
      continue;
    }

    const contactIds = contacts.map((c: any) => c.id);
    const txTime = new Date(tx.created_at).getTime();
    const winStart = new Date(txTime - windowMs).toISOString();
    const winEnd = new Date(txTime + windowMs).toISOString();

    const { data: deals } = await supabase
      .from('crm_deals')
      .select('id, created_at')
      .in('contact_id', contactIds)
      .gte('created_at', winStart)
      .lte('created_at', winEnd);

    if (!deals || deals.length === 0) {
      stats.no_deal_in_window++;
      if (stats.samples_no_match.length < 10) {
        stats.samples_no_match.push({ tx_id: tx.id, email, reason: 'no_deal_in_window' });
      }
      continue;
    }

    if (deals.length > 1) stats.multiple_matches++;

    // Escolher o deal mais próximo no tempo
    const best = deals
      .map((d: any) => ({ id: d.id, diff: Math.abs(new Date(d.created_at).getTime() - txTime) }))
      .sort((a, b) => a.diff - b.diff)[0];

    if (dryRun) {
      stats.updated++;
      if (stats.samples_updated.length < 10) {
        stats.samples_updated.push({ tx_id: tx.id, email, deal_id: best.id, diff_ms: best.diff });
      }
      continue;
    }

    const { error: updErr } = await supabase
      .from('hubla_transactions')
      .update({ linked_deal_id: best.id })
      .eq('id', tx.id);

    if (updErr) {
      stats.errors++;
      console.error(`[backfill] erro tx=${tx.id}:`, updErr);
    } else {
      stats.updated++;
      if (stats.samples_updated.length < 10) {
        stats.samples_updated.push({ tx_id: tx.id, email, deal_id: best.id, diff_ms: best.diff });
      }
    }
  }

  console.log(`[backfill-linked-deal-id] done`, stats);

  return new Response(
    JSON.stringify({ dry_run: dryRun, since, until, window_days: windowDays, ...stats }, null, 2),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});