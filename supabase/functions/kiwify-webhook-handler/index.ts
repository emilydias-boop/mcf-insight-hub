import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-kiwify-token, x-kiwify-signature',
};

/**
 * Computa HMAC-SHA1 hex de `message` usando `secret` (formato Kiwify).
 */
async function hmacSha1Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ============= HELPERS portados do hubla-webhook-handler =============
const PIPELINE_INSIDE_SALES_ORIGIN = 'PIPELINE INSIDE SALES';

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  let clean = phone.replace(/\D/g, '');
  if (clean.startsWith('0')) clean = clean.substring(1);
  if (!clean.startsWith('55') && clean.length <= 11) clean = '55' + clean;
  return '+' + clean;
}

async function checkIfPartner(
  supabase: any,
  email: string | null
): Promise<{ isPartner: boolean; product: string | null }> {
  if (!email) return { isPartner: false, product: null };
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

interface KiwifyCRMContactData {
  email: string | null;
  phone: string | null;
  name: string | null;
  productName: string;
  value: number;
  extraTags?: string[];
}

/**
 * Cria ou atualiza contato + deal A010 no CRM (PIPELINE INSIDE SALES → Novo Lead),
 * com tags ['A010', 'A010 Kiwify'] (substitui o 'Hubla' do fluxo original).
 * Espelha o comportamento de createOrUpdateCRMContact do hubla-webhook-handler.
 */
async function createOrUpdateKiwifyCRMContact(
  supabase: any,
  data: KiwifyCRMContactData
): Promise<void> {
  if (!data.email && !data.phone) {
    console.log('[CRM][Kiwify] Sem email ou telefone, pulando criação de contato');
    return;
  }

  // Bloqueio de parceiros: registra em partner_returns e não cria deal
  const partnerCheck = await checkIfPartner(supabase, data.email);
  if (partnerCheck.isPartner) {
    console.log(`[CRM][Kiwify] 🚫 PARCEIRO DETECTADO: ${data.email} - ${partnerCheck.product}. Bloqueando.`);
    let contactId: string | null = null;
    if (data.email) {
      const { data: contact } = await supabase
        .from('crm_contacts')
        .select('id')
        .ilike('email', data.email)
        .limit(1)
        .maybeSingle();
      contactId = contact?.id || null;
    }
    await supabase.from('partner_returns').insert({
      contact_id: contactId,
      contact_email: data.email,
      contact_name: data.name,
      partner_product: partnerCheck.product,
      return_source: 'kiwify_a010',
      return_product: data.productName,
      return_value: data.value || 0,
      blocked: true,
    });
    return;
  }

  const normalizedPhone = normalizePhone(data.phone);
  const targetStageName = 'Novo Lead';
  const targetTags =
    data.extraTags && data.extraTags.length > 0 ? data.extraTags : ['A010', 'A010 Kiwify'];
  const targetOriginName = PIPELINE_INSIDE_SALES_ORIGIN;

  // 1. Buscar/criar origem
  let originId: string | null = null;
  const { data: existingOrigins } = await supabase
    .from('crm_origins')
    .select('id')
    .ilike('name', targetOriginName)
    .order('created_at', { ascending: true })
    .limit(1);

  if (existingOrigins && existingOrigins.length > 0) {
    originId = existingOrigins[0].id;
  } else {
    const { data: newOrigin } = await supabase
      .from('crm_origins')
      .insert({
        clint_id: `kiwify-origin-${Date.now()}`,
        name: targetOriginName,
        description: 'Criada automaticamente via webhook Kiwify',
      })
      .select('id')
      .single();
    originId = newOrigin?.id || null;
  }

  // 2. Buscar contato por email (prioridade) — preferindo o que já tem deal nessa origem
  let contactId: string | null = null;
  let existingContact: any = null;

  if (data.email) {
    const { data: allByEmail } = await supabase
      .from('crm_contacts')
      .select('id, phone')
      .ilike('email', data.email)
      .eq('is_archived', false)
      .order('created_at', { ascending: true })
      .limit(20);

    if (allByEmail && allByEmail.length > 0) {
      for (const c of allByEmail) {
        const { data: dealForContact } = await supabase
          .from('crm_deals')
          .select('id')
          .eq('contact_id', c.id)
          .eq('origin_id', originId)
          .limit(1)
          .maybeSingle();
        if (dealForContact) {
          contactId = c.id;
          existingContact = c;
          break;
        }
      }
      if (!contactId) {
        contactId = allByEmail[0].id;
        existingContact = allByEmail[0];
      }
    }
  }

  // 3. Fallback por telefone normalizado
  if (!contactId && normalizedPhone) {
    const phoneDigits = normalizedPhone.replace(/\D/g, '');
    const { data: byPhone } = await supabase
      .from('crm_contacts')
      .select('id, email, phone')
      .or(`phone.eq.${normalizedPhone},phone.eq.+${phoneDigits},phone.eq.${phoneDigits}`)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (byPhone) {
      existingContact = byPhone;
      contactId = byPhone.id;
    }
  }

  // 4. Normalizar telefone do contato existente
  if (existingContact && normalizedPhone && existingContact.phone !== normalizedPhone) {
    await supabase
      .from('crm_contacts')
      .update({ phone: normalizedPhone, updated_at: new Date().toISOString() })
      .eq('id', existingContact.id);
  }

  // 5. Criar contato novo se necessário
  if (!contactId) {
    const { data: newContact } = await supabase
      .from('crm_contacts')
      .insert({
        clint_id: `kiwify-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        name: data.name || 'Cliente A010',
        email: data.email,
        phone: normalizedPhone,
        origin_id: originId,
        tags: targetTags,
        custom_fields: { source: 'kiwify', product: data.productName },
      })
      .select('id')
      .single();
    contactId = newContact?.id || null;
  }

  // 6. Se já existe deal nesta origem → atualizar tags/valor (não criar duplicado)
  let existingDeal: any = null;
  if (contactId && originId) {
    const { data: dealByContactOrigin } = await supabase
      .from('crm_deals')
      .select('id, tags, value, custom_fields, stage_id')
      .eq('contact_id', contactId)
      .eq('origin_id', originId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (dealByContactOrigin) existingDeal = dealByContactOrigin;
  }

  if (existingDeal) {
    const currentTags: string[] = existingDeal.tags || [];
    const newTags: string[] = currentTags.filter(t => !/^a010 em aberto$/i.test(t));
    if (!newTags.includes('A010')) newTags.push('A010');
    if (!newTags.includes('A010 Kiwify')) newTags.push('A010 Kiwify');

    const currentCustomFields = existingDeal.custom_fields || {};
    const updatedCustomFields = {
      ...currentCustomFields,
      a010_compra: true,
      a010_produto: data.productName,
      a010_data: new Date().toISOString(),
      source: 'kiwify',
    };

    const newValue = Math.max(existingDeal.value || 0, data.value || 0);

    // Promover stage "A010 Em Aberto" → "Novo Lead" se aplicável
    let promotedStageId: string | null = null;
    if (existingDeal.stage_id) {
      const { data: currentStage } = await supabase
        .from('crm_stages')
        .select('stage_name')
        .eq('id', existingDeal.stage_id)
        .maybeSingle();
      if (currentStage && /a010 em aberto/i.test(currentStage.stage_name || '')) {
        const { data: novoLead } = await supabase
          .from('crm_stages')
          .select('id')
          .eq('origin_id', originId)
          .eq('stage_name', 'Novo Lead')
          .limit(1)
          .maybeSingle();
        if (novoLead) promotedStageId = novoLead.id;
      }
    }

    const updatePayload: any = {
      tags: newTags,
      value: newValue,
      custom_fields: updatedCustomFields,
      updated_at: new Date().toISOString(),
    };
    if (promotedStageId) {
      updatePayload.stage_id = promotedStageId;
      updatePayload.stage_moved_at = new Date().toISOString();
    }

    await supabase.from('crm_deals').update(updatePayload).eq('id', existingDeal.id);
    console.log(
      `[CRM][Kiwify] Deal atualizado: ${existingDeal.id} - tags=${JSON.stringify(newTags)}${promotedStageId ? ' (promovido → Novo Lead)' : ''}`
    );
    return;
  }

  // 7. Buscar stage "Novo Lead"
  let stageId: string | null = null;
  if (originId) {
    const { data: targetStage } = await supabase
      .from('crm_stages')
      .select('id')
      .eq('origin_id', originId)
      .eq('stage_name', targetStageName)
      .limit(1)
      .maybeSingle();
    if (targetStage) {
      stageId = targetStage.id;
    } else {
      const { data: fallbackStage } = await supabase
        .from('crm_stages')
        .select('id')
        .eq('origin_id', originId)
        .order('stage_order', { ascending: true })
        .limit(1)
        .maybeSingle();
      stageId = fallbackStage?.id || null;
    }
  }

  // 8. Criar deal — distribuição ativa OU herança de owner
  if (!contactId || !originId) {
    console.log('[CRM][Kiwify] Faltou contactId/originId, pulando criação de deal');
    return;
  }

  let distributedOwnerId: string | null = null;
  let distributedOwnerProfileId: string | null = null;
  let wasDistributed = false;

  try {
    const { data: distConfig } = await supabase
      .from('lead_distribution_config')
      .select('id')
      .eq('origin_id', originId)
      .eq('is_active', true)
      .limit(1);
    if (distConfig && distConfig.length > 0) {
      const { data: nextOwnerEmail } = await supabase.rpc('get_next_lead_owner', { p_origin_id: originId });
      if (nextOwnerEmail) {
        distributedOwnerId = nextOwnerEmail;
        wasDistributed = true;
        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('id')
          .ilike('email', distributedOwnerId)
          .maybeSingle();
        if (ownerProfile) distributedOwnerProfileId = ownerProfile.id;
      }
    }
  } catch (distError) {
    console.error('[CRM][Kiwify] Erro ao verificar distribuição:', distError);
  }

  let inheritedOwnerId: string | null = null;
  let inheritedOwnerProfileId: string | null = null;
  if (!wasDistributed) {
    const { data: dealWithOwner } = await supabase
      .from('crm_deals')
      .select('owner_id, owner_profile_id')
      .eq('contact_id', contactId)
      .not('owner_id', 'is', null)
      .limit(1)
      .maybeSingle();
    if (dealWithOwner?.owner_id) {
      inheritedOwnerId = dealWithOwner.owner_id;
      inheritedOwnerProfileId = dealWithOwner.owner_profile_id;
      if (!inheritedOwnerProfileId && inheritedOwnerId) {
        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', inheritedOwnerId)
          .maybeSingle();
        if (ownerProfile) inheritedOwnerProfileId = ownerProfile.id;
      }
    }
  }

  const finalOwnerId = wasDistributed ? distributedOwnerId : inheritedOwnerId;
  const finalOwnerProfileId = wasDistributed ? distributedOwnerProfileId : inheritedOwnerProfileId;

  const dealData = {
    clint_id: `kiwify-deal-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    name: `${data.name || 'Cliente'} - A010`,
    value: data.value || 0,
    contact_id: contactId,
    origin_id: originId,
    stage_id: stageId,
    owner_id: finalOwnerId,
    owner_profile_id: finalOwnerProfileId,
    product_name: data.productName,
    tags: targetTags,
    custom_fields: {
      source: 'kiwify',
      product: data.productName,
      a010_compra: true,
      a010_data: new Date().toISOString(),
      ...(wasDistributed ? { distributed: true, owner_original: inheritedOwnerId || null } : {}),
    },
    data_source: 'webhook',
    stage_moved_at: new Date().toISOString(),
  };

  const { data: newDeal, error: dealError } = await supabase
    .from('crm_deals')
    .insert(dealData)
    .select('id')
    .maybeSingle();

  if (dealError) {
    if (dealError.code === '23505' || dealError.message?.includes('duplicate')) {
      console.log(`[CRM][Kiwify] Deal duplicado ignorado para contact_id=${contactId}, origin_id=${originId}`);
    } else {
      console.error('[CRM][Kiwify] Erro ao criar deal:', dealError);
    }
  } else if (newDeal) {
    console.log(
      `[CRM][Kiwify] Deal criado: ${data.name} - A010 (${newDeal.id}) owner=${finalOwnerId || 'nenhum'} tags=${JSON.stringify(targetTags)}`
    );
  }
}

// Mapeamento de produtos Kiwify para categorias (mesmo padrão do Hubla)
const PRODUCT_MAPPING: Record<string, string> = {
  // A010 - Curso
  'A010': 'a010',
  'A011': 'a010',
  'A012': 'a010',
  // Incorporador 50k products
  'A000': 'incorporador',
  'A001': 'incorporador',
  'A002': 'incorporador',
  'A003': 'incorporador',
  'A004': 'incorporador',
  'A005': 'incorporador',
  'A008': 'incorporador',
  'A009': 'incorporador',
  'R001': 'incorporador',
  'R004': 'incorporador',
  'R005': 'incorporador',
  'R006': 'incorporador',
  'R009': 'incorporador',
  'R21': 'incorporador',
  // Contratos
  'Contrato': 'contrato',
  'CONTRATO': 'contrato',
  // Order Bumps
  'OB': 'orderbump',
  'Imersão Presencial': 'ob_evento',
  'Acesso Vitalício': 'ob_acesso',
  'Construir Para Alugar': 'ob_construir',
};

/**
 * Converte data da Kiwify (Brasília sem timezone) para UTC ISO string
 * Kiwify envia: "2026-01-14 15:40" (horário de Brasília)
 * Devemos salvar: "2026-01-14T18:40:00.000Z" (UTC)
 */
function convertKiwifyDateToUTC(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  
  // Se já tem timezone (termina em Z ou +/-), retornar como está
  if (dateStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateStr)) {
    return new Date(dateStr).toISOString();
  }
  
  // Kiwify envia horário de Brasília (UTC-3)
  // Adicionar o offset -03:00 antes de converter para UTC
  const dateWithTz = `${dateStr.replace(' ', 'T')}-03:00`;
  return new Date(dateWithTz).toISOString();
}

function mapProductCategory(productName: string, productCode?: string): string {
  if (!productName) return 'outros';
  const upperName = productName.toUpperCase();
  
  // Check product code first
  if (productCode) {
    for (const [key, value] of Object.entries(PRODUCT_MAPPING)) {
      if (productCode.toUpperCase().includes(key.toUpperCase())) {
        return value;
      }
    }
  }
  
  // Check product name patterns
  if (upperName.includes('A010') || upperName.includes('A011') || upperName.includes('A012')) {
    return 'a010';
  }
  if (upperName.includes('CONTRATO') || upperName.includes('A000')) {
    return 'contrato';
  }
  if (upperName.includes('MCF') || upperName.includes('INCORPORADOR') || upperName.includes('ANTICRISE')) {
    return 'incorporador';
  }
  if (upperName.includes('ORDER BUMP') || upperName.includes('OB ')) {
    return 'orderbump';
  }
  if (upperName.includes('IMERSÃO PRESENCIAL')) {
    return 'ob_evento';
  }
  if (upperName.includes('ACESSO VITALÍCIO')) {
    return 'ob_acesso';
  }
  if (upperName.includes('CONSTRUIR PARA ALUGAR')) {
    return 'ob_construir';
  }
  if (upperName.includes('EFEITO ALAVANCA') || upperName.includes('CLUBE DO ARREMATE')) {
    return 'outros';
  }
  
  return 'outros';
}

serve(async (req) => {
  const startTime = Date.now();
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const kiwifyToken = Deno.env.get('KIWIFY_WEBHOOK_TOKEN');
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const rawText = await req.text();
    let rawBody: any = {};
    try {
      rawBody = rawText ? JSON.parse(rawText) : {};
    } catch (e) {
      console.error('[Kiwify Webhook] Invalid JSON body');
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // Kiwify pode enviar payload "flat" (campos na raiz) ou "embrulhado" ({ url, signature, order: {...} })
    const body = rawBody?.order && typeof rawBody.order === 'object' ? rawBody.order : rawBody;
    const eventType = body.webhook_event_type || body.event || rawBody.webhook_event_type || 'unknown';
    
    console.log(`[Kiwify Webhook] Received event: ${eventType}`);
    console.log(`[Kiwify Webhook] Body:`, JSON.stringify(rawBody, null, 2));

    // ===== Validar assinatura HMAC-SHA1 (formato Kiwify) =====
    // Kiwify envia: ?signature=<hex> e signature = HMAC-SHA1(rawBody, KIWIFY_WEBHOOK_TOKEN)
    // Fallback aceito: token estático em header/query (`x-kiwify-token`, `?token=`) para testes manuais.
    if (!kiwifyToken) {
      console.error('[Kiwify Webhook] KIWIFY_WEBHOOK_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'Webhook not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const url = new URL(req.url);
    const querySignature = (url.searchParams.get('signature') || '').toLowerCase().trim();
    const headerSignature = (req.headers.get('x-kiwify-signature') || '').toLowerCase().trim();
    const incomingSignature = querySignature || headerSignature;

    const headerToken = req.headers.get('x-kiwify-token') || req.headers.get('X-Kiwify-Token');
    const queryToken = url.searchParams.get('token');
    const staticToken = headerToken || queryToken;

    let authOk = false;
    let authMethod = 'none';

    if (incomingSignature) {
      const expectedSig = await hmacSha1Hex(kiwifyToken, rawText);
      if (timingSafeEqualHex(incomingSignature, expectedSig)) {
        authOk = true;
        authMethod = 'hmac';
      } else {
        console.error('[Kiwify Webhook] HMAC mismatch', {
          received: incomingSignature.slice(0, 8) + '…',
          expected: expectedSig.slice(0, 8) + '…',
        });
      }
    }

    if (!authOk && staticToken && staticToken === kiwifyToken) {
      authOk = true;
      authMethod = 'static-token';
    }

    if (!authOk) {
      console.error('[Kiwify Webhook] Invalid or missing signature/token', {
        hasQuerySignature: !!querySignature,
        hasHeaderSignature: !!headerSignature,
        hasStaticToken: !!staticToken,
      });
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Kiwify Webhook] Signature OK (method=${authMethod})`);

    // Log do webhook recebido
    const { data: logEntry, error: logError } = await supabase
      .from('hubla_webhook_logs')
      .insert({
        event_type: `kiwify:${eventType}`,
        event_data: body,
        status: 'processing'
      })
      .select('id')
      .single();

    if (logError) {
      console.error('[Kiwify Webhook] Error logging webhook:', logError);
    }

    const logId = logEntry?.id;

    // Processar eventos
    let processed = false;
    let transactionId = null;

    if (eventType === 'order_paid' || eventType === 'compra_aprovada' || eventType === 'purchase_approved' || eventType === 'order_approved') {
      // Venda aprovada - estrutura Kiwify usa Commissions, Customer, Product no root
      const commissions = body.Commissions || body.commissions || {};
      const customer = body.Customer || body.customer || {};
      const product = body.Product || body.product || {};
      const subscription = body.Subscription || body.subscription || {};
      
      const orderId = body.order_id || body.Order?.order_id || `kiwify_${Date.now()}`;
      const kiwifyId = `kiwify_${orderId}`;
      
      // Extrair valores da estrutura Commissions (Kiwify envia em centavos)
      const grossValueCents = commissions.charge_amount || commissions.product_base_price || 0;
      const netValueCents = commissions.my_commission || grossValueCents;
      const grossValue = grossValueCents / 100;
      const netValue = netValueCents / 100;
      
      const productName = product.product_name || product.name || 'Produto Kiwify';
      const productCode = product.product_id || product.id || '';
      const productCategory = mapProductCategory(productName, productCode);
      
      // Verificar parcela (para assinaturas e parcelamentos)
      // Kiwify pode enviar em diferentes formatos: Subscription.charges, installment_number, etc.
      const subscriptionCharges = subscription.charges?.length || 0;
      const bodyInstallment = body.installment_number || body.installment || 0;
      const orderInstallment = body.Order?.installment_number || body.order?.installment_number || 0;
      // Priorizar: subscription > body > order > default
      const installmentNumber = subscriptionCharges > 0 ? subscriptionCharges : (bodyInstallment || orderInstallment || 1);
      const totalInstallments = subscription.plan?.charges_limit || body.total_installments || body.Order?.total_installments || 1;
      
      console.log(`[Kiwify Webhook] Installment detection: subscriptionCharges=${subscriptionCharges}, bodyInstallment=${bodyInstallment}, orderInstallment=${orderInstallment}, final=${installmentNumber}/${totalInstallments}`);
      
      const customerName = customer.full_name || customer.name || '';
      const customerEmail = customer.email || '';
      const customerPhone = customer.mobile || customer.phone || '';
      
      const rawSaleDate = body.approved_date || body.created_at;
      const saleDate = convertKiwifyDateToUTC(rawSaleDate);

      console.log(`[Kiwify Webhook] Processing sale: ${kiwifyId}, product: ${productName}, category: ${productCategory}, gross: ${grossValue}, net: ${netValue}`);

      // Verificar duplicata
      const { data: existing } = await supabase
        .from('hubla_transactions')
        .select('id')
        .eq('hubla_id', kiwifyId)
        .single();

      if (existing) {
        console.log(`[Kiwify Webhook] Transaction ${kiwifyId} already exists, skipping`);
      } else {
        // Inserir transação
        const { data: transaction, error: txError } = await supabase
          .from('hubla_transactions')
          .insert({
            hubla_id: kiwifyId,
            event_type: 'kiwify.purchase_approved',
            product_name: productName,
            product_code: productCode,
            product_category: productCategory,
            product_price: grossValue,
            net_value: netValue,
            customer_name: customerName,
            customer_email: customerEmail,
            customer_phone: customerPhone,
            sale_date: saleDate,
            sale_status: 'completed',
            installment_number: installmentNumber,
            total_installments: totalInstallments,
            source: 'kiwify',
            raw_data: body
          })
          .select('id')
          .single();

        if (txError) {
          console.error('[Kiwify Webhook] Error inserting transaction:', txError);
          throw txError;
        }

        transactionId = transaction?.id;
        processed = true;

        // Se for A010 e primeira parcela, inserir em a010_sales
        if (productCategory === 'a010' && installmentNumber === 1 && customerName) {
          const { error: a010Error } = await supabase
            .from('a010_sales')
            .insert({
              customer_name: customerName,
              customer_email: customerEmail || null,
              customer_phone: customerPhone || null,
              net_value: netValue,
              sale_date: saleDate.split('T')[0],
              status: 'completed'
            });

          if (a010Error) {
            console.error('[Kiwify Webhook] Error inserting a010_sales:', a010Error);
          }
        }
      }
    } else if (eventType === 'refund' || eventType === 'compra_reembolsada' || eventType === 'order_refunded') {
      // Reembolso
      const order = body.order || body.Order || body;
      const orderId = order.order_id || order.id || body.order_id;
      const kiwifyId = `kiwify_${orderId}`;

      console.log(`[Kiwify Webhook] Processing refund for: ${kiwifyId}`);

      // Atualizar status da transação
      const { error: updateError } = await supabase
        .from('hubla_transactions')
        .update({ sale_status: 'refunded' })
        .eq('hubla_id', kiwifyId);

      if (updateError) {
        console.error('[Kiwify Webhook] Error updating refund status:', updateError);
      }

      // Atualizar a010_sales se existir
      const customer = body.Customer || body.customer || order.customer || {};
      const customerEmail = customer.email || '';
      
      if (customerEmail) {
        await supabase
          .from('a010_sales')
          .update({ status: 'refunded' })
          .eq('customer_email', customerEmail);
      }

      processed = true;
    } else if (eventType === 'chargeback' || eventType === 'chargeback_created') {
      // Chargeback
      const order = body.order || body.Order || body;
      const orderId = order.order_id || order.id || body.order_id;
      const kiwifyId = `kiwify_${orderId}`;

      console.log(`[Kiwify Webhook] Processing chargeback for: ${kiwifyId}`);

      const { error: updateError } = await supabase
        .from('hubla_transactions')
        .update({ sale_status: 'chargeback' })
        .eq('hubla_id', kiwifyId);

      if (updateError) {
        console.error('[Kiwify Webhook] Error updating chargeback status:', updateError);
      }

      processed = true;
    } else if (eventType === 'subscription_canceled' || eventType === 'assinatura_cancelada') {
      // Assinatura cancelada
      const subscription = body.Subscription || body.subscription || body;
      const orderId = subscription.id || body.order_id;
      
      console.log(`[Kiwify Webhook] Processing subscription cancellation: ${orderId}`);
      processed = true;
    }

    // Atualizar log
    const processingTime = Date.now() - startTime;
    if (logId) {
      await supabase
        .from('hubla_webhook_logs')
        .update({
          status: 'success',
          processed_at: new Date().toISOString(),
          processing_time_ms: processingTime
        })
        .eq('id', logId);
    }

    console.log(`[Kiwify Webhook] Processed in ${processingTime}ms, transaction: ${transactionId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed,
        transactionId,
        processingTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Kiwify Webhook] Error:', error);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
