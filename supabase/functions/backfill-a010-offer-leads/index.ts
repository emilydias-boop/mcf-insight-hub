import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PIPELINE_INSIDE_SALES_ORIGIN = 'PIPELINE INSIDE SALES';

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return null;
  if (digits.startsWith('55') && digits.length >= 12) return `+${digits}`;
  if (digits.length === 11 || digits.length === 10) return `+55${digits}`;
  return digits;
}

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
    console.log(`🚀 Backfill A010 Offer Leads - dry_run: ${dry_run}`);

    // 1. Buscar origin PIPELINE INSIDE SALES
    const { data: originData } = await supabase
      .from('crm_origins')
      .select('id')
      .ilike('name', PIPELINE_INSIDE_SALES_ORIGIN)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!originData) {
      throw new Error('Origin PIPELINE INSIDE SALES não encontrada');
    }
    const originId = originData.id;
    console.log(`📌 Origin ID: ${originId}`);

    // 2. Buscar stage "Novo Lead" do pipeline
    const { data: stageData } = await supabase
      .from('crm_stages')
      .select('id')
      .eq('origin_id', originId)
      .ilike('name', '%Novo Lead%')
      .limit(1)
      .maybeSingle();

    const stageId = stageData?.id || null;
    console.log(`📌 Stage Novo Lead ID: ${stageId}`);

    // 3. Buscar transações A010 que são offers
    const allTransactions: any[] = [];
    let page = 0;
    const pageSize = 1000;
    while (true) {
      const { data: batch, error } = await supabase
        .from('hubla_transactions')
        .select('customer_email, customer_name, customer_phone, sale_date, net_value, product_name')
        .eq('product_category', 'a010')
        .like('hubla_id', '%-offer-%')
        .not('customer_email', 'is', null)
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) throw error;
      if (!batch || batch.length === 0) break;
      allTransactions.push(...batch);
      if (batch.length < pageSize) break;
      page++;
    }

    console.log(`📊 ${allTransactions.length} transações A010 offer encontradas`);

    // 4. Deduplicar por email
    const uniqueBuyers = new Map<string, {
      name: string; phone: string | null; sale_date: string; net_value: number; product_name: string;
    }>();
    for (const t of allTransactions) {
      const email = t.customer_email?.toLowerCase().trim();
      if (email && !uniqueBuyers.has(email)) {
        uniqueBuyers.set(email, {
          name: t.customer_name,
          phone: t.customer_phone,
          sale_date: t.sale_date,
          net_value: t.net_value || 0,
          product_name: t.product_name || 'A010',
        });
      }
    }

    const emails = Array.from(uniqueBuyers.keys());
    console.log(`👥 ${emails.length} compradores únicos`);

    // 5. Batch lookup: crm_contacts por email (batches de 200)
    const contactByEmail = new Map<string, string>();
    for (let i = 0; i < emails.length; i += 200) {
      const batch = emails.slice(i, i + 200);
      const { data: contacts } = await supabase
        .from('crm_contacts')
        .select('id, email')
        .in('email', batch);

      for (const c of contacts || []) {
        if (c.email) contactByEmail.set(c.email.toLowerCase().trim(), c.id);
      }
    }
    console.log(`✅ ${contactByEmail.size} contatos já existentes`);

    // 6. Batch lookup: crm_deals por contact_id + origin_id
    const contactIds = Array.from(contactByEmail.values());
    const existingDealContactIds = new Set<string>();
    for (let i = 0; i < contactIds.length; i += 200) {
      const batch = contactIds.slice(i, i + 200);
      const { data: deals } = await supabase
        .from('crm_deals')
        .select('contact_id')
        .eq('origin_id', originId)
        .in('contact_id', batch);

      for (const d of deals || []) {
        if (d.contact_id) existingDealContactIds.add(d.contact_id);
      }
    }
    console.log(`✅ ${existingDealContactIds.size} contatos já com deal no pipeline`);

    // 7. Processar
    const stats = {
      total: emails.length,
      already_has_deal: 0,
      contacts_created: 0,
      deals_created: 0,
      a010_sales_upserted: 0,
      skipped: 0,
      errors: 0,
    };
    const details: any[] = [];

    for (const [email, buyer] of uniqueBuyers) {
      const existingContactId = contactByEmail.get(email);

      // Se já tem deal nesse pipeline, pular
      if (existingContactId && existingDealContactIds.has(existingContactId)) {
        stats.already_has_deal++;
        details.push({ email, name: buyer.name, action: 'already_has_deal' });
        continue;
      }

      if (dry_run) {
        stats.deals_created++;
        if (!existingContactId) stats.contacts_created++;
        details.push({
          email, name: buyer.name,
          action: 'would_create',
          has_contact: !!existingContactId,
        });
        continue;
      }

      try {
        let contactId = existingContactId;
        const normalizedPhone = normalizePhone(buyer.phone);

        // Criar contato se necessário
        if (!contactId) {
          // Double-check por email antes de inserir
          const { data: doubleCheck } = await supabase
            .from('crm_contacts')
            .select('id')
            .ilike('email', email)
            .limit(1)
            .maybeSingle();

          if (doubleCheck) {
            contactId = doubleCheck.id;
          } else {
            const { data: nc, error: ce } = await supabase
              .from('crm_contacts')
              .insert({
                clint_id: `hubla-bf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                name: buyer.name || 'Cliente A010',
                email,
                phone: normalizedPhone,
                origin_id: originId,
                tags: ['A010', 'Hubla', 'Backfill-Offer'],
                custom_fields: { source: 'hubla', product: buyer.product_name },
              })
              .select('id')
              .single();
            if (ce) throw ce;
            contactId = nc.id;
            stats.contacts_created++;
          }
        }

        // Criar deal
        const { error: de } = await supabase
          .from('crm_deals')
          .insert({
            clint_id: `hubla-bf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: `${buyer.name || 'Cliente'} - A010`,
            contact_id: contactId,
            origin_id: originId,
            stage_id: stageId,
            value: buyer.net_value,
            tags: ['A010', 'Hubla', 'Backfill-Offer'],
            custom_fields: { source: 'hubla', product: buyer.product_name, sale_date: buyer.sale_date },
            data_source: 'webhook',
          });
        if (de) throw de;
        stats.deals_created++;

        // Upsert a010_sales
        await supabase.from('a010_sales').upsert({
          customer_name: buyer.name || 'Cliente Desconhecido',
          customer_email: email,
          customer_phone: buyer.phone,
          net_value: buyer.net_value,
          sale_date: buyer.sale_date,
          status: 'completed',
        }, { onConflict: 'customer_email,sale_date', ignoreDuplicates: true });
        stats.a010_sales_upserted++;

        details.push({ email, name: buyer.name, action: 'created', contact_id: contactId });
      } catch (err: any) {
        stats.errors++;
        details.push({ email, name: buyer.name, action: 'error', error: err.message });
        console.error(`❌ ${email}:`, err.message);
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
