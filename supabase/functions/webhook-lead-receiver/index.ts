import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-source-tag, x-webhook-key',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Extract slug from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const slug = pathParts[pathParts.length - 1];

    if (!slug || slug === 'webhook-lead-receiver') {
      console.error('[WEBHOOK-RECEIVER] Slug não fornecido na URL');
      return new Response(
        JSON.stringify({ error: 'Slug do endpoint é obrigatório na URL (ex: /webhook-lead-receiver/instagram-bio)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[WEBHOOK-RECEIVER] Recebendo lead para slug: ${slug}`);

    // 1. Fetch endpoint configuration
    const { data: endpoint, error: endpointError } = await supabase
      .from('webhook_endpoints')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();

    if (endpointError) {
      console.error('[WEBHOOK-RECEIVER] Erro ao buscar endpoint:', endpointError);
      throw endpointError;
    }

    if (!endpoint) {
      console.error(`[WEBHOOK-RECEIVER] Endpoint não encontrado ou inativo: ${slug}`);
      return new Response(
        JSON.stringify({ error: `Endpoint '${slug}' não encontrado ou está inativo` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[WEBHOOK-RECEIVER] Endpoint encontrado: ${endpoint.name}`);

    // 2. Validate authentication if configured
    if (endpoint.auth_header_name && endpoint.auth_header_value) {
      const authHeader = req.headers.get(endpoint.auth_header_name);
      if (authHeader !== endpoint.auth_header_value) {
        console.error('[WEBHOOK-RECEIVER] Autenticação inválida');
        return new Response(
          JSON.stringify({ error: 'Autenticação inválida' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 3. Parse payload
    const payload = await req.json();
    console.log('[WEBHOOK-RECEIVER] Payload recebido:', JSON.stringify(payload, null, 2));

    // 4. Validate required fields
    const requiredFields = endpoint.required_fields || ['name', 'email'];
    const missingFields = requiredFields.filter((field: string) => !payload[field]);
    
    if (missingFields.length > 0) {
      console.error('[WEBHOOK-RECEIVER] Campos obrigatórios faltando:', missingFields);
      return new Response(
        JSON.stringify({ error: `Campos obrigatórios: ${missingFields.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Get origin and stage info
    if (!endpoint.origin_id) {
      console.error('[WEBHOOK-RECEIVER] Endpoint sem origin_id configurado');
      return new Response(
        JSON.stringify({ error: 'Endpoint não possui origin configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the initial stage if not configured
    // IMPORTANT: crm_deals.stage_id has a FK to crm_stages, NOT local_pipeline_stages
    // So we can only use stage_id if it exists in crm_stages
    let stageId: string | null = null;
    
    if (endpoint.stage_id) {
      // Verify if the configured stage_id exists in crm_stages (FK constraint)
      const { data: validStage } = await supabase
        .from('crm_stages')
        .select('id')
        .eq('id', endpoint.stage_id)
        .maybeSingle();
      
      if (validStage) {
        stageId = validStage.id;
        console.log('[WEBHOOK-RECEIVER] Usando stage de crm_stages:', stageId);
      } else {
        console.log('[WEBHOOK-RECEIVER] stage_id configurado está em local_pipeline_stages, usando null para FK');
      }
    }
    
    // If no valid stage_id, try to find one in local_pipeline_stages first, then crm_stages
    if (!stageId) {
      // 1. Tentar local_pipeline_stages primeiro (pipelines customizadas)
      const { data: localStage } = await supabase
        .from('local_pipeline_stages')
        .select('id')
        .eq('origin_id', endpoint.origin_id)
        .eq('is_active', true)
        .order('stage_order', { ascending: true })
        .limit(1)
        .maybeSingle();
      
      if (localStage) {
        stageId = localStage.id;
        console.log('[WEBHOOK-RECEIVER] Usando primeira stage de local_pipeline_stages:', stageId);
      } else {
        // 2. Fallback para crm_stages (pipelines legadas)
        const { data: legacyStage } = await supabase
          .from('crm_stages')
          .select('id')
          .eq('origin_id', endpoint.origin_id)
          .order('stage_order', { ascending: true })
          .limit(1)
          .maybeSingle();
        
        if (legacyStage) {
          stageId = legacyStage.id;
          console.log('[WEBHOOK-RECEIVER] Usando primeira stage de crm_stages:', stageId);
        } else {
          console.log('[WEBHOOK-RECEIVER] Nenhuma stage encontrada, deal será criado sem stage_id');
        }
      }
    }

    // 6. Normalize phone
    const normalizedPhone = normalizePhone(payload.whatsapp || payload.phone || payload.telefone);
    console.log('[WEBHOOK-RECEIVER] Telefone normalizado:', normalizedPhone);

    // 7. Upsert contact
    let contactId: string;
    const { data: existingContact } = await supabase
      .from('crm_contacts')
      .select('id')
      .ilike('email', (payload.email || '').trim())
      .maybeSingle();

    const autoTags = endpoint.auto_tags || [];
    const sourceTag = req.headers.get('x-source-tag');
    if (sourceTag && !autoTags.includes(sourceTag)) {
      autoTags.push(sourceTag);
    }

    if (existingContact) {
      contactId = existingContact.id;
      console.log('[WEBHOOK-RECEIVER] Contato existente:', contactId);
      
      // Update contact with new data
      await supabase
        .from('crm_contacts')
        .update({
          name: payload.name,
          phone: normalizedPhone,
          tags: autoTags.length > 0 ? autoTags : undefined,
          updated_at: new Date().toISOString()
        })
        .eq('id', contactId);
    } else {
      // Create new contact
      const { data: newContact, error: contactError } = await supabase
        .from('crm_contacts')
        .insert({
          clint_id: `${slug}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          name: payload.name,
          email: (payload.email || '').trim().toLowerCase(),
          phone: normalizedPhone,
          origin_id: endpoint.origin_id,
          tags: autoTags
        })
        .select('id')
        .single();
      
      if (contactError) {
        console.error('[WEBHOOK-RECEIVER] Erro ao criar contato:', contactError);
        throw contactError;
      }
      contactId = newContact.id;
      console.log('[WEBHOOK-RECEIVER] Novo contato criado:', contactId);
    }

    // 8. Check for existing deal (duplicata recente nas últimas 24h)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: existingDeal } = await supabase
      .from('crm_deals')
      .select('id')
      .eq('contact_id', contactId)
      .eq('origin_id', endpoint.origin_id)
      .gte('created_at', twentyFourHoursAgo)
      .maybeSingle();

    if (existingDeal) {
      console.log('[WEBHOOK-RECEIVER] Deal já existe, ignorando duplicata:', existingDeal.id);
      
      // Update metrics anyway
      await updateEndpointMetrics(supabase, endpoint.id);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          action: 'skipped', 
          reason: 'deal_already_exists',
          deal_id: existingDeal.id,
          contact_id: contactId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8b. Check if email already has a deal with contract paid in the same pipeline
    // This prevents creating new deals for leads who already purchased
    const contactEmail = (payload.email || '').trim().toLowerCase();
    if (contactEmail) {
      const { data: contractPaidDeal } = await supabase
        .from('crm_deals')
        .select('id, name')
        .eq('origin_id', endpoint.origin_id)
        .in('stage_id', await getContractPaidStageIds(supabase, endpoint.origin_id))
        .limit(1);

      // Only block if we found a deal with contract paid for the same email
      if (contractPaidDeal && contractPaidDeal.length > 0) {
        // Verify the deal belongs to the same email by checking contact
        const { data: paidContacts } = await supabase
          .from('crm_deals')
          .select('id, crm_contacts!inner(email)')
          .eq('origin_id', endpoint.origin_id)
          .in('id', contractPaidDeal.map(d => d.id));

        const hasPaidDealForEmail = paidContacts?.some((d: any) => 
          d.crm_contacts?.email?.toLowerCase().trim() === contactEmail
        );

        if (hasPaidDealForEmail) {
          console.log('[WEBHOOK-RECEIVER] ⛔ Email já possui deal com contrato pago na mesma pipeline, bloqueando criação');
          await updateEndpointMetrics(supabase, endpoint.id);
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              action: 'skipped', 
              reason: 'contract_already_paid',
              contact_id: contactId
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // 9. Map custom fields
    const customFields: Record<string, unknown> = {
      source: payload.source || slug,
      solucao_busca: payload.objective,
      profile_type: payload.profileType,
      faixa_renda: mapMonthlyIncome(payload.monthlyIncome),
      industry_sector: payload.industrySector,
      selection_decision: payload.selectionDecision,
      original_timestamp: payload.timestamp,
      lead_channel: slug.toUpperCase(),
      webhook_endpoint: endpoint.name
    };

    // Apply custom field mapping if configured
    if (endpoint.field_mapping && typeof endpoint.field_mapping === 'object') {
      for (const [sourceField, targetField] of Object.entries(endpoint.field_mapping)) {
        if (payload[sourceField] !== undefined && typeof targetField === 'string') {
          customFields[targetField] = payload[sourceField];
        }
      }
    }

    // 10. Get next owner based on distribution
    let assignedOwner: string | null = null;
    let assignedOwnerProfileId: string | null = null;
    const { data: nextOwner, error: ownerError } = await supabase
      .rpc('get_next_lead_owner', { p_origin_id: endpoint.origin_id });

    if (ownerError) {
      console.log('[WEBHOOK-RECEIVER] ⚠️ Erro ao buscar owner:', ownerError.message);
    } else if (nextOwner) {
      assignedOwner = nextOwner;
      console.log('[WEBHOOK-RECEIVER] 👤 Owner atribuído automaticamente:', assignedOwner);
      
      // Buscar owner_profile_id correspondente
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', assignedOwner)
        .maybeSingle();
      
      if (ownerProfile) {
        assignedOwnerProfileId = ownerProfile.id;
        console.log('[WEBHOOK-RECEIVER] 👤 Profile ID encontrado:', assignedOwnerProfileId);
      } else {
        console.log('[WEBHOOK-RECEIVER] ⚠️ Profile não encontrado para email:', assignedOwner);
      }
    } else {
      console.log('[WEBHOOK-RECEIVER] ⚠️ Nenhum owner configurado para distribuição');
    }

    // 11. Create deal
    const dealCreatedAt = payload.timestamp || new Date().toISOString();
    const { data: deal, error: dealError } = await supabase
      .from('crm_deals')
      .insert({
        clint_id: `${slug}-deal-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        name: payload.name,
        value: 0,
        contact_id: contactId,
        origin_id: endpoint.origin_id,
        stage_id: stageId,
        owner_id: assignedOwner,
        owner_profile_id: assignedOwnerProfileId,
        product_name: endpoint.name,
        tags: autoTags,
        custom_fields: customFields,
        data_source: 'webhook',
        created_at: dealCreatedAt,
        stage_moved_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (dealError) {
      console.error('[WEBHOOK-RECEIVER] Erro ao criar deal:', dealError);
      throw dealError;
    }

    console.log('[WEBHOOK-RECEIVER] ✅ Deal criado com sucesso:', deal.id);

    // 12. Update endpoint metrics
    await updateEndpointMetrics(supabase, endpoint.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        action: 'created',
        deal_id: deal.id,
        contact_id: contactId,
        assigned_owner: assignedOwner,
        endpoint: endpoint.name,
        tags: autoTags
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[WEBHOOK-RECEIVER] ❌ Erro:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Update endpoint metrics
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateEndpointMetrics(supabaseClient: any, endpointId: string) {
  try {
    // Get current leads_received count
    const { data: endpoint } = await supabaseClient
      .from('webhook_endpoints')
      .select('leads_received')
      .eq('id', endpointId)
      .single();
    
    const currentCount = endpoint?.leads_received || 0;
    
    await supabaseClient
      .from('webhook_endpoints')
      .update({
        leads_received: currentCount + 1,
        last_lead_at: new Date().toISOString()
      })
      .eq('id', endpointId);
  } catch (error) {
    console.log('[WEBHOOK-RECEIVER] Erro ao atualizar métricas:', error);
  }
}

// Get stage IDs that represent "contract paid" status
async function getContractPaidStageIds(supabaseClient: any, originId: string): Promise<string[]> {
  const stageIds: string[] = [];
  
  // Check local_pipeline_stages for contract-paid stages
  const { data: localStages } = await supabaseClient
    .from('local_pipeline_stages')
    .select('id')
    .eq('origin_id', originId)
    .ilike('name', '%contrato%pago%');
  
  if (localStages) {
    stageIds.push(...localStages.map((s: any) => s.id));
  }
  
  // Also check crm_stages
  const { data: crmStages } = await supabaseClient
    .from('crm_stages')
    .select('id')
    .eq('origin_id', originId)
    .ilike('name', '%contrato%pago%');
  
  if (crmStages) {
    stageIds.push(...crmStages.map((s: any) => s.id));
  }
  
  return stageIds;
}

// Normalize phone to E.164 format (+55XXXXXXXXXXX)
function normalizePhone(phone: string | null | undefined): string | null {
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

// Map monthly income to standardized values
function mapMonthlyIncome(income: string | null | undefined): string | null {
  if (!income) return null;
  
  const mapping: Record<string, string> = {
    'Até R$ 5 mil': 'Até R$ 5.000',
    'R$ 5 mil a R$ 10 mil': 'R$ 5.000 a R$ 10.000',
    'R$ 10 mil a R$ 20 mil': 'R$ 10.000 a R$ 20.000',
    'R$ 20 mil a R$ 30 mil': 'R$ 20.000 a R$ 30.000',
    'Acima de R$ 20 mil': '+R$ 30.000',
    'Acima de R$ 30 mil': '+R$ 30.000',
  };
  
  return mapping[income] || income;
}
