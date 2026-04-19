import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuração fixa para leads LIVE (PIPELINE INSIDE SALES - LEAD GRATUITO)
const LIVE_ORIGIN_ID = 'fdac4941-f0a2-46a2-8e70-7578d922d21a';
const LIVE_INITIAL_STAGE_ID = '252c75d2-2a01-43ca-bc01-27270d0cd849'; // Base

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
  const startTime = Date.now();
  let webhookLogId: string | null = null;
  const finalizeWebhookLog = async (status: 'success' | 'error', errorMsg?: string) => {
    if (!webhookLogId) return;
    try {
      await supabase.from('webhook_events').update({
        status,
        processed_at: new Date().toISOString(),
        processing_time_ms: Date.now() - startTime,
        error_message: errorMsg ?? null,
      }).eq('id', webhookLogId);
    } catch (_) { /* nunca quebra fluxo */ }
  };

  try {
    const payload = await req.json();
    console.log('[LIVE-LEAD] Recebendo lead:', JSON.stringify(payload, null, 2));

    // Registrar evento no painel de movimentações
    try {
      const { data: log } = await supabase
        .from('webhook_events')
        .insert({
          event_type: 'lead.received.live',
          event_data: payload,
          status: 'processing',
        })
        .select('id')
        .single();
      webhookLogId = log?.id ?? null;
    } catch (_) { /* nunca quebra fluxo */ }

    // Validar campos obrigatórios
    if (!payload.name || !payload.email) {
      console.error('[LIVE-LEAD] Campos obrigatórios faltando');
      return new Response(
        JSON.stringify({ error: 'name e email são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalizar telefone para formato E.164
    const normalizedPhone = normalizePhone(payload.whatsapp);
    console.log('[LIVE-LEAD] Telefone normalizado:', normalizedPhone);

    // 1. Verificar se contato já existe (por email, fallback por telefone)
    let contactId: string;
    let existingContact = null;

    // 1a. Buscar por email
    const { data: contactByEmail } = await supabase
      .from('crm_contacts')
      .select('id')
      .ilike('email', payload.email.trim())
      .maybeSingle();

    existingContact = contactByEmail;

    // 1b. Fallback: buscar por telefone (últimos 9 dígitos)
    if (!existingContact && normalizedPhone) {
      const phoneClean = normalizedPhone.replace(/\D/g, '');
      const phoneSuffix = phoneClean.slice(-9);
      if (phoneSuffix.length === 9) {
        const { data: contactByPhone } = await supabase
          .from('crm_contacts')
          .select('id, email')
          .ilike('phone', `%${phoneSuffix}`)
          .maybeSingle();
        
        if (contactByPhone) {
          existingContact = contactByPhone;
          console.log('[LIVE-LEAD] Contato encontrado por telefone (9-digit):', contactByPhone.id);
          if (!contactByPhone.email && payload.email) {
            await supabase.from('crm_contacts').update({ email: payload.email.trim().toLowerCase(), updated_at: new Date().toISOString() }).eq('id', contactByPhone.id);
          }
        }
      }

      // Fallback: últimos 8 dígitos (ignora dígito 9 variável do celular BR)
      if (!existingContact && phoneClean.length >= 8) {
        const phoneSuffix8 = phoneClean.slice(-8);
        const { data: contactByPhone8 } = await supabase
          .from('crm_contacts')
          .select('id, email')
          .ilike('phone', `%${phoneSuffix8}`)
          .maybeSingle();
        
        if (contactByPhone8) {
          existingContact = contactByPhone8;
          console.log('[LIVE-LEAD] Contato encontrado por telefone (8-digit fallback):', contactByPhone8.id);
          if (!contactByPhone8.email && payload.email) {
            await supabase.from('crm_contacts').update({ email: payload.email.trim().toLowerCase(), updated_at: new Date().toISOString() }).eq('id', contactByPhone8.id);
          }
        }
      }
    }

    if (existingContact) {
      contactId = existingContact.id;
      console.log('[LIVE-LEAD] Contato existente:', contactId);
      
      // Atualizar dados do contato
      await supabase
        .from('crm_contacts')
        .update({
          name: payload.name,
          phone: normalizedPhone,
          updated_at: new Date().toISOString()
        })
        .eq('id', contactId);
    } else {
      // Criar novo contato
      const { data: newContact, error: contactError } = await supabase
        .from('crm_contacts')
        .insert({
          clint_id: `live-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          name: payload.name,
          email: payload.email.trim().toLowerCase(),
          phone: normalizedPhone,
          origin_id: LIVE_ORIGIN_ID,
          tags: ['Lead-Live']
        })
        .select('id')
        .single();
      
      if (contactError) {
        console.error('[LIVE-LEAD] Erro ao criar contato:', contactError);
        throw contactError;
      }
      contactId = newContact.id;
      console.log('[LIVE-LEAD] Novo contato criado:', contactId);
    }

    // 2. Verificar se já existe deal por identidade (email/phone) nesta origem
    const emailNorm = payload.email?.trim().toLowerCase() || '';
    const phoneCleanForCheck = normalizedPhone ? normalizedPhone.replace(/\D/g, '') : '';
    const phoneSuffixForCheck = phoneCleanForCheck.length >= 9 ? phoneCleanForCheck.slice(-9) : phoneCleanForCheck;

    const { data: existingDealId } = await supabase
      .rpc('check_duplicate_deal_by_identity', {
        p_email: emailNorm,
        p_phone_suffix: phoneSuffixForCheck,
        p_origin_id: LIVE_ORIGIN_ID,
      });

    if (existingDealId) {
      console.log('[LIVE-LEAD] Deal já existe por identidade, ignorando duplicata:', existingDealId);
      return new Response(
        JSON.stringify({ 
          success: true, 
          action: 'skipped', 
          reason: 'deal_already_exists',
          deal_id: existingDealId,
          contact_id: contactId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Mapear custom_fields com qualificação
    const customFields: Record<string, any> = {
      source: payload.source || 'form-live',
      solucao_busca: payload.objective,
      profile_type: payload.profileType,
      faixa_renda: mapMonthlyIncome(payload.monthlyIncome),
      industry_sector: payload.industrySector,
      selection_decision: payload.selectionDecision,
      original_timestamp: payload.timestamp,
      lead_channel: 'LIVE'
    };

    // 4. Buscar próximo owner baseado na distribuição configurada
    let assignedOwner: string | null = null;
    let assignedOwnerProfileId: string | null = null;
    const { data: nextOwner, error: ownerError } = await supabase
      .rpc('get_next_lead_owner', { p_origin_id: LIVE_ORIGIN_ID });

    if (ownerError) {
      console.log('[LIVE-LEAD] ⚠️ Erro ao buscar owner:', ownerError.message);
    } else if (nextOwner) {
      assignedOwner = nextOwner;
      console.log('[LIVE-LEAD] 👤 Owner atribuído automaticamente:', assignedOwner);
      
      // Buscar owner_profile_id correspondente
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', assignedOwner)
        .maybeSingle();
      
      if (ownerProfile) {
        assignedOwnerProfileId = ownerProfile.id;
        console.log('[LIVE-LEAD] 👤 Profile ID encontrado:', assignedOwnerProfileId);
      } else {
        console.log('[LIVE-LEAD] ⚠️ Profile não encontrado para email:', assignedOwner);
      }
    } else {
      console.log('[LIVE-LEAD] ⚠️ Nenhum owner configurado para distribuição');
    }

    // 5. Criar deal com owner atribuído
    const dealCreatedAt = payload.timestamp || new Date().toISOString();
    const { data: deal, error: dealError } = await supabase
      .from('crm_deals')
      .insert({
        clint_id: `live-deal-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        name: payload.name,
        value: 0,
        contact_id: contactId,
        origin_id: LIVE_ORIGIN_ID,
        stage_id: LIVE_INITIAL_STAGE_ID,
        owner_id: assignedOwner,
        owner_profile_id: assignedOwnerProfileId,
        product_name: 'LIVE',
        tags: ['Lead-Live'],
        custom_fields: customFields,
        data_source: 'webhook',
        created_at: dealCreatedAt,
        stage_moved_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (dealError) {
      console.error('[LIVE-LEAD] Erro ao criar deal:', dealError);
      throw dealError;
    }

    console.log('[LIVE-LEAD] ✅ Deal criado com sucesso:', deal.id);
    if (assignedOwner) {
      console.log('[LIVE-LEAD] 👤 Atribuído para:', assignedOwner);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        action: 'created',
        deal_id: deal.id,
        contact_id: contactId,
        assigned_owner: assignedOwner,
        origin: 'LEAD GRATUITO',
        stage: 'Base'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[LIVE-LEAD] ❌ Erro:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Normalizar telefone para formato E.164 (+55XXXXXXXXXXX)
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  
  // Remove tudo exceto números
  let clean = phone.replace(/\D/g, '');
  
  // Se começar com 0, remove (ex: 011 -> 11)
  if (clean.startsWith('0')) {
    clean = clean.substring(1);
  }
  
  // Adiciona código do país se não tiver
  if (!clean.startsWith('55') && clean.length <= 11) {
    clean = '55' + clean;
  }
  
  return '+' + clean;
}

// Mapear faixa de renda para valores padronizados
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
