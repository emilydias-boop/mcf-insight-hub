import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Cron job wrapper para sync-newsale-orphans
// Roda automaticamente via pg_cron (configurado no Supabase)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()
  console.log('🕐 [CRON] Iniciando sync automático de newsale- órfãos...')

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Buscar transações newsale- que ainda não foram contadas
    const { data: newsaleTransactions, error: fetchError } = await supabase
      .from('hubla_transactions')
      .select('id, hubla_id, customer_email, customer_name, sale_date, net_value, product_price')
      .ilike('hubla_id', 'newsale-%')
      .eq('product_category', 'a010')
      .eq('count_in_dashboard', false)
      .order('sale_date', { ascending: false })
      .limit(100)

    if (fetchError) {
      console.error('❌ [CRON] Erro ao buscar newsale-:', fetchError)
      throw fetchError
    }

    if (!newsaleTransactions || newsaleTransactions.length === 0) {
      console.log('✅ [CRON] Nenhum newsale- órfão encontrado')
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhum órfão encontrado',
          processed: 0,
          processing_time_ms: Date.now() - startTime
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📊 [CRON] Encontrados ${newsaleTransactions.length} newsale- para processar`)

    // Buscar todas as transações A010 contadas (Make/Hubla) para comparação
    const { data: countedTransactions, error: countedError } = await supabase
      .from('hubla_transactions')
      .select('customer_email, customer_name, sale_date')
      .eq('product_category', 'a010')
      .eq('count_in_dashboard', true)
      .not('hubla_id', 'ilike', 'newsale-%')

    if (countedError) {
      console.error('❌ [CRON] Erro ao buscar transações contadas:', countedError)
      throw countedError
    }

    // Criar sets para lookup rápido
    const countedEmails = new Set<string>()
    const countedNames = new Set<string>()

    countedTransactions?.forEach(t => {
      if (t.customer_email) {
        countedEmails.add(t.customer_email.toLowerCase().trim())
      }
      if (t.customer_name) {
        // Normalizar nome para comparação
        const normalized = t.customer_name.toLowerCase().trim()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        countedNames.add(normalized)
      }
    })

    // Identificar órfãos verdadeiros
    const trueOrphans: typeof newsaleTransactions = []
    const skipped: { id: string; reason: string }[] = []

    for (const newsale of newsaleTransactions) {
      const email = newsale.customer_email?.toLowerCase().trim()
      const name = newsale.customer_name?.toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')

      // Verificar se já existe transação com mesmo email ou nome
      if (email && countedEmails.has(email)) {
        skipped.push({ id: newsale.id, reason: 'email_match' })
        continue
      }

      if (name && countedNames.has(name)) {
        skipped.push({ id: newsale.id, reason: 'name_match' })
        continue
      }

      trueOrphans.push(newsale)
    }

    console.log(`📊 [CRON] Órfãos verdadeiros: ${trueOrphans.length}, Ignorados: ${skipped.length}`)

    // Promover órfãos verdadeiros
    let promotedCount = 0
    let totalNetValue = 0

    for (const orphan of trueOrphans) {
      // Calcular net_value se não existir (85% do product_price)
      const netValue = orphan.net_value || (orphan.product_price ? orphan.product_price * 0.85 : 0)

      const { error: updateError } = await supabase
        .from('hubla_transactions')
        .update({
          count_in_dashboard: true,
          net_value: netValue,
          updated_at: new Date().toISOString(),
          raw_data: { 
            promoted_by_cron: true,
            promoted_at: new Date().toISOString(),
            original_hubla_id: orphan.hubla_id
          }
        })
        .eq('id', orphan.id)

      if (!updateError) {
        promotedCount++
        totalNetValue += netValue
        console.log(`✅ [CRON] Promovido: ${orphan.customer_name} - R$ ${netValue.toFixed(2)}`)
      } else {
        console.error(`❌ [CRON] Erro ao promover ${orphan.id}:`, updateError)
      }
    }

    const processingTime = Date.now() - startTime
    console.log(`🎉 [CRON] Sync concluído em ${processingTime}ms`)
    console.log(`   - Processados: ${newsaleTransactions.length}`)
    console.log(`   - Promovidos: ${promotedCount}`)
    console.log(`   - Ignorados: ${skipped.length}`)
    console.log(`   - Valor total promovido: R$ ${totalNetValue.toFixed(2)}`)

    return new Response(
      JSON.stringify({
        success: true,
        processed: newsaleTransactions.length,
        promoted: promotedCount,
        skipped: skipped.length,
        total_net_value_promoted: totalNetValue,
        processing_time_ms: processingTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ [CRON] Erro no sync:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Erro no sync', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
