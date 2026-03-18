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
      const { data: contactByEmail } = await supabase
        .from('crm_contacts')
        .select('id')
        .ilike('email', emailTrimmed)
        .maybeSingle();
      existingContact = contactByEmail;
    }

    // 7c. Fallback: buscar por telefone (últimos 9 dígitos)
    if (!existingContact && normalizedPhone) {
      const phoneSuffix = normalizedPhone.replace(/\D/g, '').slice(-9);
      if (phoneSuffix.length === 9) {
        const { data: contactByPhone } = await supabase
          .from('crm_contacts')
          .select('id, email')
          .ilike('phone', `%${phoneSuffix}`)
          .maybeSingle();
        
        if (contactByPhone) {
          existingContact = contactByPhone;
          console.log('[WEBHOOK-RECEIVER] Contato encontrado por telefone:', contactByPhone.id);
          if (!contactByPhone.email && emailTrimmed) {
            await supabase.from('crm_contacts').update({ email: emailTrimmed.toLowerCase(), updated_at: new Date().toISOString() }).eq('id', contactByPhone.id);
          }
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
      
      await supabase
        .from('crm_contacts')
        .update({
          name: payload.name || payload.nome_completo,
          phone: normalizedPhone,
          tags: autoTags.length > 0 ? autoTags : undefined,
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
        console.error('[WEBHOOK-RECEIVER] Erro ao criar contato:', contactError);
        throw contactError;
      }
      contactId = newContact.id;
      console.log('[WEBHOOK-RECEIVER] Novo contato criado:', contactId);
    }

    // 8. Check for existing deal (any deal for same contact+origin, respecting UNIQUE constraint)
    const { data: existingDeal } = await supabase
      .from('crm_deals')
      .select('id')
      .eq('contact_id', contactId)
      .eq('origin_id', endpoint.origin_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingDeal) {
      console.log('[WEBHOOK-RECEIVER] Deal já existe, atualizando lead_profile:', existingDeal.id);
      
      // Mesmo com deal duplicado, atualiza o lead_profile
      await upsertLeadProfile(supabase, contactId, existingDeal.id, payload, cpfClean, normalizedPhone);

      // Adicionar auto_tags ao deal existente (se houver)
      if (autoTags.length > 0) {
        const { data: currentDeal } = await supabase
          .from('crm_deals')
          .select('tags')
          .eq('id', existingDeal.id)
          .single();
        
        const currentTags: string[] = (currentDeal?.tags as string[]) || [];
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

    // 10. Get next owner based on distribution
    let assignedOwner: string | null = null;
    let assignedOwnerProfileId: string | null = null;
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

    // 12. Upsert lead_profile com dados completos do ClientData
    await upsertLeadProfile(supabase, contactId, deal.id, payload, cpfClean, normalizedPhone);

    // 13. Update endpoint metrics
    await updateEndpointMetrics(supabase, endpoint.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        action: 'created',
        deal_id: deal.id,
        contact_id: contactId,
        assigned_owner: assignedOwner,
        endpoint: endpoint.name,
        tags: autoTags,
        lead_profile: true
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
