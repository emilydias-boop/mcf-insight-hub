import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Multiplier brackets based on percentage
const getMultiplier = (pct: number): number => {
  if (pct < 71) return 0;
  if (pct <= 85) return 0.5;
  if (pct <= 99) return 0.7;
  if (pct <= 119) return 1;
  return 1.5;
};

// Cálculo inverso do No-Show
const calculateNoShowPerformance = (noShows: number, agendadas: number): number => {
  if (agendadas <= 0) return 100;
  
  const taxaNoShow = (noShows / agendadas) * 100;
  
  if (taxaNoShow <= 30) {
    return Math.min(150, 100 + ((30 - taxaNoShow) / 30) * 50);
  } else {
    return Math.max(0, 100 - ((taxaNoShow - 30) / 30) * 100);
  }
};

interface CompPlan {
  meta_reunioes_agendadas: number;
  meta_reunioes_realizadas: number;
  meta_tentativas: number;
  meta_organizacao: number;
  valor_meta_rpg: number;
  valor_docs_reuniao: number;
  valor_tentativas: number;
  valor_organizacao: number;
  fixo_valor: number;
  ifood_mensal: number;
  ifood_ultrameta: number;
  dias_uteis: number;
}

interface Kpi {
  reunioes_agendadas: number;
  reunioes_realizadas: number;
  tentativas_ligacoes: number;
  score_organizacao: number;
  no_shows: number;
}

const calculatePayoutValues = (compPlan: CompPlan, kpi: Kpi, sdrMetaDiaria: number, calendarIfoodMensal?: number, diasUteisMes?: number) => {
  // Dias úteis do mês (do calendário ou padrão)
  const diasUteisReal = diasUteisMes || compPlan.dias_uteis || 19;

  // Meta de agendadas = meta_diaria do SDR × dias úteis do mês
  const metaAgendadasAjustada = Math.round((sdrMetaDiaria || 0) * diasUteisReal);
  
  // Manter proporção para realizadas e tentativas baseado no comp_plan
  const proporcaoRealizadas = compPlan.meta_reunioes_agendadas > 0 
    ? compPlan.meta_reunioes_realizadas / compPlan.meta_reunioes_agendadas 
    : 0.7;
  const metaRealizadasAjustada = Math.round(metaAgendadasAjustada * proporcaoRealizadas);
  
  const proporcaoTentativas = compPlan.meta_reunioes_agendadas > 0 
    ? compPlan.meta_tentativas / compPlan.meta_reunioes_agendadas 
    : 17;
  const metaTentativasAjustada = Math.round(metaAgendadasAjustada * proporcaoTentativas);
  // meta_organizacao é percentual, não precisa ajustar

  const pct_reunioes_agendadas = metaAgendadasAjustada > 0 
    ? (kpi.reunioes_agendadas / metaAgendadasAjustada) * 100 
    : 0;
  const pct_reunioes_realizadas = metaRealizadasAjustada > 0
    ? (kpi.reunioes_realizadas / metaRealizadasAjustada) * 100
    : 0;
  const pct_tentativas = metaTentativasAjustada > 0
    ? (kpi.tentativas_ligacoes / metaTentativasAjustada) * 100
    : 0;
  const pct_organizacao = compPlan.meta_organizacao > 0
    ? (kpi.score_organizacao / compPlan.meta_organizacao) * 100
    : 0;

  const pct_no_show = calculateNoShowPerformance(kpi.no_shows || 0, kpi.reunioes_agendadas || 0);

  const cappedPctAgendadas = Math.min(pct_reunioes_agendadas, 120);
  const cappedPctRealizadas = Math.min(pct_reunioes_realizadas, 120);
  const cappedPctTentativas = Math.min(pct_tentativas, 120);
  const cappedPctOrganizacao = Math.min(pct_organizacao, 120);
  const cappedPctNoShow = Math.min(pct_no_show, 120);

  const mult_reunioes_agendadas = getMultiplier(cappedPctAgendadas);
  const mult_reunioes_realizadas = getMultiplier(cappedPctRealizadas);
  const mult_tentativas = getMultiplier(cappedPctTentativas);
  const mult_organizacao = getMultiplier(cappedPctOrganizacao);
  const mult_no_show = getMultiplier(cappedPctNoShow);

  const valor_reunioes_agendadas = compPlan.valor_meta_rpg * mult_reunioes_agendadas;
  const valor_reunioes_realizadas = compPlan.valor_docs_reuniao * mult_reunioes_realizadas;
  const valor_tentativas = compPlan.valor_tentativas * mult_tentativas;
  const valor_organizacao = compPlan.valor_organizacao * mult_organizacao;

  const valor_variavel_total = valor_reunioes_agendadas + valor_reunioes_realizadas + valor_tentativas + valor_organizacao;
  const valor_fixo = compPlan.fixo_valor;
  const total_conta = valor_fixo + valor_variavel_total;

  const pct_media_global = (cappedPctAgendadas + cappedPctRealizadas + cappedPctTentativas + cappedPctOrganizacao) / 4;
  const ifood_mensal = calendarIfoodMensal ?? compPlan.ifood_mensal;
  const ifood_ultrameta = pct_media_global >= 100 ? compPlan.ifood_ultrameta : 0;
  const total_ifood = ifood_mensal + ifood_ultrameta;

  return {
    pct_reunioes_agendadas,
    pct_reunioes_realizadas,
    pct_tentativas,
    pct_organizacao,
    pct_no_show,
    mult_reunioes_agendadas,
    mult_reunioes_realizadas,
    mult_tentativas,
    mult_organizacao,
    mult_no_show,
    valor_reunioes_agendadas,
    valor_reunioes_realizadas,
    valor_tentativas,
    valor_organizacao,
    valor_variavel_total,
    valor_fixo,
    total_conta,
    ifood_mensal,
    ifood_ultrameta,
    total_ifood,
    // Metas ajustadas para salvar no payout
    meta_agendadas_ajustada: metaAgendadasAjustada,
    meta_realizadas_ajustada: metaRealizadasAjustada,
    meta_tentativas_ajustada: metaTentativasAjustada,
    dias_uteis_mes: diasUteisReal,
  };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { sdr_id, ano_mes } = await req.json();

    if (!ano_mes) {
      return new Response(
        JSON.stringify({ error: 'ano_mes is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔄 Recalculando payout para ${sdr_id ? `SDR ${sdr_id}` : 'todos os SDRs'} no mês ${ano_mes}`);

    // Fetch working days calendar for this month
    const { data: calendarData, error: calendarError } = await supabase
      .from('working_days_calendar')
      .select('ifood_mensal_calculado, dias_uteis_final, ifood_valor_dia')
      .eq('ano_mes', ano_mes)
      .single();

    if (calendarError && calendarError.code !== 'PGRST116') {
      console.log(`⚠️ Erro ao buscar calendário: ${calendarError.message}`);
    }

    const calendarIfoodMensal = calendarData?.ifood_mensal_calculado ?? null;
    console.log(`📅 Calendário ${ano_mes}: iFood Mensal = ${calendarIfoodMensal ?? 'não definido'}`);

    // Get SDRs to process (with email for RPC call)
    let sdrsQuery = supabase.from('sdr').select('id, name, email, meta_diaria').eq('active', true);
    if (sdr_id) {
      sdrsQuery = sdrsQuery.eq('id', sdr_id);
    }
    
    const { data: sdrs, error: sdrsError } = await sdrsQuery;
    if (sdrsError) throw sdrsError;

    if (!sdrs || sdrs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No SDRs to process', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate date range for the month
    const [year, month] = ano_mes.split('-').map(Number);
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    console.log(`📅 Período: ${monthStart} até ${monthEnd}`);

    const results = [];
    let processed = 0;
    let errors = 0;

    for (const sdr of sdrs) {
      try {
        console.log(`   ⏳ Processando SDR: ${sdr.name} (${sdr.id})`);

        // ===== USAR RPC get_sdr_metrics_v2 PARA CONSISTÊNCIA =====
        let reunioesAgendadas = 0;
        let noShows = 0;
        let reunioesRealizadas = 0;
        let taxaNoShow = 0;

        if (sdr.email) {
          const { data: metricsData, error: metricsError } = await supabase.rpc('get_sdr_metrics_v2', {
            start_date: monthStart,
            end_date: monthEnd,
            sdr_email_filter: sdr.email
          });

          if (metricsError) {
            console.log(`   ⚠️ Erro ao buscar métricas RPC para ${sdr.name}: ${metricsError.message}`);
          } else if (metricsData && metricsData.metrics && metricsData.metrics.length > 0) {
            const metrics = metricsData.metrics[0];
            reunioesAgendadas = metrics.total_agendamentos || 0;
            noShows = metrics.no_shows || 0;
            reunioesRealizadas = metrics.realizadas || 0;
            taxaNoShow = metrics.taxa_no_show || 0;
            
            console.log(`   📊 Métricas da RPC para ${sdr.name}: Agendadas=${reunioesAgendadas}, No-Shows=${noShows}, Realizadas=${reunioesRealizadas}`);
          } else {
            console.log(`   ⚠️ Nenhuma métrica encontrada na RPC para ${sdr.name}`);
          }
        } else {
          console.log(`   ⚠️ SDR ${sdr.name} não tem email configurado`);
        }

        // Get comp plan
        const { data: compPlan, error: compError } = await supabase
          .from('sdr_comp_plan')
          .select('*')
          .eq('sdr_id', sdr.id)
          .lte('vigencia_inicio', monthStart)
          .or(`vigencia_fim.is.null,vigencia_fim.gte.${monthStart}`)
          .order('vigencia_inicio', { ascending: false })
          .limit(1)
          .single();

        if (compError || !compPlan) {
          console.log(`   ⚠️ Plano de compensação não encontrado para ${sdr.name}`);
          continue;
        }

        // ===== ATUALIZAR sdr_month_kpi COM DADOS DA RPC =====
        const { data: existingKpi } = await supabase
          .from('sdr_month_kpi')
          .select('id, tentativas_ligacoes, score_organizacao')
          .eq('sdr_id', sdr.id)
          .eq('ano_mes', ano_mes)
          .maybeSingle();

        const kpiData = {
          sdr_id: sdr.id,
          ano_mes: ano_mes,
          reunioes_agendadas: reunioesAgendadas,
          no_shows: noShows,
          reunioes_realizadas: reunioesRealizadas,
          taxa_no_show: taxaNoShow,
          // Preservar tentativas e organização se já existirem
          tentativas_ligacoes: existingKpi?.tentativas_ligacoes || 0,
          score_organizacao: existingKpi?.score_organizacao || 0,
          updated_at: new Date().toISOString(),
        };

        let kpi;
        if (existingKpi) {
          const { data: updatedKpi, error: updateError } = await supabase
            .from('sdr_month_kpi')
            .update(kpiData)
            .eq('id', existingKpi.id)
            .select()
            .single();
          
          if (updateError) {
            console.error(`   ❌ Erro ao atualizar KPI: ${updateError.message}`);
            errors++;
            continue;
          }
          kpi = updatedKpi;
        } else {
          const { data: newKpi, error: createError } = await supabase
            .from('sdr_month_kpi')
            .insert({
              ...kpiData,
              intermediacoes_contrato: 0,
            })
            .select()
            .single();
          
          if (createError) {
            console.error(`   ❌ Erro ao criar KPI: ${createError.message}`);
            errors++;
            continue;
          }
          kpi = newKpi;
        }

        console.log(`   📊 KPI atualizado para ${sdr.name}:`, {
          reunioes_agendadas: kpi.reunioes_agendadas,
          reunioes_realizadas: kpi.reunioes_realizadas,
          no_shows: kpi.no_shows,
        });

        // Count intermediações
        const { count: interCount } = await supabase
          .from('sdr_intermediacoes')
          .select('*', { count: 'exact', head: true })
          .eq('sdr_id', sdr.id)
          .eq('ano_mes', ano_mes);

        if (interCount !== null && interCount !== kpi.intermediacoes_contrato) {
          await supabase
            .from('sdr_month_kpi')
            .update({ intermediacoes_contrato: interCount })
            .eq('id', kpi.id);
          kpi.intermediacoes_contrato = interCount;
        }

        // Calculate values - passa dias_uteis_final do calendário para ajuste proporcional
        const diasUteisMes = calendarData?.dias_uteis_final ?? null;
        const calculatedValues = calculatePayoutValues(compPlan as CompPlan, kpi as Kpi, sdr.meta_diaria || 0, calendarIfoodMensal, diasUteisMes);
        
        console.log(`   💰 Valores calculados para ${sdr.name}:`, {
          pct_agendadas: calculatedValues.pct_reunioes_agendadas.toFixed(1),
          pct_realizadas: calculatedValues.pct_reunioes_realizadas.toFixed(1),
          ifood_mensal: calculatedValues.ifood_mensal,
          dias_uteis_mes: calculatedValues.dias_uteis_mes,
          meta_agendadas_ajustada: calculatedValues.meta_agendadas_ajustada,
        });

        // Get existing payout to preserve ifood_ultrameta_autorizado
        const { data: existingPayout } = await supabase
          .from('sdr_month_payout')
          .select('ifood_ultrameta_autorizado, ifood_ultrameta_autorizado_por, ifood_ultrameta_autorizado_em, status')
          .eq('sdr_id', sdr.id)
          .eq('ano_mes', ano_mes)
          .single();

        // Only update if not LOCKED
        if (existingPayout?.status === 'LOCKED') {
          console.log(`   ⏭️ Payout travado para ${sdr.name}, pulando`);
          continue;
        }

        // Remove campos que não existem na tabela sdr_month_payout
        const { pct_no_show, mult_no_show, ...payoutFields } = calculatedValues;

        // Upsert payout
        const { data: payout, error: payoutError } = await supabase
          .from('sdr_month_payout')
          .upsert({
            sdr_id: sdr.id,
            ano_mes: ano_mes,
            ...payoutFields,
            status: existingPayout?.status || 'DRAFT',
            ifood_ultrameta_autorizado: existingPayout?.ifood_ultrameta_autorizado || false,
            ifood_ultrameta_autorizado_por: existingPayout?.ifood_ultrameta_autorizado_por || null,
            ifood_ultrameta_autorizado_em: existingPayout?.ifood_ultrameta_autorizado_em || null,
          }, {
            onConflict: 'sdr_id,ano_mes',
          })
          .select()
          .single();

        if (payoutError) {
          console.error(`   ❌ Erro ao salvar payout: ${payoutError.message}`);
          errors++;
          continue;
        }

        results.push({ sdr_id: sdr.id, sdr_name: sdr.name, payout_id: payout.id });
        processed++;
        console.log(`   ✅ Sucesso para ${sdr.name}`);
      } catch (e: any) {
        console.error(`   ❌ Erro ao processar ${sdr.name}: ${e.message}`);
        errors++;
      }
    }

    console.log(`📊 Resultado: ${processed} processados, ${errors} erros`);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        errors,
        total: sdrs.length,
        results,
        calendarIfoodMensal,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro no recálculo:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
