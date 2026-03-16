import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PARTNER_PATTERNS = ['A001', 'A002', 'A003', 'A004', 'A009', 'INCORPORADOR', 'ANTICRISE'];
const FALLBACK_VENDA_REALIZADA_STAGE = '3a2776e2-a536-4a2a-bb7b-a2f53c8941df';

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
    console.log(`🔄 Move Partners to Venda Realizada - dry_run: ${dry_run}`);

    // 1. Buscar stages "Venda Realizada" por origin_id
    const { data: vendaRealizadaStages, error: stagesErr } = await supabase
      .from('crm_stages')
      .select('id, stage_name, origin_id')
      .ilike('stage_name', '%venda realizada%');

    if (stagesErr) throw stagesErr;

    const vendaRealizadaByOrigin = new Map<string, string>();
    for (const s of vendaRealizadaStages || []) {
      if (s.origin_id) vendaRealizadaByOrigin.set(s.origin_id, s.id);
    }
    console.log(`📊 ${vendaRealizadaByOrigin.size} stages "Venda Realizada" encontrados`);

    // Collect stage IDs that ARE "Venda Realizada" to exclude deals already there
    const vendaRealizadaStageIds = new Set(
      (vendaRealizadaStages || []).map(s => s.id)
    );
    vendaRealizadaStageIds.add(FALLBACK_VENDA_REALIZADA_STAGE);

    // 2. Buscar todos os deals com contatos
    const allDeals: any[] = [];
    let page = 0;
    const PAGE_SIZE = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('crm_deals')
        .select('id, name, contact_id, origin_id, stage_id, tags, value')
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allDeals.push(...data);
      if (data.length < PAGE_SIZE) break;
      page++;
    }
    console.log(`📊 ${allDeals.length} deals totais`);

    // Filter out deals already in Venda Realizada
    const dealsNotInVR = allDeals.filter(d => !vendaRealizadaStageIds.has(d.stage_id));
    console.log(`📊 ${dealsNotInVR.length} deals fora de Venda Realizada`);

    // 3. Buscar emails dos contatos desses deals
    const contactIds = [...new Set(dealsNotInVR.map(d => d.contact_id).filter(Boolean))];
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

    // 4. Identificar parceiros via hubla_transactions
    const allEmails = [...new Set(Array.from(contactEmails.values()))];
    const partnerEmails = new Set<string>();

    for (let i = 0; i < allEmails.length; i += 200) {
      const batch = allEmails.slice(i, i + 200);
      const { data: txs } = await supabase
        .from('hubla_transactions')
        .select('customer_email, product_name')
        .in('customer_email', batch)
        .eq('sale_status', 'completed');

      for (const tx of txs || []) {
        if (!tx.customer_email || !tx.product_name) continue;
        const upper = tx.product_name.toUpperCase();
        if (PARTNER_PATTERNS.some(p => upper.includes(p))) {
          partnerEmails.add(tx.customer_email.toLowerCase().trim());
        }
      }
    }
    console.log(`🤝 ${partnerEmails.size} emails de parceiros encontrados`);

    // 5. Filtrar deals de parceiros que não estão em Venda Realizada
    const partnerDeals = dealsNotInVR.filter(d => {
      const email = contactEmails.get(d.contact_id);
      return email && partnerEmails.has(email);
    });
    console.log(`🎯 ${partnerDeals.length} deals de parceiros para mover`);

    const stats = {
      total_deals: allDeals.length,
      deals_fora_vr: dealsNotInVR.length,
      partner_emails: partnerEmails.size,
      partner_deals_found: partnerDeals.length,
      moved: 0,
      errors: 0,
    };
    const details: any[] = [];

    // 6. Mover cada deal
    for (const deal of partnerDeals) {
      const email = contactEmails.get(deal.contact_id) || '';
      const targetStageId = vendaRealizadaByOrigin.get(deal.origin_id) || FALLBACK_VENDA_REALIZADA_STAGE;

      if (dry_run) {
        details.push({
          deal_id: deal.id,
          deal_name: deal.name,
          email,
          target_stage: targetStageId,
          action: 'would_move',
        });
        stats.moved++;
        continue;
      }

      try {
        // Update deal
        const existingTags: string[] = Array.isArray(deal.tags) ? deal.tags : [];
        const newTags = existingTags.includes('Parceiro') ? existingTags : [...existingTags, 'Parceiro'];

        const { error: updateErr } = await supabase
          .from('crm_deals')
          .update({
            stage_id: targetStageId,
            tags: newTags,
            updated_at: new Date().toISOString(),
          })
          .eq('id', deal.id);

        if (updateErr) throw updateErr;

        // Register activity
        await supabase.from('deal_activities').insert({
          deal_id: deal.id,
          activity_type: 'stage_change',
          description: `Parceiro detectado: movido automaticamente para Venda Realizada`,
          from_stage: deal.stage_id,
          to_stage: targetStageId,
          metadata: { source: 'move-partners-to-venda-realizada', email },
        });

        stats.moved++;
        details.push({ deal_id: deal.id, deal_name: deal.name, email, action: 'moved' });
      } catch (err: any) {
        stats.errors++;
        details.push({ deal_id: deal.id, deal_name: deal.name, email, action: 'error', error: err.message });
        console.error(`❌ ${email}:`, err.message);
      }
    }

    console.log(`✅ Stats: ${JSON.stringify(stats)}`);

    return new Response(JSON.stringify({ dry_run, stats, details, success: true }), {
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
