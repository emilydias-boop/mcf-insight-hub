import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PARTNER_PATTERNS = ['A001', 'A002', 'A003', 'A004', 'A009', 'INCORPORADOR', 'ANTICRISE'];
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

    const { dry_run = true, days_back = 7 } = await req.json().catch(() => ({ dry_run: true, days_back: 7 }));
    console.log(`🚀 Backfill A010 Missing Deals - dry_run: ${dry_run}, days_back: ${days_back}`);

    // 1. Buscar origin
    const { data: originData } = await supabase
      .from('crm_origins').select('id')
      .ilike('name', PIPELINE_INSIDE_SALES_ORIGIN)
      .order('created_at', { ascending: true }).limit(1).maybeSingle();

    if (!originData) throw new Error('Origin PIPELINE INSIDE SALES não encontrada');
    const originId = originData.id;

    // 2. Buscar stage "Novo Lead"
    const { data: stageData } = await supabase
      .from('crm_stages').select('id')
      .eq('origin_id', originId).ilike('stage_name', '%Novo Lead%').limit(1).maybeSingle();
    const stageId = stageData?.id || null;

    // 3. Buscar transações A010 recentes
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days_back);

    const allTransactions: any[] = [];
    let page = 0;
    const pageSize = 1000;
    while (true) {
      const { data: batch, error } = await supabase
        .from('hubla_transactions')
        .select('id, customer_email, customer_name, customer_phone, sale_date, net_value, product_name, source, hubla_id')
        .eq('product_category', 'a010')
        .eq('sale_status', 'completed')
        .gte('sale_date', sinceDate.toISOString())
        .not('customer_email', 'is', null)
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) throw error;
      if (!batch || batch.length === 0) break;
      allTransactions.push(...batch);
      if (batch.length < pageSize) break;
      page++;
    }

    console.log(`📊 ${allTransactions.length} transações A010 nos últimos ${days_back} dias`);

    // 4. Deduplicar por email
    const uniqueBuyers = new Map<string, any>();
    for (const t of allTransactions) {
      const email = t.customer_email?.toLowerCase().trim();
      if (email && !uniqueBuyers.has(email)) {
        uniqueBuyers.set(email, t);
      }
    }

    const emails = Array.from(uniqueBuyers.keys());
    console.log(`👥 ${emails.length} compradores únicos`);

    // 5. Buscar contatos existentes
    const contactByEmail = new Map<string, string>();
    for (let i = 0; i < emails.length; i += 200) {
      const batch = emails.slice(i, i + 200);
      const { data: contacts } = await supabase
        .from('crm_contacts').select('id, email').in('email', batch);
      for (const c of contacts || []) {
        if (c.email) contactByEmail.set(c.email.toLowerCase().trim(), c.id);
      }
    }

    // 6. Buscar deals existentes
    const contactIds = Array.from(contactByEmail.values());
    const existingDealContactIds = new Set<string>();
    for (let i = 0; i < contactIds.length; i += 200) {
      const batch = contactIds.slice(i, i + 200);
      const { data: deals } = await supabase
        .from('crm_deals').select('contact_id')
        .eq('origin_id', originId).in('contact_id', batch);
      for (const d of deals || []) {
        if (d.contact_id) existingDealContactIds.add(d.contact_id);
      }
    }

    console.log(`✅ ${contactByEmail.size} contatos existentes, ${existingDealContactIds.size} já com deal`);

    // 6.5 Filtrar emails que precisam de deal (excluir quem já tem)
    const emailsNeedingDeal: string[] = [];
    for (const [email] of uniqueBuyers) {
      const existingContactId = contactByEmail.get(email);
      if (existingContactId && existingDealContactIds.has(existingContactId)) continue;
      emailsNeedingDeal.push(email);
    }
    console.log(`🔍 ${emailsNeedingDeal.length} emails precisam de deal (sem deal no PIS)`);

    // 6.6 Batch partner check - buscar todas transações dos candidatos
    const partnerEmails = new Set<string>();
    for (let i = 0; i < emailsNeedingDeal.length; i += 200) {
      const batch = emailsNeedingDeal.slice(i, i + 200);
      const { data: txs } = await supabase
        .from('hubla_transactions')
        .select('customer_email, product_name')
        .in('customer_email', batch)
        .eq('sale_status', 'completed');

      for (const tx of txs || []) {
        if (!tx.product_name || !tx.customer_email) continue;
        const upper = tx.product_name.toUpperCase();
        if (PARTNER_PATTERNS.some(p => upper.includes(p))) {
          partnerEmails.add(tx.customer_email.toLowerCase().trim());
        }
      }
    }
    console.log(`🤝 ${partnerEmails.size} parceiros identificados`);

    // 7. Processar
    const stats = {
      total: emails.length,
      already_has_deal: 0,
      skipped_partners: 0,
      contacts_created: 0,
      deals_created: 0,
      errors: 0,
    };
    const details: any[] = [];

    for (const [email, buyer] of uniqueBuyers) {
      const existingContactId = contactByEmail.get(email);

      // Skip se já tem deal
      if (existingContactId && existingDealContactIds.has(existingContactId)) {
        stats.already_has_deal++;
        continue;
      }

      // Partner check (já calculado em batch)
      if (partnerEmails.has(email)) {
        stats.skipped_partners++;
        details.push({ email, name: buyer.customer_name, action: 'skipped_partner' });
        continue;
      }

      if (dry_run) {
        stats.deals_created++;
        if (!existingContactId) stats.contacts_created++;
        details.push({ email, name: buyer.customer_name, action: 'would_create', has_contact: !!existingContactId, source: buyer.source });
        continue;
      }

      try {
        let contactId = existingContactId;

        if (!contactId) {
          const { data: doubleCheck } = await supabase
            .from('crm_contacts').select('id').ilike('email', email).limit(1).maybeSingle();

          if (doubleCheck) {
            contactId = doubleCheck.id;
          } else {
            const { data: nc, error: ce } = await supabase
              .from('crm_contacts')
              .insert({
                clint_id: `bf-a010-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                name: buyer.customer_name || 'Cliente A010',
                email,
                phone: normalizePhone(buyer.customer_phone),
                origin_id: originId,
                tags: ['A010', 'Backfill'],
                custom_fields: { source: buyer.source || 'backfill', product: 'A010 - MCF Fundamentos' },
              })
              .select('id').single();
            if (ce) throw ce;
            contactId = nc.id;
            stats.contacts_created++;
          }
        }

        // Distribuir
        let ownerEmail: string | null = null;
        let ownerProfileId: string | null = null;
        const { data: nextOwner } = await supabase.rpc('get_next_lead_owner', { p_origin_id: originId });
        if (nextOwner) {
          ownerEmail = nextOwner;
          const { data: profile } = await supabase
            .from('profiles').select('id').ilike('email', nextOwner).limit(1).maybeSingle();
          ownerProfileId = profile?.id || null;
        }

        // Criar deal
        const { data: newDeal, error: de } = await supabase
          .from('crm_deals')
          .insert({
            clint_id: `bf-a010-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: `${buyer.customer_name || 'Cliente'} - A010`,
            contact_id: contactId,
            origin_id: originId,
            stage_id: stageId,
            value: buyer.net_value || 0,
            owner_id: ownerEmail,
            owner_profile_id: ownerProfileId,
            tags: ['A010', 'Backfill'],
            custom_fields: { source: buyer.source || 'backfill', product: 'A010', sale_date: buyer.sale_date, distributed: !!ownerEmail, deal_user_original: ownerEmail },
            data_source: 'webhook',
          })
          .select('id').single();
        if (de) throw de;
        stats.deals_created++;

        if (newDeal?.id && ownerEmail) {
          await supabase.from('deal_activities').insert({
            deal_id: newDeal.id,
            activity_type: 'owner_change',
            description: `Backfill A010: Lead distribuído para ${ownerEmail}`,
            metadata: { owner_email: ownerEmail, source: 'backfill-a010-missing-deals', distributed: true },
          });
        }

        // Upsert a010_sales
        await supabase.from('a010_sales').upsert({
          customer_name: buyer.customer_name || 'Cliente',
          customer_email: email,
          customer_phone: buyer.customer_phone,
          net_value: buyer.net_value || 0,
          sale_date: buyer.sale_date,
          status: 'completed',
        }, { onConflict: 'customer_email,sale_date', ignoreDuplicates: true });

        details.push({ email, name: buyer.customer_name, action: 'created', owner: ownerEmail });
      } catch (err: any) {
        stats.errors++;
        details.push({ email, name: buyer.customer_name, action: 'error', error: err.message });
        console.error(`❌ ${email}:`, err.message);
      }
    }

    console.log(`✅ Stats:`, JSON.stringify(stats));

    return new Response(JSON.stringify({ dry_run, days_back, stats, details }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('❌', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
