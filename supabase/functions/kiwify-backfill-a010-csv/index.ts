import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PIPELINE_INSIDE_SALES_ORIGIN = 'PIPELINE INSIDE SALES';

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  let clean = phone.replace(/\D/g, '');
  if (clean.startsWith('0')) clean = clean.substring(1);
  if (!clean.startsWith('55') && clean.length <= 11) clean = '55' + clean;
  return '+' + clean;
}

async function checkIfPartner(supabase: any, email: string | null) {
  if (!email) return { isPartner: false, product: null as string | null };
  const PARTNER_PRODUCTS = ['A001', 'A002', 'A003', 'A004', 'A009'];
  const { data: transactions } = await supabase
    .from('hubla_transactions')
    .select('product_name')
    .ilike('customer_email', email)
    .eq('sale_status', 'completed')
    .limit(50);
  if (!transactions?.length) return { isPartner: false, product: null };
  for (const tx of transactions) {
    const name = (tx.product_name || '').toUpperCase();
    for (const code of PARTNER_PRODUCTS) {
      if (name.includes(code)) return { isPartner: true, product: code };
    }
    if (name.includes('INCORPORADOR') && !name.includes('CONTRATO') && !name.includes('A010')) {
      return { isPartner: true, product: 'MCF Incorporador' };
    }
    if (name.includes('ANTICRISE') && !name.includes('CONTRATO')) {
      return { isPartner: true, product: 'Anticrise' };
    }
  }
  return { isPartner: false, product: null };
}

interface Row {
  kiwify_id: string;
  product: string;
  name: string;
  email: string;
  phone: string;
  value: number;
  created_at: string;
}

function parseKiwifyDate(s: string): string {
  // "16/06/2026 13:55:11" (BRT)
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return new Date().toISOString();
  const [, d, mo, y, hh, mm, ss] = m;
  return new Date(`${y}-${mo}-${d}T${hh}:${mm}:${ss}-03:00`).toISOString();
}

async function processRow(supabase: any, row: Row) {
  const email = row.email?.toLowerCase().trim();
  const phone = normalizePhone(row.phone);
  if (!email && !phone) return { status: 'skipped_no_identity', email: row.email };

  // Partner block
  const partnerCheck = await checkIfPartner(supabase, email);
  if (partnerCheck.isPartner) {
    await supabase.from('partner_returns').insert({
      contact_email: email,
      contact_name: row.name,
      partner_product: partnerCheck.product,
      return_source: 'kiwify_a010_backfill',
      return_product: row.product,
      return_value: row.value || 0,
      blocked: true,
    });
    return { status: 'blocked_partner', email };
  }

  // Resolve origin
  const { data: originRow } = await supabase
    .from('crm_origins')
    .select('id')
    .ilike('name', PIPELINE_INSIDE_SALES_ORIGIN)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  const originId = originRow?.id;
  if (!originId) return { status: 'error', email, reason: 'origin not found' };

  // Find contact by email
  let contactId: string | null = null;
  let existingContact: any = null;
  if (email) {
    const { data: allByEmail } = await supabase
      .from('crm_contacts')
      .select('id, phone')
      .ilike('email', email)
      .eq('is_archived', false)
      .order('created_at', { ascending: true })
      .limit(20);
    if (allByEmail && allByEmail.length > 0) {
      for (const c of allByEmail) {
        const { data: d } = await supabase
          .from('crm_deals')
          .select('id')
          .eq('contact_id', c.id)
          .eq('origin_id', originId)
          .limit(1)
          .maybeSingle();
        if (d) { contactId = c.id; existingContact = c; break; }
      }
      if (!contactId) { contactId = allByEmail[0].id; existingContact = allByEmail[0]; }
    }
  }
  if (!contactId && phone) {
    const digits = phone.replace(/\D/g, '');
    const { data: byPhone } = await supabase
      .from('crm_contacts')
      .select('id, phone')
      .or(`phone.eq.${phone},phone.eq.+${digits},phone.eq.${digits}`)
      .limit(1)
      .maybeSingle();
    if (byPhone) { contactId = byPhone.id; existingContact = byPhone; }
  }

  if (existingContact && phone && existingContact.phone !== phone) {
    await supabase.from('crm_contacts').update({ phone, updated_at: new Date().toISOString() }).eq('id', existingContact.id);
  }

  // Create contact if needed
  if (!contactId) {
    const { data: newContact, error } = await supabase
      .from('crm_contacts')
      .insert({
        clint_id: `kiwify-bf-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        name: row.name || 'Cliente A010',
        email,
        phone,
        origin_id: originId,
        tags: ['A010', 'A010 Kiwify'],
        custom_fields: { source: 'kiwify', product: row.product, kiwify_order_id: row.kiwify_id },
      })
      .select('id')
      .single();
    if (error) return { status: 'error', email, reason: error.message };
    contactId = newContact.id;
  }

  // Existing deal?
  const { data: existingDeal } = await supabase
    .from('crm_deals')
    .select('id, tags, value, custom_fields, stage_id')
    .eq('contact_id', contactId)
    .eq('origin_id', originId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const compraDate = parseKiwifyDate(row.created_at);

  if (existingDeal) {
    const currentTags: string[] = existingDeal.tags || [];
    const newTags = currentTags.filter((t) => !/^a010 em aberto$/i.test(t));
    if (!newTags.includes('A010')) newTags.push('A010');
    if (!newTags.includes('A010 Kiwify')) newTags.push('A010 Kiwify');
    const cf = existingDeal.custom_fields || {};
    const updatedCF = {
      ...cf,
      a010_compra: true,
      a010_produto: row.product,
      a010_data: compraDate,
      source: cf.source || 'kiwify',
      kiwify_order_id: row.kiwify_id,
    };
    const update: any = {
      tags: newTags,
      value: Math.max(existingDeal.value || 0, row.value || 0),
      custom_fields: updatedCF,
      updated_at: new Date().toISOString(),
    };
    // Promote A010 Em Aberto → Novo Lead
    if (existingDeal.stage_id) {
      const { data: stage } = await supabase
        .from('crm_stages')
        .select('stage_name')
        .eq('id', existingDeal.stage_id)
        .maybeSingle();
      if (stage && /a010 em aberto/i.test(stage.stage_name || '')) {
        const { data: novoLead } = await supabase
          .from('crm_stages')
          .select('id')
          .eq('origin_id', originId)
          .eq('stage_name', 'Novo Lead')
          .maybeSingle();
        if (novoLead) {
          update.stage_id = novoLead.id;
          update.stage_moved_at = new Date().toISOString();
        }
      }
    }
    await supabase.from('crm_deals').update(update).eq('id', existingDeal.id);
    await upsertHublaTransactionMirror(supabase, row, existingDeal.id, compraDate, email, phone);
    return { status: 'updated', email, deal_id: existingDeal.id };
  }

  // Create deal
  const { data: stage } = await supabase
    .from('crm_stages')
    .select('id')
    .eq('origin_id', originId)
    .eq('stage_name', 'Novo Lead')
    .maybeSingle();
  let stageId = stage?.id;
  if (!stageId) {
    const { data: fb } = await supabase
      .from('crm_stages')
      .select('id')
      .eq('origin_id', originId)
      .order('stage_order', { ascending: true })
      .limit(1)
      .maybeSingle();
    stageId = fb?.id;
  }

  // Distribute
  let ownerId: string | null = null;
  let ownerProfileId: string | null = null;
  try {
    const { data: cfg } = await supabase
      .from('lead_distribution_config')
      .select('id')
      .eq('origin_id', originId)
      .eq('is_active', true)
      .limit(1);
    if (cfg && cfg.length > 0) {
      const { data: nextOwner } = await supabase.rpc('get_next_lead_owner', { p_origin_id: originId });
      if (nextOwner) {
        ownerId = nextOwner;
        const { data: p } = await supabase.from('profiles').select('id').ilike('email', ownerId).maybeSingle();
        if (p) ownerProfileId = p.id;
      }
    }
  } catch (_) {}

  if (!ownerId) {
    const { data: dwo } = await supabase
      .from('crm_deals')
      .select('owner_id, owner_profile_id')
      .eq('contact_id', contactId)
      .not('owner_id', 'is', null)
      .limit(1)
      .maybeSingle();
    if (dwo?.owner_id) {
      ownerId = dwo.owner_id;
      ownerProfileId = dwo.owner_profile_id;
    }
  }

  const { data: newDeal, error: dealErr } = await supabase
    .from('crm_deals')
    .insert({
      clint_id: `kiwify-bf-deal-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      name: `${row.name || 'Cliente'} - A010`,
      value: row.value || 0,
      contact_id: contactId,
      origin_id: originId,
      stage_id: stageId,
      owner_id: ownerId,
      owner_profile_id: ownerProfileId,
      product_name: row.product,
      tags: ['A010', 'A010 Kiwify'],
      custom_fields: {
        source: 'kiwify',
        product: row.product,
        a010_compra: true,
        a010_produto: row.product,
        a010_data: compraDate,
        kiwify_order_id: row.kiwify_id,
        backfill: true,
      },
      data_source: 'webhook',
      stage_moved_at: new Date().toISOString(),
    })
    .select('id')
    .maybeSingle();

  if (dealErr) return { status: 'error', email, reason: dealErr.message };
  await upsertHublaTransactionMirror(supabase, row, newDeal?.id, compraDate, email, phone);
  return { status: 'created', email, deal_id: newDeal?.id };
}

/**
 * Espelha a venda em hubla_transactions com linked_deal_id, garantindo que
 * o RPC get_all_hubla_transactions (relatório de Aquisição/Origem) consiga
 * contar essas vendas de backfill.
 * - hubla_id segue convenção do kiwify-webhook-handler: "kiwify_<order_id>"
 * - product_name é canonicalizado para casar com product_configurations
 */
async function upsertHublaTransactionMirror(
  supabase: any,
  row: Row,
  dealId: string | undefined,
  saleDate: string,
  email: string | null,
  phone: string | null,
): Promise<void> {
  if (!row.kiwify_id) return;
  const hublaId = `kiwify_${row.kiwify_id}`;

  // Canonicaliza nome de produto A010 para o nome do product_configurations
  const isA010 = /a010/i.test(row.product || '');
  const productName = isA010 ? 'A010 - Construa para Vender sem Dinheiro' : row.product;

  try {
    const { data: existing } = await supabase
      .from('hubla_transactions')
      .select('id, linked_deal_id')
      .eq('hubla_id', hublaId)
      .maybeSingle();

    if (existing) {
      // Só atualiza linked_deal_id se ainda não tem
      if (!existing.linked_deal_id && dealId) {
        await supabase
          .from('hubla_transactions')
          .update({ linked_deal_id: dealId, linked_at: new Date().toISOString(), linked_method: 'manual' })
          .eq('id', existing.id);
      }
      return;
    }

    await supabase.from('hubla_transactions').insert({
      hubla_id: hublaId,
      event_type: 'kiwify.backfill_csv',
      product_name: productName,
      product_code: isA010 ? '1475bb20-12e7-11ef-9e36-f58d9f9c7ab9' : (row.product || ''),
      product_category: isA010 ? 'a010' : null,
      product_price: row.value || 0,
      net_value: row.value || 0,
      customer_name: row.name || null,
      customer_email: email,
      customer_phone: phone,
      sale_date: saleDate,
      sale_status: 'completed',
      installment_number: 1,
      total_installments: 1,
      source: 'kiwify',
      raw_data: { backfill: true, csv_row: row },
      linked_deal_id: dealId || null,
      linked_at: dealId ? new Date().toISOString() : null,
      linked_method: dealId ? 'manual' : null,
    });
  } catch (e) {
    console.error('[backfill] Erro ao espelhar em hubla_transactions:', e);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const body = await req.json();
    const rows: Row[] = body.rows || [];
    const results: any[] = [];
    let created = 0, updated = 0, blocked = 0, errors = 0, skipped = 0;

    for (const row of rows) {
      try {
        const r = await processRow(supabase, row);
        results.push(r);
        if (r.status === 'created') created++;
        else if (r.status === 'updated') updated++;
        else if (r.status === 'blocked_partner') blocked++;
        else if (r.status === 'error') errors++;
        else skipped++;
      } catch (e: any) {
        errors++;
        results.push({ status: 'error', email: row.email, reason: e?.message || String(e) });
      }
    }

    return new Response(
      JSON.stringify({ processed: rows.length, created, updated, blocked_partners: blocked, errors, skipped, results }, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});