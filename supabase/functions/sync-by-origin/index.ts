import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLINT_API_KEY = Deno.env.get('CLINT_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

interface ClintAPIResponse<T> {
  data: T;
  meta?: {
    page: number;
    per_page: number;
    total: number;
  };
}

async function callClintAPI<T = any>(resource: string, params?: Record<string, string>): Promise<ClintAPIResponse<T>> {
  const queryParams = new URLSearchParams(params || {});
  const url = `https://api.clint.digital/v1/${resource}${
    queryParams.toString() ? '?' + queryParams.toString() : ''
  }`;

  const response = await fetch(url, {
    headers: {
      'api-token': CLINT_API_KEY!,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Clint API error: ${response.status} - ${error}`);
  }

  return await response.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { origin_id } = await req.json();
    
    if (!origin_id) {
      throw new Error('origin_id é obrigatório');
    }

    console.log(`🎯 Sincronizando origin: ${origin_id}`);
    const startTime = Date.now();

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Buscar dados da origin no banco
    const { data: origin, error: originError } = await supabase
      .from('crm_origins')
      .select('id, clint_id, name')
      .eq('id', origin_id)
      .single();

    if (originError || !origin) {
      throw new Error(`Origin não encontrada: ${origin_id}`);
    }

    console.log(`📋 Origin: ${origin.name} (${origin.clint_id})`);

    // Buscar todos os deals dessa origin da API Clint
    let allDeals: any[] = [];
    let page = 1;
    const MAX_PAGES = 500; // Aumentado para cobrir até 100.000 deals
    const PER_PAGE = 200; // Máximo permitido pela API

    console.log(`🔍 Buscando deals com origin_id: ${origin.clint_id}`);

    while (page <= MAX_PAGES) {
      const response = await callClintAPI<any[]>('deals', {
        page: page.toString(),
        per_page: PER_PAGE.toString(),
      });

      const deals = response.data || [];
      if (deals.length === 0) {
        console.log(`📄 Página ${page}: vazia, encerrando busca`);
        break;
      }

      // Filtrar deals dessa origin
      const dealsFromOrigin = deals.filter((deal: any) => 
        deal.origin_id === origin.clint_id
      );

      allDeals.push(...dealsFromOrigin);

      console.log(`📄 Página ${page}: ${deals.length} deals total, ${dealsFromOrigin.length} dessa origin (acumulado: ${allDeals.length})`);

      // Continuar até não haver mais dados
      if (deals.length < PER_PAGE) {
        console.log(`📄 Última página alcançada (${deals.length} < ${PER_PAGE})`);
        break;
      }
      
      page++;
    }

    console.log(`✅ Total de deals encontrados: ${allDeals.length}`);

    // Buscar stages para mapear IDs
    const { data: stages } = await supabase
      .from('crm_stages')
      .select('id, clint_id');

    const stageMap = new Map(stages?.map(s => [s.clint_id, s.id]) || []);

    // Extrair contact_ids únicos
    const uniqueContactIds = [...new Set(
      allDeals
        .filter(deal => deal.contact_id)
        .map(deal => deal.contact_id)
    )];

    console.log(`👥 Contacts únicos a buscar: ${uniqueContactIds.length}`);

    // Buscar contacts da API
    let allContacts: any[] = [];
    
    if (uniqueContactIds.length > 0) {
      page = 1;
      while (page <= MAX_PAGES && allContacts.length < uniqueContactIds.length) {
        const response = await callClintAPI<any[]>('contacts', {
          page: page.toString(),
          per_page: '200',
        });

        if (!response.data || response.data.length === 0) break;

        // Filtrar apenas os contacts que estão nos deals
        const relevantContacts = response.data.filter((contact: any) =>
          uniqueContactIds.includes(contact.id)
        );

        allContacts.push(...relevantContacts);

        if (!response.meta || page >= response.meta.total / 200) break;
        page++;
      }
    }

    console.log(`✅ Contacts encontrados: ${allContacts.length}`);

    // Buscar contacts já existentes para mapear IDs
    const { data: existingContacts } = await supabase
      .from('crm_contacts')
      .select('id, clint_id');

    const contactMap = new Map(existingContacts?.map(c => [c.clint_id, c.id]) || []);

    // Bulk upsert contacts
    if (allContacts.length > 0) {
      const contactsToUpsert = allContacts.map(contact => ({
        clint_id: contact.id,
        name: contact.name,
        email: contact.email || null,
        phone: contact.phone || null,
        organization_name: contact.organization?.name || null,
        origin_id: origin_id,
        tags: contact.tags || [],
        custom_fields: contact.custom_fields || {},
      }));

      const { error: contactError } = await supabase
        .from('crm_contacts')
        .upsert(contactsToUpsert, { onConflict: 'clint_id' });

      if (contactError) {
        console.error('❌ Erro ao inserir contacts:', contactError);
        throw contactError;
      }

      console.log(`✅ ${contactsToUpsert.length} contacts inseridos`);

      // Atualizar contactMap com novos IDs
      const { data: updatedContacts } = await supabase
        .from('crm_contacts')
        .select('id, clint_id')
        .in('clint_id', allContacts.map(c => c.id));

      updatedContacts?.forEach(c => contactMap.set(c.clint_id, c.id));
    }

    // Bulk upsert deals
    if (allDeals.length > 0) {
      const dealsToUpsert = allDeals.map(deal => ({
        clint_id: deal.id,
        name: deal.name || 'Negócio sem título',
        value: deal.value || 0,
        stage_id: stageMap.get(deal.stage_id) || null,
        contact_id: contactMap.get(deal.contact_id) || null,
        origin_id: origin_id,
        probability: deal.probability || null,
        expected_close_date: deal.expected_close_date || null,
        owner_id: deal.user?.email || deal.owner_id || null,
        tags: deal.tags || [],
        custom_fields: deal.custom_fields || {},
      }));

      const { error: dealError } = await supabase
        .from('crm_deals')
        .upsert(dealsToUpsert, { onConflict: 'clint_id' });

      if (dealError) {
        console.error('❌ Erro ao inserir deals:', dealError);
        throw dealError;
      }

      console.log(`✅ ${dealsToUpsert.length} deals inseridos`);
    }

    // Atualizar contact_count da origin
    const { error: updateError } = await supabase
      .from('crm_origins')
      .update({ contact_count: allContacts.length })
      .eq('id', origin_id);

    if (updateError) {
      console.error('❌ Erro ao atualizar contact_count:', updateError);
    }

    const duration = Date.now() - startTime;

    const summary = {
      success: true,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      origin: {
        id: origin_id,
        name: origin.name,
      },
      results: {
        contacts_synced: allContacts.length,
        deals_synced: allDeals.length,
      },
    };

    console.log(`✅ Sincronização concluída em ${(duration / 1000).toFixed(1)}s`);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('❌ Erro na sincronização:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
