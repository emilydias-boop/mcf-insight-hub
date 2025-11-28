import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const payload = await req.json();
    console.log('🔄 Calculando métricas semanais:', payload);

    const { week_start, week_end } = payload;

    if (!week_start || !week_end) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: week_start, week_end' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. BUSCAR CUSTOS DA SEMANA
    const { data: dailyCosts } = await supabase
      .from('daily_costs')
      .select('*')
      .gte('date', week_start)
      .lte('date', week_end);

    const ads_cost = dailyCosts?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;

    // 2. BUSCAR CUSTOS OPERACIONAIS MENSAIS (dividir por 4 semanas)
    const weekMonth = new Date(week_start);
    const monthStart = new Date(weekMonth.getFullYear(), weekMonth.getMonth(), 1);
    
    const { data: operationalCosts } = await supabase
      .from('operational_costs')
      .select('*')
      .eq('month', monthStart.toISOString().split('T')[0]);

    const team_cost = (operationalCosts?.find(c => c.cost_type === 'team')?.amount || 0) / 4;
    const office_cost = (operationalCosts?.find(c => c.cost_type === 'office')?.amount || 0) / 4;

    // 3. BUSCAR TRANSAÇÕES HUBLA DA SEMANA
    const { data: hublaTransactions } = await supabase
      .from('hubla_transactions')
      .select('*')
      .gte('sale_date', week_start)
      .lte('sale_date', week_end)
      .eq('sale_status', 'completed');

    // Mapear produtos para categorias
    let a010_revenue = 0, a010_sales = 0;
    let ob_construir_revenue = 0, ob_construir_sales = 0;
    let ob_vitalicio_revenue = 0, ob_vitalicio_sales = 0;
    let ob_evento_revenue = 0, ob_evento_sales = 0;
    let contract_revenue = 0, contract_sales = 0;
    let incorporador_50k = 0;

    hublaTransactions?.forEach(t => {
      const name = t.product_name?.toLowerCase() || '';
      const category = t.product_category?.toLowerCase() || '';
      const price = t.product_price || 0;

      // A010
      if (name.includes('a010') || (category === 'curso' && name.includes('consultoria'))) {
        a010_revenue += price;
        a010_sales += 1;
      }
      // OB Construir
      else if (name.includes('construir para alugar') || name.includes('a005') || name.includes('a003')) {
        ob_construir_revenue += price;
        ob_construir_sales += 1;
      }
      // OB Vitalício
      else if (name.includes('vitalício') || name.includes('a006') || name.includes('a004')) {
        ob_vitalicio_revenue += price;
        ob_vitalicio_sales += 1;
      }
      // OB Evento (ajustar conforme produto correto)
      else if (name.includes('evento') || category === 'evento') {
        ob_evento_revenue += price;
        ob_evento_sales += 1;
      }
      // Contratos
      else if (category === 'contrato' || name.includes('contrato')) {
        contract_revenue += price;
        contract_sales += 1;
      }
      // Incorporador 50k
      if (name.includes('mcf incorporador') || name.includes('a001') || name.includes('a009')) {
        incorporador_50k += price;
      }
    });

    // 4. CALCULAR CLINT REVENUE (soma de todos)
    const clint_revenue = a010_revenue + ob_construir_revenue + ob_vitalicio_revenue + 
                          ob_evento_revenue + contract_revenue;

    // 5. CALCULAR MÉTRICAS DERIVADAS
    const total_revenue = clint_revenue;
    const operating_cost = ads_cost + team_cost + office_cost;
    const real_cost = operating_cost;
    const operating_profit = total_revenue - operating_cost;
    
    const roi = real_cost > 0 ? ((operating_profit / real_cost) * 100) : 0;
    const roas = ads_cost > 0 ? (total_revenue / ads_cost) : 0;
    const cpl = 0; // Será calculado quando tivermos leads
    const cplr = 0;
    const cir = ads_cost > 0 ? ((ads_cost / total_revenue) * 100) : 0;

    // Ultrametas
    const ultrameta_clint = clint_revenue * 0.3; // 30% do faturamento
    const ultrameta_liquido = ultrameta_clint - (operating_cost * 0.15); // 15% dos custos

    // 6. UPSERT EM WEEKLY_METRICS
    const { data, error } = await supabase
      .from('weekly_metrics')
      .upsert({
        start_date: week_start,
        end_date: week_end,
        week_label: `${week_start} - ${week_end}`,
        ads_cost,
        team_cost,
        office_cost,
        total_cost: operating_cost,
        operating_cost,
        real_cost,
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
        total_revenue,
        operating_profit,
        roi,
        roas,
        cpl,
        cplr,
        cir,
        ultrameta_clint,
        ultrameta_liquido,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'start_date,end_date'
      })
      .select();

    if (error) {
      console.error('❌ Erro ao salvar métricas:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Métricas calculadas:', data);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Métricas calculadas com sucesso',
        data 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro ao calcular métricas:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
