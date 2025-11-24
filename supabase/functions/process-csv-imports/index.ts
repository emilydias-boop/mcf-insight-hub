import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

const CHUNK_SIZE = 1000

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('🔄 Buscando jobs pendentes...')

    // Buscar jobs pendentes
    const { data: pendingJobs, error: jobsError } = await supabase
      .from('sync_jobs')
      .select('*')
      .eq('job_type', 'import_deals_csv')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(5)

    if (jobsError) {
      console.error('❌ Erro ao buscar jobs:', jobsError)
      throw jobsError
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      console.log('✅ Nenhum job pendente para processar')
      return new Response(
        JSON.stringify({ message: 'Nenhum job pendente' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📋 ${pendingJobs.length} job(s) pendente(s) encontrado(s)`)

    // Processar cada job
    for (const job of pendingJobs) {
      try {
        console.log(`\n🔧 Processando job ${job.id}...`)
        
        // Atualizar status para processing
        await supabase
          .from('sync_jobs')
          .update({ 
            status: 'processing',
            started_at: new Date().toISOString()
          })
          .eq('id', job.id)

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
        console.log(`📊 ${csvDeals.length} negócios encontrados no CSV`)

        // Carregar caches
        console.log('🗂️ Carregando caches...')
        const contactsCache = await loadContactsCache(supabase)
        const stagesCache = await loadStagesCache(supabase)

        // Processar em chunks
        let processed = 0
        let skipped = 0
        const errors: any[] = []

        for (let i = 0; i < csvDeals.length; i += CHUNK_SIZE) {
          const chunk = csvDeals.slice(i, i + CHUNK_SIZE)
          console.log(`\n📦 Processando chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(csvDeals.length / CHUNK_SIZE)}`)

          const dbDeals: CRMDeal[] = []

          for (const csvDeal of chunk) {
            try {
              const dbDeal = convertToDBFormat(csvDeal, contactsCache, stagesCache)
              if (dbDeal) {
                dbDeals.push(dbDeal)
              } else {
                skipped++
              }
            } catch (error: any) {
              console.error(`❌ Erro ao converter deal:`, error)
              errors.push({ deal: csvDeal, error: error.message })
              skipped++
            }
          }

          if (dbDeals.length > 0) {
            console.log(`💾 Salvando ${dbDeals.length} negócios...`)
            const { error: upsertError } = await supabase.rpc('upsert_deals_smart', {
              deals_data: dbDeals
            })

            if (upsertError) {
              console.error('❌ Erro ao fazer upsert:', upsertError)
              errors.push({ chunk: i, error: upsertError.message })
            } else {
              processed += dbDeals.length
              console.log(`✅ ${processed}/${csvDeals.length} processados`)
            }
          }

          // Atualizar progresso
          await supabase
            .from('sync_jobs')
            .update({
              total_processed: processed,
              total_skipped: skipped,
              metadata: {
                ...job.metadata,
                errors: errors.slice(0, 100) // Limitar a 100 erros
              }
            })
            .eq('id', job.id)
        }

        // Finalizar job
        await supabase
          .from('sync_jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            total_processed: processed,
            total_skipped: skipped
          })
          .eq('id', job.id)

        console.log(`✅ Job ${job.id} concluído: ${processed} processados, ${skipped} ignorados`)

      } catch (error: any) {
        console.error(`❌ Erro ao processar job ${job.id}:`, error)
        
        await supabase
          .from('sync_jobs')
          .update({
            status: 'failed',
            error_message: error.message,
            completed_at: new Date().toISOString()
          })
          .eq('id', job.id)
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        processedJobs: pendingJobs.length 
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
  stagesCache: Map<string, string>
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
  
  console.log(`✅ Cache de contatos carregado: ${cache.size} entradas`)
  return cache
}

async function loadStagesCache(supabase: any): Promise<Map<string, string>> {
  const cache = new Map<string, string>()
  
  const { data: stages } = await supabase
    .from('crm_stages')
    .select('id, stage_name')
  
  if (stages) {
    for (const stage of stages) {
      cache.set(stage.stage_name.toLowerCase(), stage.id)
    }
  }
  
  console.log(`✅ Cache de estágios carregado: ${cache.size} entradas`)
  return cache
}
