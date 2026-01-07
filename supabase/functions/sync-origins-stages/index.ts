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

function getColorFromType(type: string): string {
  const colorMap: Record<string, string> = {
    'BASE': '#3b82f6',
    'CUSTOM': '#8b5cf6',
    'CLOSING': '#10b981',
    'LOST': '#ef4444',
  };
  return colorMap[type] || '#6b7280';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Sincronizando Origins e Stages do Clint CRM');
    const startTime = Date.now();

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    let page = 1;
    let totalOrigins = 0;
    let totalStages = 0;
    let totalGroups = 0;
    const MAX_PAGES = 1000;
    
    const groupIdMap = new Map<string, string>();
    const originIdMap = new Map<string, string>();
    const originsWithParent: any[] = [];
    const orphanedOrigins: any[] = []; // Origins sem grupo mas que deveriam ter

    // PRIMEIRA PASSADA: Salvar groups e origins (sem parent_id ainda)
    while (page <= MAX_PAGES) {
      const response = await callClintAPI('origins', { 
        page: page.toString(), 
        per_page: '200' 
      });
      const origins = response.data || [];

      if (origins.length === 0) break;

      for (const origin of origins) {
        // 1. Processar GROUP
        let groupDbId = null;
        if (origin.group && origin.group.id) {
          const groupClintId = origin.group.id;
          
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
        } else {
          // ⚠️ Origem sem grupo - registrar para análise
          console.warn(`⚠️ Origem "${origin.name}" (${origin.id}) veio sem grupo da API Clint`);
          orphanedOrigins.push({
            name: origin.name,
            clint_id: origin.id,
          });
        }
        
        // 2. Salvar ORIGIN (sem parent_id por enquanto)
        const { data: savedOrigin, error: originError } = await supabase
          .from('crm_origins')
          .upsert(
            {
              clint_id: origin.id,
              name: origin.name,
              description: origin.description || null,
              group_id: groupDbId,
              contact_count: 0,
              parent_id: null, // Será atualizado na segunda passada
            },
            { onConflict: 'clint_id' }
          )
          .select()
          .single();

        if (originError) {
          console.error(`❌ Erro ao salvar origin ${origin.name}:`, originError);
          continue;
        }
        
        // Mapear clint_id -> supabase_id
        originIdMap.set(origin.id, savedOrigin.id);
        totalOrigins++;

        // Se tem parent, guardar para segunda passada
        if (origin.parent_id || origin.parent || origin.parent_origin_id) {
          const parentClintId = origin.parent_id || origin.parent?.id || origin.parent_origin_id;
          originsWithParent.push({
            clint_id: origin.id,
            supabase_id: savedOrigin.id,
            parent_clint_id: parentClintId,
          });
        }

        // 3. Salvar STAGES
        if (origin.stages && Array.isArray(origin.stages) && origin.stages.length > 0) {
          const stagesToUpsert = origin.stages.map((stage: any, index: number) => {
            const stageName = stage.label || stage.name || `${origin.name} - ${stage.type} #${stage.order}`;

            return {
              clint_id: stage.id,
              stage_name: stageName,
              stage_order: stage.order !== undefined ? stage.order : index,
              color: getColorFromType(stage.type),
              is_active: true,
              origin_id: savedOrigin.id,
            };
          });

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

      console.log(`📄 Página ${page}: Groups: ${totalGroups} | Origins: ${totalOrigins} | Stages: ${totalStages}`);
      page++;

      if (!response.meta || page > response.meta.total / 200) {
        break;
      }
    }

    // SEGUNDA PASSADA: Atualizar parent_id das origins filhas
    console.log(`🔗 Atualizando hierarquia de ${originsWithParent.length} origins filhas...`);
    let linkedOrigins = 0;
    
    for (const childOrigin of originsWithParent) {
      const parentSupabaseId = originIdMap.get(childOrigin.parent_clint_id);
      
      if (parentSupabaseId) {
        const { error: updateError } = await supabase
          .from('crm_origins')
          .update({ parent_id: parentSupabaseId })
          .eq('id', childOrigin.supabase_id);

        if (updateError) {
          console.error(`❌ Erro ao atualizar parent_id para origin ${childOrigin.clint_id}:`, updateError);
        } else {
          linkedOrigins++;
        }
      } else {
        console.warn(`⚠️ Parent origin ${childOrigin.parent_clint_id} não encontrado para origin ${childOrigin.clint_id}`);
      }
    }
    
    console.log(`✅ ${linkedOrigins} origins vinculadas às suas origins pai`);
    
    // Reportar origens órfãs
    if (orphanedOrigins.length > 0) {
      console.warn(`\n⚠️ ATENÇÃO: ${orphanedOrigins.length} origins sem grupo detectadas:`);
      orphanedOrigins.forEach(o => console.warn(`  - ${o.name} (${o.clint_id})`));
      console.warn('Verifique no Clint CRM se essas origins estão corretamente associadas a grupos.\n');
    }
    
    const duration = Date.now() - startTime;

    const summary = {
      success: true,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      results: {
        groups_synced: totalGroups,
        origins_synced: totalOrigins,
        origins_with_parent: linkedOrigins,
        stages_synced: totalStages,
        orphaned_origins: orphanedOrigins.length,
      },
      warnings: orphanedOrigins.length > 0 ? orphanedOrigins : undefined,
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
