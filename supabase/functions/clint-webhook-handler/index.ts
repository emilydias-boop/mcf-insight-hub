// Clint CRM Webhook Handler - Version 2025-11-24T15:00:00Z
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

serve(async (req) => {
  console.log('[WEBHOOK] New request received - Version 2025-11-24T15:00:00Z');
  
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
    const payload: WebhookEvent = await req.json();
    console.log('[WEBHOOK] Event received:', payload.event);
    console.log('[WEBHOOK] Data:', JSON.stringify(payload.data).substring(0, 200));

    // Validar estrutura básica
    if (!payload.event || !payload.data) {
      console.error('[WEBHOOK] Invalid payload structure');
      return new Response(
        JSON.stringify({ error: 'Invalid payload structure' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar log do webhook
    const { data: logData, error: logError } = await supabase
      .from('webhook_events')
      .insert({
        event_type: payload.event,
        event_data: payload,
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

    // Processar o evento baseado no tipo
    let result: any = null;

    switch (payload.event) {
      case 'contact.created':
        result = await handleContactCreated(supabase, payload.data);
        break;
      case 'contact.updated':
        result = await handleContactUpdated(supabase, payload.data);
        break;
      case 'contact.deleted':
        result = await handleContactDeleted(supabase, payload.data);
        break;
      
      case 'deal.created':
        result = await handleDealCreated(supabase, payload.data);
        break;
      case 'deal.updated':
        result = await handleDealUpdated(supabase, payload.data);
        break;
      case 'deal.stage_changed':
        result = await handleDealStageChanged(supabase, payload.data);
        break;
      case 'deal.deleted':
        result = await handleDealDeleted(supabase, payload.data);
        break;

      case 'origin.created':
        result = await handleOriginCreated(supabase, payload.data);
        break;
      case 'origin.updated':
        result = await handleOriginUpdated(supabase, payload.data);
        break;

      case 'stage.created':
        result = await handleStageCreated(supabase, payload.data);
        break;
      case 'stage.updated':
        result = await handleStageUpdated(supabase, payload.data);
        break;

      default:
        console.log('[WEBHOOK] Unhandled event type:', payload.event);
        result = { message: 'Event type not handled', event: payload.event };
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

// ============= HANDLERS DE CONTATOS =============

async function handleContactCreated(supabase: any, data: any) {
  console.log('[CONTACT.CREATED] Processing:', data.id);

  const { data: existing } = await supabase
    .from('crm_contacts')
    .select('id')
    .eq('clint_id', data.id)
    .single();

  if (existing) {
    console.log('[CONTACT.CREATED] Contact already exists, updating instead');
    return handleContactUpdated(supabase, data);
  }

  const { error } = await supabase
    .from('crm_contacts')
    .insert({
      clint_id: data.id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      organization_name: data.organization?.name,
      origin_id: data.origin_id,
      tags: data.tags || [],
      custom_fields: data.custom_fields || {}
    });

  if (error) throw error;
  console.log('[CONTACT.CREATED] Success');
  return { action: 'created', contact_id: data.id };
}

async function handleContactUpdated(supabase: any, data: any) {
  console.log('[CONTACT.UPDATED] Processing:', data.id);

  const { error } = await supabase
    .from('crm_contacts')
    .upsert({
      clint_id: data.id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      organization_name: data.organization?.name,
      origin_id: data.origin_id,
      tags: data.tags || [],
      custom_fields: data.custom_fields || {},
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'clint_id'
    });

  if (error) throw error;
  console.log('[CONTACT.UPDATED] Success');
  return { action: 'updated', contact_id: data.id };
}

async function handleContactDeleted(supabase: any, data: any) {
  console.log('[CONTACT.DELETED] Processing:', data.id);

  // Soft delete - você pode mudar para hard delete se preferir
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
  console.log('[DEAL.CREATED] Processing:', data.id);

  const { data: existing } = await supabase
    .from('crm_deals')
    .select('id')
    .eq('clint_id', data.id)
    .single();

  if (existing) {
    console.log('[DEAL.CREATED] Deal already exists, updating instead');
    return handleDealUpdated(supabase, data);
  }

  // Buscar IDs internos
  const contactId = await getInternalContactId(supabase, data.contact_id);
  const stageId = await getInternalStageId(supabase, data.stage_id);
  const originId = await getInternalOriginId(supabase, data.origin_id);

  const { data: deal, error } = await supabase
    .from('crm_deals')
    .insert({
      clint_id: data.id,
      name: data.name,
      value: data.value || 0,
      stage_id: stageId,
      contact_id: contactId,
      origin_id: originId,
      owner_id: data.owner_id,
      probability: data.probability,
      expected_close_date: data.expected_close_date,
      tags: data.tags || [],
      custom_fields: data.custom_fields || {}
    })
    .select()
    .single();

  if (error) throw error;

  // Criar atividade
  await createDealActivity(supabase, deal.id, 'created', 'Deal criado via webhook', null, null, data);

  console.log('[DEAL.CREATED] Success');
  return { action: 'created', deal_id: data.id };
}

async function handleDealUpdated(supabase: any, data: any) {
  console.log('[DEAL.UPDATED] Processing:', data.id);

  const contactId = await getInternalContactId(supabase, data.contact_id);
  const stageId = await getInternalStageId(supabase, data.stage_id);
  const originId = await getInternalOriginId(supabase, data.origin_id);

  const { data: deal, error } = await supabase
    .from('crm_deals')
    .update({
      name: data.name,
      value: data.value || 0,
      stage_id: stageId,
      contact_id: contactId,
      origin_id: originId,
      owner_id: data.owner_id,
      probability: data.probability,
      expected_close_date: data.expected_close_date,
      tags: data.tags || [],
      custom_fields: data.custom_fields || {},
      updated_at: new Date().toISOString()
    })
    .eq('clint_id', data.id)
    .select()
    .single();

  if (error) throw error;

  // Criar atividade
  await createDealActivity(supabase, deal.id, 'updated', 'Deal atualizado via webhook', null, null, data);

  console.log('[DEAL.UPDATED] Success');
  return { action: 'updated', deal_id: data.id };
}

async function handleDealStageChanged(supabase: any, data: any) {
  console.log('[DEAL.STAGE_CHANGED] Processing:', data.id);
  console.log('[DEAL.STAGE_CHANGED] From:', data.from_stage_id, 'To:', data.to_stage_id);

  const fromStageId = await getInternalStageId(supabase, data.from_stage_id);
  const toStageId = await getInternalStageId(supabase, data.to_stage_id);

  // Buscar nomes dos estágios
  const { data: fromStage } = await supabase
    .from('crm_stages')
    .select('stage_name')
    .eq('id', fromStageId)
    .single();

  const { data: toStage } = await supabase
    .from('crm_stages')
    .select('stage_name')
    .eq('id', toStageId)
    .single();

  // Atualizar estágio do deal
  const { data: deal, error } = await supabase
    .from('crm_deals')
    .update({
      stage_id: toStageId,
      updated_at: new Date().toISOString()
    })
    .eq('clint_id', data.id)
    .select()
    .single();

  if (error) throw error;

  // Criar atividade de mudança de estágio
  const description = `Deal movido de ${fromStage?.stage_name || 'desconhecido'} para ${toStage?.stage_name || 'desconhecido'}`;
  await createDealActivity(
    supabase,
    deal.id,
    'stage_change',
    description,
    fromStage?.stage_name,
    toStage?.stage_name,
    data
  );

  console.log('[DEAL.STAGE_CHANGED] Success');
  return { 
    action: 'stage_changed', 
    deal_id: data.id,
    from_stage: fromStage?.stage_name,
    to_stage: toStage?.stage_name
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
    .single();
  return data?.id || null;
}

async function getInternalStageId(supabase: any, clintId: string | null): Promise<string | null> {
  if (!clintId) return null;
  const { data } = await supabase
    .from('crm_stages')
    .select('id')
    .eq('clint_id', clintId)
    .single();
  return data?.id || null;
}

async function getInternalOriginId(supabase: any, clintId: string | null): Promise<string | null> {
  if (!clintId) return null;
  const { data } = await supabase
    .from('crm_origins')
    .select('id')
    .eq('clint_id', clintId)
    .single();
  return data?.id || null;
}

async function getInternalGroupId(supabase: any, clintId: string | null): Promise<string | null> {
  if (!clintId) return null;
  const { data } = await supabase
    .from('crm_groups')
    .select('id')
    .eq('clint_id', clintId)
    .single();
  return data?.id || null;
}
