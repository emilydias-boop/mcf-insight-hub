import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLINT_API_KEY = Deno.env.get('CLINT_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

interface TestResult {
  method: 'DIRECT' | 'PROXY';
  resource: string;
  count?: number;
  time: number;
  error?: string;
}

// VERSÃO A: Chamada Direta à API Clint
async function callClintAPIDirect(resource: string, params?: Record<string, string>) {
  if (!CLINT_API_KEY) {
    throw new Error('CLINT_API_KEY não configurada');
  }
  
  const queryParams = new URLSearchParams(params || {});
  const url = `https://api.clint.digital/v1/${resource}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
  
  console.log(`🔵 [DIRECT] Calling: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'api-token': CLINT_API_KEY,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Direct API error: ${response.status} - ${error}`);
  }
  
  return await response.json();
}

// VERSÃO B: Via Proxy clint-api
async function callClintAPIProxy(resource: string, params?: Record<string, string>) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados');
  }
  
  const url = `${SUPABASE_URL}/functions/v1/clint-api`;
  
  console.log(`🟢 [PROXY] Calling clint-api for: ${resource}`);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      resource,
      method: 'GET',
      params,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Proxy API error: ${response.status} - ${error}`);
  }
  
  return await response.json();
}

// TESTE A1: Origins via DIRECT
async function testOriginsDirect(supabase: any): Promise<TestResult> {
  console.log('\n🧪 TEST A1: Sincronizando Origins via DIRECT');
  const startTime = Date.now();
  
  try {
    const response = await callClintAPIDirect('origins', { page: '1', per_page: '200' });
    const origins = response.data || [];
    
    console.log(`✅ [DIRECT] Origins: ${origins.length} registros`);
    
    // Inserir no Supabase
    let inserted = 0;
    for (const origin of origins) {
      const { error } = await supabase.from('crm_origins').upsert({
        clint_id: origin.id,
        name: origin.name,
        description: origin.description || null,
        parent_id: null, // Será mapeado em segundo passo
      }, { onConflict: 'clint_id' });
      
      if (!error) inserted++;
    }
    
    const time = Date.now() - startTime;
    console.log(`✅ [DIRECT] Origins inseridos: ${inserted}/${origins.length} em ${time}ms`);
    
    return { method: 'DIRECT', resource: 'origins', count: origins.length, time };
  } catch (error) {
    const time = Date.now() - startTime;
    console.error('❌ [DIRECT] Erro:', error);
    return { method: 'DIRECT', resource: 'origins', error: String(error), time };
  }
}

// TESTE A2: Origins via PROXY
async function testOriginsProxy(supabase: any): Promise<TestResult> {
  console.log('\n🧪 TEST A2: Sincronizando Origins via PROXY');
  const startTime = Date.now();
  
  try {
    const response = await callClintAPIProxy('origins', { page: '1', per_page: '200' });
    const origins = response.data || [];
    
    console.log(`✅ [PROXY] Origins: ${origins.length} registros`);
    
    // Inserir no Supabase
    let inserted = 0;
    for (const origin of origins) {
      const { error } = await supabase.from('crm_origins').upsert({
        clint_id: origin.id,
        name: origin.name,
        description: origin.description || null,
        parent_id: null,
      }, { onConflict: 'clint_id' });
      
      if (!error) inserted++;
    }
    
    const time = Date.now() - startTime;
    console.log(`✅ [PROXY] Origins inseridos: ${inserted}/${origins.length} em ${time}ms`);
    
    return { method: 'PROXY', resource: 'origins', count: origins.length, time };
  } catch (error) {
    const time = Date.now() - startTime;
    console.error('❌ [PROXY] Erro:', error);
    return { method: 'PROXY', resource: 'origins', error: String(error), time };
  }
}

// TESTE B1: Contacts (3 páginas) via DIRECT
async function testContactsDirect(supabase: any): Promise<TestResult> {
  console.log('\n🧪 TEST B1: Sincronizando Contacts (3 páginas) via DIRECT');
  const startTime = Date.now();
  let totalContacts = 0;
  
  try {
    for (let page = 1; page <= 3; page++) {
      const response = await callClintAPIDirect('contacts', { 
        page: page.toString(), 
        per_page: '200' 
      });
      const contacts = response.data || [];
      
      console.log(`📄 [DIRECT] Página ${page}: ${contacts.length} contatos`);
      
      if (contacts.length === 0) break;
      
      totalContacts += contacts.length;
      
      // Inserir batch no Supabase (100 registros por vez)
      for (let i = 0; i < contacts.length; i += 100) {
        const batch = contacts.slice(i, i + 100);
        
        for (const contact of batch) {
          await supabase.from('crm_contacts').upsert({
            clint_id: contact.id,
            name: contact.name,
            email: contact.email || null,
            phone: contact.phone || null,
            organization_name: contact.organization?.name || null,
            tags: contact.tags || [],
          }, { onConflict: 'clint_id' });
        }
      }
    }
    
    const time = Date.now() - startTime;
    console.log(`✅ [DIRECT] Total de contatos: ${totalContacts} em ${time}ms`);
    
    return { method: 'DIRECT', resource: 'contacts', count: totalContacts, time };
  } catch (error) {
    const time = Date.now() - startTime;
    console.error('❌ [DIRECT] Erro:', error);
    return { method: 'DIRECT', resource: 'contacts', error: String(error), time };
  }
}

// TESTE B2: Contacts (3 páginas) via PROXY
async function testContactsProxy(supabase: any): Promise<TestResult> {
  console.log('\n🧪 TEST B2: Sincronizando Contacts (3 páginas) via PROXY');
  const startTime = Date.now();
  let totalContacts = 0;
  
  try {
    for (let page = 1; page <= 3; page++) {
      const response = await callClintAPIProxy('contacts', { 
        page: page.toString(), 
        per_page: '200' 
      });
      const contacts = response.data || [];
      
      console.log(`📄 [PROXY] Página ${page}: ${contacts.length} contatos`);
      
      if (contacts.length === 0) break;
      
      totalContacts += contacts.length;
      
      // Inserir batch no Supabase (100 registros por vez)
      for (let i = 0; i < contacts.length; i += 100) {
        const batch = contacts.slice(i, i + 100);
        
        for (const contact of batch) {
          await supabase.from('crm_contacts').upsert({
            clint_id: contact.id,
            name: contact.name,
            email: contact.email || null,
            phone: contact.phone || null,
            organization_name: contact.organization?.name || null,
            tags: contact.tags || [],
          }, { onConflict: 'clint_id' });
        }
      }
    }
    
    const time = Date.now() - startTime;
    console.log(`✅ [PROXY] Total de contatos: ${totalContacts} em ${time}ms`);
    
    return { method: 'PROXY', resource: 'contacts', count: totalContacts, time };
  } catch (error) {
    const time = Date.now() - startTime;
    console.error('❌ [PROXY] Erro:', error);
    return { method: 'PROXY', resource: 'contacts', error: String(error), time };
  }
}

// Função para analisar resultados
function analyzeResults(results: TestResult[]) {
  const directResults = results.filter(r => r.method === 'DIRECT');
  const proxyResults = results.filter(r => r.method === 'PROXY');
  
  const directSuccess = directResults.filter(r => !r.error).length;
  const proxySuccess = proxyResults.filter(r => !r.error).length;
  
  const directAvgTime = directResults.reduce((sum, r) => sum + r.time, 0) / directResults.length;
  const proxyAvgTime = proxyResults.reduce((sum, r) => sum + r.time, 0) / proxyResults.length;
  
  let recommendation = '';
  let winner = '';
  
  if (directSuccess > proxySuccess) {
    recommendation = 'DIRECT: Mais confiável (menos erros)';
    winner = 'DIRECT';
  } else if (proxySuccess > directSuccess) {
    recommendation = 'PROXY: Mais confiável (menos erros)';
    winner = 'PROXY';
  } else if (directAvgTime < proxyAvgTime) {
    recommendation = 'DIRECT: Mais rápido (ambas confiáveis)';
    winner = 'DIRECT';
  } else {
    recommendation = 'PROXY: Melhor para manutenção (código centralizado)';
    winner = 'PROXY';
  }
  
  return {
    directSuccess: `${directSuccess}/${directResults.length}`,
    proxySuccess: `${proxySuccess}/${proxyResults.length}`,
    directAvgTime: `${directAvgTime.toFixed(0)}ms`,
    proxyAvgTime: `${proxyAvgTime.toFixed(0)}ms`,
    recommendation,
    winner,
  };
}

// Handler principal
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🧪 INICIANDO TESTES COMPARATIVOS: DIRECT vs PROXY');
    console.log('📌 Recursos testados: origins (1 página) + contacts (3 páginas)');
    console.log('⏱️  Estimativa: 30-60 segundos\n');
    
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    const results: TestResult[] = [];
    
    // Teste A: Origins (poucos registros)
    console.log('═══════════════════════════════════════');
    console.log('🔬 TESTE A: ORIGINS (Poucos Registros)');
    console.log('═══════════════════════════════════════');
    
    results.push(await testOriginsDirect(supabase));
    await new Promise(r => setTimeout(r, 1000)); // Aguardar 1s entre testes
    results.push(await testOriginsProxy(supabase));
    
    // Teste B: Contacts (muitos registros - 3 páginas)
    console.log('\n═══════════════════════════════════════');
    console.log('🔬 TESTE B: CONTACTS (3 Páginas)');
    console.log('═══════════════════════════════════════');
    
    await new Promise(r => setTimeout(r, 2000)); // Aguardar 2s
    results.push(await testContactsDirect(supabase));
    await new Promise(r => setTimeout(r, 2000));
    results.push(await testContactsProxy(supabase));
    
    // Análise dos resultados
    console.log('\n═══════════════════════════════════════');
    console.log('📊 RESULTADOS COMPARATIVOS');
    console.log('═══════════════════════════════════════');
    console.log(JSON.stringify(results, null, 2));
    
    const analysis = analyzeResults(results);
    
    console.log('\n═══════════════════════════════════════');
    console.log('🏆 ANÁLISE FINAL');
    console.log('═══════════════════════════════════════');
    console.log(`✅ Sucessos DIRECT: ${analysis.directSuccess}`);
    console.log(`✅ Sucessos PROXY: ${analysis.proxySuccess}`);
    console.log(`⚡ Tempo médio DIRECT: ${analysis.directAvgTime}`);
    console.log(`⚡ Tempo médio PROXY: ${analysis.proxyAvgTime}`);
    console.log(`\n🏆 RECOMENDAÇÃO: ${analysis.recommendation}`);
    
    const summary = {
      success: true,
      timestamp: new Date().toISOString(),
      tests: results,
      analysis,
      nextSteps: [
        `Implementar a abordagem vencedora: ${analysis.winner}`,
        'Remover código da abordagem não escolhida',
        'Expandir para sincronização completa: origins → contacts → deals',
        'Preparar Edge Function import-csv-data para quando CSV estiver pronto',
      ],
    };
    
    return new Response(JSON.stringify(summary, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('❌ Erro fatal nos testes:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
