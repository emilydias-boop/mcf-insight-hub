import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

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

async function callClintAPI<T = any>(
  resource: string,
  params?: Record<string, string>
): Promise<ClintAPIResponse<T>> {
  const queryParams = new URLSearchParams(params || {});
  const url = `https://api.clint.digital/v1/${resource}${
    queryParams.toString() ? '?' + queryParams.toString() : ''
  }`;

  console.log(`🔵 Calling Clint API: ${resource} (page ${params?.page || 1})`);

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

async function syncOrigins(supabase: any): Promise<number> {
  console.log('🔄 Sincronizando Origins...');
  const startTime = Date.now();
  let totalProcessed = 0;

  try {
    const response = await callClintAPI('origins', { page: '1', per_page: '200' });
    const origins = response.data || [];

    for (const origin of origins) {
      await supabase.from('crm_origins').upsert(
        {
          clint_id: origin.id,
          name: origin.name,
          description: origin.description || null,
          parent_id: null,
          contact_count: 0,
        },
        { onConflict: 'clint_id' }
      );
    }

    totalProcessed = origins.length;
    console.log(`✅ Origins sincronizadas: ${totalProcessed} em ${Date.now() - startTime}ms`);
    
    return totalProcessed;
  } catch (error) {
    console.error('❌ Erro ao sincronizar origins:', error);
    throw error;
  }
}

async function syncContacts(supabase: any): Promise<number> {
  console.log('🔄 Sincronizando Contacts...');
  const startTime = Date.now();
  let page = 1;
  let totalProcessed = 0;
  const MAX_PAGES = 1000;

  try {
    while (page <= MAX_PAGES) {
      const response = await callClintAPI('contacts', {
        page: page.toString(),
        per_page: '200',
      });

      const contacts = response.data || [];
      if (contacts.length === 0) break;

      for (let i = 0; i < contacts.length; i += 100) {
        const batch = contacts.slice(i, i + 100);

        for (const contact of batch) {
          await supabase.from('crm_contacts').upsert(
            {
              clint_id: contact.id,
              name: contact.name,
              email: contact.email || null,
              phone: contact.phone || null,
              organization_name: contact.organization?.name || null,
              origin_id: null,
              tags: contact.tags || [],
              custom_fields: contact.custom_fields || {},
            },
            { onConflict: 'clint_id' }
          );
        }
      }

      totalProcessed += contacts.length;
      console.log(`📄 Contatos processados: ${totalProcessed} (página ${page})`);

      await new Promise((r) => setTimeout(r, 200));
      page++;

      if (!response.meta || contacts.length < 200) break;
    }

    console.log(`✅ Contacts sincronizados: ${totalProcessed} em ${Date.now() - startTime}ms`);
    return totalProcessed;
  } catch (error) {
    console.error('❌ Erro ao sincronizar contacts:', error);
    throw error;
  }
}

async function syncDeals(supabase: any): Promise<number> {
  console.log('🔄 Sincronizando Deals...');
  const startTime = Date.now();
  let page = 1;
  let totalProcessed = 0;
  const MAX_PAGES = 1000;

  try {
    while (page <= MAX_PAGES) {
      const response = await callClintAPI('deals', {
        page: page.toString(),
        per_page: '200',
      });

      const deals = response.data || [];
      if (deals.length === 0) break;

      for (let i = 0; i < deals.length; i += 100) {
        const batch = deals.slice(i, i + 100);

        for (const deal of batch) {
          let contactId = null;
          if (deal.contact_id) {
            const { data: contact } = await supabase
              .from('crm_contacts')
              .select('id')
              .eq('clint_id', deal.contact_id)
              .maybeSingle();
            contactId = contact?.id || null;
          }

          let stageId = null;
          if (deal.stage_id) {
            const { data: stage } = await supabase
              .from('crm_stages')
              .select('id')
              .eq('clint_id', deal.stage_id)
              .maybeSingle();
            stageId = stage?.id || null;
          }

          await supabase.from('crm_deals').upsert(
            {
              clint_id: deal.id,
              name: deal.name,
              value: deal.value || 0,
              stage_id: stageId,
              contact_id: contactId,
              origin_id: null,
              owner_id: deal.owner_id || null,
              probability: deal.probability || null,
              expected_close_date: deal.expected_close_date || null,
              tags: deal.tags || [],
              custom_fields: deal.custom_fields || {},
            },
            { onConflict: 'clint_id' }
          );
        }
      }

      totalProcessed += deals.length;
      console.log(`💼 Deals processados: ${totalProcessed} (página ${page})`);

      await new Promise((r) => setTimeout(r, 200));
      page++;

      if (!response.meta || deals.length < 200) break;
    }

    console.log(`✅ Deals sincronizados: ${totalProcessed} em ${Date.now() - startTime}ms`);
    return totalProcessed;
  } catch (error) {
    console.error('❌ Erro ao sincronizar deals:', error);
    throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Iniciando sincronização completa de dados Clint CRM');
    const overallStart = Date.now();

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const results = {
      origins: 0,
      contacts: 0,
      deals: 0,
      errors: [] as string[],
    };

    // Sincronizar na ordem: Origins → Contacts → Deals
    try {
      results.origins = await syncOrigins(supabase);
    } catch (error) {
      results.errors.push(`Origins: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }

    try {
      results.contacts = await syncContacts(supabase);
    } catch (error) {
      results.errors.push(`Contacts: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }

    try {
      results.deals = await syncDeals(supabase);
    } catch (error) {
      results.errors.push(`Deals: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }

    const totalTime = Date.now() - overallStart;

    const summary = {
      success: results.errors.length === 0,
      timestamp: new Date().toISOString(),
      duration_ms: totalTime,
      results: {
        origins_synced: results.origins,
        contacts_synced: results.contacts,
        deals_synced: results.deals,
        total_synced: results.origins + results.contacts + results.deals,
      },
      errors: results.errors.length > 0 ? results.errors : undefined,
    };

    console.log('\n📊 RESUMO DA SINCRONIZAÇÃO:');
    console.log(JSON.stringify(summary, null, 2));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: results.errors.length > 0 ? 207 : 200,
    });
  } catch (error) {
    console.error('❌ Erro fatal na sincronização:', error);
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
