import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const R1_REALIZADA_STAGE = '34995d75-933e-4d67-b7fc-19fcb8b81680';
const CONTRATO_PAGO_STAGE = '062927f5-b7a3-496a-9d47-eb03b3d69b10';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { dry_run = true } = await req.json().catch(() => ({ dry_run: true }));
    console.log(`🔄 Move Outside (R1 Realizada) to Contrato Pago - dry_run: ${dry_run}`);

    // 1. Buscar deals na stage R1 Realizada com tag 'Outside'
    const allDeals: any[] = [];
    let page = 0;
    const PAGE_SIZE = 1000;

    while (true) {
      const { data, error } = await supabase
        .from('crm_deals')
        .select('id, name, contact_id, origin_id, stage_id, tags, value')
        .eq('stage_id', R1_REALIZADA_STAGE)
        .contains('tags', ['Outside'])
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allDeals.push(...data);
      if (data.length < PAGE_SIZE) break;
      page++;
    }
    console.log(`📊 ${allDeals.length} deals Outside em R1 Realizada`);

    // 2. Buscar emails dos contatos
    const contactIds = [...new Set(allDeals.map(d => d.contact_id).filter(Boolean))];
    const contactEmails = new Map<string, string>();

    for (let i = 0; i < contactIds.length; i += 200) {
      const batch = contactIds.slice(i, i + 200);
      const { data: contacts } = await supabase
        .from('crm_contacts')
        .select('id, email')
        .in('id', batch);
      for (const c of contacts || []) {
        if (c.email) contactEmails.set(c.id, c.email.toLowerCase().trim());
      }
    }

    const stats = {
      total_deals: allDeals.length,
      moved: 0,
      errors: 0,
    };

    // 3. Dry run
    if (dry_run) {
      const details = allDeals.slice(0, 50).map(deal => ({
        deal_id: deal.id,
        deal_name: deal.name,
        email: contactEmails.get(deal.contact_id) || '',
        target_stage: CONTRATO_PAGO_STAGE,
        action: 'would_move',
      }));
      stats.moved = allDeals.length;

      return new Response(JSON.stringify({ dry_run: true, stats, details, success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Execução real
    const BATCH_SIZE = 200;
    const now = new Date().toISOString();
    const movedDeals: any[] = [];

    for (let i = 0; i < allDeals.length; i += BATCH_SIZE) {
      const batch = allDeals.slice(i, i + BATCH_SIZE);
      const ids = batch.map(d => d.id);

      const { error: updateErr } = await supabase
        .from('crm_deals')
        .update({ stage_id: CONTRATO_PAGO_STAGE, updated_at: now })
        .in('id', ids);

      if (updateErr) {
        console.error(`❌ Batch update error:`, updateErr.message);
        stats.errors += batch.length;
        continue;
      }
      stats.moved += batch.length;
      movedDeals.push(...batch);
    }

    // 5. Insert deal_activities — stage_change é registrado pelo trigger
    //    trg_log_deal_stage_change em crm_deals. Aqui só o motivo/origem.
    const ACTIVITY_BATCH = 100;
    const activities = movedDeals.map(deal => ({
      deal_id: deal.id,
      activity_type: 'auto_move',
      description: 'Outside com R1 Realizada: movido automaticamente para Contrato Pago',
      metadata: {
        source: 'move-outside-to-contrato-pago',
        from_stage_id: R1_REALIZADA_STAGE,
        to_stage_id: CONTRATO_PAGO_STAGE,
        email: contactEmails.get(deal.contact_id) || '',
      },
    }));

    for (let i = 0; i < activities.length; i += ACTIVITY_BATCH) {
      const batch = activities.slice(i, i + ACTIVITY_BATCH);
      const { error: actErr } = await supabase.from('deal_activities').insert(batch);
      if (actErr) {
        console.error(`❌ Activity insert batch error:`, actErr.message);
      }
    }

    const details = movedDeals.slice(0, 50).map(deal => ({
      deal_id: deal.id,
      deal_name: deal.name,
      email: contactEmails.get(deal.contact_id) || '',
      action: 'moved',
    }));

    console.log(`✅ Stats: ${JSON.stringify(stats)}`);

    return new Response(JSON.stringify({ dry_run: false, stats, details, success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('❌', error);
    return new Response(JSON.stringify({ error: error.message, success: false }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});