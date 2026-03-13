import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    console.log(`🧹 Cleanup Backfill Partners - dry_run: ${dry_run}`);

    // 1. Buscar deals com tag Backfill-Offer
    const { data: backfillDeals, error: dealsErr } = await supabase
      .from('crm_deals')
      .select('id, name, contact_id, origin_id, value, owner_id, tags')
      .contains('tags', ['Backfill-Offer']);

    if (dealsErr) throw dealsErr;
    console.log(`📊 ${backfillDeals?.length || 0} deals com tag Backfill-Offer`);

    if (!backfillDeals?.length) {
      return new Response(JSON.stringify({ dry_run, message: 'Nenhum deal encontrado', stats: { total: 0 } }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Buscar contatos desses deals
    const contactIds = [...new Set(backfillDeals.map(d => d.contact_id).filter(Boolean))];
    const contactEmails = new Map<string, { email: string; name: string }>();

    for (let i = 0; i < contactIds.length; i += 200) {
      const batch = contactIds.slice(i, i + 200);
      const { data: contacts } = await supabase
        .from('crm_contacts')
        .select('id, email, name')
        .in('id', batch);

      for (const c of contacts || []) {
        if (c.email) contactEmails.set(c.id, { email: c.email.toLowerCase().trim(), name: c.name });
      }
    }

    // 3. Buscar quais desses emails são parceiros (compraram parceria/incorporador)
    const allEmails = [...new Set(Array.from(contactEmails.values()).map(c => c.email))];
    const partnerEmails = new Set<string>();

    for (let i = 0; i < allEmails.length; i += 200) {
      const batch = allEmails.slice(i, i + 200);
      const { data: partnerTx } = await supabase
        .from('hubla_transactions')
        .select('customer_email, product_name, product_category')
        .in('customer_email', batch)
        .in('product_category', ['parceria', 'incorporador'])
        .eq('sale_status', 'completed');

      for (const tx of partnerTx || []) {
        if (tx.customer_email) partnerEmails.add(tx.customer_email.toLowerCase().trim());
      }
    }

    console.log(`🤝 ${partnerEmails.size} emails de parceiros encontrados`);

    // 4. Identificar deals de parceiros
    const partnerDeals = backfillDeals.filter(d => {
      const contact = contactEmails.get(d.contact_id);
      return contact && partnerEmails.has(contact.email);
    });

    console.log(`🎯 ${partnerDeals.length} deals de parceiros para remover`);

    const stats = {
      total_backfill: backfillDeals.length,
      partner_deals: partnerDeals.length,
      registered_in_partner_returns: 0,
      deals_deleted: 0,
      errors: 0,
    };
    const details: any[] = [];

    for (const deal of partnerDeals) {
      const contact = contactEmails.get(deal.contact_id);
      if (!contact) continue;

      if (dry_run) {
        details.push({ deal_id: deal.id, email: contact.email, name: contact.name, action: 'would_remove' });
        stats.deals_deleted++;
        continue;
      }

      try {
        // Registrar em partner_returns
        await supabase.from('partner_returns').insert({
          contact_id: deal.contact_id,
          contact_email: contact.email,
          contact_name: contact.name,
          partner_product: 'parceria/incorporador',
          return_source: 'backfill-cleanup',
          return_product: 'A010 Offer',
          return_value: deal.value || 0,
          original_deal_id: deal.id,
          blocked: true,
          notes: 'Removido do backfill: contato é parceiro existente',
        } as any);
        stats.registered_in_partner_returns++;

        // Deletar deal
        const { error: delErr } = await supabase
          .from('crm_deals')
          .delete()
          .eq('id', deal.id);

        if (delErr) throw delErr;
        stats.deals_deleted++;
        details.push({ deal_id: deal.id, email: contact.email, name: contact.name, action: 'removed' });
      } catch (err: any) {
        stats.errors++;
        details.push({ deal_id: deal.id, email: contact.email, action: 'error', error: err.message });
        console.error(`❌ ${contact.email}:`, err.message);
      }
    }

    console.log(`✅ Stats: ${JSON.stringify(stats)}`);

    return new Response(JSON.stringify({ dry_run, stats, details }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('❌', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
