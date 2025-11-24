// Version: 2025-11-24T17:50:00Z
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

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
  if (!csvDeal.name || csvDeal.name.trim() === '') {
    console.warn(`⚠️ Deal ${csvDeal.id} sem nome. Campos disponíveis:`, Object.keys(csvDeal));
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

  // Custom fields - todos os campos que não são padrão
  const standardFields = ['id', 'name', 'email', 'phone', 'complete_phone', 'stage', 'origin', 'value', 'user_email', 'tags'];
  const customFields: Record<string, any> = {};
  
  Object.keys(csvDeal).forEach(key => {
    if (!standardFields.includes(key) && csvDeal[key]) {
      customFields[key] = csvDeal[key];
    }
  });

  return {
    clint_id: csvDeal.id,
    name: csvDeal.name,
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

// Processar deals em batches
async function processDeals(
  supabase: any,
  csvDeals: CSVDeal[],
  contactsCache: Map<string, string>,
  stagesCache: Map<string, string>
): Promise<ImportStats> {
  const stats: ImportStats = {
    total: csvDeals.length,
    imported: 0,
    updated: 0,
    errors: 0,
    duration_seconds: 0,
    errorDetails: [],
  };

  const BATCH_SIZE = 100;
  const startTime = Date.now();

  for (let i = 0; i < csvDeals.length; i += BATCH_SIZE) {
    const batch = csvDeals.slice(i, i + BATCH_SIZE);
    const dealsToInsert: any[] = [];

    batch.forEach((csvDeal, index) => {
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
        return;
      }

      dealsToInsert.push(dealData);
    });

    if (dealsToInsert.length > 0) {
      try {
        const { data, error } = await supabase
          .from('crm_deals')
          .upsert(dealsToInsert, {
            onConflict: 'clint_id',
            ignoreDuplicates: false,
          })
          .select();

        if (error) {
          console.error(`❌ Erro no batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error);
          stats.errors += dealsToInsert.length;
          dealsToInsert.forEach((deal, idx) => {
            stats.errorDetails.push({
              line: i + idx + 2,
              clint_id: deal.clint_id,
              error: error.message,
            });
          });
        } else {
          // Verificar se foram atualizações ou inserções
          const insertedCount = data?.length || 0;
          stats.imported += insertedCount;
          
          console.log(`✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${insertedCount} deals processados`);
        }
      } catch (err: any) {
        console.error(`❌ Exceção no batch ${Math.floor(i / BATCH_SIZE) + 1}:`, err);
        stats.errors += dealsToInsert.length;
      }
    }

    // Pequeno delay para não sobrecarregar
    if (i + BATCH_SIZE < csvDeals.length) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  stats.duration_seconds = Math.floor((Date.now() - startTime) / 1000);
  
  return stats;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[IMPORT-DEALS-CSV] Version: 2025-11-24T17:50:00Z');
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
    
    // Validar que os deals têm os campos necessários
    const dealsWithoutId = csvDeals.filter(d => !d.id).length;
    const dealsWithoutName = csvDeals.filter(d => !d.name).length;
    
    if (dealsWithoutId > 0 || dealsWithoutName > 0) {
      console.warn(`⚠️ Validação: ${dealsWithoutId} deals sem ID, ${dealsWithoutName} deals sem nome`);
    }

    // Conectar ao Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Carregar caches
    console.log('🔄 Carregando caches...');
    const [contactsCache, stagesCache] = await Promise.all([
      loadContactsCache(supabase),
      loadStagesCache(supabase),
    ]);

    // Processar deals
    console.log('⚙️ Processando deals...');
    const stats = await processDeals(supabase, csvDeals, contactsCache, stagesCache);

    // Executar link de contacts a origins via deals
    console.log('🔗 Vinculando contacts a origins...');
    try {
      const { data: linkCount } = await supabase.rpc('link_contacts_to_origins_via_deals');
      console.log(`✅ ${linkCount || 0} contacts vinculados a origins`);
    } catch (linkError) {
      console.error('⚠️ Erro ao vincular contacts:', linkError);
    }

    console.log('✅ Importação concluída!');
    console.log(`📊 Estatísticas:`, stats);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Importação concluída com sucesso',
        stats,
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
