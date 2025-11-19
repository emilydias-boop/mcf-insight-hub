import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLINT_API_KEY = Deno.env.get('CLINT_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const BATCH_SIZE = 100;

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

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
  let jobId: string | undefined;

  try {
    const body = await req.json().catch(() => ({}));
    const autoMode = body.auto_mode === true;
    
    console.log('🚀 Sincronizando Deals do Clint CRM', autoMode ? '(Modo Automático)' : '');
    const startTime = Date.now();

    // Criar ou recuperar job de sincronização
    let startPage = 1;
    
    if (autoMode) {
      // Verificar se há job em execução
      const { data: runningJob } = await supabase
        .from('sync_jobs')
        .select('*')
        .eq('job_type', 'sync-deals')
        .eq('status', 'running')
        .single();

      if (runningJob) {
        console.log('⏸️ Job já em execução, continuando...');
        jobId = runningJob.id;
        startPage = (runningJob.last_page || 0) + 1;
      } else {
        // Criar novo job
        const { data: newJob, error: jobError } = await supabase
          .from('sync_jobs')
          .insert({
            job_type: 'sync-deals',
            status: 'running',
            started_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (jobError) throw jobError;
        jobId = newJob.id;
      }
    }

    let page = startPage;
    let totalProcessed = 0;
    const MAX_PAGES = autoMode ? 5 : 1000; // Limitar em modo automático

    // 📊 Cache de mapeamentos para otimização (bulk queries)
    const contactMap = new Map<string, string>();
    const stageMap = new Map<string, { id: string; origin_id: string | null }>();
    let lastResponse: any;
    let lastDeals: any[] = [];

    while (page <= MAX_PAGES) {
      const response = await callClintAPI('deals', {
        page: page.toString(),
        per_page: '200',
      });

      lastResponse = response;
      const deals = response.data || [];
      lastDeals = deals;
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
      for (let i = 0; i < deals.length; i += BATCH_SIZE) {
        const batch = deals.slice(i, i + BATCH_SIZE);

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

      // Salvar checkpoint em modo automático
      if (autoMode && jobId) {
        await supabase
          .from('sync_jobs')
          .update({
            last_page: page,
            total_processed: totalProcessed,
            updated_at: new Date().toISOString(),
          })
          .eq('id', jobId);
      }

      await new Promise((r) => setTimeout(r, 100));
      page++;

      if (!response.meta || deals.length < 200) break;
      
      // Em modo automático, parar após MAX_PAGES para não bloquear
      if (autoMode && page > startPage + MAX_PAGES) {
        console.log(`⏸️ Pausando após ${MAX_PAGES} páginas em modo automático`);
        break;
      }
    }

    const duration = Date.now() - startTime;
    const isComplete = page > startPage && (!lastResponse?.meta || lastDeals?.length < 200);

    // Atualizar status do job
    if (autoMode && jobId!) {
      await supabase
        .from('sync_jobs')
        .update({
          status: isComplete ? 'completed' : 'running',
          completed_at: isComplete ? new Date().toISOString() : null,
          total_processed: totalProcessed,
          last_page: page - 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);
    }

    const summary = {
      success: true,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      is_complete: isComplete,
      results: {
        deals_synced: totalProcessed,
        last_page: page - 1,
      },
    };

    console.log(isComplete ? '✅ Sincronização completa:' : '⏸️ Sincronização pausada:');
    console.log(JSON.stringify(summary, null, 2));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('❌ Erro na sincronização:', error);
    
    // Marcar job como failed em modo automático
    if (jobId) {
      try {
        await supabase
          .from('sync_jobs')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Erro desconhecido',
            updated_at: new Date().toISOString(),
          })
          .eq('id', jobId);
      } catch (e) {
        console.error('Erro ao atualizar job:', e);
      }
    }
    
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
