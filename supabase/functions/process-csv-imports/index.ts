import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CSVDeal {
  id?: string
  name?: string
  value?: string
  stage?: string
  contact?: string
  origin?: string
  owner?: string
  tags?: string
  expected_close_date?: string
  probability?: string
  [key: string]: string | undefined
}

interface CRMDeal {
  clint_id: string
  name: string
  value?: number
  stage_id?: string
  contact_id?: string
  origin_id?: string
  owner_id?: string
  tags?: string[]
  custom_fields?: Record<string, any>
  expected_close_date?: string
  probability?: number
  updated_at: string
}

const CHUNK_SIZE = 1000 // Processar 1000 deals por vez

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('🔄 Buscando jobs para processar...')

    // Buscar jobs 'pending' ou 'processing' (para retomar)
    const { data: jobs, error: jobsError } = await supabase
      .from('sync_jobs')
      .select('*')
      .eq('job_type', 'import_deals_csv')
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: true })
      .limit(1) // Processar 1 job por vez

    if (jobsError) {
      console.error('❌ Erro ao buscar jobs:', jobsError)
      throw jobsError
    }

    if (!jobs || jobs.length === 0) {
      console.log('✅ Nenhum job pendente para processar')
      return new Response(
        JSON.stringify({ message: 'Nenhum job pendente' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const job = jobs[0]
    console.log(`\n🔧 Processando job ${job.id}...`)

    // Marcar como processing se for a primeira vez
    if (job.status === 'pending') {
      await supabase
        .from('sync_jobs')
        .update({ 
          status: 'processing',
          started_at: new Date().toISOString()
        })
        .eq('id', job.id)
    }

    const filePath = job.metadata.file_path
    console.log(`📥 Baixando arquivo: ${filePath}`)

    // Baixar CSV do storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('csv-imports')
      .download(filePath)

    if (downloadError) {
      throw new Error(`Erro ao baixar arquivo: ${downloadError.message}`)
    }

    const csvText = await fileData.text()
    const csvDeals = parseCSV(csvText)
    const totalDeals = csvDeals.length
    console.log(`📊 ${totalDeals} negócios no CSV`)

    // Calcular total de chunks
    const totalChunks = Math.ceil(totalDeals / CHUNK_SIZE)
    
    // Obter chunk atual do metadata (ou começar do 0)
    const currentChunk = job.metadata.current_chunk || 0
    
    console.log(`📦 Processando chunk ${currentChunk + 1}/${totalChunks}`)

    // Se já processou todos os chunks, marcar como completed
    if (currentChunk >= totalChunks) {
      console.log('✅ Todos os chunks já foram processados')
      await supabase
        .from('sync_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', job.id)
      
      return new Response(
        JSON.stringify({ success: true, message: 'Job já concluído' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Carregar caches (apenas uma vez por execução)
    console.log('🗂️ Carregando caches...')
    const contactsCache = await loadContactsCache(supabase)
    const stagesCache = await loadStagesCache(supabase)

    // Processar apenas 1 chunk
    const startIdx = currentChunk * CHUNK_SIZE
    const endIdx = Math.min(startIdx + CHUNK_SIZE, totalDeals)
    const chunkDeals = csvDeals.slice(startIdx, endIdx)
    
    console.log(`🔨 Processando deals ${startIdx + 1} a ${endIdx}...`)

    const dbDeals: CRMDeal[] = []
    const errors: any[] = job.metadata.errors || []
    let chunkSkipped = 0
    const originId = job.metadata.origin_id // origin_id do job

    for (const csvDeal of chunkDeals) {
      try {
        const dbDeal = convertToDBFormat(csvDeal, contactsCache, stagesCache, originId)
        if (dbDeal) {
          dbDeals.push(dbDeal)
        } else {
          chunkSkipped++
        }
      } catch (error: any) {
        console.error(`❌ Erro ao converter deal:`, error)
        errors.push({ deal: csvDeal, error: error.message })
        chunkSkipped++
      }
    }

    // Salvar deals no banco
    if (dbDeals.length > 0) {
      console.log(`💾 Salvando ${dbDeals.length} negócios...`)
      const { error: upsertError } = await supabase.rpc('upsert_deals_smart', {
        deals_data: dbDeals
      })

      if (upsertError) {
        console.error('❌ Erro ao fazer upsert:', upsertError)
        throw upsertError
      }
    }

    // Atualizar totais acumulados
    const currentProcessed = (job.total_processed || 0) + dbDeals.length
    const currentSkipped = (job.total_skipped || 0) + chunkSkipped
    const nextChunk = currentChunk + 1
    const isComplete = nextChunk >= totalChunks

    console.log(`✅ Chunk ${currentChunk + 1} processado: ${dbDeals.length} salvos, ${chunkSkipped} pulados`)

    // Atualizar job com progresso
    await supabase
      .from('sync_jobs')
      .update({
        status: isComplete ? 'completed' : 'processing',
        total_processed: currentProcessed,
        total_skipped: currentSkipped,
        completed_at: isComplete ? new Date().toISOString() : null,
        metadata: {
          ...job.metadata,
          current_chunk: nextChunk,
          total_chunks: totalChunks,
          current_line: endIdx,
          total_lines: totalDeals,
          errors: errors.slice(0, 100) // Limitar a 100 erros
        }
      })
      .eq('id', job.id)

    const message = isComplete 
      ? `✅ Importação completa: ${currentProcessed} deals processados`
      : `📦 Chunk ${nextChunk}/${totalChunks} processado. Próximo chunk será processado pelo cron.`

    console.log(message)

    return new Response(
      JSON.stringify({ 
        success: true,
        message,
        job_id: job.id,
        current_chunk: nextChunk,
        total_chunks: totalChunks,
        is_complete: isComplete,
        total_processed: currentProcessed,
        total_skipped: currentSkipped
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('❌ Erro geral:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

function parseCSV(csvText: string): CSVDeal[] {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) return []

  const headerLine = lines[0]
  const delimiter = headerLine.includes(';') ? ';' : ','
  
  const headers = parseLine(headerLine, delimiter).map(h => h.toLowerCase().trim())
  
  const deals: CSVDeal[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i], delimiter)
    const deal: CSVDeal = {}
    
    headers.forEach((header, index) => {
      if (values[index] !== undefined) {
        deal[header] = values[index].trim()
      }
    })
    
    if (deal.id || deal.name) {
      deals.push(deal)
    }
  }
  
  return deals
}

function parseLine(line: string, delimiter: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === delimiter && !inQuotes) {
      values.push(current)
      current = ''
    } else {
      current += char
    }
  }
  values.push(current)
  
  return values.map(v => v.replace(/^"|"$/g, ''))
}

function convertToDBFormat(
  csvDeal: CSVDeal,
  contactsCache: Map<string, string>,
  stagesCache: Map<string, string>,
  originId?: string
): CRMDeal | null {
  const clintId = csvDeal.id?.trim()
  const name = csvDeal.name?.trim()
  
  if (!clintId || !name) {
    return null
  }

  const dbDeal: CRMDeal = {
    clint_id: clintId,
    name: name,
    updated_at: new Date().toISOString()
  }

  // Aplicar origin_id do job (prioridade sobre CSV)
  if (originId) {
    dbDeal.origin_id = originId
  }

  if (csvDeal.value) {
    const value = parseFloat(csvDeal.value.replace(/[^0-9.-]/g, ''))
    if (!isNaN(value)) dbDeal.value = value
  }

  if (csvDeal.stage) {
    const stageId = stagesCache.get(csvDeal.stage.toLowerCase())
    if (stageId) dbDeal.stage_id = stageId
  }

  if (csvDeal.contact) {
    const contactId = contactsCache.get(csvDeal.contact.toLowerCase())
    if (contactId) dbDeal.contact_id = contactId
  }

  if (csvDeal.owner) {
    dbDeal.owner_id = csvDeal.owner.trim()
  }

  if (csvDeal.tags) {
    dbDeal.tags = csvDeal.tags.split(',').map(t => t.trim()).filter(Boolean)
  }

  if (csvDeal.expected_close_date) {
    dbDeal.expected_close_date = csvDeal.expected_close_date
  }

  if (csvDeal.probability) {
    const prob = parseInt(csvDeal.probability)
    if (!isNaN(prob) && prob >= 0 && prob <= 100) {
      dbDeal.probability = prob
    }
  }

  // Custom fields
  const excludedFields = ['id', 'name', 'value', 'stage', 'contact', 'origin', 'owner', 'tags', 'expected_close_date', 'probability']
  const customFields: Record<string, any> = {}
  
  for (const [key, value] of Object.entries(csvDeal)) {
    if (!excludedFields.includes(key) && value) {
      customFields[key] = value
    }
  }
  
  if (Object.keys(customFields).length > 0) {
    dbDeal.custom_fields = customFields
  }

  return dbDeal
}

async function loadContactsCache(supabase: any): Promise<Map<string, string>> {
  const cache = new Map<string, string>()
  
  const { data: contacts } = await supabase
    .from('crm_contacts')
    .select('id, name, email, phone')
  
  if (contacts) {
    for (const contact of contacts) {
      if (contact.name) cache.set(contact.name.toLowerCase(), contact.id)
      if (contact.email) cache.set(contact.email.toLowerCase(), contact.id)
      if (contact.phone) cache.set(contact.phone.toLowerCase(), contact.id)
    }
  }
  
  console.log(`✅ Cache de contatos: ${cache.size} entradas`)
  return cache
}

async function loadStagesCache(supabase: any): Promise<Map<string, string>> {
  const cache = new Map<string, string>()
  
  // 1. Buscar de local_pipeline_stages primeiro (prioridade para pipelines customizadas)
  const { data: localStages } = await supabase
    .from('local_pipeline_stages')
    .select('id, name')
    .eq('is_active', true)
  
  if (localStages) {
    for (const stage of localStages) {
      cache.set(stage.name.toLowerCase().trim(), stage.id)
    }
  }
  
  // 2. Fallback para crm_stages (stages legadas)
  const { data: crmStages } = await supabase
    .from('crm_stages')
    .select('id, stage_name')
  
  if (crmStages) {
    for (const stage of crmStages) {
      // Só adiciona se não existir no cache (local tem prioridade)
      if (!cache.has(stage.stage_name.toLowerCase().trim())) {
        cache.set(stage.stage_name.toLowerCase().trim(), stage.id)
      }
    }
  }
  
  console.log(`✅ Cache de estágios: ${cache.size} entradas (local + legado)`)
  return cache
}
