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
    console.log('🚀 Sincronizando Contacts do Clint CRM');
    const startTime = Date.now();

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Verificar se é modo automático (cron) ou manual
    const body = req.method === 'POST' ? await req.json() : {};
    const autoMode = body.auto_mode === true;
    
    // Configurações para modo automático vs manual
    const CONTACTS_PER_PAGE = 200;
    const BATCH_SIZE = 1000; // Aumentado para melhor performance
    const MAX_PAGES_PER_RUN = autoMode ? 50 : 1000; // Processar 50 páginas por vez no cron (10k contatos)
    const RATE_LIMIT_MS = 10; // Reduzido para 10ms

    let totalProcessed = 0;
    let totalSkipped = 0;
    let startPage = 1;
    let jobId = null;

    // Se modo automático, buscar ou criar job
    if (autoMode) {
      // Buscar job em andamento ou criar novo
      const { data: existingJobs } = await supabase
        .from('sync_jobs')
        .select('*')
        .eq('job_type', 'contacts')
        .in('status', ['running', 'pending'])
        .order('updated_at', { ascending: false })
        .limit(1);

      if (existingJobs && existingJobs.length > 0) {
        const job = existingJobs[0];
        jobId = job.id;
        startPage = (job.last_page || 0) + 1;
        totalProcessed = job.total_processed || 0;
        totalSkipped = job.total_skipped || 0;
        
        console.log(`📂 Continuando job ${jobId} da página ${startPage}`);
        
        // Atualizar status para running
        await supabase
          .from('sync_jobs')
          .update({ 
            status: 'running',
            started_at: new Date().toISOString()
          })
          .eq('id', jobId);
      } else {
        // Criar novo job
        const { data: newJob, error } = await supabase
          .from('sync_jobs')
          .insert({
            job_type: 'contacts',
            status: 'running',
            started_at: new Date().toISOString(),
            last_page: 0,
            total_processed: 0,
            total_skipped: 0
          })
          .select()
          .single();

        if (error) throw error;
        jobId = newJob.id;
        console.log(`📝 Novo job criado: ${jobId}`);
      }
    }

    let page = startPage;

    const endPage = autoMode ? Math.min(startPage + MAX_PAGES_PER_RUN - 1, 1000) : 1000;
    
    let lastContactsLength = 0;
    
    while (page <= endPage) {
      const response = await callClintAPI('contacts', {
        page: page.toString(),
        per_page: CONTACTS_PER_PAGE.toString(),
      });

      const contacts = response.data || [];
      lastContactsLength = contacts.length;
      
      if (contacts.length === 0) {
        console.log('✅ Todos os contatos foram processados');
        break;
      }

      // Processar em batches maiores com bulk upsert
      for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
        const batch = contacts.slice(i, i + BATCH_SIZE);

        // Preparar todos os contatos do batch para bulk upsert
        // IMPORTANTE: Usar email como fallback se não houver nome
        const contactsToUpsert = batch
          .filter((contact: any) => {
            // Se não tem nome, tenta usar email como fallback
            if (!contact.name || contact.name.trim() === '') {
              if (contact.email && contact.email.trim() !== '') {
                contact.name = contact.email.trim(); // Usar email como nome
                return true;
              }
              // Só descarta se não tiver nem nome nem email
              totalSkipped++;
              console.log(`⚠️ Contato sem nome/email descartado - ID: ${contact.id}`);
              return false;
            }
            return true;
          })
          .map((contact: any) => ({
            clint_id: contact.id,
            name: contact.name.trim(),
            email: contact.email || null,
            phone: contact.phone || null,
            organization_name: contact.organization?.name || null,
            origin_id: null, // Será preenchido posteriormente via sync-link-contacts
            tags: contact.tags || [],
            custom_fields: contact.custom_fields || {},
          }));

        // Só fazer upsert se houver contatos válidos no batch
        if (contactsToUpsert.length === 0) {
          console.log(`⏭️ Batch ${i}-${i + batch.length} pulado: nenhum contato válido`);
          continue;
        }

        // Bulk upsert de todos os contatos do batch de uma vez
        const { error } = await supabase
          .from('crm_contacts')
          .upsert(contactsToUpsert, { onConflict: 'clint_id' });

        if (error) {
          console.error(`❌ Erro no batch ${i}-${i + batch.length}:`, error);
          throw error;
        }

        totalProcessed += contactsToUpsert.length;
        const percentage = response.meta?.total 
          ? ((totalProcessed / response.meta.total) * 100).toFixed(1)
          : 'N/A';
        
        console.log(`📄 Processados: ${totalProcessed} contatos válidos | ${totalSkipped} sem nome/email (${percentage}% - página ${page}, batch ${Math.floor(i / BATCH_SIZE) + 1})`);
      }

      // Atualizar checkpoint do job após cada página
      if (autoMode && jobId) {
        await supabase
          .from('sync_jobs')
          .update({ 
            last_page: page,
            total_processed: totalProcessed,
            total_skipped: totalSkipped,
            updated_at: new Date().toISOString()
          })
          .eq('id', jobId);
      }

      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
      page++;

      if (lastContactsLength < CONTACTS_PER_PAGE) {
        console.log('✅ Última página alcançada');
        break;
      }
    }

    const duration = Date.now() - startTime;
    const isComplete = (page > endPage && lastContactsLength >= CONTACTS_PER_PAGE) ? false : true;

    // Atualizar job com status final
    if (autoMode && jobId) {
      await supabase
        .from('sync_jobs')
        .update({ 
          status: isComplete ? 'completed' : 'paused',
          completed_at: isComplete ? new Date().toISOString() : null,
          total_processed: totalProcessed,
          total_skipped: totalSkipped,
          metadata: {
            last_page: page - 1,
            duration_ms: duration,
            mode: 'auto'
          }
        })
        .eq('id', jobId);
    }

    const summary = {
      success: true,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      mode: autoMode ? 'auto' : 'manual',
      job_id: jobId,
      is_complete: isComplete,
      results: {
        contacts_synced: totalProcessed,
        contacts_skipped: totalSkipped,
        pages_processed: `${startPage}-${page - 1}`,
        reason_skipped: 'Contatos sem nome e email (violaria constraint NOT NULL)',
      },
    };

    console.log(`✅ Sincronização ${isComplete ? 'completa' : 'pausada'}:`);
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
