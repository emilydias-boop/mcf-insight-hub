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
// Se taxa_no_show <= 30% → performance = 100% + bônus proporcional até 150%
// Se taxa_no_show > 30% → performance decresce
const calculateNoShowPerformance = (noShows: number, agendadas: number): number => {
  if (agendadas <= 0) return 100;
  
  const taxaNoShow = (noShows / agendadas) * 100;
  
  if (taxaNoShow <= 30) {
    // Quanto menor a taxa, melhor (bônus até 150%)
    return Math.min(150, 100 + ((30 - taxaNoShow) / 30) * 50);
  } else {
    // Acima de 30%, penalidade
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
}

interface Kpi {
  reunioes_agendadas: number;
  reunioes_realizadas: number;
  tentativas_ligacoes: number;
  score_organizacao: number;
  no_shows: number;
}

const calculatePayoutValues = (compPlan: CompPlan, kpi: Kpi) => {
  // Calculate percentages for regular indicators
  const pct_reunioes_agendadas = compPlan.meta_reunioes_agendadas > 0 
    ? (kpi.reunioes_agendadas / compPlan.meta_reunioes_agendadas) * 100 
    : 0;
  const pct_reunioes_realizadas = compPlan.meta_reunioes_realizadas > 0
    ? (kpi.reunioes_realizadas / compPlan.meta_reunioes_realizadas) * 100
    : 0;
  const pct_tentativas = compPlan.meta_tentativas > 0
    ? (kpi.tentativas_ligacoes / compPlan.meta_tentativas) * 100
    : 0;
  const pct_organizacao = compPlan.meta_organizacao > 0
    ? (kpi.score_organizacao / compPlan.meta_organizacao) * 100
    : 0;

  // Calculate No-Show performance (inverse calculation)
  const pct_no_show = calculateNoShowPerformance(kpi.no_shows || 0, kpi.reunioes_agendadas || 0);

  // Cap all percentages at 120% for payout calculation
  const cappedPctAgendadas = Math.min(pct_reunioes_agendadas, 120);
  const cappedPctRealizadas = Math.min(pct_reunioes_realizadas, 120);
  const cappedPctTentativas = Math.min(pct_tentativas, 120);
  const cappedPctOrganizacao = Math.min(pct_organizacao, 120);
  const cappedPctNoShow = Math.min(pct_no_show, 120);

  // Get multipliers (using capped percentages)
  const mult_reunioes_agendadas = getMultiplier(cappedPctAgendadas);
  const mult_reunioes_realizadas = getMultiplier(cappedPctRealizadas);
  const mult_tentativas = getMultiplier(cappedPctTentativas);
  const mult_organizacao = getMultiplier(cappedPctOrganizacao);
  const mult_no_show = getMultiplier(cappedPctNoShow);

  // Calculate values
  const valor_reunioes_agendadas = compPlan.valor_meta_rpg * mult_reunioes_agendadas;
  const valor_reunioes_realizadas = compPlan.valor_docs_reuniao * mult_reunioes_realizadas;
  const valor_tentativas = compPlan.valor_tentativas * mult_tentativas;
  const valor_organizacao = compPlan.valor_organizacao * mult_organizacao;

  // Totals (No-Show não tem valor base próprio, afeta indiretamente via realizadas)
  const valor_variavel_total = valor_reunioes_agendadas + valor_reunioes_realizadas + valor_tentativas + valor_organizacao;
  const valor_fixo = compPlan.fixo_valor;
  const total_conta = valor_fixo + valor_variavel_total;

  // iFood logic - only ultrameta if average >= 100%
  // Use the 4 main indicators for average calculation
  const pct_media_global = (cappedPctAgendadas + cappedPctRealizadas + cappedPctTentativas + cappedPctOrganizacao) / 4;
  const ifood_mensal = compPlan.ifood_mensal;
  // Note: ifood_ultrameta is set here but won't be paid unless authorized
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

    // Get SDRs to process
    let sdrsQuery = supabase.from('sdr').select('id, name').eq('active', true);
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

    const [year, month] = ano_mes.split('-').map(Number);
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;

    const results = [];
    let processed = 0;
    let errors = 0;

    for (const sdr of sdrs) {
      try {
        console.log(`   ⏳ Processando SDR: ${sdr.name} (${sdr.id})`);

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

        // Get or create KPI
        let { data: kpi, error: kpiError } = await supabase
          .from('sdr_month_kpi')
          .select('*')
          .eq('sdr_id', sdr.id)
          .eq('ano_mes', ano_mes)
          .single();

        if (kpiError && kpiError.code === 'PGRST116') {
          // Create empty KPI
          const { data: newKpi, error: createError } = await supabase
            .from('sdr_month_kpi')
            .insert({ 
              sdr_id: sdr.id, 
              ano_mes: ano_mes,
              reunioes_agendadas: 0,
              reunioes_realizadas: 0,
              tentativas_ligacoes: 0,
              score_organizacao: 0,
              no_shows: 0,
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
        } else if (kpiError) {
          console.error(`   ❌ Erro ao buscar KPI: ${kpiError.message}`);
          errors++;
          continue;
        }

        // Log KPI values for debugging
        console.log(`   📊 KPI carregado para ${sdr.name}:`, {
          reunioes_agendadas: kpi.reunioes_agendadas,
          reunioes_realizadas: kpi.reunioes_realizadas,
          tentativas_ligacoes: kpi.tentativas_ligacoes,
          score_organizacao: kpi.score_organizacao,
          no_shows: kpi.no_shows,
        });

        // Count intermediações
        const { count: interCount } = await supabase
          .from('sdr_intermediacoes')
          .select('*', { count: 'exact', head: true })
          .eq('sdr_id', sdr.id)
          .eq('ano_mes', ano_mes);

        // Update KPI with intermediações count
        if (interCount !== null && interCount !== kpi.intermediacoes_contrato) {
          await supabase
            .from('sdr_month_kpi')
            .update({ intermediacoes_contrato: interCount })
            .eq('id', kpi.id);
          kpi.intermediacoes_contrato = interCount;
        }

        // Calculate values
        const calculatedValues = calculatePayoutValues(compPlan as CompPlan, kpi as Kpi);
        
        console.log(`   💰 Valores calculados para ${sdr.name}:`, {
          pct_tentativas: calculatedValues.pct_tentativas.toFixed(1),
          pct_organizacao: calculatedValues.pct_organizacao.toFixed(1),
          mult_tentativas: calculatedValues.mult_tentativas,
          mult_organizacao: calculatedValues.mult_organizacao,
          valor_tentativas: calculatedValues.valor_tentativas,
          valor_organizacao: calculatedValues.valor_organizacao,
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

        // Upsert payout
        const { data: payout, error: payoutError } = await supabase
          .from('sdr_month_payout')
          .upsert({
            sdr_id: sdr.id,
            ano_mes: ano_mes,
            ...calculatedValues,
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
