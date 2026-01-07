import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para parsear valores brasileiros (R$ 1.234,56)
function parseBRCurrency(value: string | number): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  const cleaned = value
    .toString()
    .replace(/R\$\s?/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  
  return parseFloat(cleaned) || 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    console.log('Received webhook data:', JSON.stringify(body, null, 2));

    // Validar dados obrigatórios
    if (!body.start_date || !body.end_date) {
      throw new Error('start_date and end_date are required');
    }

    // Parsear valores
    const ads_cost = parseBRCurrency(body.ads_cost);
    const team_cost = parseBRCurrency(body.team_cost);
    const office_cost = parseBRCurrency(body.office_cost);
    const a010_revenue = parseBRCurrency(body.a010_revenue);
    const ob_construir_revenue = parseBRCurrency(body.ob_construir_revenue);
    const ob_vitalicio_revenue = parseBRCurrency(body.ob_vitalicio_revenue);
    const ob_evento_revenue = parseBRCurrency(body.ob_evento_revenue);
    const contract_revenue = parseBRCurrency(body.contract_revenue);
    const clint_revenue = parseBRCurrency(body.clint_revenue);
    const incorporador_50k = parseBRCurrency(body.incorporador_50k);

    // Valores inteiros
    const a010_sales = parseInt(body.a010_sales) || 0;
    const contract_sales = parseInt(body.contract_sales) || 0;
    const sdr_ia_ig = parseInt(body.sdr_ia_ig) || 0;
    const ob_construir_sales = parseInt(body.ob_construir_sales) || 0;
    const ob_vitalicio_sales = parseInt(body.ob_vitalicio_sales) || 0;
    const ob_evento_sales = parseInt(body.ob_evento_sales) || 0;

    // Calcular métricas automaticamente
    // total_revenue, operating_cost, real_cost, operating_profit são calculados via GENERATED columns
    
    // Calcular CPL
    const cpl = a010_sales > 0 ? ads_cost / a010_sales : null;

    // Calcular custo real para CPLR
    const real_cost_calc = ads_cost - (a010_revenue + ob_construir_revenue + ob_vitalicio_revenue + ob_evento_revenue);
    const cplr = a010_sales > 0 ? real_cost_calc / a010_sales : null;

    // Calcular receita total para ROAS e ROI
    const total_revenue_calc = a010_revenue + ob_construir_revenue + ob_vitalicio_revenue + ob_evento_revenue + contract_revenue;
    const roas = ads_cost > 0 ? total_revenue_calc / ads_cost : null;

    // Calcular custo operacional para ROI
    const operating_cost_calc = ads_cost + team_cost + office_cost;
    const operating_profit_calc = total_revenue_calc - operating_cost_calc;
    const roi = clint_revenue && operating_profit_calc 
      ? (clint_revenue / (clint_revenue - operating_profit_calc)) * 100 
      : null;

    // Calcular CIR
    const cir = contract_revenue > 0 ? (real_cost_calc / contract_revenue) * 100 : null;

    // Calcular Ultrametas
    const ultrameta_clint = (a010_sales * operating_cost_calc) + (sdr_ia_ig * operating_cost_calc / 2);
    const ultrameta_liquido = (total_revenue_calc * a010_sales) + (sdr_ia_ig * total_revenue_calc / 2);

    // Gerar week_label
    const startDate = new Date(body.start_date);
    const endDate = new Date(body.end_date);
    
    const formatDate = (date: Date) => {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    };

    const week_label = `${formatDate(startDate)} - ${formatDate(endDate)}`;

    // Preparar dados para inserção
    const metricsData = {
      start_date: body.start_date,
      end_date: body.end_date,
      week_label,
      ads_cost,
      team_cost,
      office_cost,
      a010_revenue,
      a010_sales,
      ob_construir_revenue,
      ob_construir_sales,
      ob_vitalicio_revenue,
      ob_vitalicio_sales,
      ob_evento_revenue,
      ob_evento_sales,
      contract_revenue,
      contract_sales,
      clint_revenue,
      incorporador_50k,
      sdr_ia_ig,
      // Campos calculados (usar valores fornecidos ou calcular)
      total_revenue: parseBRCurrency(body.total_revenue) || total_revenue_calc,
      operating_cost: parseBRCurrency(body.operating_cost) || operating_cost_calc,
      real_cost: parseBRCurrency(body.real_cost) || real_cost_calc,
      operating_profit: parseBRCurrency(body.operating_profit) || operating_profit_calc,
      cpl,
      cplr,
      roas,
      roi,
      cir,
      ultrameta_clint,
      ultrameta_liquido,
      // Funnel data (se fornecido)
      stage_01_target: parseInt(body.stage_01_target) || null,
      stage_01_actual: parseInt(body.stage_01_actual) || null,
      stage_01_rate: parseFloat(body.stage_01_rate) || null,
      stage_02_target: parseInt(body.stage_02_target) || null,
      stage_02_actual: parseInt(body.stage_02_actual) || null,
      stage_02_rate: parseFloat(body.stage_02_rate) || null,
      stage_03_target: parseInt(body.stage_03_target) || null,
      stage_03_actual: parseInt(body.stage_03_actual) || null,
      stage_03_rate: parseFloat(body.stage_03_rate) || null,
      stage_04_target: parseInt(body.stage_04_target) || null,
      stage_04_actual: parseInt(body.stage_04_actual) || null,
      stage_04_rate: parseFloat(body.stage_04_rate) || null,
      stage_05_target: parseInt(body.stage_05_target) || null,
      stage_05_actual: parseInt(body.stage_05_actual) || null,
      stage_05_rate: parseFloat(body.stage_05_rate) || null,
      stage_06_target: parseInt(body.stage_06_target) || null,
      stage_06_actual: parseInt(body.stage_06_actual) || null,
      stage_06_rate: parseFloat(body.stage_06_rate) || null,
      stage_07_target: parseInt(body.stage_07_target) || null,
      stage_07_actual: parseInt(body.stage_07_actual) || null,
      stage_07_rate: parseFloat(body.stage_07_rate) || null,
      stage_08_target: parseInt(body.stage_08_target) || null,
      stage_08_actual: parseInt(body.stage_08_actual) || null,
      stage_08_rate: parseFloat(body.stage_08_rate) || null,
    };

    // Verificar se já existe registro para esta semana
    const { data: existing } = await supabase
      .from('weekly_metrics')
      .select('id')
      .eq('start_date', body.start_date)
      .eq('end_date', body.end_date)
      .single();

    let result;
    if (existing) {
      // Atualizar registro existente
      result = await supabase
        .from('weekly_metrics')
        .update({
          ...metricsData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      // Inserir novo registro
      result = await supabase
        .from('weekly_metrics')
        .insert(metricsData)
        .select()
        .single();
    }

    if (result.error) throw result.error;

    console.log('Metrics saved successfully:', result.data.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: existing ? 'Metrics updated successfully' : 'Metrics created successfully',
        data: result.data,
        calculated: {
          total_revenue: total_revenue_calc,
          operating_cost: operating_cost_calc,
          real_cost: real_cost_calc,
          operating_profit: operating_profit_calc,
          cpl,
          cplr,
          roas,
          roi,
          cir,
          ultrameta_clint,
          ultrameta_liquido,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in webhook-metrics-receiver:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
