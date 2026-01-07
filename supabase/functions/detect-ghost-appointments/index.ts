import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GhostCase {
  deal_id: string;
  contact_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  sdr_email: string;
  sdr_name: string | null;
  ghost_type: string;
  severity: string;
  total_r1_agendada: number;
  distinct_days: number;
  no_show_count: number;
  detection_reason: string;
  movement_history: any[];
  first_r1_date: string | null;
  last_r1_date: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { days_back = 14, create_alerts = true } = await req.json().catch(() => ({}))

    console.log(`🔍 Iniciando detecção de agendamentos fantasmas (últimos ${days_back} dias)`)

    // Executar função SQL de detecção
    const { data: detectedCases, error: detectError } = await supabase
      .rpc('detect_ghost_appointments', { days_back })

    if (detectError) {
      console.error('❌ Erro ao executar detecção:', detectError)
      throw detectError
    }

    const cases: GhostCase[] = detectedCases || []
    console.log(`📊 Detectados ${cases.length} casos suspeitos`)

    if (cases.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhum caso suspeito detectado',
          new_cases: 0,
          total_detected: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Inserir casos na tabela de auditoria (ignorando duplicatas)
    let insertedCount = 0
    const today = new Date().toISOString().split('T')[0]

    for (const ghostCase of cases) {
      const { error: insertError } = await supabase
        .from('ghost_appointments_audit')
        .upsert({
          deal_id: ghostCase.deal_id,
          contact_id: ghostCase.contact_id,
          contact_name: ghostCase.contact_name,
          contact_email: ghostCase.contact_email,
          contact_phone: ghostCase.contact_phone,
          sdr_email: ghostCase.sdr_email,
          sdr_name: ghostCase.sdr_name,
          ghost_type: ghostCase.ghost_type,
          severity: ghostCase.severity,
          total_r1_agendada: ghostCase.total_r1_agendada,
          distinct_days: ghostCase.distinct_days,
          no_show_count: ghostCase.no_show_count,
          detection_reason: ghostCase.detection_reason,
          movement_history: ghostCase.movement_history,
          first_r1_date: ghostCase.first_r1_date,
          last_r1_date: ghostCase.last_r1_date,
          detection_date: today,
          status: 'pending'
        }, {
          onConflict: 'deal_id,detection_date',
          ignoreDuplicates: true
        })

      if (!insertError) {
        insertedCount++
      }
    }

    console.log(`✅ ${insertedCount} novos casos inseridos na tabela de auditoria`)

    // Criar alertas para coordenadores/admins
    if (create_alerts && insertedCount > 0) {
      // Agrupar por SDR
      const sdrCounts: Record<string, number> = {}
      const criticalCount = cases.filter(c => c.severity === 'critical').length
      const highCount = cases.filter(c => c.severity === 'high').length

      cases.forEach(c => {
        const sdr = c.sdr_name || c.sdr_email
        sdrCounts[sdr] = (sdrCounts[sdr] || 0) + 1
      })

      const sdrSummary = Object.entries(sdrCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([sdr, count]) => `${sdr}: ${count}`)
        .join(' | ')

      // Buscar admins e coordenadores para enviar alertas
      const { data: admins } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'coordenador', 'manager'])

      if (admins && admins.length > 0) {
        const alertTipo = criticalCount > 0 ? 'critico' : 'aviso'
        const alertTitle = criticalCount > 0 
          ? `🚨 ${criticalCount} Agendamentos Fantasmas CRÍTICOS Detectados`
          : `⚠️ ${insertedCount} Agendamentos Fantasmas Detectados`

        const alertDescription = `Detectados ${insertedCount} novos casos de agendamentos suspeitos.\n${sdrSummary}\n\n${criticalCount} críticos, ${highCount} alta severidade.`

        for (const admin of admins) {
          await supabase.from('alertas').insert({
            user_id: admin.user_id,
            tipo: alertTipo,
            titulo: alertTitle,
            descricao: alertDescription,
            metadata: {
              type: 'ghost_appointments',
              cases_count: insertedCount,
              critical_count: criticalCount,
              high_count: highCount,
              sdr_counts: sdrCounts,
              link: '/crm/auditoria-agendamentos'
            }
          })
        }

        console.log(`📣 Alertas criados para ${admins.length} usuários`)
      }
    }

    // Estatísticas por severidade
    const stats = {
      total: cases.length,
      critical: cases.filter(c => c.severity === 'critical').length,
      high: cases.filter(c => c.severity === 'high').length,
      medium: cases.filter(c => c.severity === 'medium').length,
      low: cases.filter(c => c.severity === 'low').length,
    }

    // Estatísticas por tipo
    const byType = {
      tipo_a: cases.filter(c => c.ghost_type === 'tipo_a').length,
      tipo_b: cases.filter(c => c.ghost_type === 'tipo_b').length,
      ciclo_infinito: cases.filter(c => c.ghost_type === 'ciclo_infinito').length,
      regressao: cases.filter(c => c.ghost_type === 'regressao').length,
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Detectados ${cases.length} casos, ${insertedCount} novos inseridos`,
        new_cases: insertedCount,
        total_detected: cases.length,
        stats,
        byType,
        cases: cases.slice(0, 10) // Retornar apenas os 10 primeiros
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    console.error('❌ Erro na detecção:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
