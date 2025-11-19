import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLINT_API_KEY = Deno.env.get('CLINT_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

interface SyncResult {
  resource: string;
  created: number;
  updated: number;
  errors: number;
  total: number;
}

// Função auxiliar para chamar API do Clint
async function callClintAPI(resource: string, params?: Record<string, string>) {
  const queryParams = new URLSearchParams(params || {});
  const url = `https://api.clintcrm.com.br/v1/${resource}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
  
  console.log(`🔍 Calling Clint API: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${CLINT_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`❌ Clint API Error (${response.status}):`, error);
    throw new Error(`Clint API error: ${response.status} - ${error}`);
  }

  const body = await response.json();
  
  // Log estrutura da resposta para debugging
  console.log('🔍 Response Structure:', {
    hasData: !!body.data,
    hasMeta: !!body.meta,
    dataLength: Array.isArray(body.data) ? body.data.length : 'not-array',
    metaKeys: body.meta ? Object.keys(body.meta) : [],
  });

  return body;
}

// Função de paginação robusta
async function fetchAllPaginated(resource: string, baseParams: Record<string, string> = {}) {
  const allRecords: any[] = [];
  const seenIds = new Set<string>();
  let page = 1;
  const maxPages = 500; // Limite de segurança
  let consecutiveEmptyPages = 0;
  let lastRecordCount = 0;

  console.log(`🔄 Iniciando paginação para ${resource}...`);

  while (page <= maxPages) {
    try {
      // Estratégia 1: Usar parâmetro 'page'
      const params = { ...baseParams, page: page.toString(), per_page: '200' };
      const response = await callClintAPI(resource, params);

      const records = response.data || [];
      console.log(`📄 Página ${page}: ${records.length} registros`);

      // Estratégia 2: Detectar página vazia
      if (records.length === 0) {
        consecutiveEmptyPages++;
        if (consecutiveEmptyPages >= 2) {
          console.log(`✅ Páginas vazias consecutivas detectadas. Finalizando paginação.`);
          break;
        }
      } else {
        consecutiveEmptyPages = 0;
      }

      // Estratégia 3: Detectar duplicatas
      let newRecords = 0;
      for (const record of records) {
        if (record.id && !seenIds.has(record.id)) {
          seenIds.add(record.id);
          allRecords.push(record);
          newRecords++;
        }
      }

      console.log(`📊 Novos registros únicos: ${newRecords} (total acumulado: ${allRecords.length})`);

      // Se não há novos registros únicos, pode ser duplicação
      if (newRecords === 0 && records.length > 0) {
        console.log(`⚠️ Nenhum registro novo na página ${page}. Possível duplicação detectada.`);
        break;
      }

      // Estratégia 4: Usar metadados se disponível
      if (response.meta) {
        const meta = response.meta;
        console.log('📊 Metadados da página:', meta);
        
        if (meta.total !== undefined) {
          console.log(`📈 Total de registros na API: ${meta.total}`);
          if (allRecords.length >= meta.total) {
            console.log(`✅ Todos os ${meta.total} registros foram coletados.`);
            break;
          }
        }

        if (meta.total_pages !== undefined && page >= meta.total_pages) {
          console.log(`✅ Última página (${page}/${meta.total_pages}) alcançada.`);
          break;
        }

        if (meta.page !== undefined && meta.per_page !== undefined) {
          const expectedMax = meta.page * meta.per_page;
          if (allRecords.length >= expectedMax && records.length < meta.per_page) {
            console.log(`✅ Última página parcial detectada.`);
            break;
          }
        }
      }

      // Se recebeu menos que o esperado e é consistente, provavelmente é a última página
      if (records.length < 200 && records.length === lastRecordCount) {
        console.log(`✅ Página parcial consistente detectada. Última página.`);
        break;
      }

      lastRecordCount = records.length;

      // Delay para evitar rate limiting
      if (page % 10 === 0) {
        console.log(`⏳ Aguardando 500ms após 10 páginas...`);
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      page++;

    } catch (error) {
      console.error(`❌ Erro na página ${page}:`, error);
      
      // Se for rate limit, aguardar mais tempo
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('429')) {
        console.log(`⏳ Rate limit detectado. Aguardando 5 segundos...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }
      
      throw error;
    }
  }

  if (page > maxPages) {
    console.warn(`⚠️ Limite de ${maxPages} páginas atingido. Pode haver mais registros.`);
  }

  console.log(`✅ Paginação concluída: ${allRecords.length} registros únicos coletados.`);
  return allRecords;
}

// Sincronizar Stages
async function syncStages(supabase: any): Promise<SyncResult> {
  console.log('🔄 Sincronizando stages...');
  
  try {
    const stages = await fetchAllPaginated('stages');
    
    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const stage of stages) {
      try {
        const { error } = await supabase
          .from('crm_stages')
          .upsert({
            clint_id: stage.id,
            stage_name: stage.name,
            stage_order: stage.order || 0,
            color: stage.color || null,
            is_active: stage.is_active !== false,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'clint_id',
          });

        if (error) {
          console.error(`❌ Erro ao inserir stage ${stage.id}:`, error);
          errors++;
        } else {
          // Verificar se foi criado ou atualizado
          const { data: existing } = await supabase
            .from('crm_stages')
            .select('id')
            .eq('clint_id', stage.id)
            .single();
          
          if (existing) {
            updated++;
          } else {
            created++;
          }
        }
      } catch (err) {
        console.error(`❌ Exceção ao processar stage ${stage.id}:`, err);
        errors++;
      }
    }

    console.log(`✅ Stages: ${created} criados, ${updated} atualizados, ${errors} erros`);
    return { resource: 'stages', created, updated, errors, total: stages.length };
  } catch (error) {
    console.error('❌ Erro ao sincronizar stages:', error);
    throw error;
  }
}

// Sincronizar Origins
async function syncOrigins(supabase: any): Promise<SyncResult> {
  console.log('🔄 Sincronizando origins...');
  
  try {
    const origins = await fetchAllPaginated('origins');
    
    let created = 0;
    let updated = 0;
    let errors = 0;

    // Primeira passagem: criar/atualizar sem parent_id
    for (const origin of origins) {
      try {
        const { error } = await supabase
          .from('crm_origins')
          .upsert({
            clint_id: origin.id,
            name: origin.name,
            description: origin.description || null,
            contact_count: origin.contact_count || 0,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'clint_id',
          });

        if (error) {
          console.error(`❌ Erro ao inserir origin ${origin.id}:`, error);
          errors++;
        } else {
          created++;
        }
      } catch (err) {
        console.error(`❌ Exceção ao processar origin ${origin.id}:`, err);
        errors++;
      }
    }

    // Segunda passagem: mapear parent_id hierárquico
    for (const origin of origins) {
      if (origin.parent_id) {
        try {
          // Buscar o UUID do parent no Supabase
          const { data: parentRecord } = await supabase
            .from('crm_origins')
            .select('id')
            .eq('clint_id', origin.parent_id)
            .single();

          if (parentRecord) {
            await supabase
              .from('crm_origins')
              .update({ parent_id: parentRecord.id })
              .eq('clint_id', origin.id);
          }
        } catch (err) {
          console.error(`❌ Erro ao mapear parent_id para origin ${origin.id}:`, err);
        }
      }
    }

    console.log(`✅ Origins: ${created} criados, ${updated} atualizados, ${errors} erros`);
    return { resource: 'origins', created, updated, errors, total: origins.length };
  } catch (error) {
    console.error('❌ Erro ao sincronizar origins:', error);
    throw error;
  }
}

// Sincronizar Contacts
async function syncContacts(supabase: any): Promise<SyncResult> {
  console.log('🔄 Sincronizando contacts...');
  
  try {
    const contacts = await fetchAllPaginated('contacts');
    
    let created = 0;
    let updated = 0;
    let errors = 0;
    let processed = 0;

    for (const contact of contacts) {
      try {
        // Mapear origin_id se existir
        let originUuid = null;
        if (contact.origin_id) {
          const { data: originRecord } = await supabase
            .from('crm_origins')
            .select('id')
            .eq('clint_id', contact.origin_id)
            .single();
          
          if (originRecord) {
            originUuid = originRecord.id;
          }
        }

        const { error } = await supabase
          .from('crm_contacts')
          .upsert({
            clint_id: contact.id,
            name: contact.name,
            email: contact.email || null,
            phone: contact.phone || null,
            organization_name: contact.organization?.name || null,
            origin_id: originUuid,
            tags: contact.tags || [],
            custom_fields: contact.custom_fields || {},
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'clint_id',
          });

        if (error) {
          console.error(`❌ Erro ao inserir contact ${contact.id}:`, error);
          errors++;
        } else {
          created++;
        }

        processed++;
        if (processed % 1000 === 0) {
          console.log(`📊 Progresso: ${processed}/${contacts.length} contatos processados`);
        }
      } catch (err) {
        console.error(`❌ Exceção ao processar contact ${contact.id}:`, err);
        errors++;
      }
    }

    console.log(`✅ Contacts: ${created} criados, ${updated} atualizados, ${errors} erros`);
    return { resource: 'contacts', created, updated, errors, total: contacts.length };
  } catch (error) {
    console.error('❌ Erro ao sincronizar contacts:', error);
    throw error;
  }
}

// Sincronizar Deals
async function syncDeals(supabase: any): Promise<SyncResult> {
  console.log('🔄 Sincronizando deals...');
  
  try {
    const deals = await fetchAllPaginated('deals');
    
    let created = 0;
    let updated = 0;
    let errors = 0;
    let processed = 0;

    for (const deal of deals) {
      try {
        // Mapear stage_id
        let stageUuid = null;
        if (deal.stage_id) {
          const { data: stageRecord } = await supabase
            .from('crm_stages')
            .select('id')
            .eq('clint_id', deal.stage_id)
            .single();
          
          if (stageRecord) {
            stageUuid = stageRecord.id;
          }
        }

        // Mapear contact_id
        let contactUuid = null;
        if (deal.contact_id) {
          const { data: contactRecord } = await supabase
            .from('crm_contacts')
            .select('id')
            .eq('clint_id', deal.contact_id)
            .single();
          
          if (contactRecord) {
            contactUuid = contactRecord.id;
          }
        }

        // Mapear origin_id
        let originUuid = null;
        if (deal.origin_id) {
          const { data: originRecord } = await supabase
            .from('crm_origins')
            .select('id')
            .eq('clint_id', deal.origin_id)
            .single();
          
          if (originRecord) {
            originUuid = originRecord.id;
          }
        }

        const { error } = await supabase
          .from('crm_deals')
          .upsert({
            clint_id: deal.id,
            name: deal.name,
            value: deal.value || 0,
            stage_id: stageUuid,
            contact_id: contactUuid,
            origin_id: originUuid,
            owner_id: deal.owner_id || null,
            probability: deal.probability || null,
            expected_close_date: deal.expected_close_date || null,
            tags: deal.tags || [],
            custom_fields: deal.custom_fields || {},
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'clint_id',
          });

        if (error) {
          console.error(`❌ Erro ao inserir deal ${deal.id}:`, error);
          errors++;
        } else {
          created++;
        }

        processed++;
        if (processed % 1000 === 0) {
          console.log(`📊 Progresso: ${processed}/${deals.length} deals processados`);
        }
      } catch (err) {
        console.error(`❌ Exceção ao processar deal ${deal.id}:`, err);
        errors++;
      }
    }

    console.log(`✅ Deals: ${created} criados, ${updated} atualizados, ${errors} erros`);
    return { resource: 'deals', created, updated, errors, total: deals.length };
  } catch (error) {
    console.error('❌ Erro ao sincronizar deals:', error);
    throw error;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Iniciando sincronização com Clint CRM...');

    if (!CLINT_API_KEY) {
      throw new Error('CLINT_API_KEY não configurada');
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const results: SyncResult[] = [];

    // Ordem de sincronização: stages → origins → contacts → deals
    results.push(await syncStages(supabase));
    results.push(await syncOrigins(supabase));
    results.push(await syncContacts(supabase));
    results.push(await syncDeals(supabase));

    const summary = {
      success: true,
      timestamp: new Date().toISOString(),
      results,
      total: {
        created: results.reduce((sum, r) => sum + r.created, 0),
        updated: results.reduce((sum, r) => sum + r.updated, 0),
        errors: results.reduce((sum, r) => sum + r.errors, 0),
        total: results.reduce((sum, r) => sum + r.total, 0),
      }
    };

    console.log('✅ Sincronização concluída:', summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('❌ Erro fatal na sincronização:', error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
