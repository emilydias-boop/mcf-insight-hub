import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { sdr_id, ano_mes } = await req.json()

    if (!sdr_id || !ano_mes) {
      return new Response(
        JSON.stringify({ error: 'sdr_id e ano_mes são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Sincronizando KPIs para SDR ${sdr_id}, período ${ano_mes}`)

    // Buscar email do SDR
    const { data: sdr, error: sdrError } = await supabase
      .from('sdr')
      .select('id, name, email')
      .eq('id', sdr_id)
      .single()

    if (sdrError || !sdr) {
      console.error('Erro ao buscar SDR:', sdrError)
      return new Response(
        JSON.stringify({ error: 'SDR não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!sdr.email) {
      return new Response(
        JSON.stringify({ error: 'SDR não possui email configurado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`SDR encontrado: ${sdr.name} (${sdr.email})`)

    // Calcular período (primeiro e último dia do mês)
    const [year, month] = ano_mes.split('-').map(Number)
    const startDate = new Date(year, month - 1, 1).toISOString()
    const endDate = new Date(year, month, 0, 23, 59, 59).toISOString()

    console.log(`Período: ${startDate} até ${endDate}`)

    // UUIDs dos estágios do Bubble
    const STAGE_R1_AGENDADA_UUID = 'a8365215-fd31-4bdc-bbe7-77100fa39e53'
    const STAGE_R1_REALIZADA_UUID = '34995d75-933e-4d67-b7fc-19fcb8b81680'

    // Buscar todas as atividades do período
    const { data: activities, error: activitiesError } = await supabase
      .from('deal_activities')
      .select('*')
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    if (activitiesError) {
      console.error('Erro ao buscar atividades:', activitiesError)
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar atividades' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Total de atividades encontradas: ${activities?.length || 0}`)

    // Filtrar atividades deste SDR
    const sdrActivities = activities?.filter(a => {
      const metadata = a.metadata as Record<string, any> || {}
      const dealUser = metadata.deal_user || metadata.owner || ''
      return dealUser.toLowerCase() === sdr.email.toLowerCase()
    }) || []

    console.log(`Atividades deste SDR: ${sdrActivities.length}`)

    // Contar R1 Agendadas (nome ou UUID)
    const reunioesAgendadas = sdrActivities.filter(a => 
      a.to_stage === 'Reunião 01 Agendada' || 
      a.to_stage === STAGE_R1_AGENDADA_UUID
    ).length

    // Contar No-Shows
    const noShows = sdrActivities.filter(a => 
      a.to_stage === 'No-Show'
    ).length

    // Contar R1 Realizadas (nome ou UUID)
    const reunioesRealizadas = sdrActivities.filter(a => 
      a.to_stage === 'Reunião 01 Realizada' || 
      a.to_stage === STAGE_R1_REALIZADA_UUID
    ).length

    console.log(`KPIs calculados: R1 Agendada=${reunioesAgendadas}, No-Show=${noShows}, R1 Realizada=${reunioesRealizadas}`)

    // Calcular taxa de no-show
    const taxaNoShow = reunioesAgendadas > 0 
      ? Math.round((noShows / reunioesAgendadas) * 10000) / 100 
      : 0

    // ========== INTERMEDIAÇÕES AUTOMÁTICAS ==========
    console.log('Buscando intermediações automáticas...')

    // Buscar vendas Hubla do mês (Contratos A000)
    const monthStartDate = `${year}-${String(month).padStart(2, '0')}-01`
    const monthEndDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`

    const { data: hublaTransactions, error: hublaError } = await supabase
      .from('hubla_transactions')
      .select('id, hubla_id, customer_email, customer_name, product_name, product_price, sale_date')
      .gte('sale_date', `${monthStartDate}T00:00:00`)
      .lte('sale_date', `${monthEndDate}T23:59:59`)
      .eq('sale_status', 'completed')
      .or('product_name.ilike.%contrato%,product_name.ilike.%A000%')

    if (hublaError) {
      console.error('Erro ao buscar transações Hubla:', hublaError)
    }

    console.log(`Transações Hubla (Contratos) no mês: ${hublaTransactions?.length || 0}`)

    let intermediacoes = 0
    const intermediacoesInserted: string[] = []

    if (hublaTransactions && hublaTransactions.length > 0) {
      // Para cada transação, verificar se este SDR agendou a R1 do cliente
      for (const tx of hublaTransactions) {
        const customerEmail = tx.customer_email?.toLowerCase()
        const customerName = tx.customer_name?.toLowerCase()

        if (!customerEmail && !customerName) continue

        // Buscar se este SDR agendou alguma R1 para este cliente (no histórico todo)
        const { data: matchActivities } = await supabase
          .from('deal_activities')
          .select('id, metadata, created_at')
          .or(`to_stage.eq.Reunião 01 Agendada,to_stage.eq.${STAGE_R1_AGENDADA_UUID}`)
          .order('created_at', { ascending: false })
          .limit(100)

        // Filtrar atividades que têm o mesmo cliente e foram feitas por este SDR
        const sdrMatchedR1 = matchActivities?.find(a => {
          const metadata = a.metadata as Record<string, any> || {}
          const dealUser = metadata.deal_user || metadata.owner || ''
          const dealEmail = metadata.contact_email?.toLowerCase() || ''
          const dealName = metadata.contact_name?.toLowerCase() || ''
          
          const isSameSdr = dealUser.toLowerCase() === sdr.email.toLowerCase()
          const matchesEmail = customerEmail && dealEmail && dealEmail === customerEmail
          const matchesName = customerName && dealName && dealName.includes(customerName.split(' ')[0])
          
          return isSameSdr && (matchesEmail || matchesName)
        })

        if (sdrMatchedR1) {
          // Verificar se já existe intermediação para esta transação
          const { data: existingIntermed } = await supabase
            .from('sdr_intermediacoes')
            .select('id')
            .eq('hubla_transaction_id', tx.id)
            .eq('sdr_id', sdr_id)
            .maybeSingle()

          if (!existingIntermed) {
            // Inserir nova intermediação
            const { error: insertError } = await supabase
              .from('sdr_intermediacoes')
              .insert({
                sdr_id: sdr_id,
                ano_mes: ano_mes,
                hubla_transaction_id: tx.id,
                produto_nome: tx.product_name,
                valor_venda: tx.product_price,
                observacao: `Intermediação automática - Cliente: ${tx.customer_name}`,
              })

            if (!insertError) {
              intermediacoes++
              intermediacoesInserted.push(tx.customer_name || tx.customer_email || 'N/A')
              console.log(`Intermediação inserida: ${tx.customer_name} - ${tx.product_name}`)
            }
          } else {
            intermediacoes++ // Já existe, contar mesmo assim
          }
        }
      }
    }

    // Contar total de intermediações do mês para este SDR
    const { count: totalIntermediacoes } = await supabase
      .from('sdr_intermediacoes')
      .select('*', { count: 'exact', head: true })
      .eq('sdr_id', sdr_id)
      .eq('ano_mes', ano_mes)

    console.log(`Total intermediações do mês: ${totalIntermediacoes || 0}`)

    // Atualizar ou inserir KPIs
    const { data: existingKpi, error: kpiCheckError } = await supabase
      .from('sdr_month_kpi')
      .select('id')
      .eq('sdr_id', sdr_id)
      .eq('ano_mes', ano_mes)
      .maybeSingle()

    if (kpiCheckError) {
      console.error('Erro ao verificar KPI existente:', kpiCheckError)
    }

    const kpiData = {
      sdr_id,
      ano_mes,
      reunioes_agendadas: reunioesAgendadas,
      no_shows: noShows,
      reunioes_realizadas: reunioesRealizadas,
      taxa_no_show: taxaNoShow,
      intermediacoes_contrato: totalIntermediacoes || 0,
      updated_at: new Date().toISOString(),
    }

    let upsertResult
    if (existingKpi) {
      // Update existing
      upsertResult = await supabase
        .from('sdr_month_kpi')
        .update(kpiData)
        .eq('id', existingKpi.id)
        .select()
        .single()
    } else {
      // Insert new
      upsertResult = await supabase
        .from('sdr_month_kpi')
        .insert(kpiData)
        .select()
        .single()
    }

    if (upsertResult.error) {
      console.error('Erro ao salvar KPI:', upsertResult.error)
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar KPI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('KPIs sincronizados com sucesso')

    return new Response(
      JSON.stringify({
        success: true,
        kpi: upsertResult.data,
        stats: {
          reunioes_agendadas: reunioesAgendadas,
          no_shows: noShows,
          reunioes_realizadas: reunioesRealizadas,
          taxa_no_show: taxaNoShow,
          total_activities: sdrActivities.length,
          intermediacoes_contrato: totalIntermediacoes || 0,
          intermediacoes_inserted: intermediacoesInserted,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro na sincronização:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
