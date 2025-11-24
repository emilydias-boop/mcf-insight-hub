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

// Parse CSV com separador de ponto e vírgula
function parseCSV(csvText: string): CSVDeal[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  // Primeira linha é o cabeçalho
  const headers = lines[0].split(';').map(h => h.trim().toLowerCase());
  
  const deals: CSVDeal[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = line.split(';');
    const deal: CSVDeal = { id: '', name: '' };
    
    headers.forEach((header, index) => {
      const value = values[index]?.trim() || '';
      deal[header] = value;
    });
    
    deals.push(deal);
  }
  
  return deals;
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
  if (!csvDeal.id || !csvDeal.name) {
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
        stats.errorDetails.push({
          line: lineNumber,
          clint_id: csvDeal.id || 'unknown',
          error: 'Campos obrigatórios faltando (id ou name)',
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
      throw new Error('CSV vazio ou inválido');
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
