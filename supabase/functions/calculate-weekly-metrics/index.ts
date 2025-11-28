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
    const { data: dailyCosts, error: costsError } = await supabase
      .from('daily_costs')
      .select('*')
      .gte('date', week_start)
      .lte('date', week_end);

    if (costsError) {
      console.error('❌ Erro ao buscar custos:', costsError);
    }

    const ads_cost = dailyCosts?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;
    console.log(`💰 Custo de Ads: R$ ${ads_cost.toFixed(2)}`);

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
    const { data: hublaTransactions, error: hublaError } = await supabase
      .from('hubla_transactions')
      .select('*')
      .gte('sale_date', week_start)
      .lte('sale_date', week_end)
      .eq('sale_status', 'completed');

    if (hublaError) {
      console.error('❌ Erro ao buscar transações Hubla:', hublaError);
    }

    console.log(`📊 Transações Hubla encontradas: ${hublaTransactions?.length || 0}`);

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

      // PRIORIDADE 1: Category exata (MCF Incorporador, A005, A006)
      if (category === 'a010') {
        // MCF Incorporador (A001, A009) - vai para incorporador_50k E pode ir para outra categoria
        incorporador_50k += price;
        // Não adicionar em nenhuma outra categoria, pois é um produto específico
      } 
      else if (category === 'ob_construir') {
        // A005 - MCF P2
        ob_construir_revenue += price;
        ob_construir_sales += 1;
      } 
      else if (category === 'ob_vitalicio') {
        // A006 - Renovação Parceiro MCF
        ob_vitalicio_revenue += price;
        ob_vitalicio_sales += 1;
      }
      else if (category === 'contrato') {
        // A000 - Contrato
        contract_revenue += price;
        contract_sales += 1;
      }
      // PRIORIDADE 2: Category 'curso' - verificar pelo nome
      else if (category === 'curso') {
        if (name.includes('a010') || name.includes('consultoria')) {
          a010_revenue += price;
          a010_sales += 1;
        } else if (name.includes('construir para alugar') || name.includes('construir pra alugar')) {
          ob_construir_revenue += price;
          ob_construir_sales += 1;
        }
      }
      // PRIORIDADE 3: Category 'outros' - verificar pelo nome
      else if (category === 'outros') {
        if (name.includes('vitalício') || name.includes('vitalicio') || name.includes('acesso vitalic')) {
          ob_vitalicio_revenue += price;
          ob_vitalicio_sales += 1;
        } else if (name.includes('imersão') || name.includes('imersao') || name.includes('evento')) {
          ob_evento_revenue += price;
          ob_evento_sales += 1;
        } else if (name.includes('efeito alavanca')) {
          // Efeito Alavanca não entra em nenhuma categoria específica
          // Mas conta para o total
        }
      }
    });

    console.log(`💵 Faturamento A010: R$ ${a010_revenue.toFixed(2)} (${a010_sales} vendas)`);
    console.log(`💵 Faturamento Contratos: R$ ${contract_revenue.toFixed(2)} (${contract_sales} vendas)`);
    console.log(`💵 Faturamento OB Construir: R$ ${ob_construir_revenue.toFixed(2)} (${ob_construir_sales} vendas)`);
    console.log(`💵 Faturamento OB Vitalício: R$ ${ob_vitalicio_revenue.toFixed(2)} (${ob_vitalicio_sales} vendas)`);
    console.log(`💵 Faturamento OB Evento: R$ ${ob_evento_revenue.toFixed(2)} (${ob_evento_sales} vendas)`);
    console.log(`💵 Incorporador 50k: R$ ${incorporador_50k.toFixed(2)}`);

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
