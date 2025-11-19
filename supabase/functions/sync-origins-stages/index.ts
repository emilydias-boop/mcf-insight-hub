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
        }
        
        // 2. Salvar ORIGIN
        const { data: savedOrigin, error: originError } = await supabase
          .from('crm_origins')
          .upsert(
            {
              clint_id: origin.id,
              name: origin.name,
              description: origin.description || null,
              group_id: groupDbId,
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
        
        totalOrigins++;

        // 3. Salvar STAGES
        if (origin.stages && Array.isArray(origin.stages) && origin.stages.length > 0) {
          const stagesToUpsert = origin.stages.map((stage: any, index: number) => {
            // Usar stage.label como fonte principal do nome
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
    
    const duration = Date.now() - startTime;

    const summary = {
      success: true,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      results: {
        groups_synced: totalGroups,
        origins_synced: totalOrigins,
        stages_synced: totalStages,
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
