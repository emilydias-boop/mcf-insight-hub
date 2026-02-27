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

async function callClintAPI<T = any>(
  resource: string,
  params?: Record<string, string>
): Promise<ClintAPIResponse<T>> {
  const queryParams = new URLSearchParams(params || {});
  const url = `https://api.clint.digital/v1/${resource}${
    queryParams.toString() ? '?' + queryParams.toString() : ''
  }`;

  console.log(`🔵 Calling Clint API: ${resource} (page ${params?.page || 1})`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

  try {
    const response = await fetch(url, {
      headers: {
        'api-token': CLINT_API_KEY!,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Clint API error: ${response.status} - ${error}`);
    }

    // Verificar se há conteúdo na resposta
    const contentLength = response.headers.get('content-length');
    const contentType = response.headers.get('content-type');

    if (contentLength === '0' || contentLength === null) {
      console.log(`⚠️ Resposta vazia da API Clint (página ${params?.page || 1}) - Fim dos dados`);
      return { data: [] as any };
    }

    if (!contentType?.includes('application/json')) {
      console.error(`⚠️ Resposta não é JSON: ${contentType}`);
      const text = await response.text();
      console.error(`Resposta: ${text.substring(0, 200)}`);
      throw new Error(`API retornou tipo inválido: ${contentType}`);
    }

    // Tentar fazer parse do JSON
    const text = await response.text();
    
    if (!text || text.trim().length === 0) {
      console.log(`⚠️ Corpo da resposta vazio (página ${params?.page || 1}) - Fim dos dados`);
      return { data: [] as any };
    }

    try {
      return JSON.parse(text);
    } catch (parseError: any) {
      console.error(`❌ Erro ao fazer parse do JSON (página ${params?.page || 1}):`, parseError);
      console.error(`Resposta recebida (primeiros 500 chars): ${text.substring(0, 500)}`);
      throw new Error(`Falha ao processar resposta JSON: ${parseError?.message || 'Erro desconhecido'}`);
    }

  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error?.name === 'AbortError') {
      throw new Error(`Timeout na chamada à API Clint após 60s (${resource}, página ${params?.page || 1})`);
    }
    
    throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Sincronizando Contacts do Clint CRM');
    const startTime = Date.now();

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Verificar se é modo automático (cron) ou manual - com tratamento robusto
    let body: any = {};
    
    if (req.method === 'POST') {
      try {
        const contentType = req.headers.get('content-type');
        
        if (!contentType?.includes('application/json')) {
          console.log('⚠️ POST request sem content-type JSON, usando body vazio');
          body = {};
        } else {
          const text = await req.text();
          
          if (!text || text.trim().length === 0) {
            console.log('⚠️ POST request com body vazio, usando body vazio');
            body = {};
          } else {
            try {
              body = JSON.parse(text);
            } catch (e) {
              console.error('⚠️ Erro ao fazer parse do body, usando body vazio:', e);
              body = {};
            }
          }
        }
      } catch (e) {
        console.error('⚠️ Erro ao processar request body, usando body vazio:', e);
        body = {};
      }
    }
    
    const autoMode = body.auto_mode === true;
    
    // Configurações otimizadas para processar 100k+ contatos
    const CONTACTS_PER_PAGE = 200;
    const BATCH_SIZE = 1500; // Otimizado para ~20k contatos por execução
    const MAX_PAGES_PER_RUN = autoMode ? 100 : 1000; // 100 páginas = 20k contatos por execução
    const RATE_LIMIT_MS = 5; // Otimizado para velocidade máxima

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
        .in('status', ['running', 'pending', 'paused'])
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
    
    // Buscar mapa de origins (clint_id -> supabase_id) para vincular origins diretamente
    const { data: originsData } = await supabase
      .from('crm_origins')
      .select('id, clint_id');
    
    const originsMap = new Map<string, string>();
    originsData?.forEach(origin => {
      originsMap.set(origin.clint_id, origin.id);
    });
    
    console.log(`📍 ${originsMap.size} origins carregadas para mapeamento`);
    
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

      // Processar em batches com deduplicação por email
      for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
        const batch = contacts.slice(i, i + BATCH_SIZE);

        // Preparar todos os contatos do batch
        const contactsToProcess = batch
          .map((contact: any) => {
            let contactName = '';
            if (contact.name && contact.name.trim() !== '') {
              contactName = contact.name.trim();
            } else if (contact.email && contact.email.trim() !== '') {
              contactName = contact.email.trim();
            } else {
              contactName = `Contato sem nome (ID: ${contact.id})`;
              totalSkipped++;
            }

            let originId = null;
            const contactOriginClintId = contact.origin_id || contact.origin?.id;
            if (contactOriginClintId) {
              originId = originsMap.get(contactOriginClintId) || null;
            }

            return {
              clint_id: contact.id,
              name: contactName,
              email: contact.email || null,
              phone: contact.phone || null,
              organization_name: contact.organization?.name || null,
              origin_id: originId,
              tags: contact.tags || [],
              custom_fields: contact.custom_fields || {},
            };
          });

        // DEDUPLICAÇÃO: Para contatos com email, verificar se já existe com outro clint_id
        const emailsInBatch = contactsToProcess
          .filter((c: any) => c.email)
          .map((c: any) => c.email.toLowerCase());

        if (emailsInBatch.length > 0) {
          const { data: existingByEmail } = await supabase
            .from('crm_contacts')
            .select('id, email, clint_id')
            .in('email', emailsInBatch);

          if (existingByEmail && existingByEmail.length > 0) {
            const emailToExisting = new Map<string, any>();
            existingByEmail.forEach((c: any) => {
              if (c.email) emailToExisting.set(c.email.toLowerCase(), c);
            });

            for (const contact of contactsToProcess) {
              if (contact.email) {
                const existing = emailToExisting.get(contact.email.toLowerCase());
                if (existing && existing.clint_id !== contact.clint_id) {
                  await supabase
                    .from('crm_contacts')
                    .update({ clint_id: contact.clint_id, updated_at: new Date().toISOString() })
                    .eq('id', existing.id);
                  console.log(`🔄 Reconciliado clint_id: ${existing.clint_id} → ${contact.clint_id} (email: ${contact.email})`);
                }
              }
            }
          }
        }

        // Bulk upsert
        const { error } = await supabase
          .from('crm_contacts')
          .upsert(contactsToProcess, { onConflict: 'clint_id' });

        if (error) {
          console.error(`❌ Erro no batch ${i}-${i + batch.length}:`, error);
          throw error;
        }

        totalProcessed += contactsToProcess.length;
        
        const elapsedMs = Date.now() - startTime;
        const contactsPerMin = Math.round((totalProcessed / elapsedMs) * 60000);
        const percentage = response.meta?.total 
          ? ((totalProcessed / response.meta.total) * 100).toFixed(1)
          : 'N/A';
        
        let estimatedTimeLeft = '';
        if (response.meta?.total && totalProcessed > 0) {
          const remainingContacts = response.meta.total - totalProcessed;
          const remainingMinutes = Math.round(remainingContacts / contactsPerMin);
          estimatedTimeLeft = ` | ETA: ~${remainingMinutes}min`;
        }
        
        console.log(`📄 ${totalProcessed.toLocaleString()} contatos (${contactsPerMin}/min) | ${totalSkipped} sem nome/email | ${percentage}% | pág ${page}${estimatedTimeLeft}`);
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
        reason_skipped: 'Contatos sem nome e email receberam nome padrão gerado',
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
