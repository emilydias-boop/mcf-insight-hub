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

    let page = 1;
    let totalProcessed = 0;
    let totalSkipped = 0;
    const MAX_PAGES = 1000;
    const CONTACTS_PER_PAGE = 200;
    const BATCH_SIZE = 500; // Bulk upsert de 500 contatos por vez

    while (page <= MAX_PAGES) {
      const response = await callClintAPI('contacts', {
        page: page.toString(),
        per_page: CONTACTS_PER_PAGE.toString(),
      });

      const contacts = response.data || [];
      if (contacts.length === 0) break;

      // Processar em batches maiores com bulk upsert
      for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
        const batch = contacts.slice(i, i + BATCH_SIZE);

        // Preparar todos os contatos do batch para bulk upsert
        // IMPORTANTE: Filtrar contatos sem nome (violaria constraint NOT NULL)
        const contactsToUpsert = batch
          .filter((contact: any) => {
            if (!contact.name || contact.name.trim() === '') {
              totalSkipped++;
              console.log(`⚠️ Contato sem nome descartado - ID: ${contact.id}`);
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
        
        console.log(`📄 Processados: ${totalProcessed} contatos válidos | ${totalSkipped} sem nome (${percentage}% - página ${page}, batch ${Math.floor(i / BATCH_SIZE) + 1})`);
      }

      await new Promise((r) => setTimeout(r, 50)); // Rate limiting reduzido
      page++;

      if (contacts.length < CONTACTS_PER_PAGE) break;
    }

    const duration = Date.now() - startTime;

    const summary = {
      success: true,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      results: {
        contacts_synced: totalProcessed,
        contacts_skipped: totalSkipped,
        reason_skipped: 'Contatos sem nome (violaria constraint NOT NULL)',
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
