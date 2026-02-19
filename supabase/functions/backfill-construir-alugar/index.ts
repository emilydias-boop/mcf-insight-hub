import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VIVER_ALUGUEL_ORIGIN_ID = '4e2b810a-6782-4ce9-9c0d-10d04c018636';
const STAGE_NOVO_LEAD = '2c69bf1d-94d5-4b6d-928d-dcf12da2d78c';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { dry_run = true } = await req.json().catch(() => ({ dry_run: true }));
    console.log(`🚀 Backfill - dry_run: ${dry_run}`);

    // 1. Buscar compradores únicos
    const { data: buyers, error: buyersError } = await supabase
      .from('hubla_transactions')
      .select('customer_email, customer_name, customer_phone, sale_date')
      .in('product_category', ['ob_construir_alugar', 'ob_construir'])
      .gte('sale_date', '2026-02-04')
      .not('customer_email', 'is', null)
      .order('sale_date', { ascending: true });

    if (buyersError) throw buyersError;

    // Deduplicar por email
    const uniqueBuyers = new Map<string, { name: string; phone: string | null; sale_date: string }>();
    for (const b of buyers || []) {
      const email = b.customer_email?.toLowerCase().trim();
      if (email && !uniqueBuyers.has(email)) {
        uniqueBuyers.set(email, { name: b.customer_name, phone: b.customer_phone, sale_date: b.sale_date });
      }
    }

    const emails = Array.from(uniqueBuyers.keys());
    console.log(`📊 ${emails.length} compradores únicos`);

    // 2. Buscar TODOS os contatos existentes por email de uma vez
    const { data: existingContacts } = await supabase
      .from('crm_contacts')
      .select('id, email')
      .in('email', emails);

    const contactByEmail = new Map<string, string>();
    for (const c of existingContacts || []) {
      if (c.email) contactByEmail.set(c.email.toLowerCase(), c.id);
    }

    // 3. Buscar deals existentes no pipeline Viver de Aluguel
    const contactIds = Array.from(contactByEmail.values());
    const existingDealContactIds = new Set<string>();
    if (contactIds.length > 0) {
      const { data: existingDeals } = await supabase
        .from('crm_deals')
        .select('contact_id')
        .eq('origin_id', VIVER_ALUGUEL_ORIGIN_ID)
        .in('contact_id', contactIds);

      for (const d of existingDeals || []) {
        if (d.contact_id) existingDealContactIds.add(d.contact_id);
      }
    }

    const stats = { total: emails.length, created: 0, skipped: 0, errors: 0, contacts_created: 0 };
    const details: any[] = [];

    for (const [email, buyer] of uniqueBuyers) {
      const existingContactId = contactByEmail.get(email);

      // Se já tem deal nesse pipeline, pular
      if (existingContactId && existingDealContactIds.has(existingContactId)) {
        stats.skipped++;
        details.push({ email, name: buyer.name, action: 'skipped' });
        continue;
      }

      if (dry_run) {
        stats.created++;
        details.push({ email, name: buyer.name, action: 'would_create', has_contact: !!existingContactId });
        continue;
      }

      try {
        let contactId = existingContactId;

        // Criar contato se necessário
        if (!contactId) {
          const { data: nc, error: ce } = await supabase
            .from('crm_contacts')
            .insert({
              clint_id: `backfill-va-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              name: buyer.name,
              email,
              phone: buyer.phone?.replace(/\D/g, '') || null,
              origin_id: VIVER_ALUGUEL_ORIGIN_ID,
              tags: ['Construir-Alugar', 'Hubla'],
            })
            .select('id')
            .single();
          if (ce) throw ce;
          contactId = nc.id;
          stats.contacts_created++;
        }

        // Criar deal
        const { error: de } = await supabase
          .from('crm_deals')
          .insert({
            clint_id: `backfill-va-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: `${buyer.name} - Construir Para Alugar`,
            contact_id: contactId,
            origin_id: VIVER_ALUGUEL_ORIGIN_ID,
            stage_id: STAGE_NOVO_LEAD,
            tags: ['Construir-Alugar', 'Hubla', 'Backfill'],
            custom_fields: { source: 'hubla', product: 'Construir para Alugar', sale_date: buyer.sale_date },
            data_source: 'webhook',
          });
        if (de) throw de;
        stats.created++;
        details.push({ email, name: buyer.name, action: 'created' });
      } catch (err: any) {
        stats.errors++;
        details.push({ email, name: buyer.name, action: 'error', error: err.message });
        console.error(`❌ ${email}:`, err.message);
      }
    }

    console.log(`✅ ${JSON.stringify(stats)}`);

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
