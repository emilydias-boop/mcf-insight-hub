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

function getPhoneSuffix(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 9) return null;
  return digits.slice(-9);
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

    const { dry_run = true, days_back = 7, limit = 100, offset = 0 } = await req.json().catch(() => ({ dry_run: true, days_back: 7, limit: 100, offset: 0 }));
    console.log(`🚀 Backfill A010 Missing Deals - dry_run: ${dry_run}, days_back: ${days_back}, limit: ${limit}, offset: ${offset}`);

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

    // 5. Buscar contatos existentes POR EMAIL
    const contactByEmail = new Map<string, string>(); // email -> contact_id
    for (let i = 0; i < emails.length; i += 200) {
      const batch = emails.slice(i, i + 200);
      const { data: contacts } = await supabase
        .from('crm_contacts').select('id, email').in('email', batch);
      for (const c of contacts || []) {
        if (c.email) contactByEmail.set(c.email.toLowerCase().trim(), c.id);
      }
    }

    // 5.5 Buscar contatos por TELEFONE (sufixo 9 dígitos) para quem não tem contato por email
    const phoneSuffixToEmail = new Map<string, string>(); // phone_suffix -> email do buyer
    const emailsWithoutContact = emails.filter(e => !contactByEmail.has(e));
    for (const email of emailsWithoutContact) {
      const buyer = uniqueBuyers.get(email);
      const suffix = getPhoneSuffix(buyer?.customer_phone);
      if (suffix) {
        phoneSuffixToEmail.set(suffix, email);
      }
    }

    // Batch phone lookup
    if (phoneSuffixToEmail.size > 0) {
      const phoneSuffixes = Array.from(phoneSuffixToEmail.keys());
      for (let i = 0; i < phoneSuffixes.length; i += 50) {
        const batch = phoneSuffixes.slice(i, i + 50);
        for (const suffix of batch) {
          const { data: phoneContacts } = await supabase
            .from('crm_contacts')
            .select('id, email, phone')
            .ilike('phone', `%${suffix}`)
            .limit(5);

          if (phoneContacts && phoneContacts.length > 0) {
            const buyerEmail = phoneSuffixToEmail.get(suffix)!;
            // Use first contact found by phone
            contactByEmail.set(buyerEmail, phoneContacts[0].id);
            console.log(`📱 ${buyerEmail} encontrado por telefone (${suffix}) → contato ${phoneContacts[0].id}`);
          }
        }
      }
    }

    // 6. Buscar deals existentes NO PIS - por contact_id
    const contactIds = Array.from(new Set(contactByEmail.values()));
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

    // 6.1 Buscar deals existentes NO PIS - por EMAIL do contato (cobre contatos duplicados)
    const emailsNeedingCheck = emails.filter(e => {
      const cid = contactByEmail.get(e);
      return !cid || !existingDealContactIds.has(cid);
    });

    for (let i = 0; i < emailsNeedingCheck.length; i += 100) {
      const batch = emailsNeedingCheck.slice(i, i + 100);
      // Check if any contact with this email has a deal in PIS
      const { data: dealsViaEmail } = await supabase
        .from('crm_deals')
        .select('id, contact_id, crm_contacts!inner(email)')
        .eq('origin_id', originId)
        .in('crm_contacts.email', batch);

      for (const d of dealsViaEmail || []) {
        const contactEmail = (d as any).crm_contacts?.email?.toLowerCase().trim();
        if (contactEmail) {
          // Mark this email as already having a deal
          if (!contactByEmail.has(contactEmail)) {
            contactByEmail.set(contactEmail, d.contact_id);
          }
          existingDealContactIds.add(d.contact_id);
        }
      }
    }

    console.log(`✅ ${contactByEmail.size} contatos existentes, ${existingDealContactIds.size} já com deal`);

    // 6.5 Filtrar emails que precisam de deal
    const emailsNeedingDeal: string[] = [];
    for (const [email] of uniqueBuyers) {
      const existingContactId = contactByEmail.get(email);
      if (existingContactId && existingDealContactIds.has(existingContactId)) continue;
      emailsNeedingDeal.push(email);
    }
    console.log(`🔍 ${emailsNeedingDeal.length} emails precisam de deal (sem deal no PIS)`);

    // 6.6 Batch partner check
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

    // 7. Aplicar limit/offset e processar
    const paginatedEmails = emailsNeedingDeal.filter(e => !partnerEmails.has(e));
    const sliced = paginatedEmails.slice(offset, offset + limit);
    console.log(`📋 Processando ${sliced.length} de ${paginatedEmails.length} (offset: ${offset}, limit: ${limit})`);

    const stats = {
      total: emails.length,
      total_needing_deal: paginatedEmails.length,
      processing: sliced.length,
      already_has_deal: 0,
      skipped_partners: partnerEmails.size,
      skipped_phone_match: 0,
      contacts_created: 0,
      deals_created: 0,
      errors: 0,
      next_offset: offset + limit < paginatedEmails.length ? offset + limit : null,
    };
    const details: any[] = [];

    for (const email of sliced) {
      const buyer = uniqueBuyers.get(email);
      const existingContactId = contactByEmail.get(email);

      // Skip se já tem deal (by contact_id or by email cross-check)
      if (existingContactId && existingDealContactIds.has(existingContactId)) {
        stats.already_has_deal++;
        continue;
      }

      // Partner check
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
          // Double-check: buscar por email (case insensitive)
          const { data: doubleCheck } = await supabase
            .from('crm_contacts').select('id').ilike('email', email).limit(1).maybeSingle();

          if (doubleCheck) {
            contactId = doubleCheck.id;

            // Verify this contact doesn't already have a PIS deal
            const { data: existingDeal } = await supabase
              .from('crm_deals').select('id')
              .eq('origin_id', originId).eq('contact_id', doubleCheck.id).limit(1).maybeSingle();

            if (existingDeal) {
              stats.already_has_deal++;
              details.push({ email, name: buyer.customer_name, action: 'already_has_deal_doublecheck' });
              continue;
            }
          } else {
            // Also check by phone before creating
            const phoneSuffix = getPhoneSuffix(buyer.customer_phone);
            if (phoneSuffix) {
              const { data: phoneMatch } = await supabase
                .from('crm_contacts').select('id')
                .ilike('phone', `%${phoneSuffix}`).limit(1).maybeSingle();

              if (phoneMatch) {
                // Check if this phone-matched contact has PIS deal
                const { data: phoneDeal } = await supabase
                  .from('crm_deals').select('id')
                  .eq('origin_id', originId).eq('contact_id', phoneMatch.id).limit(1).maybeSingle();

                if (phoneDeal) {
                  stats.skipped_phone_match++;
                  details.push({ email, name: buyer.customer_name, action: 'skipped_phone_match', matched_contact: phoneMatch.id });
                  continue;
                }
                contactId = phoneMatch.id;
              }
            }

            if (!contactId) {
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
        } else {
          // Contact exists by email - final check: does it have a PIS deal?
          const { data: finalCheck } = await supabase
            .from('crm_deals').select('id')
            .eq('origin_id', originId).eq('contact_id', contactId).limit(1).maybeSingle();

          if (finalCheck) {
            stats.already_has_deal++;
            details.push({ email, name: buyer.customer_name, action: 'already_has_deal_final' });
            continue;
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
