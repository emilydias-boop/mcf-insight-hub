import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PIPELINE_INSIDE_SALES_ORIGIN = 'PIPELINE INSIDE SALES';
const A010_PRODUCT_NAME = 'A010 - Construa para Vender sem Dinheiro';
const A010_PRODUCT_CODE = '1475bb20-12e7-11ef-9e36-f58d9f9c7ab9';

type Source = 'hubla' | 'kiwify';

interface Row {
  source: Source;
  external_id?: string | null; // optional vendor id; else derived from email
  name: string;
  email: string;
  phone: string | null;
  document?: string | null;
  value?: number;
  product?: string | null;
  sale_date?: string | null; // ISO; default 2026-06-16 12:00 BRT
}

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  let clean = String(phone).replace(/\D/g, '');
  if (!clean) return null;
  if (clean.startsWith('0')) clean = clean.substring(1);
  if (!clean.startsWith('55') && clean.length <= 11) clean = '55' + clean;
  return '+' + clean;
}

async function sha8(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).slice(0, 4).map((b) => b.toString(16).padStart(2, '0')).join('');
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

async function upsertHublaTransactionMirror(
  supabase: any,
  row: Row,
  hublaId: string,
  dealId: string | undefined,
  saleDate: string,
  email: string | null,
  phone: string | null,
): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from('hubla_transactions')
      .select('id, linked_deal_id')
      .eq('hubla_id', hublaId)
      .maybeSingle();
    if (existing) {
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
      event_type: `${row.source}.sheet_backfill`,
      product_name: A010_PRODUCT_NAME,
      product_code: A010_PRODUCT_CODE,
      product_category: 'a010',
      product_price: row.value || 0,
      net_value: row.value || 0,
      customer_name: row.name || null,
      customer_email: email,
      customer_phone: phone,
      sale_date: saleDate,
      sale_status: 'completed',
      installment_number: 1,
      total_installments: 1,
      source: row.source,
      raw_data: { sheet_backfill: true, source: row.source, document: row.document || null },
      linked_deal_id: dealId || null,
      linked_at: dealId ? new Date().toISOString() : null,
      linked_method: dealId ? 'manual' : null,
    });
  } catch (e) {
    console.error('[sheet-backfill] erro mirror hubla_transactions:', e);
  }
}

async function processRow(supabase: any, row: Row, dryRun: boolean) {
  const email = (row.email || '').toLowerCase().trim() || null;
  const phone = normalizePhone(row.phone);
  if (!email && !phone) return { status: 'skipped_no_identity', email: row.email };

  const idSeed = row.external_id || email || phone || `${row.name}-${Date.now()}`;
  const hublaId = `sheet-backfill-${row.source}-${await sha8(idSeed)}`;
  const saleDate = row.sale_date || '2026-06-16T15:00:00.000Z'; // 12:00 BRT

  // Partner guard
  const partnerCheck = await checkIfPartner(supabase, email);
  if (partnerCheck.isPartner) {
    if (!dryRun) {
      await supabase.from('partner_returns').insert({
        contact_email: email,
        contact_name: row.name,
        partner_product: partnerCheck.product,
        return_source: `${row.source}_a010_sheet_backfill`,
        return_product: row.product || A010_PRODUCT_NAME,
        return_value: row.value || 0,
        blocked: true,
      });
    }
    return { status: 'blocked_partner', email };
  }

  // Origin
  const { data: originRow } = await supabase
    .from('crm_origins')
    .select('id')
    .ilike('name', PIPELINE_INSIDE_SALES_ORIGIN)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  const originId = originRow?.id;
  if (!originId) return { status: 'error', email, reason: 'origin not found' };

  // Find existing contact (by email then phone)
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

  const sourceTag = row.source === 'kiwify' ? 'A010 Kiwify' : 'A010 Hubla';

  if (existingContact && phone && existingContact.phone !== phone && !dryRun) {
    await supabase.from('crm_contacts').update({ phone, updated_at: new Date().toISOString() }).eq('id', existingContact.id);
  }

  // Create contact if missing
  if (!contactId) {
    if (dryRun) {
      // simulate
      return { status: 'would_create', email, phone, name: row.name };
    }
    const { data: newContact, error } = await supabase
      .from('crm_contacts')
      .insert({
        clint_id: `sheet-bf-${row.source}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        name: row.name || 'Cliente A010',
        email,
        phone,
        origin_id: originId,
        tags: ['A010', sourceTag],
        custom_fields: { source: row.source, product: row.product || A010_PRODUCT_NAME, sheet_backfill: true, document: row.document || null },
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

  if (existingDeal) {
    if (dryRun) return { status: 'exists', email, deal_id: existingDeal.id };
    const currentTags: string[] = existingDeal.tags || [];
    const newTags = currentTags.filter((t) => !/^a010 em aberto$/i.test(t));
    if (!newTags.includes('A010')) newTags.push('A010');
    if (!newTags.includes(sourceTag)) newTags.push(sourceTag);
    const cf = existingDeal.custom_fields || {};
    const updatedCF = {
      ...cf,
      a010_compra: true,
      a010_produto: row.product || A010_PRODUCT_NAME,
      a010_data: saleDate,
      source: cf.source || row.source,
      sheet_backfill: true,
    };
    const update: any = {
      tags: newTags,
      value: Math.max(existingDeal.value || 0, row.value || 0),
      custom_fields: updatedCF,
      updated_at: new Date().toISOString(),
    };
    // Promote A010 Em Aberto -> Novo Lead
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
    await upsertHublaTransactionMirror(supabase, row, hublaId, existingDeal.id, saleDate, email, phone);
    return { status: 'updated', email, deal_id: existingDeal.id };
  }

  if (dryRun) {
    return { status: 'would_create_deal', email, contact_id: contactId };
  }

  // Stage = Novo Lead (fallback first stage)
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
      clint_id: `sheet-bf-deal-${row.source}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      name: `${row.name || 'Cliente'} - A010`,
      value: row.value || 0,
      contact_id: contactId,
      origin_id: originId,
      stage_id: stageId,
      owner_id: ownerId,
      owner_profile_id: ownerProfileId,
      product_name: row.product || A010_PRODUCT_NAME,
      tags: ['A010', sourceTag],
      custom_fields: {
        source: row.source,
        product: row.product || A010_PRODUCT_NAME,
        a010_compra: true,
        a010_produto: row.product || A010_PRODUCT_NAME,
        a010_data: saleDate,
        sheet_backfill: true,
        document: row.document || null,
      },
      data_source: 'webhook',
      stage_moved_at: new Date().toISOString(),
      created_at: saleDate,
    })
    .select('id')
    .maybeSingle();

  if (dealErr) return { status: 'error', email, reason: dealErr.message };
  await upsertHublaTransactionMirror(supabase, row, hublaId, newDeal?.id, saleDate, email, phone);
  return { status: 'created', email, deal_id: newDeal?.id, owner_id: ownerId };
}

async function inspectRow(supabase: any, row: Row) {
  const email = (row.email || '').toLowerCase().trim() || null;
  const phone = normalizePhone(row.phone);
  if (!email && !phone) {
    return { bucket: 'no_match', match_type: 'none', planilha: row, contato_existente: null, ultimo_deal: null, risco: 'medio' as const };
  }

  // Find by email
  let contact: any = null;
  let matchType: 'email' | 'phone' | 'none' = 'none';
  if (email) {
    const { data } = await supabase
      .from('crm_contacts')
      .select('id, name, email, phone')
      .ilike('email', email)
      .eq('is_archived', false)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (data) { contact = data; matchType = 'email'; }
  }
  if (!contact && phone) {
    const digits = phone.replace(/\D/g, '');
    const { data } = await supabase
      .from('crm_contacts')
      .select('id, name, email, phone')
      .or(`phone.eq.${phone},phone.eq.+${digits},phone.eq.${digits}`)
      .limit(1)
      .maybeSingle();
    if (data) { contact = data; matchType = 'phone'; }
  }

  if (!contact) {
    return { bucket: 'no_match', match_type: 'none', planilha: row, contato_existente: null, ultimo_deal: null, risco: 'medio' as const };
  }

  // Last deal across pipelines
  const { data: lastDeal } = await supabase
    .from('crm_deals')
    .select('id, name, product_name, tags, stage_id, owner_id, owner_profile_id, created_at, origin_id, custom_fields')
    .eq('contact_id', contact.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let pipelineName: string | null = null;
  let stageName: string | null = null;
  if (lastDeal?.origin_id) {
    const { data: o } = await supabase.from('crm_origins').select('name').eq('id', lastDeal.origin_id).maybeSingle();
    pipelineName = o?.name || null;
  }
  if (lastDeal?.stage_id) {
    const { data: s } = await supabase.from('crm_stages').select('stage_name').eq('id', lastDeal.stage_id).maybeSingle();
    stageName = s?.stage_name || null;
  }

  const tags: string[] = lastDeal?.tags || [];
  const isInsideSales = pipelineName ? /pipeline inside sales/i.test(pipelineName) : false;
  const hasA010Tag = tags.some((t) => /a010/i.test(t));
  const cf = lastDeal?.custom_fields || {};
  const hasOtherSale = cf?.contrato_pago === true || /contrato pago/i.test(stageName || '') || cf?.sale_status === 'completed';

  let risco: 'baixo' | 'medio' | 'alto' = 'medio';
  if (matchType === 'email') {
    risco = 'baixo';
  } else if (isInsideSales || hasA010Tag) {
    risco = 'baixo';
  } else if (hasOtherSale) {
    risco = 'alto';
  } else {
    risco = 'medio';
  }

  const bucket = matchType === 'email' ? 'matched_by_email' : 'matched_by_phone_only';

  return {
    bucket,
    match_type: matchType,
    planilha: row,
    contato_existente: contact,
    ultimo_deal: lastDeal
      ? {
          id: lastDeal.id,
          name: lastDeal.name,
          product_name: lastDeal.product_name,
          pipeline: pipelineName,
          stage: stageName,
          owner_email: lastDeal.owner_id,
          created_at: lastDeal.created_at,
          tags,
        }
      : null,
    risco,
  };
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
    const mode: 'inspect' | 'apply' | 'dry_run' = body.mode || (body.dry_run ? 'dry_run' : 'apply');

    if (mode === 'inspect') {
      const results = [];
      for (const row of rows) {
        try { results.push(await inspectRow(supabase, row)); }
        catch (e: any) { results.push({ bucket: 'error', planilha: row, error: e?.message || String(e) }); }
      }
      const buckets = {
        matched_by_email: results.filter((r: any) => r.bucket === 'matched_by_email'),
        matched_by_phone_only: results.filter((r: any) => r.bucket === 'matched_by_phone_only'),
        no_match: results.filter((r: any) => r.bucket === 'no_match'),
        errors: results.filter((r: any) => r.bucket === 'error'),
      };
      return new Response(
        JSON.stringify({ mode, processed: rows.length, counts: { matched_by_email: buckets.matched_by_email.length, matched_by_phone_only: buckets.matched_by_phone_only.length, no_match: buckets.no_match.length, errors: buckets.errors.length }, buckets }, null, 2),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const dryRun: boolean = mode === 'dry_run';

    const results: any[] = [];
    let created = 0, updated = 0, exists = 0, blocked = 0, errors = 0, skipped = 0, would_create = 0;

    for (const row of rows) {
      try {
        const r = await processRow(supabase, row, dryRun);
        results.push(r);
        if (r.status === 'created') created++;
        else if (r.status === 'updated') updated++;
        else if (r.status === 'exists') exists++;
        else if (r.status === 'blocked_partner') blocked++;
        else if (r.status === 'error') errors++;
        else if (r.status === 'would_create' || r.status === 'would_create_deal') would_create++;
        else skipped++;
      } catch (e: any) {
        errors++;
        results.push({ status: 'error', email: row.email, reason: e?.message || String(e) });
      }
    }

    return new Response(
      JSON.stringify({ dry_run: dryRun, processed: rows.length, created, updated, exists, would_create, blocked_partners: blocked, errors, skipped, results }, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});