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

// Função auxiliar para determinar cor baseada no tipo de stage
function getColorFromType(type: string): string {
  const colorMap: Record<string, string> = {
    'BASE': '#3b82f6',      // Azul
    'CUSTOM': '#8b5cf6',    // Roxo
    'CLOSING': '#10b981',   // Verde
    'LOST': '#ef4444',      // Vermelho
  };
  return colorMap[type] || '#6b7280'; // Cinza como padrão
}

async function syncOrigins(supabase: any): Promise<{ origins: number; stages: number; groups: number }> {
  console.log('🔄 Sincronizando Groups e Origins...');
  const startTime = Date.now();
  let page = 1;
  let totalOrigins = 0;
  let totalStages = 0;
  let totalGroups = 0;
  const MAX_PAGES = 1000;
  
  // Mapas para relacionamentos
  const groupIdMap = new Map<string, string>(); // clint_id → db UUID
  const originIdMap = new Map<string, string>();

  try {
    // ========== PASS 1: Sincronizar Groups e Origins ==========
    console.log('📥 Pass 1: Sincronizando dados...');
    
    while (page <= MAX_PAGES) {
      const response = await callClintAPI('origins', { 
        page: page.toString(), 
        per_page: '200' 
      });
      const origins = response.data || [];

      if (origins.length === 0) break;

      for (const origin of origins) {
        // LOG PARA PRIMEIRA ORIGIN (DEBUG)
        if (totalOrigins === 0) {
          console.log('🔍 DEBUG - Primeira Origin:', JSON.stringify(origin, null, 2));
        }
        
        // 1. Processar GROUP (se existir)
        let groupDbId = null;
        if (origin.group && origin.group.id) {
          const groupClintId = origin.group.id;
          
          // Verificar se já processamos este group
          if (!groupIdMap.has(groupClintId)) {
            const { data: savedGroup, error: groupError } = await supabase
              .from('crm_groups')
              .upsert(
                {
                  clint_id: groupClintId,
                  name: origin.group.name,
                  description: null,
                },
                { onConflict: 'clint_id' }
              )
              .select()
              .single();

            if (groupError) {
              console.error(`❌ Erro ao salvar group ${origin.group.name}:`, groupError);
            } else {
              groupIdMap.set(groupClintId, savedGroup.id);
              groupDbId = savedGroup.id;
              totalGroups++;
            }
          } else {
            groupDbId = groupIdMap.get(groupClintId);
          }
        }
        
        // 2. Salvar ORIGIN com group_id
        const { data: savedOrigin, error: originError } = await supabase
          .from('crm_origins')
          .upsert(
            {
              clint_id: origin.id,
              name: origin.name,
              description: origin.description || null,
              parent_id: null, // Temporariamente null, será atualizado no Pass 2
              contact_count: 0,
            },
            { onConflict: 'clint_id' }
          )
          .select()
          .single();

        if (originError) {
          console.error(`❌ Erro ao salvar origin ${origin.name}:`, originError);
          continue;
        }
        
        // Armazenar mapeamento clint_id → database UUID
        originIdMap.set(origin.id, savedOrigin.id);
        totalOrigins++;

        // 2. Salvar os stages desta origin - BATCH UPSERT
        if (origin.stages && Array.isArray(origin.stages) && origin.stages.length > 0) {
          const stagesToUpsert = origin.stages.map((stage: any) => ({
            clint_id: stage.id,
            stage_name: stage.name,
            stage_order: stage.order || 0,
            color: getColorFromType(stage.type),
            is_active: true,
            origin_id: savedOrigin.id,
          }));

          const { error: stagesError } = await supabase
            .from('crm_stages')
            .upsert(stagesToUpsert, { onConflict: 'clint_id' });

          if (stagesError) {
            console.error(`❌ Erro ao salvar stages para ${origin.name}:`, stagesError);
          } else {
            totalStages += stagesToUpsert.length;
          }
        }
      }

      console.log(`📄 Página ${page} processada: Groups: ${totalGroups} | Origins: ${totalOrigins} | Stages: ${totalStages}`);
      page++;

      if (!response.meta || page > response.meta.total / 200) {
        break;
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(`✅ Sincronização completa em ${duration}ms:`);
    console.log(`   - Groups: ${totalGroups}`);
    console.log(`   - Origins: ${totalOrigins}`);
    console.log(`   - Stages: ${totalStages}`);
    
    return { origins: totalOrigins, stages: totalStages, groups: totalGroups };
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

      if (contacts.length < 200) break;
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
          // Buscar contact_id
          let contactId = null;
          if (deal.contact_id) {
            const { data: contact } = await supabase
              .from('crm_contacts')
              .select('id')
              .eq('clint_id', deal.contact_id)
              .maybeSingle();
            contactId = contact?.id || null;
          }

          // Buscar stage_id E origin_id
          let stageId = null;
          let originId = null;
          
          if (deal.stage_id) {
            const { data: stage } = await supabase
              .from('crm_stages')
              .select('id, origin_id')
              .eq('clint_id', deal.stage_id)
              .maybeSingle();
            
            if (stage) {
              stageId = stage.id;
              originId = stage.origin_id;
            } else {
              console.warn(`⚠️ Deal "${deal.name}" → Stage ${deal.stage_id} não encontrado`);
            }
          }

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
      stages: 0,
      contacts: 0,
      deals: 0,
      errors: [] as string[],
    };

    // Sincronizar na ordem: Origins+Stages → Contacts → Deals
    try {
      const originResult = await syncOrigins(supabase);
      results.origins = originResult.origins;
      results.stages = originResult.stages;
    } catch (error) {
      results.errors.push(`Origins: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }

    // 🚧 TEMPORARIAMENTE DESABILITADO: Sync de Contacts causa CPU timeout
    // Contacts serão sincronizados em edge function separada no futuro
    // try {
    //   results.contacts = await syncContacts(supabase);
    // } catch (error) {
    //   results.errors.push(`Contacts: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    // }
    console.log('⏭️ Pulando sincronização de Contacts (desabilitada temporariamente)');

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
        stages_synced: results.stages,
        contacts_synced: results.contacts,
        deals_synced: results.deals,
        total_synced: results.origins + results.stages + results.contacts + results.deals,
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
