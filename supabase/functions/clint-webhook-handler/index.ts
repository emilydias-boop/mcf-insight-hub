// Clint CRM Webhook Handler - Version 2025-11-24T16:30:00Z
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

// ============= HANDLERS DE CONTATOS =============

async function handleContactCreated(supabase: any, data: any) {
  console.log('[CONTACT.CREATED] Processing contact:', data.contact?.name || data.name);

  const contactData = data.contact || data;
  const email = contactData.email || data.email;

  // Verificar se já existe pelo email
  if (email) {
    const { data: existing } = await supabase
      .from('crm_contacts')
      .select('id')
      .eq('email', email)
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
      phone: contactData.phone || data.phone,
      organization_name: data.organization?.name,
      tags: data.tags || [],
      custom_fields: data.custom_fields || {}
    });

  if (error) throw error;
  console.log('[CONTACT.CREATED] Success');
  return { action: 'created', contact: contactData.name };
}

async function handleContactUpdated(supabase: any, data: any) {
  const contactData = data.contact || data;
  const email = contactData.email || data.email;
  
  console.log('[CONTACT.UPDATED] Processing contact:', contactData.name, email);

  if (!email) {
    console.warn('[CONTACT.UPDATED] No email provided, skipping');
    return { action: 'skipped', reason: 'no_email' };
  }

  // Buscar contato pelo email
  const { data: existing } = await supabase
    .from('crm_contacts')
    .select('id, clint_id')
    .eq('email', email)
    .maybeSingle();

  if (existing) {
    // Atualizar contato existente
    const { error } = await supabase
      .from('crm_contacts')
      .update({
        name: contactData.name || data.name,
        phone: contactData.phone || data.phone,
        organization_name: data.organization?.name,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);

    if (error) throw error;
    console.log('[CONTACT.UPDATED] Success - updated existing');
    return { action: 'updated', contact_id: existing.id };
  } else {
    // Criar novo contato
    const { error } = await supabase
      .from('crm_contacts')
      .insert({
        clint_id: data.id || `clint-${Date.now()}`,
        name: contactData.name || data.name,
        email: email,
        phone: contactData.phone || data.phone,
        tags: [],
        custom_fields: {}
      });

    if (error) throw error;
    console.log('[CONTACT.UPDATED] Success - created new');
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

async function handleDealCreated(supabase: any, data: any) {
  console.log('[DEAL.CREATED] Processing deal:', data.deal?.name || data.name);
  console.log('[DEAL.CREATED] Full payload:', JSON.stringify(data, null, 2));

  const dealData = data.deal || data;
  const contactData = data.contact || {};
  const originName = data.deal_origin || data.origin?.name;
  const ownerName = dealData.user || data.deal_user;

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

  // 4. Owner (usuário responsável) - salvar EMAIL diretamente para consistência com Clint
  // O deal_user vem como email no formato: "julia.caroline@minhacasafinanciada.com"
  const ownerId = ownerName || null;
  console.log('[DEAL.CREATED] Owner (email):', ownerId);

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
  Object.keys(data).forEach(key => {
    if (!excludedFields.includes(key) && data[key] !== undefined && data[key] !== null) {
      customFields[key] = data[key];
    }
  });
  console.log('[DEAL.CREATED] Custom fields:', customFields);

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
      tags: data.tags || dealData.tags || [],
      probability: data.probability || dealData.probability,
      expected_close_date: data.expected_close_date || dealData.expected_close_date,
      custom_fields: customFields,
      product_name: productName,
      data_source: 'webhook'
    }, { onConflict: 'clint_id' })
    .select()
    .single();

  if (error) {
    console.error('[DEAL.CREATED] Error creating deal:', error);
    throw error;
  }

  // 8. Registrar atividade
  await createDealActivity(supabase, deal.id, 'created', 'Deal criado via webhook', null, null, data);

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

  // 2.1. Primeiro, buscar o contato pelo email
  if (contactData.email) {
    const { data: contact } = await supabase
      .from('crm_contacts')
      .select('id')
      .ilike('email', contactData.email)
      .maybeSingle();

    if (contact) {
      contactId = contact.id;
      console.log('[DEAL.STAGE_CHANGED] Found contact:', contactId);

      // 2.2. Tentar buscar deal por contact_id
      const { data: dealByContact } = await supabase
        .from('crm_deals')
        .select('id, stage_id, clint_id')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (dealByContact) {
        dealId = dealByContact.id;
        currentStageId = dealByContact.stage_id;
        console.log('[DEAL.STAGE_CHANGED] Found deal by contact_id:', dealId);
      }
    }
  }

  // 2.3. Se não achou por contact_id, tentar por clint_id do deal
  if (!dealId && data.deal_id) {
    console.log('[DEAL.STAGE_CHANGED] Trying to find deal by clint_id:', data.deal_id);
    
    const { data: dealByClintId } = await supabase
      .from('crm_deals')
      .select('id, stage_id, contact_id')
      .eq('clint_id', data.deal_id)
      .maybeSingle();

    if (dealByClintId) {
      dealId = dealByClintId.id;
      currentStageId = dealByClintId.stage_id;
      console.log('[DEAL.STAGE_CHANGED] Found deal by clint_id:', dealId);

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
    console.log('[DEAL.STAGE_CHANGED] Deal not found, creating new deal');
    
    const dealName = data.deal?.name || data.contact?.name || contactData.name || 'Deal via webhook';
    const dealValue = data.deal?.value || data.deal_value || 0;
    
    const { data: newDeal, error: createError } = await supabase
      .from('crm_deals')
      .insert({
        clint_id: data.deal_id || `webhook-${Date.now()}`,
        name: dealName,
        contact_id: contactId,
        stage_id: newStage.id,
        origin_id: originId,
        owner_id: data.deal_user || data.deal?.user || null, // Salvar email como owner_id
        value: dealValue,
        custom_fields: {
          deal_user: data.deal_user,
          deal_user_name: data.deal_user_name,
          deal_closer: data.deal_closer,
          deal_origin: data.deal_origin || originName,
        },
        data_source: 'webhook'
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
      data_source: 'webhook'
    };
    
    // Se temos origin_id do webhook, atualizar também
    if (originId) {
      updateData.origin_id = originId;
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

  // 4. Criar atividade de mudança de estágio - só se houve mudança real
  if (currentStageId && currentStageId !== newStage.id) {
    const description = `Deal movido de ${currentStageName || 'desconhecido'} para ${newStage.stage_name}`;
    await createDealActivity(
      supabase,
      dealId,
      'stage_change',
      description,
      currentStageName,
      newStage.stage_name,
      data
    );
    console.log('[DEAL.STAGE_CHANGED] Activity created');
  } else {
    console.log('[DEAL.STAGE_CHANGED] No stage change activity needed (new deal or same stage)');
  }

  console.log('[DEAL.STAGE_CHANGED] Success');
  return { 
    action: 'stage_changed', 
    deal_id: dealId,
    from_stage: currentStageName,
    to_stage: newStage.stage_name,
    was_created: !currentStageId // true se foi criado agora
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
  const { error } = await supabase
    .from('deal_activities')
    .insert({
      deal_id: dealId,
      activity_type: activityType,
      description: description,
      from_stage: fromStage,
      to_stage: toStage,
      metadata: metadata,
      user_id: null // Webhook, não tem usuário
    });

  if (error) {
    console.error('[ACTIVITY] Error creating activity:', error);
  } else {
    console.log('[ACTIVITY] Created:', activityType);
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
