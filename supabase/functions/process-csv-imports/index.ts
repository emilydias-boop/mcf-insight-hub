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
  dono?: string // Alias para owner
  user_email?: string // Email do responsável (formato exportação)
  user_name?: string // Nome do responsável (formato exportação)
  tags?: string
  expected_close_date?: string
  probability?: string
  email?: string
  phone?: string
  telefone?: string
  celular?: string
  whatsapp?: string
  created_at?: string // Data original de criação do lead
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
  owner_profile_id?: string
  tags?: string[]
  custom_fields?: Record<string, any>
  expected_close_date?: string
  probability?: number
  updated_at: string
  created_at?: string // Data original de criação do lead
}

interface ContactData {
  name: string
  email?: string
  phone?: string
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
    const profilesCache = await loadProfilesCache(supabase)

    // Processar apenas 1 chunk
    const startIdx = currentChunk * CHUNK_SIZE
    const endIdx = Math.min(startIdx + CHUNK_SIZE, totalDeals)
    const chunkDeals = csvDeals.slice(startIdx, endIdx)
    
    console.log(`🔨 Processando deals ${startIdx + 1} a ${endIdx}...`)

    const dbDeals: CRMDeal[] = []
    const errors: any[] = job.metadata.errors || []
    let chunkSkipped = 0
    let contactsCreated = 0
    const originId = job.metadata.origin_id // origin_id do job
    const ownerEmail = job.metadata.owner_email // owner do job (opcional)
    const ownerProfileId = job.metadata.owner_profile_id // owner profile id do job (opcional)

    // Verificar se há distribuição ativa para esta origin (para rodízio automático)
    let hasDistribution = false
    if (originId && !ownerEmail) {
      const { data: distConfig } = await supabase
        .from('lead_distribution_config')
        .select('id')
        .eq('origin_id', originId)
        .eq('is_active', true)
        .limit(1)
      hasDistribution = !!distConfig?.length
      if (hasDistribution) {
        console.log(`🔄 Distribuição automática ativa para origin ${originId}`)
      }
    }
    
    // Set para rastrear contatos já processados neste chunk (deduplicação por contact_id + origin_id)
    const processedContactOrigins = new Set<string>(job.metadata.processed_contact_origins || [])

    // Carregar deals existentes no banco para esta origin (prevenir duplicatas com webhook/Clint)
    if (originId) {
      console.log(`🔍 Carregando deals existentes para origin ${originId}...`)
      let existingPage = 0
      const PAGE_SIZE = 1000
      let hasMore = true
      while (hasMore) {
        const { data: existingDeals, error: existErr } = await supabase
          .from('crm_deals')
          .select('contact_id')
          .eq('origin_id', originId)
          .not('contact_id', 'is', null)
          .range(existingPage * PAGE_SIZE, (existingPage + 1) * PAGE_SIZE - 1)
        
        if (existErr) {
          console.error('⚠️ Erro ao carregar deals existentes:', existErr)
          break
        }
        
        for (const d of existingDeals || []) {
          if (d.contact_id) {
            processedContactOrigins.add(`${d.contact_id}_${originId}`)
          }
        }
        
        hasMore = (existingDeals?.length || 0) === PAGE_SIZE
        existingPage++
      }
      console.log(`📊 ${processedContactOrigins.size} combinações contact+origin já existentes no banco`)
    }

    for (const csvDeal of chunkDeals) {
      try {
        // Extrair dados de contato do CSV
        const contactData = extractContactData(csvDeal)
        
        // Tentar encontrar contato existente por email ou telefone
        let contactId = findContactInCache(contactData, contactsCache)
        
        // Se não encontrou e tem dados suficientes, criar novo contato
        if (!contactId && contactData.name && (contactData.email || contactData.phone)) {
          const newContactId = await createContact(supabase, contactData)
          if (newContactId) {
            contactId = newContactId
            contactsCreated++
            // Adicionar ao cache para evitar duplicatas no mesmo chunk
            if (contactData.email) contactsCache.set(contactData.email.toLowerCase(), newContactId)
            if (contactData.phone) contactsCache.set(normalizePhone(contactData.phone), newContactId)
            if (contactData.name) contactsCache.set(contactData.name.toLowerCase(), newContactId)
            console.log(`✅ Contato criado: ${contactData.name} (${newContactId})`)
          }
        }
        
        // Se encontrou um contato e tem origin_id, verificar duplicação
        if (contactId && originId) {
          const existingDealKey = `${contactId}_${originId}`
          if (processedContactOrigins.has(existingDealKey)) {
            console.log(`⏭️ Pulando deal duplicado para contato ${contactId} na origem ${originId}: ${csvDeal.name}`)
            chunkSkipped++
            continue
          }
          processedContactOrigins.add(existingDealKey)
        }
        
        const dbDeal = convertToDBFormat(csvDeal, contactsCache, stagesCache, originId, job.metadata.default_stage_id || null)
        if (dbDeal) {
          // Vincular contact_id se encontrado
          if (contactId) {
            dbDeal.contact_id = contactId
          }
          
          // Resolver owner: prioridade para job, depois CSV (incluindo user_email do formato exportação)
          const csvOwnerEmail = csvDeal.owner?.trim() || csvDeal.dono?.trim() || csvDeal.gerente?.trim() || csvDeal.user_email?.trim()
          const finalOwnerEmail = ownerEmail || csvOwnerEmail
          
          if (finalOwnerEmail) {
            dbDeal.owner_id = finalOwnerEmail
            
            // Resolver owner_profile_id
            const resolvedProfileId = ownerProfileId || profilesCache.get(finalOwnerEmail.toLowerCase())
            if (resolvedProfileId) {
              dbDeal.owner_profile_id = resolvedProfileId
            }
          } else if (hasDistribution && originId) {
            // Sem owner explícito: distribuir via rodízio
            const { data: nextOwnerEmail } = await supabase.rpc('get_next_lead_owner', {
              p_origin_id: originId
            })
            if (nextOwnerEmail) {
              dbDeal.owner_id = nextOwnerEmail
              const profileId = profilesCache.get(nextOwnerEmail.toLowerCase())
              if (profileId) {
                dbDeal.owner_profile_id = profileId
              }
              console.log(`🔄 Deal "${csvDeal.name}" distribuído para ${nextOwnerEmail} via rodízio`)
            }
          }
          
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
    const totalContactsCreated = (job.metadata.contacts_created || 0) + contactsCreated
    const nextChunk = currentChunk + 1
    const isComplete = nextChunk >= totalChunks

    console.log(`✅ Chunk ${currentChunk + 1} processado: ${dbDeals.length} salvos, ${chunkSkipped} pulados, ${contactsCreated} contatos criados`)

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
          contacts_created: totalContactsCreated,
          errors: errors.slice(0, 100), // Limitar a 100 erros
          processed_contact_origins: Array.from(processedContactOrigins) // Persistir para próximo chunk
        }
      })
      .eq('id', job.id)

    const message = isComplete 
      ? `✅ Importação completa: ${currentProcessed} deals processados, ${totalContactsCreated} contatos criados`
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
        total_skipped: currentSkipped,
        contacts_created: totalContactsCreated
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
  // Detectar delimitador: TAB tem prioridade, depois ; depois ,
  const delimiter = headerLine.includes('\t') ? '\t' 
                  : headerLine.includes(';') ? ';' 
                  : ','
  
  console.log(`📋 Delimitador detectado: ${delimiter === '\t' ? 'TAB' : delimiter}`)
  
  // Parse headers com tratamento de duplicatas
  const rawHeaders = parseLine(headerLine, delimiter).map(h => h.toLowerCase().trim())
  const seen = new Map<string, number>()
  const headers = rawHeaders.map(h => {
    const count = (seen.get(h) || 0) + 1
    seen.set(h, count)
    return count > 1 ? `${h}_${count}` : h
  })
  
  console.log(`📋 Headers detectados: ${headers.join(', ')}`)
  
  const deals: CSVDeal[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i], delimiter)
    const deal: CSVDeal = {}
    
    headers.forEach((header, index) => {
      if (values[index] !== undefined) {
        deal[header] = values[index].trim()
      }
    })
    
    // Aceitar deal se tem id, name, ou cliente (mapeamento alternativo)
    if (deal.id || deal.name || deal.cliente) {
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

/**
 * Extrai dados de contato do CSV (nome, email, telefone)
 */
function extractContactData(csvDeal: CSVDeal): ContactData {
  // cliente_2 = segunda coluna "Cliente" (SDR/contato)
  const name = csvDeal.contact?.trim() || csvDeal.cliente_2?.trim() || csvDeal.cliente?.trim() || csvDeal.name?.trim() || ''
  const email = csvDeal.email?.trim() || ''
  const phone = csvDeal.phone?.trim() || 
                csvDeal.telefone?.trim() || 
                csvDeal.celular?.trim() || 
                csvDeal.whatsapp?.trim() || ''
  
  return { name, email, phone }
}

/**
 * Normaliza número de telefone para formato E.164
 */
function normalizePhone(phone: string): string {
  let clean = phone.replace(/\D/g, '')
  
  if (clean.startsWith('0')) {
    clean = clean.substring(1)
  }
  
  if (!clean.startsWith('55') && clean.length <= 11) {
    clean = '55' + clean
  }
  
  return '+' + clean
}

/**
 * Busca contato no cache por email, telefone ou nome
 */
function findContactInCache(contactData: ContactData, cache: Map<string, string>): string | null {
  // Prioridade 1: email
  if (contactData.email) {
    const byEmail = cache.get(contactData.email.toLowerCase())
    if (byEmail) return byEmail
  }
  
  // Prioridade 2: telefone normalizado
  if (contactData.phone) {
    const normalizedPhone = normalizePhone(contactData.phone)
    const byPhone = cache.get(normalizedPhone)
    if (byPhone) return byPhone
    
    // Tentar sem normalização também
    const byRawPhone = cache.get(contactData.phone.toLowerCase())
    if (byRawPhone) return byRawPhone
  }
  
  // Prioridade 3: nome
  if (contactData.name) {
    const byName = cache.get(contactData.name.toLowerCase())
    if (byName) return byName
  }
  
  return null
}

/**
 * Cria novo contato no banco de dados
 */
async function createContact(supabase: any, contactData: ContactData): Promise<string | null> {
  const normalizedPhone = contactData.phone ? normalizePhone(contactData.phone) : null
  
  const { data, error } = await supabase
    .from('crm_contacts')
    .insert({
      clint_id: `csv_import_${crypto.randomUUID()}`,
      name: contactData.name,
      email: contactData.email || null,
      phone: normalizedPhone
    })
    .select('id')
    .single()
  
  if (error) {
    console.error(`❌ Erro ao criar contato ${contactData.name}:`, error)
    return null
  }
  
  return data?.id || null
}

function generateSyntheticId(csvDeal: CSVDeal): string {
  const seed = [
    csvDeal.name?.trim() || '',
    csvDeal.email?.trim() || '',
    csvDeal.phone?.trim() || csvDeal.telefone?.trim() || csvDeal.celular?.trim() || csvDeal.whatsapp?.trim() || '',
    csvDeal.created_at?.trim() || '',
  ].join('|').toLowerCase()

  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i)
    hash |= 0
  }
  return `csv_import_${Math.abs(hash)}`
}

function convertToDBFormat(
  csvDeal: CSVDeal,
  contactsCache: Map<string, string>,
  stagesCache: Map<string, string>,
  originId?: string,
  defaultStageId?: string | null
): CRMDeal | null {
  const clintId = csvDeal.id?.trim() || generateSyntheticId(csvDeal)
  // Mapear "cliente" como fallback para nome do deal
  const name = csvDeal.name?.trim() || csvDeal.cliente?.trim() || csvDeal.consorciado?.trim() || ''
  
  if (!name) {
    return null
  }

  // Validação: rejeitar nomes que são apenas números/telefones
  if (/^\(?[\d\s\-\(\)\+,.E]+$/.test(name)) {
    console.warn(`⚠️ Nome inválido (parece telefone): "${name}" — pulando`)
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
    dbDeal.stage_id = stageId || defaultStageId || undefined
  } else if (defaultStageId) {
    dbDeal.stage_id = defaultStageId
  }

  // contact_id será atribuído separadamente após busca/criação do contato

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

  // Custom fields - incluir email/phone que não foram mapeados para contato
  const excludedFields = ['id', 'name', 'value', 'stage', 'contact', 'origin', 'owner', 'dono', 'gerente', 'user_email', 'user_name', 'tags', 'expected_close_date', 'probability', 'email', 'phone', 'telefone', 'celular', 'whatsapp', 'created_at', 'cliente', 'cliente_2', 'consorciado']
  const customFields: Record<string, any> = {}
  
  for (const [key, value] of Object.entries(csvDeal)) {
    if (!excludedFields.includes(key) && value) {
      customFields[key] = value
    }
  }
  
  if (Object.keys(customFields).length > 0) {
    dbDeal.custom_fields = customFields
  }

  // Preservar data original de criação se disponível no CSV
  if (csvDeal.created_at) {
    const parsedDate = parseCSVDate(csvDeal.created_at)
    if (parsedDate) {
      dbDeal.created_at = parsedDate.toISOString()
    }
  }

  return dbDeal
}

/**
 * Parseia data do CSV em formatos comuns (DD/MM/YYYY HH:mm:ss ou ISO)
 */
function parseCSVDate(dateStr: string): Date | null {
  if (!dateStr?.trim()) return null
  
  // Formato: "25/08/2025 17:40:59" ou "25/08/2025"
  const brMatch = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/)
  if (brMatch) {
    const [, day, month, year, hour = '00', min = '00', sec = '00'] = brMatch
    const isoString = `${year}-${month}-${day}T${hour}:${min}:${sec}`
    const date = new Date(isoString)
    return isNaN(date.getTime()) ? null : date
  }
  
  // Tentar parse direto (formato ISO)
  const date = new Date(dateStr)
  return isNaN(date.getTime()) ? null : date
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

/**
 * Carrega cache de profiles para resolver owner_profile_id
 */
async function loadProfilesCache(supabase: any): Promise<Map<string, string>> {
  const cache = new Map<string, string>()
  
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email')
  
  if (profiles) {
    for (const profile of profiles) {
      if (profile.email) {
        cache.set(profile.email.toLowerCase(), profile.id)
      }
    }
  }
  
  console.log(`✅ Cache de profiles: ${cache.size} entradas`)
  return cache
}
