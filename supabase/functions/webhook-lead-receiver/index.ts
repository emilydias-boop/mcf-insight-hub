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

  // Painel "Movimentações de Leads" (webhook_events)
  const wlStartTime = Date.now();
  let wlLogId: string | null = null;
  let wlEventType = 'lead.received.unknown';
  let wlPayloadSnapshot: any = null;
  const finalizeWebhookLog = async (status: 'success' | 'error', errorMsg?: string) => {
    try {
      if (!wlLogId) {
        // Inserção tardia caso não tenha conseguido criar antes
        const { data } = await supabase
          .from('webhook_events')
          .insert({
            event_type: wlEventType,
            event_data: wlPayloadSnapshot ?? {},
            status,
            processed_at: new Date().toISOString(),
            processing_time_ms: Date.now() - wlStartTime,
            error_message: errorMsg ?? null,
          })
          .select('id')
          .single();
        wlLogId = data?.id ?? null;
      } else {
        await supabase.from('webhook_events').update({
          status,
          processed_at: new Date().toISOString(),
          processing_time_ms: Date.now() - wlStartTime,
          error_message: errorMsg ?? null,
        }).eq('id', wlLogId);
      }
    } catch (_) { /* nunca quebra fluxo */ }
  };

  let wlFinalStatus: 'success' | 'error' = 'success';
  let wlFinalError: string | undefined;
  try {
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

    // Painel de movimentações: derivar event_type pelo slug e logar
    wlPayloadSnapshot = payload;
    const slugLower = slug.toLowerCase();
    if (slugLower.includes('anamnese') && slugLower.includes('incompleta')) {
      wlEventType = 'lead.received.anamnese_incompleta';
    } else if (slugLower.includes('anamnese')) {
      wlEventType = 'lead.received.anamnese_completa';
    } else if (slugLower.includes('parceria')) {
      wlEventType = 'lead.received.parceria';
    } else if (slugLower.includes('instagram')) {
      wlEventType = 'lead.received.instagram';
    } else {
      wlEventType = `lead.received.${slugLower}`;
    }
    try {
      const { data: log } = await supabase
        .from('webhook_events')
        .insert({
          event_type: wlEventType,
          event_data: payload,
          status: 'processing',
        })
        .select('id')
        .single();
      wlLogId = log?.id ?? null;
    } catch (_) { /* nunca quebra fluxo */ }

    // 4. Apply reverse field mapping before validation
    if (endpoint.field_mapping) {
      for (const [sourceField, targetField] of Object.entries(endpoint.field_mapping)) {
        if (payload[sourceField] !== undefined && payload[targetField as string] === undefined) {
          payload[targetField as string] = payload[sourceField];
        }
      }
    }

    // 5. Validate required fields
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
    let stageId: string | null = null;
    
    if (endpoint.stage_id) {
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
    
    if (!stageId) {
      // Tentar buscar stage "Novo Lead" por nome primeiro (local_pipeline_stages)
      const { data: localNovoLead } = await supabase
        .from('local_pipeline_stages')
        .select('id')
        .eq('origin_id', endpoint.origin_id)
        .eq('is_active', true)
        .ilike('name', '%Novo Lead%')
        .limit(1)
        .maybeSingle();

      if (localNovoLead) {
        stageId = localNovoLead.id;
        console.log('[WEBHOOK-RECEIVER] Stage "Novo Lead" encontrado em local_pipeline_stages:', stageId);
      } else {
        // Fallback: primeira stage por ordem em local_pipeline_stages
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
          // Tentar crm_stages: buscar "Novo Lead" por nome
          const { data: crmNovoLead } = await supabase
            .from('crm_stages')
            .select('id')
            .eq('origin_id', endpoint.origin_id)
            .ilike('stage_name', '%Novo Lead%')
            .limit(1)
            .maybeSingle();

          if (crmNovoLead) {
            stageId = crmNovoLead.id;
            console.log('[WEBHOOK-RECEIVER] Stage "Novo Lead" encontrado em crm_stages:', stageId);
          } else {
            // Último fallback: primeira stage por ordem em crm_stages
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
      }
    }

    // 6. Normalize phone
    const normalizedPhone = normalizePhone(payload.whatsapp || payload.phone || payload.telefone);
    console.log('[WEBHOOK-RECEIVER] Telefone normalizado:', normalizedPhone);

    // ======= DEDUPLICAÇÃO POR CPF (antes de buscar contato) =======
    const cpfClean = cleanCpf(payload.cpf);
    let existingContact = null;
    let contactId: string;

    // 7a. Buscar por CPF no lead_profiles
    if (cpfClean) {
      const { data: profileByCpf } = await supabase
        .from('lead_profiles')
        .select('contact_id')
        .eq('cpf', cpfClean)
        .maybeSingle();
      
      if (profileByCpf?.contact_id) {
        const { data: contactByCpf } = await supabase
          .from('crm_contacts')
          .select('id, email')
          .eq('id', profileByCpf.contact_id)
          .maybeSingle();
        
        if (contactByCpf) {
          existingContact = contactByCpf;
          console.log('[WEBHOOK-RECEIVER] Contato encontrado por CPF:', contactByCpf.id);
        }
      }
    }

    // 7b. Buscar por email
    const emailTrimmed = (payload.email || '').trim();
    if (!existingContact && emailTrimmed) {
      const { data: contactsByEmail } = await supabase
        .from('crm_contacts')
        .select('id')
        .ilike('email', emailTrimmed)
        .eq('is_archived', false)
        .order('created_at', { ascending: true })
        .limit(1);
      existingContact = contactsByEmail?.[0] || null;
    }

    // 7c. Fallback: buscar por telefone (últimos 9 dígitos) — usa limit(1) para evitar erro com múltiplos matches
    if (!existingContact && normalizedPhone) {
      const phoneClean = normalizedPhone.replace(/\D/g, '');
      const phoneSuffix = phoneClean.slice(-9);
      if (phoneSuffix.length === 9) {
        const { data: contactsByPhone } = await supabase
          .from('crm_contacts')
          .select('id, email')
          .ilike('phone', `%${phoneSuffix}`)
          .order('created_at', { ascending: true })
          .limit(1);
        
        const contactByPhone = contactsByPhone?.[0] || null;
        if (contactByPhone) {
          existingContact = contactByPhone;
          console.log('[WEBHOOK-RECEIVER] Contato encontrado por telefone (9-digit):', contactByPhone.id);
          if (!contactByPhone.email && emailTrimmed) {
            await supabase.from('crm_contacts').update({ email: emailTrimmed.toLowerCase(), updated_at: new Date().toISOString() }).eq('id', contactByPhone.id);
          }
        }
      }

      // Fallback: últimos 8 dígitos (ignora dígito 9 variável do celular BR)
      if (!existingContact && phoneClean.length >= 8) {
        const phoneSuffix8 = phoneClean.slice(-8);
        const { data: contactsByPhone8 } = await supabase
          .from('crm_contacts')
          .select('id, email')
          .ilike('phone', `%${phoneSuffix8}`)
          .order('created_at', { ascending: true })
          .limit(1);
        
        const contactByPhone8 = contactsByPhone8?.[0] || null;
        if (contactByPhone8) {
          existingContact = contactByPhone8;
          console.log('[WEBHOOK-RECEIVER] Contato encontrado por telefone (8-digit fallback):', contactByPhone8.id);
          if (!contactByPhone8.email && emailTrimmed) {
            await supabase.from('crm_contacts').update({ email: emailTrimmed.toLowerCase(), updated_at: new Date().toISOString() }).eq('id', contactByPhone8.id);
          }
        }
      }
    }

    // 7d. Fallback: buscar por nome exato na mesma origin (captura duplicatas como "Anna")
    const leadName = (payload.name || payload.nome_completo || '').trim();
    if (!existingContact && leadName && endpoint.origin_id) {
      const { data: contactsByName } = await supabase
        .from('crm_contacts')
        .select('id, email')
        .ilike('name', leadName)
        .eq('origin_id', endpoint.origin_id)
        .order('created_at', { ascending: true })
        .limit(1);
      
      const contactByName = contactsByName?.[0] || null;
      if (contactByName) {
        existingContact = contactByName;
        console.log('[WEBHOOK-RECEIVER] ⚠️ Contato encontrado por NOME na mesma origin:', contactByName.id, '- Nome:', leadName);
        // Enriquecer contato com dados que faltam
        const enrichData: Record<string, string> = { updated_at: new Date().toISOString() };
        if (!contactByName.email && emailTrimmed) enrichData.email = emailTrimmed.toLowerCase();
        if (normalizedPhone) enrichData.phone = normalizedPhone;
        if (Object.keys(enrichData).length > 1) {
          await supabase.from('crm_contacts').update(enrichData).eq('id', contactByName.id);
        }
      }
    }

    const autoTags = endpoint.auto_tags || [];
    const sourceTag = req.headers.get('x-source-tag');
    if (sourceTag && !autoTags.includes(sourceTag)) {
      autoTags.push(sourceTag);
    }

    if (existingContact) {
      contactId = existingContact.id;
      console.log('[WEBHOOK-RECEIVER] Contato existente:', contactId);
      
      // Merge tags em vez de sobrescrever
      let mergedTags = autoTags;
      if (autoTags.length > 0) {
        const { data: currentContact } = await supabase
          .from('crm_contacts')
          .select('tags')
          .eq('id', contactId)
          .single();
        const currentTags: string[] = (currentContact?.tags as string[]) || [];
        mergedTags = [...new Set([...currentTags, ...autoTags])];
      }

      await supabase
        .from('crm_contacts')
        .update({
          name: payload.name || payload.nome_completo,
          phone: normalizedPhone,
          tags: mergedTags.length > 0 ? mergedTags : undefined,
          updated_at: new Date().toISOString()
        })
        .eq('id', contactId);
    } else {
      const { data: newContact, error: contactError } = await supabase
        .from('crm_contacts')
        .insert({
          clint_id: `${slug}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          name: payload.name || payload.nome_completo,
          email: emailTrimmed ? emailTrimmed.toLowerCase() : null,
          phone: normalizedPhone,
          origin_id: endpoint.origin_id,
          tags: autoTags
        })
        .select('id')
        .single();
      
      if (contactError) {
        // Handle race condition: another concurrent request just created this contact
        if (contactError.code === '23505' && emailTrimmed) {
          console.log('[WEBHOOK-RECEIVER] ⚠️ Race condition detectada (23505), buscando contato recém-criado...');
          const { data: raceContacts } = await supabase
            .from('crm_contacts')
            .select('id')
            .ilike('email', emailTrimmed)
            .eq('is_archived', false)
            .order('created_at', { ascending: true })
            .limit(1);
          if (raceContacts?.[0]) {
            contactId = raceContacts[0].id;
            existingContact = raceContacts[0];
            console.log('[WEBHOOK-RECEIVER] ✅ Contato encontrado após race condition:', contactId);
          } else {
            console.error('[WEBHOOK-RECEIVER] Erro ao criar contato (23505 mas não encontrou):', contactError);
            throw contactError;
          }
        } else {
          console.error('[WEBHOOK-RECEIVER] Erro ao criar contato:', contactError);
          throw contactError;
        }
      } else {
        contactId = newContact.id;
        console.log('[WEBHOOK-RECEIVER] Novo contato criado:', contactId);
      }
    }

    // ======= TRAVA A010: Leads compradores não devem entrar em pipelines fora de Inside Sales =======
    const INSIDE_SALES_ORIGIN_ID = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c';
    
    if (endpoint.origin_id !== INSIDE_SALES_ORIGIN_ID) {
      // Verificar se o lead tem compra A010 confirmada
      const contactEmailLower = (payload.email || '').trim().toLowerCase();
      const phoneSuffix9 = normalizedPhone ? normalizedPhone.replace(/\D/g, '').slice(-9) : '';
      
      let isA010Buyer = false;
      
      if (contactEmailLower) {
        const { data: a010ByEmail } = await supabase
          .from('hubla_transactions')
          .select('id')
          .eq('product_category', 'a010')
          .eq('sale_status', 'completed')
          .ilike('customer_email', contactEmailLower)
          .limit(1);
        
        if (a010ByEmail && a010ByEmail.length > 0) {
          isA010Buyer = true;
        }
      }
      
      if (!isA010Buyer && phoneSuffix9.length === 9) {
        const { data: a010ByPhone } = await supabase
          .from('hubla_transactions')
          .select('id')
          .eq('product_category', 'a010')
          .eq('sale_status', 'completed')
          .ilike('customer_phone', `%${phoneSuffix9}`)
          .limit(1);
        
        if (a010ByPhone && a010ByPhone.length > 0) {
          isA010Buyer = true;
        }
      }
      
      if (isA010Buyer) {
        console.log(`[WEBHOOK-RECEIVER] ⛔ Lead A010 detectado — bloqueando criação na pipeline ${endpoint.origin_id}, redirecionando para Inside Sales`);
        
        // Verificar se já tem deal na Inside Sales
        const { data: insideSalesDeal } = await supabase
          .from('crm_deals')
          .select('id, tags, custom_fields')
          .eq('contact_id', contactId)
          .eq('origin_id', INSIDE_SALES_ORIGIN_ID)
          .limit(1)
          .maybeSingle();
        
        if (insideSalesDeal) {
          // Já tem deal na Inside Sales — apenas atualizar profile e tags
          console.log('[WEBHOOK-RECEIVER] ✅ Deal já existe na Inside Sales:', insideSalesDeal.id);
          
          const currentTags: string[] = (insideSalesDeal.tags as string[]) || [];
          const mergedTags = [...new Set([...currentTags, ...autoTags])];
          if (mergedTags.length !== currentTags.length) {
            await supabase.from('crm_deals').update({ tags: mergedTags }).eq('id', insideSalesDeal.id);
          }
          
          await upsertLeadProfile(supabase, contactId, insideSalesDeal.id, payload, cpfClean, normalizedPhone);
          await updateEndpointMetrics(supabase, endpoint.id);
          
          return new Response(
            JSON.stringify({
              success: true,
              action: 'a010_blocked',
              reason: 'a010_buyer_redirected_to_inside_sales',
              deal_id: insideSalesDeal.id,
              contact_id: contactId,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          // Não tem deal na Inside Sales — criar lá em vez da pipeline original
          console.log('[WEBHOOK-RECEIVER] 🔄 Criando deal na Inside Sales para comprador A010');
          
          // Buscar estágio "Novo Lead" da Inside Sales por nome
          let insideSalesStageId: string | null = null;
          const { data: isNovoLead } = await supabase
            .from('crm_stages')
            .select('id')
            .eq('origin_id', INSIDE_SALES_ORIGIN_ID)
            .ilike('stage_name', '%Novo Lead%')
            .limit(1)
            .maybeSingle();
          if (isNovoLead) {
            insideSalesStageId = isNovoLead.id;
            console.log('[WEBHOOK-RECEIVER] Stage "Novo Lead" para Inside Sales:', insideSalesStageId);
          } else {
            // Fallback por ordem caso "Novo Lead" não exista
            const { data: isStage } = await supabase
              .from('crm_stages')
              .select('id')
              .eq('origin_id', INSIDE_SALES_ORIGIN_ID)
              .order('stage_order', { ascending: true })
              .limit(1)
              .maybeSingle();
            insideSalesStageId = isStage?.id || null;
            console.log('[WEBHOOK-RECEIVER] Fallback stage Inside Sales:', insideSalesStageId);
          }
          
          // Buscar owner via round-robin da Inside Sales
          let isOwner: string | null = null;
          let isOwnerProfileId: string | null = null;
          const { data: nextOwner } = await supabase.rpc('get_next_lead_owner', { p_origin_id: INSIDE_SALES_ORIGIN_ID });
          if (nextOwner) {
            isOwner = nextOwner;
            const { data: ownerProfile } = await supabase.from('profiles').select('id').eq('email', nextOwner).maybeSingle();
            isOwnerProfileId = ownerProfile?.id || null;
          }
          
          const isCustomFields: Record<string, unknown> = {
            source: payload.source || slug,
            lead_channel: slug.toUpperCase(),
            webhook_endpoint: endpoint.name,
            a010_redirect: true,
            original_origin_id: endpoint.origin_id,
          };
          
          const { data: newDeal } = await supabase
            .from('crm_deals')
            .insert({
              clint_id: `a010-redirect-${Date.now()}-${Math.random().toString(36).substring(7)}`,
              name: payload.name || payload.nome_completo,
              value: 0,
              contact_id: contactId,
              origin_id: INSIDE_SALES_ORIGIN_ID,
              stage_id: insideSalesStageId,
              owner_id: isOwner,
              owner_profile_id: isOwnerProfileId,
              product_name: 'A010',
              tags: [...new Set([...autoTags, 'A010'])],
              custom_fields: isCustomFields,
              data_source: 'webhook',
              stage_moved_at: new Date().toISOString(),
            })
            .select('id')
            .single();
          
          if (newDeal) {
            await upsertLeadProfile(supabase, contactId, newDeal.id, payload, cpfClean, normalizedPhone);
            
            await supabase.from('deal_activities').insert({
              deal_id: newDeal.id,
              activity_type: 'lead_entered',
              description: `Lead A010 redirecionado de ${endpoint.name} para PIPELINE INSIDE SALES`,
              metadata: { source: 'webhook', original_slug: slug, a010_redirect: true },
            });
          }
          
          await updateEndpointMetrics(supabase, endpoint.id);
          
          return new Response(
            JSON.stringify({
              success: true,
              action: 'a010_redirected',
              reason: 'a010_buyer_created_in_inside_sales',
              deal_id: newDeal?.id,
              contact_id: contactId,
              assigned_owner: isOwner,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // ======= TRAVA PARCEIRO/RENOVAÇÃO: Bloquear na Inside Sales (Incorporador) =======
    if (endpoint.origin_id === INSIDE_SALES_ORIGIN_ID && (emailTrimmed || normalizedPhone)) {
      const partnerCheckEmail = emailTrimmed ? emailTrimmed.toLowerCase() : '';
      let partnerCheck = { isPartner: false, product: null as string | null };
      
      if (partnerCheckEmail) {
        partnerCheck = await checkIfPartner(supabase, partnerCheckEmail);
      }
      
      // Fallback: check by phone suffix if email didn't match
      if (!partnerCheck.isPartner && normalizedPhone) {
        const phoneSuffix9 = normalizedPhone.replace(/\D/g, '').slice(-9);
        if (phoneSuffix9.length >= 9) {
          try {
            const { data: phoneTxs } = await supabase
              .from('hubla_transactions')
              .select('product_name, customer_email')
              .eq('sale_status', 'completed')
              .ilike('customer_phone', `%${phoneSuffix9}`);
            
            for (const tx of phoneTxs || []) {
              if (!tx.product_name) continue;
              const upper = tx.product_name.toUpperCase();
              if (PARTNER_PATTERNS.some(p => upper.includes(p))) {
                partnerCheck = { isPartner: true, product: tx.product_name };
                break;
              }
            }
          } catch (phoneErr) {
            console.error('[WEBHOOK-RECEIVER] Erro ao verificar parceiro por telefone:', phoneErr);
          }
        }
      }
      
      if (partnerCheck.isPartner) {
        console.log(`[WEBHOOK-RECEIVER] ⛔ Parceiro/Renovação detectado na Inside Sales: ${partnerCheckEmail || normalizedPhone} (${partnerCheck.product}) — bloqueando`);
        
        try {
          await supabase.from('partner_returns').insert({
            contact_id: contactId,
            contact_email: partnerCheckEmail || null,
            contact_name: payload.name || payload.nome_completo || null,
            partner_product: partnerCheck.product || 'parceria',
            return_source: `webhook-${slug}`,
            return_product: endpoint.name,
            return_value: 0,
            blocked: true,
            notes: `Parceiro/Renovação bloqueado na Inside Sales via webhook-lead-receiver (${slug}).`,
          } as any);
        } catch (prErr) {
          console.error('[WEBHOOK-RECEIVER] Erro ao registrar partner_returns:', prErr);
        }
        
        await updateEndpointMetrics(supabase, endpoint.id);
        
        return new Response(
          JSON.stringify({
            success: true,
            action: 'partner_blocked',
            reason: 'partner_or_renewal_blocked_from_inside_sales',
            contact_id: contactId,
            partner_product: partnerCheck.product,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 8. Check for existing deal by identity (email/phone suffix), not just contact_id
    const emailForDupCheck = emailTrimmed ? emailTrimmed.toLowerCase() : '';
    const phoneForDupCheck = normalizedPhone ? normalizedPhone.replace(/\D/g, '') : '';
    const phoneSuffixForDupCheck = phoneForDupCheck.length >= 9 ? phoneForDupCheck.slice(-9) : phoneForDupCheck;

    const { data: existingDealId } = await supabase
      .rpc('check_duplicate_deal_by_identity', {
        p_email: emailForDupCheck,
        p_phone_suffix: phoneSuffixForDupCheck,
        p_origin_id: endpoint.origin_id,
      });

    // If found, fetch full deal data for the update logic below
    let existingDeal = null;
    if (existingDealId) {
      const { data } = await supabase
        .from('crm_deals')
        .select('id, tags, stage_id, custom_fields, owner_id, owner_profile_id')
        .eq('id', existingDealId)
        .maybeSingle();
      existingDeal = data;
    }

    if (existingDeal) {
      console.log('[WEBHOOK-RECEIVER] Deal já existe:', existingDeal.id);
      
      const currentTags: string[] = (existingDeal.tags as string[]) || [];
      const isIncompleta = currentTags.some(t => t.toUpperCase() === 'ANAMNESE-INCOMPLETA');
      const isAnamnaseEndpoint = slug === 'anamnese-mcf';

      // --- FLUXO ESPECIAL: ANAMNESE-INCOMPLETA → ANAMNESE completa ---
      if (isIncompleta && isAnamnaseEndpoint) {
        console.log('[WEBHOOK-RECEIVER] 🔄 Fluxo ANAMNESE-INCOMPLETA → ANAMNESE completa detectado');

        // 1. Merge tags: add ANAMNESE + autoTags, keep existing
        const mergedTags = [...new Set([...currentTags, 'ANAMNESE', ...autoTags])];

        // 2. Merge custom_fields
        const existingCustomFields = (existingDeal.custom_fields as Record<string, unknown>) || {};
        const newCustomFields: Record<string, unknown> = {
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
        if (endpoint.field_mapping && typeof endpoint.field_mapping === 'object') {
          for (const [sourceField, targetField] of Object.entries(endpoint.field_mapping)) {
            if (payload[sourceField] !== undefined && typeof targetField === 'string') {
              newCustomFields[targetField] = payload[sourceField];
            }
          }
        }
        const mergedCustomFields = { ...existingCustomFields, ...newCustomFields };

        // 3. Find "Lead Gratuito" stage in the same origin
        const { data: leadGratuitoStage } = await supabase
          .from('crm_stages')
          .select('id')
          .eq('origin_id', endpoint.origin_id)
          .ilike('stage_name', 'Lead Gratuito')
          .maybeSingle();

        const newStageId = leadGratuitoStage?.id || existingDeal.stage_id;
        const oldStageId = existingDeal.stage_id;

        // 4. Update deal: new stage, merged tags & custom_fields, KEEP owner
        await supabase
          .from('crm_deals')
          .update({
            tags: mergedTags,
            custom_fields: mergedCustomFields,
            stage_id: newStageId,
            stage_moved_at: new Date().toISOString(),
          })
          .eq('id', existingDeal.id);

        console.log('[WEBHOOK-RECEIVER] ✅ Deal atualizado para ANAMNESE completa, stage:', newStageId, 'owner mantido:', existingDeal.owner_id);

        // 5. Log stage change activity (if stage actually changed)
        if (newStageId !== oldStageId) {
          await supabase
            .from('deal_activities')
            .insert({
              deal_id: existingDeal.id,
              activity_type: 'stage_change',
              description: 'ANAMNESE-INCOMPLETA → Lead Gratuito (anamnese completada via webhook)',
              metadata: {
                from_stage_id: oldStageId,
                to_stage_id: newStageId,
                trigger: 'webhook_anamnese_completed'
              }
            });
        }

        // 6. Update lead_profile
        await upsertLeadProfile(supabase, contactId, existingDeal.id, payload, cpfClean, normalizedPhone);
        await updateEndpointMetrics(supabase, endpoint.id);

        return new Response(
          JSON.stringify({
            success: true,
            action: 'anamnese_completed',
            reason: 'incompleta_to_completa',
            deal_id: existingDeal.id,
            contact_id: contactId,
            new_stage_id: newStageId,
            owner_preserved: existingDeal.owner_id
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // --- FLUXO PADRÃO: deal já existe (não é transição incompleta→completa) ---
      console.log('[WEBHOOK-RECEIVER] Deal já existe, atualizando lead_profile:', existingDeal.id);
      
      await upsertLeadProfile(supabase, contactId, existingDeal.id, payload, cpfClean, normalizedPhone);

      // Adicionar auto_tags ao deal existente (se houver)
      if (autoTags.length > 0) {
        const newTags = [...new Set([...currentTags, ...autoTags])];
        
        if (newTags.length !== currentTags.length) {
          await supabase
            .from('crm_deals')
            .update({ tags: newTags })
            .eq('id', existingDeal.id);
          console.log('[WEBHOOK-RECEIVER] Tags adicionadas ao deal existente:', newTags);
        }
      }

      await updateEndpointMetrics(supabase, endpoint.id);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          action: 'updated_profile', 
          reason: 'deal_already_exists',
          deal_id: existingDeal.id,
          contact_id: contactId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8b. Check if email already has a deal with contract paid in the same pipeline
    const contactEmail = (payload.email || '').trim().toLowerCase();
    if (contactEmail) {
      const { data: contractPaidDeal } = await supabase
        .from('crm_deals')
        .select('id, name')
        .eq('origin_id', endpoint.origin_id)
        .in('stage_id', await getContractPaidStageIds(supabase, endpoint.origin_id))
        .limit(1);

      if (contractPaidDeal && contractPaidDeal.length > 0) {
        const { data: paidContacts } = await supabase
          .from('crm_deals')
          .select('id, crm_contacts!inner(email)')
          .eq('origin_id', endpoint.origin_id)
          .in('id', contractPaidDeal.map(d => d.id));

        const hasPaidDealForEmail = paidContacts?.some((d: any) => 
          d.crm_contacts?.email?.toLowerCase().trim() === contactEmail
        );

        if (hasPaidDealForEmail) {
          console.log('[WEBHOOK-RECEIVER] ⛔ Email já possui deal com contrato pago, bloqueando');
          await upsertLeadProfile(supabase, contactId, null, payload, cpfClean, normalizedPhone);
          await updateEndpointMetrics(supabase, endpoint.id);
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              action: 'updated_profile', 
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

    if (endpoint.field_mapping && typeof endpoint.field_mapping === 'object') {
      for (const [sourceField, targetField] of Object.entries(endpoint.field_mapping)) {
        if (payload[sourceField] !== undefined && typeof targetField === 'string') {
          customFields[targetField] = payload[sourceField];
        }
      }
    }

    // 10. Get next owner based on distribution (or fixed owner)
    let assignedOwner: string | null = null;
    let assignedOwnerProfileId: string | null = null;

    if (endpoint.fixed_owner_email) {
      // SDR fixo configurado no endpoint — pula distribuição
      assignedOwner = endpoint.fixed_owner_email;
      console.log('[WEBHOOK-RECEIVER] 🔒 Owner fixo do endpoint:', assignedOwner);

      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', assignedOwner)
        .maybeSingle();

      if (ownerProfile) {
        assignedOwnerProfileId = ownerProfile.id;
      }
    } else {
      // Distribuição normal
      const { data: nextOwner, error: ownerError } = await supabase
        .rpc('get_next_lead_owner', { p_origin_id: endpoint.origin_id });

      if (ownerError) {
        console.log('[WEBHOOK-RECEIVER] ⚠️ Erro ao buscar owner:', ownerError.message);
      } else if (nextOwner) {
        assignedOwner = nextOwner;
        console.log('[WEBHOOK-RECEIVER] 👤 Owner atribuído:', assignedOwner);
        
        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', assignedOwner)
          .maybeSingle();
        
        if (ownerProfile) {
          assignedOwnerProfileId = ownerProfile.id;
        }
      }
    }

    // 11. Create deal
    const dealCreatedAt = payload.timestamp || new Date().toISOString();
    const { data: deal, error: dealError } = await supabase
      .from('crm_deals')
      .insert({
        clint_id: `${slug}-deal-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        name: payload.name || payload.nome_completo,
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

    console.log('[WEBHOOK-RECEIVER] ✅ Deal criado:', deal.id);

    // Record lead_entered activity
    try {
      await supabase.from('deal_activities').insert({
        deal_id: deal.id,
        activity_type: 'lead_entered',
        description: `Lead entrou na pipeline via ${endpoint.name}`,
        from_stage: null,
        to_stage: null,
        metadata: {
          source: 'webhook',
          endpoint_slug: slug,
          endpoint_name: endpoint.name,
          origin_id: endpoint.origin_id,
          owner_email: assignedOwner,
        },
        created_at: dealCreatedAt,
      });
      console.log('[WEBHOOK-RECEIVER] ✅ Atividade lead_entered registrada');
    } catch (actErr) {
      console.error('[WEBHOOK-RECEIVER] ⚠️ Erro ao registrar atividade lead_entered:', actErr);
    }

    // 11b. Partner detection — mover para Venda Realizada imediatamente
    let partnerDetected = false;
    if (contactEmail) {
      const partnerCheck = await checkIfPartner(supabase, contactEmail);
      if (partnerCheck.isPartner) {
        partnerDetected = true;
        console.log(`[WEBHOOK-RECEIVER] 🤝 Parceiro detectado: ${contactEmail} (${partnerCheck.product})`);

        // Buscar stage "Venda Realizada" da mesma origin
        const vendaRealizadaStageId = await getVendaRealizadaStageId(supabase, endpoint.origin_id);

        if (vendaRealizadaStageId) {
          // Mover deal para Venda Realizada
          await supabase
            .from('crm_deals')
            .update({
              stage_id: vendaRealizadaStageId,
              tags: [...new Set([...autoTags, 'Parceiro'])],
              updated_at: new Date().toISOString(),
              stage_moved_at: new Date().toISOString(),
            })
            .eq('id', deal.id);

          console.log(`[WEBHOOK-RECEIVER] ✅ Deal movido para Venda Realizada: ${vendaRealizadaStageId}`);
        } else {
          // Mesmo sem stage, adicionar tag Parceiro
          await supabase
            .from('crm_deals')
            .update({ tags: [...new Set([...autoTags, 'Parceiro'])] })
            .eq('id', deal.id);
          console.log('[WEBHOOK-RECEIVER] ⚠️ Stage Venda Realizada não encontrada, tag Parceiro adicionada');
        }

        // Registrar em partner_returns para auditoria
        try {
          await supabase.from('partner_returns').insert({
            contact_id: contactId,
            contact_email: contactEmail,
            contact_name: payload.name || payload.nome_completo || null,
            partner_product: partnerCheck.product || 'parceria',
            return_source: `webhook-${slug}`,
            return_product: endpoint.name,
            return_value: 0,
            original_deal_id: deal.id,
            blocked: false,
            notes: `Parceiro detectado no webhook-lead-receiver (${slug}). Deal criado e movido para Venda Realizada.`,
          } as any);
        } catch (prErr) {
          console.error('[WEBHOOK-RECEIVER] Erro ao registrar partner_returns:', prErr);
        }

        // Registrar deal_activity
        try {
          await supabase.from('deal_activities').insert({
            deal_id: deal.id,
            activity_type: 'stage_change',
            description: `Parceiro detectado: movido automaticamente para Venda Realizada (produto: ${partnerCheck.product})`,
            from_stage: stageId,
            to_stage: vendaRealizadaStageId || stageId,
            metadata: { source: 'webhook-lead-receiver', email: contactEmail, partner_product: partnerCheck.product },
          });
        } catch (actErr) {
          console.error('[WEBHOOK-RECEIVER] Erro ao registrar deal_activity:', actErr);
        }
      }
    }

    // 12. Upsert lead_profile com dados completos do ClientData
    await upsertLeadProfile(supabase, contactId, deal.id, payload, cpfClean, normalizedPhone);

    // 13. Update endpoint metrics
    await updateEndpointMetrics(supabase, endpoint.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        action: partnerDetected ? 'created_partner_moved' : 'created',
        deal_id: deal.id,
        contact_id: contactId,
        assigned_owner: assignedOwner,
        endpoint: endpoint.name,
        tags: autoTags,
        lead_profile: true,
        partner_detected: partnerDetected
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[WEBHOOK-RECEIVER] ❌ Erro:', error);
    wlFinalStatus = 'error';
    wlFinalError = errorMessage;
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  } finally {
    await finalizeWebhookLog(wlFinalStatus, wlFinalError);
  }
});

// ============ LEAD PROFILE HELPERS ============

// Parse boolean from various formats: true/false, "sim"/"não", 1/0
function parseBool(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  if (typeof val === 'string') {
    const lower = val.toLowerCase().trim();
    return ['true', '1', 'sim', 'yes', 's'].includes(lower);
  }
  return false;
}

// Parse number from string (handles monetary values like "R$ 1.500,00")
function parseNum(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    // Remove currency symbols, dots as thousands separator, convert comma to dot
    const cleaned = val.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
  return null;
}

// Parse JSONB array from string or array
function parseJsonArray(val: unknown): unknown[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return val.split(',').map(s => s.trim()).filter(Boolean); }
  }
  return [];
}

// Clean CPF: remove non-digits
function cleanCpf(val: unknown): string | null {
  if (!val || typeof val !== 'string') return null;
  const clean = val.replace(/\D/g, '');
  return clean.length >= 11 ? clean : null;
}

// Parse date fields: DDMMYYYY, DD/MM/YYYY, YYYY-MM-DD → YYYY-MM-DD or null
function parseDateField(val: unknown): string | null {
  if (!val || typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed) return null;

  // Already ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // DDMMYYYY (8 digits, no separator)
  if (/^\d{8}$/.test(trimmed)) {
    const day = trimmed.slice(0, 2);
    const month = trimmed.slice(2, 4);
    const year = trimmed.slice(4, 8);
    const d = new Date(`${year}-${month}-${day}`);
    return isNaN(d.getTime()) ? null : `${year}-${month}-${day}`;
  }

  // DD/MM/YYYY
  const slashMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    const d = new Date(`${year}-${month}-${day}`);
    return isNaN(d.getTime()) ? null : `${year}-${month}-${day}`;
  }

  return null;
}


function getField(payload: any, ...keys: string[]): unknown {
  for (const key of keys) {
    if (payload[key] !== undefined && payload[key] !== null && payload[key] !== '') return payload[key];
  }
  return undefined;
}

// Upsert lead_profile with full ClientData
async function upsertLeadProfile(
  supabaseClient: any,
  contactId: string,
  dealId: string | null,
  payload: any,
  cpfClean: string | null,
  normalizedPhone: string | null
) {
  try {
    const profileData: Record<string, unknown> = {
      contact_id: contactId,
      deal_id: dealId,
      
      // Pessoal
      nome_completo: getField(payload, 'nome_completo', 'name') as string || null,
      cpf: cpfClean,
      whatsapp: normalizedPhone || (getField(payload, 'whatsapp') as string) || null,
      data_nascimento: parseDateField(getField(payload, 'data_nascimento') as string) || null,
      estado_cidade: getField(payload, 'estado_cidade') as string || null,
      estado_civil: getField(payload, 'estado_civil') as string || null,
      num_filhos: parseNum(getField(payload, 'num_filhos')) as number | null,

      // Profissional
      profissao: getField(payload, 'profissao') as string || null,
      is_empresario: parseBool(getField(payload, 'e_empresario', 'isEmpresario', 'is_empresario')),
      porte_empresa: parseNum(getField(payload, 'porte_empresa', 'portEmpresa')) as number | null,

      // Financeiro
      renda_bruta: parseNum(getField(payload, 'renda_bruta', 'rendaBruta')),
      fonte_renda: getField(payload, 'fonte_renda', 'fonteRenda') as string || null,
      faixa_aporte: parseNum(getField(payload, 'faixa_aporte', 'faixaAporte')),
      faixa_aporte_descricao: getField(payload, 'faixa_aporte_descricao', 'faixaAporteDescricao') as string || null,

      // Perfil / Interesses
      esporte_hobby: getField(payload, 'esporte_hobby', 'esporteHobby') as string || null,
      gosta_futebol: parseBool(getField(payload, 'gosta_futebol', 'gostaFutebol')),
      time_futebol: getField(payload, 'time_futebol', 'timeFutebol') as string || null,

      // Empresa / Capital
      precisa_capital_giro: parseBool(getField(payload, 'precisa_capital_giro', 'precisaCapitalGiro')),
      valor_capital_giro: parseNum(getField(payload, 'valor_capital_giro', 'valorCapitalGiro')),

      // Objetivos
      objetivos_principais: parseJsonArray(getField(payload, 'objetivos_principais', 'objetivosPrincipais')),
      renda_passiva_meta: parseNum(getField(payload, 'renda_passiva_meta', 'rendaPassivaMeta')),
      tempo_independencia: getField(payload, 'tempo_independencia', 'tempoIndependencia') as string || null,

      // Patrimônio
      imovel_financiado: parseBool(getField(payload, 'possui_imovel_financiado', 'imovelFinanciado')),
      possui_consorcio: parseBool(getField(payload, 'possui_consorcio', 'possuiConsorcio')),
      saldo_fgts: parseNum(getField(payload, 'saldo_fgts', 'saldoFGTS')),

      // Investimentos
      investe: parseBool(getField(payload, 'investe')),
      valor_investido: parseNum(getField(payload, 'valor_investido', 'valorInvestido')),
      corretora: getField(payload, 'corretora') as string || null,

      // Situação financeira
      possui_divida: parseBool(getField(payload, 'possui_divida', 'possuiDivida')),

      // Outros
      possui_seguros: parseBool(getField(payload, 'possui_seguros', 'possuiSeguros')),
      possui_carro: parseBool(getField(payload, 'possui_carro', 'possuiCarro')),

      // Bancário
      bancos: parseJsonArray(getField(payload, 'bancos')),

      // Perfil avançado
      interesse_holding: parseBool(getField(payload, 'interesse_holding', 'interesseHolding')),
      perfil_indicacao: getField(payload, 'perfil_indicacao', 'perfilIndicacao') as string || null,

      // Calculados (placeholder)
      lead_score: 0,
      icp_level: null,

      // Controle
      origem: (getField(payload, 'origem') as string) || 'mcf_crm',
      updated_at: new Date().toISOString(),
    };

    // Upsert by contact_id
    const { error } = await supabaseClient
      .from('lead_profiles')
      .upsert(profileData, { onConflict: 'contact_id' });

    if (error) {
      console.error('[WEBHOOK-RECEIVER] Erro ao upsert lead_profile:', error);
    } else {
      console.log('[WEBHOOK-RECEIVER] ✅ Lead profile upserted para contact:', contactId);
    }
  } catch (err) {
    console.error('[WEBHOOK-RECEIVER] Erro inesperado no lead_profile:', err);
  }
}

// ============ EXISTING HELPERS ============

async function updateEndpointMetrics(supabaseClient: any, endpointId: string) {
  try {
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

async function getContractPaidStageIds(supabaseClient: any, originId: string): Promise<string[]> {
  const stageIds: string[] = [];
  
  const { data: localStages } = await supabaseClient
    .from('local_pipeline_stages')
    .select('id')
    .eq('origin_id', originId)
    .ilike('name', '%contrato%pago%');
  
  if (localStages) {
    stageIds.push(...localStages.map((s: any) => s.id));
  }
  
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

// ============ PARTNER DETECTION ============

const PARTNER_PATTERNS = [
  'A001', 'A002', 'A003', 'A004', 'A005', 'A006', 'A007', 'A008', 'A009',
  'INCORPORADOR', 'ANTICRISE', 'RENOVAÇÃO', 'RENOVACAO',
  'R001', 'R004', 'R005', 'R006', 'R009', 'R21',
  'MCF PLANO', 'MCF INCORPORADOR',
];

async function checkIfPartner(
  supabaseClient: any,
  email: string
): Promise<{ isPartner: boolean; product: string | null }> {
  try {
    const { data: txs } = await supabaseClient
      .from('hubla_transactions')
      .select('product_name')
      .eq('customer_email', email.toLowerCase().trim())
      .eq('sale_status', 'completed');

    for (const tx of txs || []) {
      if (!tx.product_name) continue;
      const upper = tx.product_name.toUpperCase();
      if (PARTNER_PATTERNS.some(p => upper.includes(p))) {
        return { isPartner: true, product: tx.product_name };
      }
    }
  } catch (err) {
    console.error('[WEBHOOK-RECEIVER] Erro ao verificar parceiro:', err);
  }
  return { isPartner: false, product: null };
}

const FALLBACK_VENDA_REALIZADA_STAGE = '3a2776e2-a536-4a2a-bb7b-a2f53c8941df';

async function getVendaRealizadaStageId(
  supabaseClient: any,
  originId: string
): Promise<string | null> {
  // Try crm_stages first
  const { data: crmStage } = await supabaseClient
    .from('crm_stages')
    .select('id')
    .eq('origin_id', originId)
    .ilike('stage_name', '%venda realizada%')
    .limit(1)
    .maybeSingle();

  if (crmStage) return crmStage.id;

  // Try local_pipeline_stages
  const { data: localStage } = await supabaseClient
    .from('local_pipeline_stages')
    .select('id')
    .eq('origin_id', originId)
    .ilike('name', '%venda realizada%')
    .limit(1)
    .maybeSingle();

  if (localStage) return localStage.id;

  return FALLBACK_VENDA_REALIZADA_STAGE;
}

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
