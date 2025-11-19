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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Sincronizando Deals do Clint CRM');
    const startTime = Date.now();

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    let page = 1;
    let totalProcessed = 0;
    const MAX_PAGES = 1000;

    // 📊 Cache de mapeamentos para otimização (bulk queries)
    const contactMap = new Map<string, string>();
    const stageMap = new Map<string, { id: string; origin_id: string | null }>();

    while (page <= MAX_PAGES) {
      const response = await callClintAPI('deals', {
        page: page.toString(),
        per_page: '200',
      });

      const deals = response.data || [];
      if (deals.length === 0) break;

      // 🔧 OTIMIZAÇÃO: Buscar todos contact_ids e stage_ids de uma vez
      const contactClintIds = [...new Set(deals.map((d: any) => d.contact_id).filter(Boolean))];
      const stageClintIds = [...new Set(deals.map((d: any) => d.stage_id).filter(Boolean))];

      // Bulk query: Contacts
      if (contactClintIds.length > 0) {
        const { data: contacts } = await supabase
          .from('crm_contacts')
          .select('id, clint_id')
          .in('clint_id', contactClintIds);

        if (contacts) {
          contacts.forEach((c: any) => contactMap.set(c.clint_id, c.id));
        }
      }

      // Bulk query: Stages
      if (stageClintIds.length > 0) {
        const { data: stages } = await supabase
          .from('crm_stages')
          .select('id, clint_id, origin_id')
          .in('clint_id', stageClintIds);

        if (stages) {
          stages.forEach((s: any) => stageMap.set(s.clint_id, { id: s.id, origin_id: s.origin_id }));
        }
      }

      // Processar deals em batch
      for (let i = 0; i < deals.length; i += 100) {
        const batch = deals.slice(i, i + 100);

        for (const deal of batch) {
          const contactId = deal.contact_id ? contactMap.get(deal.contact_id) || null : null;
          const stageData = deal.stage_id ? stageMap.get(deal.stage_id) || null : null;
          const stageId = stageData?.id || null;
          const originId = stageData?.origin_id || null;

          await supabase.from('crm_deals').upsert(
            {
              clint_id: deal.id,
              name: deal.name,
              value: deal.value || 0,
              stage_id: stageId,
              contact_id: contactId,
              origin_id: originId,
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

      await new Promise((r) => setTimeout(r, 100));
      page++;

      if (!response.meta || deals.length < 200) break;
    }

    const duration = Date.now() - startTime;

    const summary = {
      success: true,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      results: {
        deals_synced: totalProcessed,
      },
    };

    console.log('✅ Sincronização completa:');
    console.log(JSON.stringify(summary, null, 2));

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
