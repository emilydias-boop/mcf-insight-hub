// Clint CRM Webhook Handler - Version 2025-11-24T16:30:00Z
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookEvent {
  event: string;
  timestamp?: string;
  data: any;
}

// Interface para o formato direto do Clint (campo por campo)
interface ClintRawPayload {
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_doc?: string;
  contact_role?: string;
  contact_notes?: string;
  deal_stage?: string;
  deal_user?: string;
  deal_status?: string;
  deal_name?: string;
  deal_value?: number;
  origin_name?: string;
  [key: string]: any;
}

serve(async (req) => {
  console.log('[WEBHOOK] New request received - Version 2025-11-24T16:30:00Z');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const startTime = Date.now();
  let webhookLogId: string | null = null;

  try {
    // FASE 1: LOG DETALHADO - Capturar payload EXATO que Clint envia
    const rawPayload = await req.json();
    console.log('[WEBHOOK] ========== RAW PAYLOAD COMPLETO ==========');
    console.log(JSON.stringify(rawPayload, null, 2));
    console.log('[WEBHOOK] =======================================');

    // FASE 2: NORMALIZAÇÃO - Converter formato direto para formato esperado
    const normalizedPayload = normalizeClintPayload(rawPayload);
    console.log('[WEBHOOK] Event type detectado:', normalizedPayload.event);

    // ========== BLOQUEIO: Origin LIVE é gerenciada pelo webhook-live-leads ==========
    const BLOCKED_ORIGIN_ID = 'fdac4941-f0a2-46a2-8e70-7578d922d21a';
    const BLOCKED_ORIGIN_NAME = 'PIPELINE INSIDE SALES - LEAD GRATUITO';
    
    const originNameFromPayload = normalizedPayload.data.origin?.name || 
                                   normalizedPayload.data.deal_origin || 
                                   normalizedPayload.data.origin_name ||
                                   rawPayload.deal_origin ||
                                   rawPayload.origin_name;

    if (originNameFromPayload && (
        originNameFromPayload.includes('LEAD GRATUITO') || 
        originNameFromPayload.includes('GRATUITO') ||
        originNameFromPayload === BLOCKED_ORIGIN_NAME
    )) {
      console.log('[WEBHOOK] ⛔ BLOCKED: Lead para origin LIVE - ignorando Clint');
      console.log('[WEBHOOK] Origin detectada:', originNameFromPayload);
      
      // Log do bloqueio
      await supabase.from('webhook_events').insert({
        event_type: `blocked_${normalizedPayload.event}`,
        event_data: { ...rawPayload, blocked_reason: 'live_origin_managed_internally' },
        status: 'blocked',
        processed_at: new Date().toISOString()
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          action: 'blocked', 
          reason: 'Origin LIVE é gerenciada pelo webhook-live-leads',
          origin_detected: originNameFromPayload
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // ========== FIM BLOQUEIO ==========
    console.log('[WEBHOOK] Payload normalizado:', JSON.stringify(normalizedPayload.data, null, 2));

    // Criar log do webhook (mesmo se houver erro depois)
    const { data: logData, error: logError } = await supabase
      .from('webhook_events')
      .insert({
        event_type: normalizedPayload.event,
        event_data: rawPayload, // Salvar payload original do Clint
        status: 'processing'
      })
      .select()
      .single();

    if (logError) {
      console.error('[WEBHOOK] Error creating log:', logError);
    } else {
      webhookLogId = logData.id;
      console.log('[WEBHOOK] Log created:', webhookLogId);
    }

    // FASE 3: PROCESSAMENTO - Executar lógica baseada no evento
    let result: any = null;

    switch (normalizedPayload.event) {
      case 'deal.stage_changed':
        result = await handleDealStageChanged(supabase, normalizedPayload.data);
        break;
      
      case 'contact.updated':
        result = await handleContactUpdated(supabase, normalizedPayload.data);
        break;

      case 'deal.updated':
        result = await handleDealUpdated(supabase, normalizedPayload.data);
        break;

      case 'contact.created':
        result = await handleContactCreated(supabase, normalizedPayload.data);
        break;

      case 'contact.deleted':
        result = await handleContactDeleted(supabase, normalizedPayload.data);
        break;
      
      case 'deal.created':
        result = await handleDealCreated(supabase, normalizedPayload.data);
        break;

      case 'deal.deleted':
        result = await handleDealDeleted(supabase, normalizedPayload.data);
        break;

      case 'origin.created':
        result = await handleOriginCreated(supabase, normalizedPayload.data);
        break;
      
      case 'origin.updated':
        result = await handleOriginUpdated(supabase, normalizedPayload.data);
        break;

      case 'stage.created':
        result = await handleStageCreated(supabase, normalizedPayload.data);
        break;
      
      case 'stage.updated':
        result = await handleStageUpdated(supabase, normalizedPayload.data);
        break;

      default:
        console.log('[WEBHOOK] Unhandled event type:', normalizedPayload.event);
        result = { message: 'Event type not handled', event: normalizedPayload.event };
    }

    const processingTime = Date.now() - startTime;

    // Atualizar log como sucesso
    if (webhookLogId) {
      await supabase
        .from('webhook_events')
        .update({
          status: 'success',
          processing_time_ms: processingTime,
          processed_at: new Date().toISOString()
        })
        .eq('id', webhookLogId);
    }

    console.log(`[WEBHOOK] Processed successfully in ${processingTime}ms`);

    return new Response(
      JSON.stringify({ success: true, result, processingTime }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error('[WEBHOOK] Error:', error.message);
    console.error('[WEBHOOK] Stack:', error.stack);

    // Atualizar log como erro
    if (webhookLogId) {
      await supabase
        .from('webhook_events')
        .update({
          status: 'error',
          error_message: error.message,
          processing_time_ms: processingTime,
          processed_at: new Date().toISOString()
        })
        .eq('id', webhookLogId);
    }

    // Retornar 200 OK mesmo com erro para evitar retry infinito do Clint
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============= NORMALIZAÇÃO DE PAYLOAD =============

/**
 * Converte o formato direto do Clint (campo por campo) para o formato esperado
 */
function normalizeClintPayload(rawPayload: any): WebhookEvent {
  // Se já está no formato correto (com event e data), retornar
  if (rawPayload.event && rawPayload.data) {
    return rawPayload as WebhookEvent;
  }

  const raw = rawPayload as ClintRawPayload;

  // Detectar tipo de evento baseado em campos presentes
  let event = 'unknown';
  
  // 1. PRIORIDADE: Campo explícito de ação/evento do Clint
  if (raw.action === 'created' || raw.event_type === 'deal_created') {
    event = 'deal.created';
    console.log('[NORMALIZE] Detectado deal.created por campo explícito:', raw.action || raw.event_type);
  }
  // 2. Detectar criação por timestamps (criado há menos de 5 segundos)
  else if (raw.deal_created_at && raw.deal_updated_at) {
    const createdAt = new Date(raw.deal_created_at).getTime();
    const updatedAt = new Date(raw.deal_updated_at).getTime();
    if (Math.abs(updatedAt - createdAt) < 5000) {
      event = 'deal.created';
      console.log('[NORMALIZE] Detectado deal.created por timestamps próximos');
    }
  }
  // 3. Se tem deal_stage, é mudança de estágio
  else if (raw.deal_stage) {
    event = 'deal.stage_changed';
  } 
  // 4. Se tem informações de deal mas sem estágio, é atualização de deal
  else if (raw.deal_name || raw.deal_value !== undefined || raw.deal_status) {
    event = 'deal.updated';
  }
  // 5. Se só tem informações de contato, é atualização de contato
  else if (raw.contact_name || raw.contact_email || raw.contact_phone) {
    event = 'contact.updated';
  }

  console.log('[NORMALIZE] Event detectado:', event);

  // Normalizar dados
  return {
    event,
    data: {
      // Dados do contato
      contact: {
        name: raw.contact_name,
        email: raw.contact_email,
        phone: raw.contact_phone,
        doc: raw.contact_doc,
        role: raw.contact_role,
        notes: raw.contact_notes
      },
      // Dados do deal
      deal: {
        name: raw.deal_name,
        value: raw.deal_value,
        stage: raw.deal_stage, // Nome do estágio
        user: raw.deal_user,
        status: raw.deal_status
      },
      // Dados da origem
      origin: {
        name: raw.origin_name
      },
      // Campos extras importantes
      deal_origin: raw.deal_origin, // Nome da origem do deal
      deal_old_stage: raw.deal_old_stage, // Estágio anterior
      // Manter outros campos
      ...raw
    }
  };
}

// ============= HELPER: Normalizar telefone =============
function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  
  let clean = phone.replace(/\D/g, '');
  
  if (clean.startsWith('0')) {
    clean = clean.substring(1);
  }
  
  if (!clean.startsWith('55') && clean.length <= 11) {
    clean = '55' + clean;
  }
  
  return '+' + clean;
}

// ============= HELPER: Parsear tags do Clint =============
/**
 * Converte a string de tags do Clint em um array de tags
 * Exemplos de entrada:
 *   "[A010 - Construa para Vender BIO - Instagram]" → ["A010 - Construa para Vender", "BIO - Instagram"]
 *   "Tag1, Tag2" → ["Tag1", "Tag2"]
 *   "[Tag Única]" → ["Tag Única"]
 */
function parseClintTags(tagString: string | null | undefined): string[] {
  if (!tagString || typeof tagString !== 'string') return [];
  
  // Remover colchetes externos se presentes
  let cleaned = tagString.trim();
  if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
    cleaned = cleaned.slice(1, -1);
  }
  
  // Tentar detectar padrões de múltiplas tags dentro da string
  // Padrão comum do Clint: "A010 - Algo BIO - Instagram" (separado por categoria - descrição)
  const tagPatterns = [
    /\b(A010\s*-\s*[^,\[\]]+)/gi,
    /\b(BIO\s*-\s*[^,\[\]]+)/gi,
    /\b(LIVE\s*-\s*[^,\[\]]+)/gi,
    /\b(LEAD\s*-\s*[^,\[\]]+)/gi,
  ];
  
  const extractedTags: string[] = [];
  let remainingString = cleaned;
  
  // Extrair tags que seguem padrões conhecidos
  for (const pattern of tagPatterns) {
    const matches = cleaned.match(pattern);
    if (matches) {
      for (const match of matches) {
        const trimmed = match.trim();
        if (trimmed && !extractedTags.includes(trimmed)) {
          extractedTags.push(trimmed);
          remainingString = remainingString.replace(match, '').trim();
        }
      }
    }
  }
  
  // Se não encontrou padrões conhecidos, tentar separar por vírgula
  if (extractedTags.length === 0) {
    const commaSplit = cleaned.split(',').map(t => t.trim()).filter(Boolean);
    if (commaSplit.length > 1) {
      return commaSplit;
    }
    
    // Se é uma única string não vazia, retornar como array de 1 elemento
    if (cleaned.trim()) {
      return [cleaned.trim()];
    }
  }
  
  return extractedTags;
}

/**
 * Extrai tags de várias fontes possíveis no payload do Clint
 */
function extractTagsFromClintPayload(data: any): string[] {
  // 1. Tags já em formato array
  if (Array.isArray(data.tags) && data.tags.length > 0) {
    return data.tags.map((t: any) => typeof t === 'string' ? t : t.name || String(t));
  }
  
  // 2. Campo contact_tag (string do Clint)
  if (data.contact_tag) {
    return parseClintTags(data.contact_tag);
  }
  
  // 3. Campo tags como string
  if (typeof data.tags === 'string') {
    return parseClintTags(data.tags);
  }
  
  // 4. Verificar em deal ou contact aninhados
  const dealTags = data.deal?.tags;
  const contactTags = data.contact?.tags;
  
  if (Array.isArray(dealTags)) {
    return dealTags.map((t: any) => typeof t === 'string' ? t : t.name || String(t));
  }
  
  if (Array.isArray(contactTags)) {
    return contactTags.map((t: any) => typeof t === 'string' ? t : t.name || String(t));
  }
  
  return [];
}

// ============= HANDLERS DE CONTATOS =============

async function handleContactCreated(supabase: any, data: any) {
  console.log('[CONTACT.CREATED] Processing contact:', data.contact?.name || data.name);

  const contactData = data.contact || data;
  const email = contactData.email || data.email;
  const phone = contactData.phone || data.phone;
  const normalizedPhone = normalizePhone(phone);

  // Extrair tags do payload do Clint
  const parsedTags = extractTagsFromClintPayload(data);
  console.log('[CONTACT.CREATED] Parsed tags:', parsedTags);

  // Verificar se já existe pelo email
  if (email) {
    const { data: existing } = await supabase
      .from('crm_contacts')
      .select('id')
      .ilike('email', email)
      .maybeSingle();

    if (existing) {
      console.log('[CONTACT.CREATED] Contact already exists, updating instead');
      return handleContactUpdated(supabase, data);
    }
  }

  const { error } = await supabase
    .from('crm_contacts')
    .insert({
      clint_id: data.id || `clint-${Date.now()}`,
      name: contactData.name || data.name,
      email: email,
      phone: normalizedPhone, // TELEFONE NORMALIZADO
      organization_name: data.organization?.name,
      tags: parsedTags.length > 0 ? parsedTags : (data.tags || []),
      custom_fields: data.custom_fields || {}
    });

  if (error) throw error;
  console.log('[CONTACT.CREATED] Success with normalized phone:', normalizedPhone, 'tags:', parsedTags);
  return { action: 'created', contact: contactData.name, tags: parsedTags };
}


async function handleContactUpdated(supabase: any, data: any) {
  const contactData = data.contact || data;
  const email = contactData.email || data.email;
  const phone = contactData.phone || data.phone;
  const normalizedPhone = normalizePhone(phone);
  
  console.log('[CONTACT.UPDATED] Processing contact:', contactData.name, email);

  if (!email) {
    console.warn('[CONTACT.UPDATED] No email provided, skipping');
    return { action: 'skipped', reason: 'no_email' };
  }

  // Buscar contato pelo email
  const { data: existing } = await supabase
    .from('crm_contacts')
    .select('id, clint_id')
    .ilike('email', email)
    .maybeSingle();

  if (existing) {
    // Atualizar contato existente
    const { error } = await supabase
      .from('crm_contacts')
      .update({
        name: contactData.name || data.name,
        phone: normalizedPhone, // TELEFONE NORMALIZADO
        organization_name: data.organization?.name,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);

    if (error) throw error;
    console.log('[CONTACT.UPDATED] Success - updated existing with phone:', normalizedPhone);
    return { action: 'updated', contact_id: existing.id };
  } else {
    // Criar novo contato
    const { error } = await supabase
      .from('crm_contacts')
      .insert({
        clint_id: data.id || `clint-${Date.now()}`,
        name: contactData.name || data.name,
        email: email,
        phone: normalizedPhone, // TELEFONE NORMALIZADO
        tags: [],
        custom_fields: {}
      });

    if (error) throw error;
    console.log('[CONTACT.UPDATED] Success - created new with phone:', normalizedPhone);
    return { action: 'created', email };
  }
}

async function handleContactDeleted(supabase: any, data: any) {
  console.log('[CONTACT.DELETED] Processing:', data.id);

  const { error } = await supabase
    .from('crm_contacts')
    .delete()
    .eq('clint_id', data.id);

  if (error) throw error;
  console.log('[CONTACT.DELETED] Success');
  return { action: 'deleted', contact_id: data.id };
}

// ============= HANDLERS DE DEALS =============

// ============= HELPER: Verificar se é parceiro existente =============
async function checkIfPartner(supabase: any, email: string | null): Promise<{isPartner: boolean, product: string | null}> {
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
      if (name.includes(code)) {
        return { isPartner: true, product: code };
      }
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

async function handleDealCreated(supabase: any, data: any) {
  console.log('[DEAL.CREATED] Processing deal:', data.deal?.name || data.name);
  console.log('[DEAL.CREATED] Full payload:', JSON.stringify(data, null, 2));

  const dealData = data.deal || data;
  const contactData = data.contact || {};
  const originName = data.deal_origin || data.origin?.name;
  const ownerName = dealData.user || data.deal_user;

  // === VERIFICAÇÃO DE PARCEIRO: Bloquear reentrada no fluxo ===
  const contactEmail = contactData.email || data.contact_email;
  if (contactEmail) {
    const partnerCheck = await checkIfPartner(supabase, contactEmail);
    if (partnerCheck.isPartner) {
      console.log(`[DEAL.CREATED] 🚫 PARCEIRO DETECTADO: ${contactEmail} - Produto: ${partnerCheck.product}. Bloqueando criação.`);
      
      let contactId: string | null = null;
      const { data: contact } = await supabase
        .from('crm_contacts')
        .select('id')
        .ilike('email', contactEmail)
        .limit(1)
        .maybeSingle();
      contactId = contact?.id || null;
      
      await supabase.from('partner_returns').insert({
        contact_id: contactId,
        contact_email: contactEmail,
        contact_name: contactData.name || data.contact_name,
        partner_product: partnerCheck.product,
        return_source: 'clint_deal_created',
        return_product: dealData.name || data.deal_name,
        return_value: dealData.value || data.deal_value || 0,
        blocked: true,
      });
      
      console.log(`[DEAL.CREATED] Retorno de parceiro registrado em partner_returns`);
      return { action: 'blocked', reason: 'partner_detected', product: partnerCheck.product };
    }
  }

  // 1. Buscar ou criar contato pelo email
  let contactId = null;
  if (contactData.email) {
    const { data: contact } = await supabase
      .from('crm_contacts')
      .select('id')
      .eq('email', contactData.email)
      .maybeSingle();
    
    if (contact) {
      contactId = contact.id;
      console.log('[DEAL.CREATED] Contact found:', contactId);
    } else {
      // Criar contato se não existir
      const { data: newContact, error: contactError } = await supabase
        .from('crm_contacts')
        .insert({
          clint_id: contactData.id || `contact-${Date.now()}`,
          name: contactData.name || 'Contato via webhook',
          email: contactData.email,
          phone: contactData.phone,
          tags: [],
          custom_fields: {}
        })
        .select('id')
        .single();
      
      if (!contactError && newContact) {
        contactId = newContact.id;
        console.log('[DEAL.CREATED] Contact created:', contactId);
      }
    }
  }

  // 2. Buscar stage pelo nome
  let stageId = null;
  if (dealData.stage) {
    const { data: stage } = await supabase
      .from('crm_stages')
      .select('id')
      .ilike('stage_name', dealData.stage)
      .maybeSingle();
    stageId = stage?.id;
    console.log('[DEAL.CREATED] Stage found:', stageId);
  }

  // 3. Buscar origin pelo nome - AUTO-CRIAR SE NÃO EXISTIR
  let originId = null;
  if (originName) {
    const { data: origin } = await supabase
      .from('crm_origins')
      .select('id')
      .ilike('name', originName)
      .maybeSingle();
    
    if (origin) {
      originId = origin.id;
      console.log('[DEAL.CREATED] Origin found:', originId);
    } else {
      // Auto-criar origem
      const { data: newOrigin, error: originError } = await supabase
        .from('crm_origins')
        .insert({
          clint_id: `auto-${Date.now()}`,
          name: originName,
          description: 'Criada automaticamente via webhook Clint'
        })
        .select('id')
        .single();
      
      if (!originError && newOrigin) {
        originId = newOrigin.id;
        console.log('[DEAL.CREATED] Origin auto-created:', originName, originId);
      }
    }
  }

  // 4. Owner - verificar distribuição ativa antes de usar deal_user do Clint
  const originalOwner = ownerName || null;
  let ownerId = originalOwner;

  if (originId) {
    try {
      const { data: distConfig } = await supabase
        .from('lead_distribution_config')
        .select('id')
        .eq('origin_id', originId)
        .eq('is_active', true)
        .limit(1);

      if (distConfig && distConfig.length > 0) {
        const { data: nextOwner, error: distError } = await supabase
          .rpc('get_next_lead_owner', { p_origin_id: originId });

        if (!distError && nextOwner) {
          ownerId = nextOwner;
          console.log('[DEAL.CREATED] Distribuição ativa - owner via distribuição:', ownerId, '(original Clint:', originalOwner, ')');
        } else {
          console.log('[DEAL.CREATED] Distribuição falhou, usando owner Clint:', originalOwner, distError);
        }
      } else {
        console.log('[DEAL.CREATED] Sem distribuição ativa para origin:', originId, '- usando owner Clint:', originalOwner);
      }
    } catch (distErr) {
      console.log('[DEAL.CREATED] Erro ao verificar distribuição, usando owner Clint:', originalOwner, distErr);
    }
  }
  console.log('[DEAL.CREATED] Owner final (email):', ownerId);

  // 4.1 Buscar owner_profile_id correspondente para filtro do CRM
  let ownerProfileId: string | null = null;
  if (ownerId) {
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', ownerId)
      .maybeSingle();
    
    if (ownerProfile) {
      ownerProfileId = ownerProfile.id;
      console.log('[DEAL.CREATED] Profile ID encontrado:', ownerProfileId);
    } else {
      console.log('[DEAL.CREATED] ⚠️ Profile não encontrado para:', ownerId);
    }
  }

  // 5. Detectar product_name baseado em tags, nome do deal ou origem
  const productName = extractProductFromDeal(data, originName);
  console.log('[DEAL.CREATED] Product detected:', productName);

  // 6. Processar custom_fields - tudo que não é campo padrão + deal_user
  const excludedFields = ['id', 'name', 'value', 'stage', 'contact', 'origin', 'user', 'deal', 'event', 'timestamp', 'action', 'event_type'];
  const customFields: any = {
    deal_user: data.deal_user || dealData.user,
    deal_user_name: data.deal_user_name,
    deal_closer: data.deal_closer,
    deal_origin: data.deal_origin || originName,
  };
  // Salvar owner original do Clint se distribuição redirecionou
  if (ownerId !== originalOwner && originalOwner) {
    customFields.deal_user_original = originalOwner;
    customFields.distributed = true;
  }
  Object.keys(data).forEach(key => {
    if (!excludedFields.includes(key) && data[key] !== undefined && data[key] !== null) {
      customFields[key] = data[key];
    }
  });
  console.log('[DEAL.CREATED] Custom fields:', customFields);

  // 6.1. Extrair e processar tags do Clint (incluindo contact_tag)
  const parsedTags = extractTagsFromClintPayload(data);
  console.log('[DEAL.CREATED] Parsed tags:', parsedTags);

  // 7. Criar deal com UPSERT para evitar duplicação
  const { data: deal, error } = await supabase
    .from('crm_deals')
    .upsert({
      clint_id: data.id || data.deal_id || `clint-${Date.now()}`,
      name: dealData.name || data.deal_name || data.name || 'Deal sem nome',
      value: dealData.value || data.deal_value || 0,
      stage_id: stageId,
      contact_id: contactId,
      origin_id: originId,
      owner_id: ownerId,
      owner_profile_id: ownerProfileId,
      tags: parsedTags.length > 0 ? parsedTags : (data.tags || dealData.tags || []),
      probability: data.probability || dealData.probability,
      expected_close_date: data.expected_close_date || dealData.expected_close_date,
      custom_fields: customFields,
      product_name: productName,
      data_source: 'webhook',
      stage_moved_at: new Date().toISOString()
    }, { onConflict: 'clint_id' })
    .select()
    .single();

  if (error) {
    console.error('[DEAL.CREATED] Error creating deal:', error);
    throw error;
  }

  // 8. Registrar atividade
  await createDealActivity(supabase, deal.id, 'created', 'Deal criado via webhook', null, null, data);

  // 9. Generate tasks from activity templates for the initial stage
  if (deal.stage_id && deal.origin_id) {
    try {
      const tasksCreated = await generateTasksFromTemplates(supabase, deal);
      console.log(`[DEAL.CREATED] Generated ${tasksCreated} tasks for deal ${deal.id}`);
    } catch (taskError) {
      console.error('[DEAL.CREATED] Error generating tasks:', taskError);
      // Don't fail the deal creation if task generation fails
    }
  }

  console.log('[DEAL.CREATED] Success - Deal ID:', deal.id, 'Product:', productName);
  return { action: 'created', deal_id: deal.id, deal_name: deal.name, product_name: productName };
}

// ============= HELPER: Detectar produto do deal =============
function extractProductFromDeal(data: any, originName?: string): string | null {
  // 1. Verificar tags primeiro
  const tags = data.tags || data.deal?.tags || [];
  for (const tag of tags) {
    const tagUpper = String(tag).toUpperCase();
    if (tagUpper.includes('A010')) return 'A010';
    if (tagUpper.includes('CONTRATO')) return 'Contrato';
    if (tagUpper.includes('A001') || tagUpper.includes('MCF INCORPORADOR')) return 'MCF Incorporador';
    if (tagUpper.includes('A003') || tagUpper.includes('ANTICRISE')) return 'Plano Anticrise';
    if (tagUpper.includes('VITALÍCIO') || tagUpper.includes('VITALICIO')) return 'Acesso Vitalício';
  }
  
  // 2. Verificar nome do deal
  const dealName = (data.deal?.name || data.deal_name || data.name || '').toUpperCase();
  if (dealName.includes('A010')) return 'A010';
  if (dealName.includes('CONTRATO')) return 'Contrato';
  if (dealName.includes('MCF') || dealName.includes('INCORPORADOR')) return 'MCF Incorporador';
  if (dealName.includes('ANTICRISE')) return 'Plano Anticrise';
  
  // 3. Verificar origem (A010 Hubla, Inside Sales, etc)
  const origin = (originName || '').toUpperCase();
  if (origin.includes('A010')) return 'A010';
  if (origin.includes('HUBLA')) return 'A010';
  if (origin.includes('KIWIFY')) return 'A010';
  if (origin.includes('INSIDE SALES')) return 'Contrato';
  
  // 4. Verificar custom_fields
  const customProduct = data.product_name || data.deal?.product_name || data.custom_fields?.product_name;
  if (customProduct) return customProduct;
  
  return null;
}

// ============= HELPER: Generate tasks from activity templates =============
async function generateTasksFromTemplates(supabase: any, deal: any): Promise<number> {
  // 1. Fetch active templates for the deal's stage
  const { data: templates, error: templatesError } = await supabase
    .from('activity_templates')
    .select('*')
    .eq('stage_id', deal.stage_id)
    .eq('is_active', true)
    .order('order_index');

  if (templatesError) {
    console.error('[TASKS] Error fetching templates:', templatesError);
    return 0;
  }

  if (!templates || templates.length === 0) {
    console.log(`[TASKS] No templates found for stage ${deal.stage_id}`);
    return 0;
  }

  // 2. Create tasks from templates
  const now = new Date();
  const tasks = templates.map((template: any) => {
    const dueDays = template.default_due_days || 0;
    const dueDate = new Date(now.getTime() + dueDays * 24 * 60 * 60 * 1000);

    return {
      deal_id: deal.id,
      template_id: template.id,
      title: template.name,
      description: template.description,
      type: template.type || 'other',
      status: 'pending',
      due_date: dueDate.toISOString(),
      owner_id: deal.owner_id || null,
      contact_id: deal.contact_id || null,
    };
  });

  const { error: insertError } = await supabase
    .from('deal_tasks')
    .insert(tasks);

  if (insertError) {
    console.error('[TASKS] Error inserting tasks:', insertError);
    return 0;
  }

  console.log(`[TASKS] Created ${tasks.length} tasks for deal ${deal.id}`);
  return tasks.length;
}

async function handleDealUpdated(supabase: any, data: any) {
  console.log('[DEAL.UPDATED] Processing deal update');

  const dealData = data.deal || data;
  const contactData = data.contact || {};

  // Buscar deal pelo email do contato
  let dealId = null;
  if (contactData.email) {
    const { data: contact } = await supabase
      .from('crm_contacts')
      .select('id')
      .eq('email', contactData.email)
      .maybeSingle();

    if (contact) {
      const { data: deal } = await supabase
        .from('crm_deals')
        .select('id')
        .eq('contact_id', contact.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      dealId = deal?.id;
    }
  }

  if (!dealId) {
    console.warn('[DEAL.UPDATED] Deal not found, cannot update');
    return { action: 'skipped', reason: 'deal_not_found' };
  }

  const { error } = await supabase
    .from('crm_deals')
    .update({
      name: dealData.name,
      value: dealData.value,
      updated_at: new Date().toISOString(),
      data_source: 'webhook'
    })
    .eq('id', dealId);

  if (error) throw error;

  await createDealActivity(supabase, dealId, 'updated', 'Deal atualizado via webhook', null, null, data);

  console.log('[DEAL.UPDATED] Success');
  return { action: 'updated', deal_id: dealId };
}

async function handleDealStageChanged(supabase: any, data: any) {
  console.log('[DEAL.STAGE_CHANGED] Processing stage change');
  
  const dealData = data.deal || {};
  const contactData = data.contact || {};
  const newStageName = dealData.stage || data.deal_stage;
  const originName = data.deal_origin;

  console.log('[DEAL.STAGE_CHANGED] Contact:', contactData.email);
  console.log('[DEAL.STAGE_CHANGED] New stage:', newStageName);
  console.log('[DEAL.STAGE_CHANGED] Origin:', originName);

  if (!newStageName) {
    throw new Error('Stage name not provided in webhook');
  }

  // 1. Buscar origem pelo nome (se fornecida)
  let originId = null;
  if (originName) {
    const { data: origin } = await supabase
      .from('crm_origins')
      .select('id, name')
      .ilike('name', originName)
      .maybeSingle();
    
    originId = origin?.id;
    console.log('[DEAL.STAGE_CHANGED] Origin found:', origin?.name, originId);
  }

  // 2. Buscar o estágio novo pelo NOME e ORIGEM
  const stageQuery = supabase
    .from('crm_stages')
    .select('id, stage_name, origin_id')
    .ilike('stage_name', newStageName);
  
  // Se encontrou a origem, filtrar por ela para evitar ambiguidade
  if (originId) {
    stageQuery.eq('origin_id', originId);
  }
  
  const { data: newStage } = await stageQuery.maybeSingle();

  if (!newStage) {
    const errorMsg = originId 
      ? `Stage not found: ${newStageName} for origin ${originName}`
      : `Stage not found: ${newStageName}`;
    throw new Error(errorMsg);
  }

  console.log('[DEAL.STAGE_CHANGED] Found stage:', newStage.stage_name, newStage.id, 'origin_id:', newStage.origin_id);

  // 2. Buscar o deal de múltiplas formas (robusto)
  let dealId = null;
  let currentStageId = null;
  let currentStageName = null;
  let contactId = null;
  let dealHasOwner = false;

  // 2.1. Primeiro, buscar o contato pelo email
  if (contactData.email) {
    const { data: contact } = await supabase
      .from('crm_contacts')
      .select('id')
      .ilike('email', contactData.email)
      .maybeSingle();

    if (contact) {
      contactId = contact.id;
      console.log('[DEAL.STAGE_CHANGED] Found contact by email:', contactId);
    } else {
      // NOVO: Criar contato se não existir (igual ao handleDealCreated)
      console.log('[DEAL.STAGE_CHANGED] Contact not found by email, creating...');
      const normalizedPhone = contactData.phone ? normalizePhone(contactData.phone) : null;
      
      const { data: newContact, error: contactError } = await supabase
        .from('crm_contacts')
        .insert({
          clint_id: contactData.id || `webhook-contact-${Date.now()}`,
          name: contactData.name || data.contact_name || 'Contato via webhook',
          email: contactData.email,
          phone: normalizedPhone,
          tags: contactData.tags || [],
        })
        .select('id')
        .single();
      
      if (!contactError && newContact) {
        contactId = newContact.id;
        console.log('[DEAL.STAGE_CHANGED] Contact created:', contactId);
      } else {
        console.error('[DEAL.STAGE_CHANGED] Error creating contact:', contactError);
      }
    }
  }

  // 2.1b. NOVO: Se não tem email mas tem telefone, tentar buscar/criar por telefone
  if (!contactId && (contactData.phone || data.contact_phone)) {
    const phone = contactData.phone || data.contact_phone;
    const normalizedPhone = normalizePhone(phone);
    
    if (normalizedPhone) {
      const { data: contactByPhone } = await supabase
        .from('crm_contacts')
        .select('id')
        .eq('phone', normalizedPhone)
        .maybeSingle();
      
      if (contactByPhone) {
        contactId = contactByPhone.id;
        console.log('[DEAL.STAGE_CHANGED] Found contact by phone:', contactId);
      } else {
        // Criar contato pelo telefone
        console.log('[DEAL.STAGE_CHANGED] Creating contact by phone...');
        const { data: newContact, error: contactError } = await supabase
          .from('crm_contacts')
          .insert({
            clint_id: contactData.id || `webhook-phone-${Date.now()}`,
            name: contactData.name || data.contact_name || 'Contato via webhook',
            email: contactData.email || null,
            phone: normalizedPhone,
            tags: contactData.tags || [],
          })
          .select('id')
          .single();
        
        if (!contactError && newContact) {
          contactId = newContact.id;
          console.log('[DEAL.STAGE_CHANGED] Contact created by phone:', contactId);
        }
      }
    }
  }

  // 2.2. Tentar buscar deal por contact_id (se encontrou contato)
  if (contactId) {
    const { data: dealByContact } = await supabase
      .from('crm_deals')
      .select('id, stage_id, clint_id, owner_id')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (dealByContact) {
      dealId = dealByContact.id;
      currentStageId = dealByContact.stage_id;
      dealHasOwner = !!dealByContact.owner_id;
      console.log('[DEAL.STAGE_CHANGED] Found deal by contact_id:', dealId, 'clint_id:', dealByContact.clint_id, 'owner_id:', dealByContact.owner_id);
      
      // RECONCILIAÇÃO: Se o deal foi criado via Hubla (clint_id = hubla-deal-*) mas agora
      // temos o ID real do Clint (data.deal_id é UUID), atualizar o clint_id
      const existingClintId = dealByContact.clint_id || '';
      const clintDealId = data.deal_id || '';
      const isHublaDeal = existingClintId.startsWith('hubla-deal-');
      const isValidClintUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clintDealId);
      
      if (isHublaDeal && isValidClintUUID && existingClintId !== clintDealId) {
        console.log('[DEAL.STAGE_CHANGED] RECONCILING clint_id: Hubla->', existingClintId, 'Clint->', clintDealId);
        
        const { error: reconcileError } = await supabase
          .from('crm_deals')
          .update({ 
            clint_id: clintDealId,
            updated_at: new Date().toISOString()
          })
          .eq('id', dealId);
        
        if (reconcileError) {
          console.error('[DEAL.STAGE_CHANGED] Error reconciling clint_id:', reconcileError);
        } else {
          console.log('[DEAL.STAGE_CHANGED] Successfully reconciled clint_id for deal:', dealId);
        }
      }
    }
  }

  // 2.3. Se não achou por contact_id, tentar por clint_id do deal
  if (!dealId && data.deal_id) {
    console.log('[DEAL.STAGE_CHANGED] Trying to find deal by clint_id:', data.deal_id);
    
    const { data: dealByClintId } = await supabase
      .from('crm_deals')
      .select('id, stage_id, contact_id, owner_id')
      .eq('clint_id', data.deal_id)
      .maybeSingle();

    if (dealByClintId) {
      dealId = dealByClintId.id;
      currentStageId = dealByClintId.stage_id;
      dealHasOwner = !!dealByClintId.owner_id;
      console.log('[DEAL.STAGE_CHANGED] Found deal by clint_id:', dealId, 'owner_id:', dealByClintId.owner_id);

      // Se o deal existe mas não tem contact_id vinculado, vincular agora
      if (!dealByClintId.contact_id && contactId) {
        console.log('[DEAL.STAGE_CHANGED] Linking contact to deal');
        await supabase
          .from('crm_deals')
          .update({ contact_id: contactId })
          .eq('id', dealId);
      }
    }
  }

  // 2.4. Se ainda não achou e temos contactId, criar o deal
  if (!dealId && contactId) {
    // === VERIFICAÇÃO DE PARCEIRO antes de criar deal ===
    const contactEmail = contactData.email || data.contact_email;
    if (contactEmail) {
      const partnerCheck = await checkIfPartner(supabase, contactEmail);
      if (partnerCheck.isPartner) {
        console.log(`[DEAL.STAGE_CHANGED] 🚫 PARCEIRO DETECTADO: ${contactEmail} - Produto: ${partnerCheck.product}. Bloqueando criação.`);
        
        await supabase.from('partner_returns').insert({
          contact_id: contactId,
          contact_email: contactEmail,
          contact_name: contactData.name || data.contact_name,
          partner_product: partnerCheck.product,
          return_source: 'clint_stage_changed',
          return_product: newStageName,
          return_value: data.deal?.value || data.deal_value || 0,
          blocked: true,
        });
        
        return { action: 'blocked', reason: 'partner_detected', product: partnerCheck.product };
      }
    }
    
    console.log('[DEAL.STAGE_CHANGED] Deal not found, creating new deal');
    
    const dealName = data.deal?.name || data.contact?.name || contactData.name || 'Deal via webhook';
    const dealValue = data.deal?.value || data.deal_value || 0;

    // Resolver owner_profile_id a partir do email do owner
    const ownerEmail = data.deal_user || data.deal?.user || null;
    let ownerProfileId: string | null = null;
    if (ownerEmail) {
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', ownerEmail)
        .maybeSingle();
      if (ownerProfile) {
        ownerProfileId = ownerProfile.id;
      }
      console.log('[DEAL.STAGE_CHANGED] Owner lookup:', ownerEmail, '->', ownerProfileId);
    }

    // === DISTRIBUIÇÃO DE LEADS ===
    let finalOwnerEmail = ownerEmail;
    let finalOwnerProfileId = ownerProfileId;
    let wasDistributed = false;

    if (originId) {
      try {
        const { data: distConfig } = await supabase
          .from('lead_distribution_config')
          .select('id')
          .eq('origin_id', originId)
          .eq('is_active', true)
          .limit(1);

        if (distConfig && distConfig.length > 0) {
          console.log('[DEAL.STAGE_CHANGED] Distribution config found for origin:', originId);
          const { data: nextOwner, error: distError } = await supabase
            .rpc('get_next_lead_owner', { p_origin_id: originId });

          if (!distError && nextOwner) {
            finalOwnerEmail = nextOwner;
            wasDistributed = true;
            console.log('[DEAL.STAGE_CHANGED] Distributed to:', finalOwnerEmail, '(original:', ownerEmail, ')');

            const { data: distProfile } = await supabase
              .from('profiles')
              .select('id')
              .eq('email', finalOwnerEmail)
              .maybeSingle();
            if (distProfile) {
              finalOwnerProfileId = distProfile.id;
            }
          } else {
            console.log('[DEAL.STAGE_CHANGED] Distribution failed, using original owner:', distError);
          }
        }
      } catch (err) {
        console.log('[DEAL.STAGE_CHANGED] Erro na distribuicao, usando owner original:', err);
      }
    }
    
    const { data: newDeal, error: createError } = await supabase
      .from('crm_deals')
      .insert({
        clint_id: data.deal_id || `webhook-${Date.now()}`,
        name: dealName,
        contact_id: contactId,
        stage_id: newStage.id,
        origin_id: originId,
        owner_id: finalOwnerEmail,
        owner_profile_id: finalOwnerProfileId,
        value: dealValue,
        custom_fields: {
          deal_user: data.deal_user,
          deal_user_name: data.deal_user_name,
          deal_closer: data.deal_closer,
          deal_origin: data.deal_origin || originName,
          ...(wasDistributed ? {
            distributed: true,
            deal_user_original: ownerEmail,
            distributed_at: new Date().toISOString(),
          } : {}),
        },
        data_source: 'webhook',
        stage_moved_at: new Date().toISOString()
      })
      .select('id, stage_id')
      .single();

    if (createError) {
      console.error('[DEAL.STAGE_CHANGED] Error creating deal:', createError);
      throw createError;
    }

    dealId = newDeal.id;
    currentStageId = newStage.id; // Deal novo já começa no novo estágio
    console.log('[DEAL.STAGE_CHANGED] Created new deal:', dealId);
  }

  if (!dealId) {
    throw new Error('Deal not found and could not be created');
  }

  // Buscar nome do estágio atual (se temos stage_id e o deal não foi criado agora)
  if (currentStageId && currentStageId !== newStage.id) {
    const { data: currentStage } = await supabase
      .from('crm_stages')
      .select('stage_name')
      .eq('id', currentStageId)
      .maybeSingle();
    currentStageName = currentStage?.stage_name;
  }

  // 3. Atualizar o estágio do deal (e origem se encontrada) - só se necessário
  // Se o deal foi criado agora, já tem o stage correto, não precisa atualizar
  if (currentStageId !== newStage.id) {
    const updateData: any = {
      stage_id: newStage.id,
      updated_at: new Date().toISOString(),
      data_source: 'webhook',
      stage_moved_at: new Date().toISOString()
    };
    
    // Se temos origin_id do webhook, atualizar também
    if (originId) {
      updateData.origin_id = originId;
    }

    // CORREÇÃO: Se o deal não tem owner_id mas o webhook tem, atualizar
    const ownerFromWebhook = data.deal_user || data.deal?.user;
    if (ownerFromWebhook && !dealHasOwner) {
      updateData.owner_id = ownerFromWebhook;
      console.log('[DEAL.STAGE_CHANGED] Updating missing owner_id:', ownerFromWebhook);
      
      // Buscar owner_profile_id correspondente
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', ownerFromWebhook)
        .maybeSingle();
      
      if (ownerProfile) {
        updateData.owner_profile_id = ownerProfile.id;
        console.log('[DEAL.STAGE_CHANGED] Profile ID encontrado:', ownerProfile.id);
      } else {
        console.log('[DEAL.STAGE_CHANGED] ⚠️ Profile não encontrado para email:', ownerFromWebhook);
      }
    }

    const { error: updateError } = await supabase
      .from('crm_deals')
      .update(updateData)
      .eq('id', dealId);

    if (updateError) throw updateError;

    console.log('[DEAL.STAGE_CHANGED] Deal updated:', dealId);
  } else {
    console.log('[DEAL.STAGE_CHANGED] Deal already in correct stage, skipping update');
  }

  // 4. Criar atividade de mudança de estágio
  // CORREÇÃO: SEMPRE criar activity para R1 Agendada, mesmo para deals novos
  const isR1Agendada = newStage.stage_name?.toUpperCase().includes('REUNI') && 
                       newStage.stage_name?.toUpperCase().includes('01') && 
                       newStage.stage_name?.toUpperCase().includes('AGENDADA');
  const isR1AgendadaSimple = newStage.stage_name?.toUpperCase() === 'R1 AGENDADA' ||
                             newStage.stage_name?.toUpperCase() === 'REUNIÃO 01 AGENDADA';
  
  // Usar deal_old_stage do webhook como from_stage (mais preciso que o stage local)
  const webhookOldStage = data.deal_old_stage || currentStageName;
  const wasNewDeal = !currentStageId || currentStageId === newStage.id;
  
  // Sempre criar activity se: houve mudança de stage OU é R1 Agendada (mesmo em deal novo)
  const shouldCreateActivity = (currentStageId && currentStageId !== newStage.id) || 
                               (isR1Agendada || isR1AgendadaSimple);
  
  if (shouldCreateActivity) {
    const description = wasNewDeal 
      ? `Deal criado em ${newStage.stage_name}` 
      : `Deal movido de ${webhookOldStage || 'desconhecido'} para ${newStage.stage_name}`;
    
    await createDealActivity(
      supabase,
      dealId,
      'stage_change',
      description,
      webhookOldStage || null,
      newStage.stage_name,
      {
        ...data,
        is_new_deal: wasNewDeal,
        owner_email: data.deal_user || data.deal?.user
      }
    );
    console.log('[DEAL.STAGE_CHANGED] Activity created:', description, 'is_new_deal:', wasNewDeal);
  } else {
    console.log('[DEAL.STAGE_CHANGED] No activity needed (same stage, not R1 Agendada)');
  }

  // 5. CRIAR MEETING_SLOT se for estágio de reunião agendada e tiver dados de reunião
  const meetingResult = await tryCreateMeetingSlotFromClint(supabase, dealId, contactId, newStage.stage_name, data);
  
  // 6. ENQUEUE AUTOMATIONS for the new stage
  let automationResult = null;
  if (currentStageId !== newStage.id || !currentStageId) {
    try {
      automationResult = await enqueueAutomationsForDeal(supabase, {
        dealId,
        contactId,
        newStageId: newStage.id,
        oldStageId: currentStageId,
        originId,
        triggerType: 'enter'
      });
      console.log('[DEAL.STAGE_CHANGED] Automation enqueue result:', automationResult);
    } catch (automationError: any) {
      console.error('[DEAL.STAGE_CHANGED] Error enqueueing automations:', automationError.message);
      // Don't fail the webhook if automation fails
    }
  }
  
  console.log('[DEAL.STAGE_CHANGED] Success');
  return { 
    action: 'stage_changed', 
    deal_id: dealId,
    from_stage: currentStageName,
    to_stage: newStage.stage_name,
    was_created: !currentStageId, // true se foi criado agora
    meeting_slot: meetingResult,
    automations: automationResult
  };
}

async function handleDealDeleted(supabase: any, data: any) {
  console.log('[DEAL.DELETED] Processing:', data.id);

  const { error } = await supabase
    .from('crm_deals')
    .delete()
    .eq('clint_id', data.id);

  if (error) throw error;
  console.log('[DEAL.DELETED] Success');
  return { action: 'deleted', deal_id: data.id };
}

// ============= HANDLERS DE ORIGENS =============

async function handleOriginCreated(supabase: any, data: any) {
  console.log('[ORIGIN.CREATED] Processing:', data.id);

  const groupId = await getInternalGroupId(supabase, data.group_id);
  const parentId = await getInternalOriginId(supabase, data.parent_id);

  const { error } = await supabase
    .from('crm_origins')
    .upsert({
      clint_id: data.id,
      name: data.name,
      description: data.description,
      group_id: groupId,
      parent_id: parentId
    }, {
      onConflict: 'clint_id'
    });

  if (error) throw error;
  console.log('[ORIGIN.CREATED] Success');
  return { action: 'created', origin_id: data.id };
}

async function handleOriginUpdated(supabase: any, data: any) {
  console.log('[ORIGIN.UPDATED] Processing:', data.id);

  const groupId = await getInternalGroupId(supabase, data.group_id);
  const parentId = await getInternalOriginId(supabase, data.parent_id);

  const { error } = await supabase
    .from('crm_origins')
    .update({
      name: data.name,
      description: data.description,
      group_id: groupId,
      parent_id: parentId,
      updated_at: new Date().toISOString()
    })
    .eq('clint_id', data.id);

  if (error) throw error;
  console.log('[ORIGIN.UPDATED] Success');
  return { action: 'updated', origin_id: data.id };
}

// ============= HANDLERS DE ESTÁGIOS =============

async function handleStageCreated(supabase: any, data: any) {
  console.log('[STAGE.CREATED] Processing:', data.id);

  const originId = await getInternalOriginId(supabase, data.origin_id);

  const { error } = await supabase
    .from('crm_stages')
    .upsert({
      clint_id: data.id,
      stage_name: data.name,
      stage_order: data.order || 0,
      color: data.color,
      origin_id: originId,
      is_active: true
    }, {
      onConflict: 'clint_id'
    });

  if (error) throw error;
  console.log('[STAGE.CREATED] Success');
  return { action: 'created', stage_id: data.id };
}

async function handleStageUpdated(supabase: any, data: any) {
  console.log('[STAGE.UPDATED] Processing:', data.id);

  const originId = await getInternalOriginId(supabase, data.origin_id);

  const { error } = await supabase
    .from('crm_stages')
    .update({
      stage_name: data.name,
      stage_order: data.order || 0,
      color: data.color,
      origin_id: originId,
      updated_at: new Date().toISOString()
    })
    .eq('clint_id', data.id);

  if (error) throw error;
  console.log('[STAGE.UPDATED] Success');
  return { action: 'updated', stage_id: data.id };
}

// ============= FUNÇÕES AUXILIARES =============

async function createDealActivity(
  supabase: any,
  dealId: string,
  activityType: string,
  description: string,
  fromStage: string | null,
  toStage: string | null,
  metadata: any
) {
  // CORREÇÃO: Usar deal_updated_stage_at como created_at quando disponível
  // Isso garante que atividades reprocessadas tenham a data original correta
  const originalTimestamp = metadata?.deal_updated_stage_at || metadata?.deal_updated_at;
  const activityCreatedAt = originalTimestamp ? new Date(originalTimestamp).toISOString() : new Date().toISOString();
  
  console.log('[ACTIVITY] Using created_at:', activityCreatedAt, 'from metadata:', !!originalTimestamp);

  // PREVENÇÃO DE DUPLICATAS COM DEDUPE_KEY
  // Gerar chave única baseada em deal_id + activity_type + to_stage + data original (não now())
  const dateKey = activityCreatedAt.substring(0, 16); // YYYY-MM-DDTHH:MM (precisão de minuto)
  const dedupeKey = `${dealId}-${activityType}-${toStage || 'null'}-${dateKey}`;
  
  console.log('[ACTIVITY] Attempting insert with dedupe_key:', dedupeKey);

  // Primeiro, verificar se já existe com a mesma dedupe_key
  const { data: existingActivity } = await supabase
    .from('deal_activities')
    .select('id')
    .eq('metadata->>dedupe_key', dedupeKey)
    .limit(1);

  if (existingActivity && existingActivity.length > 0) {
    console.log('[ACTIVITY] DUPLICATE DETECTED via dedupe_key - Skipping insert. Existing activity:', existingActivity[0].id);
    return;
  }

  // Também verificar por deal_id + to_stage + created_at similar (backup check)
  // Janela de 60 segundos ao redor da data original
  const activityDate = new Date(activityCreatedAt);
  const cutoffBefore = new Date(activityDate.getTime() - 60 * 1000).toISOString();
  const cutoffAfter = new Date(activityDate.getTime() + 60 * 1000).toISOString();
  
  const { data: recentActivity } = await supabase
    .from('deal_activities')
    .select('id, created_at')
    .eq('deal_id', dealId)
    .eq('activity_type', activityType)
    .eq('to_stage', toStage || '')
    .gte('created_at', cutoffBefore)
    .lte('created_at', cutoffAfter)
    .limit(1);

  if (recentActivity && recentActivity.length > 0) {
    console.log('[ACTIVITY] DUPLICATE DETECTED via time window - Skipping insert. Existing activity:', recentActivity[0].id);
    console.log('[ACTIVITY] Deal:', dealId, 'Stage:', toStage, 'Within 60s of:', recentActivity[0].created_at);
    return;
  }

  // Inserir com dedupe_key no metadata E created_at correto
  const { error } = await supabase
    .from('deal_activities')
    .insert({
      deal_id: dealId,
      activity_type: activityType,
      description: description,
      from_stage: fromStage,
      to_stage: toStage,
      created_at: activityCreatedAt, // USAR DATA ORIGINAL, NÃO NOW()
      metadata: { ...metadata, dedupe_key: dedupeKey },
      user_id: null // Webhook, não tem usuário
    });

  if (error) {
    // Se o erro for de constraint única (race condition), ignorar silenciosamente
    if (error.code === '23505') {
      console.log('[ACTIVITY] DUPLICATE CONSTRAINT - Another process already inserted this activity');
      return;
    }
    console.error('[ACTIVITY] Error creating activity:', error);
  } else {
    console.log('[ACTIVITY] Created:', activityType, 'for deal:', dealId, 'at:', activityCreatedAt, 'with dedupe_key:', dedupeKey);
  }
}

async function getInternalContactId(supabase: any, clintId: string | null): Promise<string | null> {
  if (!clintId) return null;
  const { data } = await supabase
    .from('crm_contacts')
    .select('id')
    .eq('clint_id', clintId)
    .maybeSingle();
  return data?.id || null;
}

async function getInternalStageId(supabase: any, clintId: string | null): Promise<string | null> {
  if (!clintId) return null;
  const { data } = await supabase
    .from('crm_stages')
    .select('id')
    .eq('clint_id', clintId)
    .maybeSingle();
  return data?.id || null;
}

async function getInternalOriginId(supabase: any, clintId: string | null): Promise<string | null> {
  if (!clintId) return null;
  const { data } = await supabase
    .from('crm_origins')
    .select('id')
    .eq('clint_id', clintId)
    .maybeSingle();
  return data?.id || null;
}

async function getInternalGroupId(supabase: any, clintId: string | null): Promise<string | null> {
  if (!clintId) return null;
  const { data } = await supabase
    .from('crm_groups')
    .select('id')
    .eq('clint_id', clintId)
    .maybeSingle();
  return data?.id || null;
}

// ============= CRIAR MEETING_SLOT A PARTIR DO CLINT =============

/**
 * Tenta criar um meeting_slot quando o deal muda para estágio de reunião agendada
 * Campos esperados do Clint:
 * - deal_data_reuniao_01 ou deal_data_hora_agendament: Data/hora da reunião
 * - deal_hora_agendamento: Hora separada (opcional)
 * - deal_closer: Nome do closer responsável
 * - deal_link_reuniao_01: Link da reunião (opcional)
 */
async function tryCreateMeetingSlotFromClint(
  supabase: any,
  dealId: string,
  contactId: string | null,
  stageName: string,
  data: any
): Promise<any> {
  // Verificar se é estágio de reunião agendada
  const stageUpper = (stageName || '').toUpperCase();
  const isReuniao01 = (stageUpper.includes('REUNI') || stageUpper.includes('R1')) && 
                      stageUpper.includes('AGENDADA');
  
  if (!isReuniao01) {
    return { skipped: true, reason: 'not_reunion_stage' };
  }

  console.log('[MEETING_SLOT] Detected reunion stage, checking for meeting data...');
  
  // Extrair dados de reunião do payload
  const meetingDate = data.deal_data_reuniao_01 || data.deal_data_hora_agendament || data.deal_data_reuniao_closer;
  const meetingTime = data.deal_hora_agendamento;
  const closerName = data.deal_closer;
  const meetingLink = data.deal_link_reuniao_01;
  
  console.log('[MEETING_SLOT] Meeting data:', { meetingDate, meetingTime, closerName, meetingLink });
  
  // Precisa pelo menos de data e closer
  if (!meetingDate || !closerName) {
    console.log('[MEETING_SLOT] Missing required data (date or closer)');
    return { skipped: true, reason: 'missing_data', missing: { date: !meetingDate, closer: !closerName } };
  }
  
  // 1. Buscar closer pelo nome
  const { data: closer } = await supabase
    .from('closers')
    .select('id, name, calendly_default_link')
    .ilike('name', `%${closerName}%`)
    .eq('is_active', true)
    .maybeSingle();
  
  if (!closer) {
    console.log('[MEETING_SLOT] Closer not found:', closerName);
    return { skipped: true, reason: 'closer_not_found', closer_name: closerName };
  }
  
  console.log('[MEETING_SLOT] Found closer:', closer.name, closer.id);
  
  // 2. Parsear data/hora
  const scheduledAt = parseClintDateTime(meetingDate, meetingTime);
  if (!scheduledAt) {
    console.log('[MEETING_SLOT] Failed to parse datetime:', meetingDate, meetingTime);
    return { skipped: true, reason: 'invalid_datetime', raw: { date: meetingDate, time: meetingTime } };
  }
  
  console.log('[MEETING_SLOT] Parsed scheduled_at:', scheduledAt);
  
  // 3. Verificar se já existe slot para este deal
  const { data: existingSlot } = await supabase
    .from('meeting_slots')
    .select('id, scheduled_at, status')
    .eq('deal_id', dealId)
    .in('status', ['scheduled', 'rescheduled'])
    .maybeSingle();
  
  if (existingSlot) {
    console.log('[MEETING_SLOT] Slot already exists for deal:', existingSlot.id);
    return { skipped: true, reason: 'slot_already_exists', existing_slot_id: existingSlot.id };
  }
  
  // 4. Detectar lead_type baseado nas tags (buscar em múltiplos lugares)
  const tags = data.tags || data.contact?.tags || [];
  const leadType = detectLeadTypeFromTags(tags, data);
  console.log('[MEETING_SLOT] Detected lead_type:', leadType);
  
  // 5. Criar meeting_slot com source = clint_webhook
  const { data: newSlot, error: slotError } = await supabase
    .from('meeting_slots')
    .insert({
      closer_id: closer.id,
      deal_id: dealId,
      contact_id: contactId,
      scheduled_at: scheduledAt,
      duration_minutes: 60,
      status: 'scheduled',
      meeting_link: meetingLink || closer.calendly_default_link || null,
      notes: 'Criado via webhook Clint',
      lead_type: leadType,
      source: 'clint_webhook'
    })
    .select('id')
    .single();
  
  if (slotError) {
    console.error('[MEETING_SLOT] Error creating slot:', slotError);
    return { error: true, message: slotError.message };
  }
  
  console.log('[MEETING_SLOT] Successfully created slot:', newSlot.id);
  
  // 6. Atualizar deal com próxima ação = reunião
  await supabase
    .from('crm_deals')
    .update({
      next_action_type: 'meeting',
      next_action_date: scheduledAt,
      next_action_note: `Reunião com ${closer.name}`,
      updated_at: new Date().toISOString()
    })
    .eq('id', dealId);
  
  return { created: true, slot_id: newSlot.id, closer: closer.name, scheduled_at: scheduledAt, lead_type: leadType };
}

/**
 * Detecta o tipo de lead (A ou B) baseado em tags e campos do payload
 * Prioriza padrões explícitos, com fallback para default 'A'
 */
function detectLeadTypeFromTags(tags: any[], data: any): 'A' | 'B' {
  // Combinar tags de múltiplas fontes
  const allTags: string[] = [];
  
  if (Array.isArray(tags)) {
    allTags.push(...tags.map(t => String(t)));
  }
  
  // Também checar campos específicos que podem indicar tipo
  if (data.contact_tag) allTags.push(String(data.contact_tag));
  if (data.deal_tag) allTags.push(String(data.deal_tag));
  if (data.lead_type) {
    // Campo explícito de tipo de lead
    const explicit = String(data.lead_type).toUpperCase().trim();
    if (explicit === 'B' || explicit.includes('LEAD B')) return 'B';
    if (explicit === 'A' || explicit.includes('LEAD A')) return 'A';
  }
  
  // Analisar cada tag
  for (const tag of allTags) {
    const tagUpper = String(tag).toUpperCase().trim();
    
    // Patterns para Lead B (verificar primeiro - mais específico)
    if (
      tagUpper === 'LEAD B' ||
      tagUpper === 'B' ||
      tagUpper.includes('LEAD B') ||
      tagUpper.includes('TIPO B') ||
      tagUpper.includes('NAO CONSTROI') ||
      tagUpper.includes('NÃO CONSTRÓI') ||
      tagUpper.includes('NAO INVESTE') ||
      tagUpper.includes('NÃO INVESTE') ||
      (tagUpper.includes('LEAD') && /\bB\b/.test(tagUpper))
    ) {
      return 'B';
    }
    
    // Patterns para Lead A
    if (
      tagUpper === 'LEAD A' ||
      tagUpper === 'A' ||
      tagUpper.includes('LEAD A') ||
      tagUpper.includes('TIPO A') ||
      tagUpper.includes('JÁ CONSTRÓI') ||
      tagUpper.includes('JA CONSTROI') ||
      tagUpper.includes('INVESTIDOR') ||
      (tagUpper.includes('LEAD') && /\bA\b/.test(tagUpper))
    ) {
      return 'A';
    }
  }
  
  // Default: Lead A se não encontrar indicador explícito
  return 'A';
}

/**
 * Parseia data/hora do Clint em diferentes formatos
 * Exemplos de entrada:
 * - "2025-01-15 14:30:00"
 * - "15/01/2025 14:30"
 * - "2025-01-15" + "14:30"
 */
function parseClintDateTime(dateStr: string, timeStr?: string): string | null {
  try {
    let dateObj: Date;
    
    // Normalizar string
    const cleanDate = String(dateStr).trim();
    const cleanTime = timeStr ? String(timeStr).trim() : null;
    
    // Formato ISO: 2025-01-15T14:30:00 ou 2025-01-15 14:30:00
    if (/^\d{4}-\d{2}-\d{2}/.test(cleanDate)) {
      if (cleanTime && /^\d{2}:\d{2}/.test(cleanTime)) {
        // Data + hora separados
        const datePart = cleanDate.split(/[T ]/)[0];
        dateObj = new Date(`${datePart}T${cleanTime}:00`);
      } else {
        // Data já contém hora
        dateObj = new Date(cleanDate.replace(' ', 'T'));
      }
    }
    // Formato BR: 15/01/2025 ou 15/01/2025 14:30
    else if (/^\d{2}\/\d{2}\/\d{4}/.test(cleanDate)) {
      const parts = cleanDate.split(/[\s]+/);
      const dateParts = parts[0].split('/');
      const timePart = cleanTime || parts[1] || '12:00';
      
      // DD/MM/YYYY -> YYYY-MM-DD
      const isoDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
      dateObj = new Date(`${isoDate}T${timePart}:00`);
    }
    else {
      // Tentar parse genérico
      dateObj = new Date(cleanDate);
    }
    
    // Validar resultado
    if (isNaN(dateObj.getTime())) {
      console.log('[PARSE_DATETIME] Invalid date result:', cleanDate, cleanTime);
      return null;
    }
    
    return dateObj.toISOString();
  } catch (err) {
    console.error('[PARSE_DATETIME] Error parsing:', dateStr, timeStr, err);
    return null;
  }
}

// ============= AUTOMATION INTEGRATION =============

interface AutomationEnqueueParams {
  dealId: string;
  contactId: string | null;
  newStageId: string;
  oldStageId?: string | null;
  originId?: string | null;
  triggerType: 'enter' | 'exit';
}

/**
 * Enqueues automation flows for a deal that changed stage
 * This calls the automation-enqueue edge function
 */
async function enqueueAutomationsForDeal(
  supabase: any,
  params: AutomationEnqueueParams
): Promise<{ enqueued: number } | null> {
  const { dealId, contactId, newStageId, oldStageId, originId, triggerType } = params;

  if (!dealId || !newStageId) {
    console.log('[AUTOMATION] Missing dealId or newStageId, skipping');
    return null;
  }

  if (!contactId) {
    console.log('[AUTOMATION] No contactId, skipping automation enqueue');
    return null;
  }

  try {
    // Call the automation-enqueue function
    const { data, error } = await supabase.functions.invoke('automation-enqueue', {
      body: {
        dealId,
        contactId,
        newStageId,
        oldStageId,
        originId,
        triggerType
      }
    });

    if (error) {
      console.error('[AUTOMATION] Error calling automation-enqueue:', error);
      return null;
    }

    console.log('[AUTOMATION] Enqueue result:', data);
    return { enqueued: data?.enqueued || 0 };
  } catch (err: any) {
    console.error('[AUTOMATION] Exception calling automation-enqueue:', err.message);
    return null;
  }
}
