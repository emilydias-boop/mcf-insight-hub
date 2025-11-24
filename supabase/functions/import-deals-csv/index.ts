// Version: 2025-11-24T21:00:00Z - Optimized with bulk check + smart UPSERT
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

// @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
declare const EdgeRuntime: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CRMDeal {
  id: string;
  clint_id: string;
  name: string;
  value: number | null;
  stage_id: string | null;
  contact_id: string | null;
  origin_id: string | null;
  owner_id: string | null;
  tags: string[] | null;
  custom_fields: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface CSVDeal {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  complete_phone?: string;
  stage?: string;
  origin?: string;
  value?: string;
  user_email?: string;
  tags?: string;
  [key: string]: any; // Para campos custom
}

interface ImportStats {
  total: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: number;
  duration_seconds: number;
  errorDetails: Array<{ line: number; clint_id: string; error: string }>;
}

const PIPELINE_INSIDE_SALES_ORIGIN_ID = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c';

// Parser CSV robusto que lida com aspas duplas e valores com vírgulas
function parseCSV(csvText: string): CSVDeal[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    console.log('❌ CSV vazio ou com apenas header');
    return [];
  }

  // Detecta o delimitador (vírgula ou ponto-e-vírgula)
  const firstLine = lines[0];
  const delimiter = firstLine.includes(',') ? ',' : ';';
  console.log(`🔍 Delimitador detectado: "${delimiter}"`);

  // Parse da primeira linha (headers) respeitando aspas
  const headers = parseLine(firstLine, delimiter).map(h => h.trim().toLowerCase());
  console.log(`📋 Headers detectados (${headers.length}):`, headers.slice(0, 5), headers.length > 5 ? '...' : '');
  
  // Mapeamento flexível de colunas principais
  const idColumnIndex = headers.findIndex(h => h.match(/^(id|clint_id|deal_id)$/i));
  const nameColumnIndex = headers.findIndex(h => h.match(/^(name|nome|deal_name|title|titulo)$/i));
  
  if (idColumnIndex === -1) {
    console.warn('⚠️ Coluna de ID não encontrada. Headers disponíveis:', headers);
  }
  if (nameColumnIndex === -1) {
    console.warn('⚠️ Coluna de nome não encontrada. Headers disponíveis:', headers);
  }
  
  const deals: CSVDeal[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseLine(line, delimiter);
    
    // Validar estrutura da linha
    if (values.length !== headers.length) {
      console.warn(`⚠️ Linha ${i + 1} tem ${values.length} colunas, esperado ${headers.length}. Pulando.`);
      continue;
    }
    
    const deal: CSVDeal = { id: '', name: '' };
    
    headers.forEach((header, index) => {
      const value = values[index]?.trim() || '';
      deal[header] = value;
    });
    
    // Mapear colunas flexíveis para campos padrão
    if (idColumnIndex !== -1 && !deal.id) {
      deal.id = values[idColumnIndex]?.trim() || '';
    }
    if (nameColumnIndex !== -1 && !deal.name) {
      deal.name = values[nameColumnIndex]?.trim() || '';
    }
    
    deals.push(deal);
  }
  
  // Log de exemplo
  if (deals.length > 0) {
    const firstDeal = deals[0];
    const sampleFields = Object.keys(firstDeal).slice(0, 3).reduce((acc, key) => {
      acc[key] = firstDeal[key];
      return acc;
    }, {} as Record<string, any>);
    console.log('📊 Primeira linha de exemplo (3 primeiros campos):', sampleFields);
  }
  
  console.log(`✅ Total de deals parseados: ${deals.length}`);
  
  return deals;
}

// Campos custom prioritários (top 30)
const PRIORITY_CUSTOM_FIELDS = [
  'estado', 'profissao', 'renda_media', 'faixa_de_renda', 'perfil',
  'tags', 'notes', 'utm_source', 'utm_campaign', 'utm_medium', 'utm_content',
  'data_agendamento', 'data_reuniao_01', 'resumo', 'closer', 'atendente',
  'motivacao', 'solucao_que_busca', 'feedback_da_reuniao', 'telefone',
  'faixa_etaria', 'valor_imovel', 'tipo_do_imovel', 'contexto',
  'historico', 'capacidade_de_invest', 'fonte_de_renda', 'endereco',
  'user_email', 'user_name'
];

// ❌ REMOVIDA: função individual substituída por bulk check na função processDeals

// Função auxiliar para parsear uma linha CSV respeitando aspas duplas
function parseLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Aspas duplas escapadas ""
        current += '"';
        i++; // Pular próximo char
      } else {
        // Início ou fim de aspas
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      // Delimitador fora de aspas - fim do valor
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Adicionar último valor
  values.push(current.trim());
  
  return values.map(v => {
    // Remover aspas duplas no início e fim
    if (v.startsWith('"') && v.endsWith('"')) {
      return v.slice(1, -1);
    }
    return v;
  });
}

// Normalizar telefone
function normalizePhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  return phone.replace(/\D/g, '');
}

// Validar email
function isValidEmail(email?: string): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Converter deal CSV para formato do banco
function convertToDBFormat(
  csvDeal: CSVDeal,
  contactsCache: Map<string, string>,
  stagesCache: Map<string, string>
): Partial<CRMDeal> | null {
  // Validação melhorada com mensagens específicas
  if (!csvDeal.id || csvDeal.id.trim() === '') {
    console.warn('⚠️ Deal sem ID. Campos disponíveis:', Object.keys(csvDeal));
    return null;
  }
  
  // 🔧 FIX: Usar email como fallback se nome estiver vazio
  let dealName = csvDeal.name?.trim() || '';
  if (!dealName && csvDeal.email) {
    dealName = csvDeal.email;
    console.info(`ℹ️ Deal ${csvDeal.id} usando email como nome: ${dealName}`);
  }
  if (!dealName) {
    console.warn(`⚠️ Deal ${csvDeal.id} sem nome nem email. Pulando...`);
    return null;
  }

  // Buscar contact_id
  let contactId: string | null = null;
  if (csvDeal.email && isValidEmail(csvDeal.email)) {
    contactId = contactsCache.get(csvDeal.email.toLowerCase()) || null;
  }
  if (!contactId && (csvDeal.phone || csvDeal.complete_phone)) {
    const phone = normalizePhone(csvDeal.phone || csvDeal.complete_phone);
    if (phone) {
      contactId = contactsCache.get(phone) || null;
    }
  }

  // Buscar stage_id
  let stageId: string | null = null;
  if (csvDeal.stage) {
    stageId = stagesCache.get(csvDeal.stage.toLowerCase()) || null;
  }

  // Valor
  const value = csvDeal.value ? parseFloat(csvDeal.value.replace(/[^\d.,-]/g, '').replace(',', '.')) : null;

  // Tags
  let tags: string[] | null = null;
  if (csvDeal.tags) {
    tags = csvDeal.tags.split(',').map(t => t.trim()).filter(Boolean);
  }

  // Custom fields - apenas os 30 mais importantes
  const standardFields = ['id', 'name', 'email', 'phone', 'complete_phone', 'stage', 'origin', 'value', 'user_email', 'tags', 'created_at', 'updated_at'];
  const customFields: Record<string, any> = {};
  
  Object.keys(csvDeal).forEach(key => {
    if (!standardFields.includes(key) && csvDeal[key] && PRIORITY_CUSTOM_FIELDS.includes(key)) {
      customFields[key] = csvDeal[key];
    }
  });

  return {
    clint_id: csvDeal.id,
    name: dealName, // 🔧 FIX: Usar variável com fallback
    value: value,
    stage_id: stageId,
    contact_id: contactId,
    origin_id: PIPELINE_INSIDE_SALES_ORIGIN_ID,
    owner_id: csvDeal.user_email || null,
    tags: tags,
    custom_fields: Object.keys(customFields).length > 0 ? customFields : {},
  };
}

// Carregar todos os contacts em cache
async function loadContactsCache(supabase: any): Promise<Map<string, string>> {
  const cache = new Map<string, string>();
  
  const { data: contacts, error } = await supabase
    .from('crm_contacts')
    .select('id, email, phone');
  
  if (error) {
    console.error('Erro ao carregar contacts:', error);
    return cache;
  }

  contacts?.forEach((contact: any) => {
    if (contact.email) {
      cache.set(contact.email.toLowerCase(), contact.id);
    }
    if (contact.phone) {
      const normalized = normalizePhone(contact.phone);
      if (normalized) {
        cache.set(normalized, contact.id);
      }
    }
  });

  console.log(`✅ Cache de contacts carregado: ${cache.size} entradas`);
  return cache;
}

// Carregar stages da origin em cache
async function loadStagesCache(supabase: any): Promise<Map<string, string>> {
  const cache = new Map<string, string>();
  
  const { data: stages, error } = await supabase
    .from('crm_stages')
    .select('id, stage_name')
    .eq('origin_id', PIPELINE_INSIDE_SALES_ORIGIN_ID);
  
  if (error) {
    console.error('Erro ao carregar stages:', error);
    return cache;
  }

  stages?.forEach((stage: any) => {
    cache.set(stage.stage_name.toLowerCase(), stage.id);
  });

  console.log(`✅ Cache de stages carregado: ${cache.size} estágios`);
  return cache;
}

// Processar deals em batches com atualização de progresso
async function processDeals(
  supabase: any,
  csvDeals: CSVDeal[],
  contactsCache: Map<string, string>,
  stagesCache: Map<string, string>,
  jobId?: string
): Promise<ImportStats> {
  const stats: ImportStats = {
    total: csvDeals.length,
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    duration_seconds: 0,
    errorDetails: [],
  };

  const BATCH_SIZE = 20; // Otimizado para 20 deals por batch
  const startTime = Date.now();

  // Pré-carregar todos os clint_ids existentes para verificação em batch
  const allClintIds = csvDeals.map(d => d.id).filter(Boolean);
  const { data: existingDeals } = await supabase
    .from('crm_deals')
    .select('clint_id, updated_at')
    .in('clint_id', allClintIds);
  
  const existingDealsMap = new Map<string, string>();
  existingDeals?.forEach((deal: any) => {
    existingDealsMap.set(deal.clint_id, deal.updated_at);
  });
  
  console.log(`📊 Verificação de existência: ${existingDealsMap.size} deals já existem no banco`);

  for (let i = 0; i < csvDeals.length; i += BATCH_SIZE) {
    const batch = csvDeals.slice(i, i + BATCH_SIZE);
    const dealsToInsert: any[] = [];

    for (let index = 0; index < batch.length; index++) {
      const csvDeal = batch[index];
      const lineNumber = i + index + 2; // +2 porque linha 1 é header e array começa em 0
      
      const dealData = convertToDBFormat(csvDeal, contactsCache, stagesCache);
      
      if (!dealData) {
        stats.errors++;
        const missingFields = [];
        if (!csvDeal.id) missingFields.push('id');
        if (!csvDeal.name) missingFields.push('name');
        
        stats.errorDetails.push({
          line: lineNumber,
          clint_id: csvDeal.id || 'unknown',
          error: `Campos faltando: ${missingFields.join(', ')}. Headers disponíveis: ${Object.keys(csvDeal).slice(0, 5).join(', ')}...`,
        });
        continue;
      }

      // Verificação inteligente: só importar se for novo ou mais recente
      const existingUpdatedAt = existingDealsMap.get(csvDeal.id);
      
      if (existingUpdatedAt) {
        // Deal já existe, verificar timestamp
        const csvUpdatedAt = csvDeal.updated_at || csvDeal.updated_stage_at;
        
        if (!csvUpdatedAt) {
          // CSV não tem timestamp, proteger dados existentes (do webhook)
          stats.skipped++;
          continue;
        }
        
        try {
          const csvDate = new Date(csvUpdatedAt);
          const dbDate = new Date(existingUpdatedAt);
          
          if (csvDate <= dbDate) {
            // CSV é mais antigo ou igual, não sobrescrever
            stats.skipped++;
            continue;
          }
        } catch {
          // Erro ao parsear data, proteger dados existentes
          stats.skipped++;
          continue;
        }
      }

      dealsToInsert.push(dealData);
    }

    if (dealsToInsert.length > 0) {
      // 🚀 OTIMIZAÇÃO: Preparar deals com updated_at do CSV para comparação no UPSERT
      const dealsWithTimestamp = dealsToInsert.map(deal => {
        const csvDeal = batch.find(d => d.id === deal.clint_id);
        const csvUpdatedAt = csvDeal?.updated_at || csvDeal?.updated_stage_at;
        
        return {
          ...deal,
          updated_at: csvUpdatedAt || new Date().toISOString(),
        };
      });
      
      // 🔧 FIX: Try-catch individual para cada batch com logs detalhados
      try {
        // Usar RPC function para UPSERT inteligente (só atualiza se CSV for mais recente)
        const { data, error } = await supabase.rpc('upsert_deals_smart', {
          deals_data: dealsWithTimestamp
        });

        if (error) {
          console.error(`❌ Erro no batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error);
          stats.errors += dealsToInsert.length;
          
          // 🔍 Logar TODOS os deals do batch com erro para debug
          console.error('Deals do batch com erro:', dealsWithTimestamp.map((d: any) => ({
            id: d.clint_id,
            name: d.name,
            tags: d.tags,
            tags_type: Array.isArray(d.tags) ? 'array' : typeof d.tags
          })));
          
          dealsToInsert.forEach((deal, idx) => {
            stats.errorDetails.push({
              line: i + idx + 2,
              clint_id: deal.clint_id,
              error: error.message,
            });
          });
        } else {
          const processedCount = dealsToInsert.length;
          stats.imported += processedCount;
          
          console.log(`✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${processedCount} deals processados`);
        }
      } catch (err: any) {
        console.error(`❌ Exceção no batch ${Math.floor(i / BATCH_SIZE) + 1}:`, err);
        stats.errors += dealsToInsert.length;
        // Continuar para próximo batch ao invés de parar
      }
    }

    // Atualizar progresso do job
    if (jobId) {
      await supabase
        .from('sync_jobs')
        .update({
          total_processed: stats.imported,
          total_skipped: stats.skipped + stats.errors,
          last_page: Math.floor(i / BATCH_SIZE) + 1,
          metadata: {
            imported: stats.imported,
            skipped: stats.skipped,
            errors: stats.errors,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);
    }

    // ❌ Delay removido - não necessário e consome CPU
  }

  stats.duration_seconds = Math.floor((Date.now() - startTime) / 1000);
  
  return stats;
}

// Função de processamento de chunks em background (SEQUENCIAL)
async function processChunksInBackground(
  allDeals: CSVDeal[],
  jobIds: string[],
  chunkSize: number,
  supabaseUrl: string,
  supabaseKey: string
) {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Carregar caches uma vez para todos os chunks
  console.log('🔄 Carregando caches...');
  const [contactsCache, stagesCache] = await Promise.all([
    loadContactsCache(supabase),
    loadStagesCache(supabase),
  ]);
  
  console.log(`📦 Iniciando processamento SEQUENCIAL de ${jobIds.length} chunks...`);
  
  // Processar cada chunk UM POR VEZ, em ordem
  for (let i = 0; i < jobIds.length; i++) {
    const jobId = jobIds[i];
    const chunkStart = i * chunkSize;
    const chunkEnd = Math.min((i + 1) * chunkSize, allDeals.length);
    const chunkDeals = allDeals.slice(chunkStart, chunkEnd);
    
    console.log(`📦 Processando chunk ${i + 1}/${jobIds.length}: deals ${chunkStart}-${chunkEnd}`);
    
    try {
      // Atualizar job para processing
      await supabase
        .from('sync_jobs')
        .update({
          status: 'processing',
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      // Processar deals do chunk
      const stats = await processDeals(supabase, chunkDeals, contactsCache, stagesCache, jobId);

      // Atualizar job para completed
      await supabase
        .from('sync_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          total_processed: stats.imported,
          total_skipped: stats.skipped + stats.errors,
          metadata: {
            stats,
            imported: stats.imported,
            skipped: stats.skipped,
            errors: stats.errors,
            errorDetails: stats.errorDetails.slice(0, 100),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      console.log(`✅ Chunk ${i + 1}/${jobIds.length} concluído: ${stats.imported} importados, ${stats.skipped} pulados, ${stats.errors} erros`);
    } catch (error) {
      console.error(`❌ Erro no chunk ${i + 1}:`, error);
      
      // Atualizar job para failed
      await supabase
        .from('sync_jobs')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Erro desconhecido',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);
    }
  }
  
  // Executar link de contacts a origins via deals uma vez no final
  console.log('🔗 Vinculando contacts a origins...');
  try {
    const { data: linkCount } = await supabase.rpc('link_contacts_to_origins_via_deals');
    console.log(`✅ ${linkCount || 0} contacts vinculados a origins`);
  } catch (linkError) {
    console.error('⚠️ Erro ao vincular contacts:', linkError);
  }
  
  console.log('✅ Todos os chunks processados!');
}

// Função de processamento em background (mantida para compatibilidade)
async function processInBackground(
  csvDeals: CSVDeal[],
  jobId: string,
  supabaseUrl: string,
  supabaseKey: string
) {
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Atualizar job para started
    await supabase
      .from('sync_jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    // Carregar caches
    console.log('🔄 Carregando caches...');
    const [contactsCache, stagesCache] = await Promise.all([
      loadContactsCache(supabase),
      loadStagesCache(supabase),
    ]);

    // Processar deals
    console.log('⚙️ Processando deals...');
    const stats = await processDeals(supabase, csvDeals, contactsCache, stagesCache, jobId);

    // Executar link de contacts a origins via deals
    console.log('🔗 Vinculando contacts a origins...');
    try {
      const { data: linkCount } = await supabase.rpc('link_contacts_to_origins_via_deals');
      console.log(`✅ ${linkCount || 0} contacts vinculados a origins`);
    } catch (linkError) {
      console.error('⚠️ Erro ao vincular contacts:', linkError);
    }

    // Atualizar job para completed
    await supabase
      .from('sync_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        total_processed: stats.imported,
        total_skipped: stats.errors,
        metadata: {
          stats,
          errorDetails: stats.errorDetails.slice(0, 100), // Limitar a 100 erros
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    console.log('✅ Importação concluída!');
    console.log(`📊 Estatísticas:`, stats);
  } catch (error) {
    console.error('❌ Erro no processamento background:', error);
    
    // Atualizar job para failed
    await supabase
      .from('sync_jobs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Erro desconhecido',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[IMPORT-DEALS-CSV] Version: 2025-11-24T20:00:00Z - Chunked processing');
    console.log('📥 Iniciando importação de deals via CSV');
    
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      throw new Error('Nenhum arquivo CSV foi enviado');
    }

    const csvText = await file.text();
    console.log(`📄 Arquivo recebido: ${file.name} (${csvText.length} bytes)`);

    // Parse CSV
    const csvDeals = parseCSV(csvText);
    console.log(`📊 Total de deals no CSV: ${csvDeals.length}`);

    if (csvDeals.length === 0) {
      throw new Error('CSV vazio ou inválido. Verifique se o arquivo tem pelo menos 2 linhas (header + dados).');
    }
    
    // 🔧 FIX: CHUNK_SIZE reduzido para evitar CPU timeout
    const CHUNK_SIZE = 1000; // Reduzido de 2000 para 1000 (mais seguro)
    const totalChunks = Math.ceil(csvDeals.length / CHUNK_SIZE);
    
    console.log(`📦 Dividindo em ${totalChunks} chunk(s) de até ${CHUNK_SIZE} deals cada`);
    
    // Validar que os deals têm os campos necessários
    const dealsWithoutId = csvDeals.filter(d => !d.id || d.id.trim() === '').length;
    const dealsWithoutName = csvDeals.filter(d => !d.name || d.name.trim() === '').length;
    
    if (dealsWithoutId > 0 || dealsWithoutName > 0) {
      console.warn(`⚠️ Validação: ${dealsWithoutId} deals sem ID, ${dealsWithoutName} deals sem nome`);
    }

    // Conectar ao Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Criar job parent para agrupar todos os chunks
    const parentJobId = crypto.randomUUID();
    const jobIds: string[] = [];
    
    // Criar jobs para cada chunk
    for (let i = 0; i < totalChunks; i++) {
      const chunkStart = i * CHUNK_SIZE;
      const chunkEnd = Math.min((i + 1) * CHUNK_SIZE, csvDeals.length);
      const chunkSize = chunkEnd - chunkStart;
      
      const { data: job, error: jobError } = await supabase
        .from('sync_jobs')
        .insert({
          job_type: 'deals',
          status: 'pending',
          metadata: {
            filename: file.name,
            total_deals: chunkSize,
            import_type: 'csv',
            parent_job_id: parentJobId,
            chunk_number: i + 1,
            total_chunks: totalChunks,
            chunk_start: chunkStart,
            chunk_end: chunkEnd,
          },
        })
        .select()
        .single();

      if (jobError || !job) {
        console.error(`❌ Erro ao criar job chunk ${i + 1}:`, jobError);
        continue;
      }
      
      jobIds.push(job.id);
      console.log(`✅ Job chunk ${i + 1}/${totalChunks} criado: ${job.id} (${chunkSize} deals)`);
    }
    
    if (jobIds.length === 0) {
      throw new Error('Falha ao criar jobs de importação');
    }

    // Processar chunks em background sequencialmente
    EdgeRuntime.waitUntil(
      processChunksInBackground(csvDeals, jobIds, CHUNK_SIZE, supabaseUrl, supabaseKey)
    );

    // Retornar resposta imediata
    return new Response(
      JSON.stringify({
        success: true,
        message: `Importação iniciada. ${totalChunks} chunk(s) serão processados em background.`,
        parent_job_id: parentJobId,
        job_ids: jobIds,
        total_deals: csvDeals.length,
        total_chunks: totalChunks,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Erro na importação:', error);
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
