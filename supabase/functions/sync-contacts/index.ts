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
    const MAX_PAGES = 1000;

    while (page <= MAX_PAGES) {
      const response = await callClintAPI('contacts', {
        page: page.toString(),
        per_page: '200',
      });

      const contacts = response.data || [];
      if (contacts.length === 0) break;

      // Processar em batch de 100
      for (let i = 0; i < contacts.length; i += 100) {
        const batch = contacts.slice(i, i + 100);

        for (const contact of batch) {
          // Note: origin_id será preenchido posteriormente via sync-link-contacts
          // A API Clint não retorna origin_id diretamente nos contatos
          await supabase.from('crm_contacts').upsert(
            {
              clint_id: contact.id,
              name: contact.name,
              email: contact.email || null,
              phone: contact.phone || null,
              organization_name: contact.organization?.name || null,
              origin_id: null, // Será preenchido depois via deals
              tags: contact.tags || [],
              custom_fields: contact.custom_fields || {},
            },
            { onConflict: 'clint_id' }
          );
        }
      }

      totalProcessed += contacts.length;
      console.log(`📄 Contatos processados: ${totalProcessed} (página ${page})`);

      await new Promise((r) => setTimeout(r, 100)); // Reduzido para 100ms
      page++;

      if (contacts.length < 200) break;
    }

    const duration = Date.now() - startTime;

    const summary = {
      success: true,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      results: {
        contacts_synced: totalProcessed,
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
