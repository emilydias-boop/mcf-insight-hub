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

  try {
    const payload = await req.json();
    console.log('[LIVE-LEAD] Recebendo lead:', JSON.stringify(payload, null, 2));

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

    // 1. Verificar se contato já existe (por email)
    let contactId: string;
    const { data: existingContact } = await supabase
      .from('crm_contacts')
      .select('id')
      .ilike('email', payload.email.trim())
      .maybeSingle();

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
          tags: ['Lead-Live'],
          data_source: 'webhook-live'
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

    // 2. Verificar se já existe deal para este contato nesta origem
    const { data: existingDeal } = await supabase
      .from('crm_deals')
      .select('id')
      .eq('contact_id', contactId)
      .eq('origin_id', LIVE_ORIGIN_ID)
      .maybeSingle();

    if (existingDeal) {
      console.log('[LIVE-LEAD] Deal já existe, ignorando duplicata:', existingDeal.id);
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

    // 4. Criar deal
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
        product_name: 'LIVE',
        tags: ['Lead-Live'],
        custom_fields: customFields,
        data_source: 'webhook-live',
        created_at: dealCreatedAt
      })
      .select('id')
      .single();

    if (dealError) {
      console.error('[LIVE-LEAD] Erro ao criar deal:', dealError);
      throw dealError;
    }

    console.log('[LIVE-LEAD] ✅ Deal criado com sucesso:', deal.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        action: 'created',
        deal_id: deal.id,
        contact_id: contactId,
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
