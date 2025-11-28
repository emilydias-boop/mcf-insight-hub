import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapeamento completo de 19 categorias
const REVENUE_CATEGORIES = [
  'a010', 'captacao', 'contrato', 'parceria', 'p2', 'renovacao', 
  'formacao', 'projetos', 'efeito_alavanca', 'mentoria_caixa', 
  'mentoria_grupo_caixa', 'socios', 'ob_construir_alugar', 
  'ob_vitalicio', 'ob_evento', 'clube_arremate', 'imersao', 
  'imersao_socios', 'outros'
] as const;

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

    // 3. BUSCAR TRANSAÇÕES HUBLA DA SEMANA (VENDAS COMPLETADAS)
    // Query corrigida com timezone UTC
    const { data: completedTransactions } = await supabase
      .from('hubla_transactions')
      .select('*')
      .gte('sale_date', `${week_start}T00:00:00Z`)
      .lt('sale_date', `${week_end}T23:59:59Z`)
      .eq('sale_status', 'completed');

    // 4. BUSCAR REEMBOLSOS DA SEMANA
    const { data: refundedTransactions } = await supabase
      .from('hubla_transactions')
      .select('*')
      .gte('sale_date', `${week_start}T00:00:00Z`)
      .lt('sale_date', `${week_end}T23:59:59Z`)
      .eq('sale_status', 'refunded');

    console.log(`📊 Vendas: ${completedTransactions?.length || 0} | Reembolsos: ${refundedTransactions?.length || 0}`);

    // 5. CALCULAR RECEITAS POR CATEGORIA
    const revenueByCategory: Record<string, { revenue: number; sales: number }> = {};
    
    // Inicializar todas as categorias
    REVENUE_CATEGORIES.forEach(cat => {
      revenueByCategory[cat] = { revenue: 0, sales: 0 };
    });

    // Somar vendas completadas
    completedTransactions?.forEach(t => {
      const category = t.product_category?.toLowerCase() || 'outros';
      const price = t.product_price || 0;
      
      if (revenueByCategory[category]) {
        revenueByCategory[category].revenue += price;
        revenueByCategory[category].sales += 1;
      }
    });

    // Calcular gross revenue (faturamento bruto)
    const gross_revenue = Object.values(revenueByCategory).reduce((sum, cat) => sum + cat.revenue, 0);

    // Calcular reembolsos
    const refunds = refundedTransactions?.reduce((sum, t) => sum + (t.product_price || 0), 0) || 0;

    // Calcular receita líquida (net revenue)
    const net_revenue = gross_revenue - refunds;

    console.log(`💵 Faturamento Bruto: R$ ${gross_revenue.toFixed(2)}`);
    console.log(`💸 Reembolsos: R$ ${refunds.toFixed(2)}`);
    console.log(`💰 Receita Líquida: R$ ${net_revenue.toFixed(2)}`);

    // Log por categoria
    REVENUE_CATEGORIES.forEach(cat => {
      const { revenue, sales } = revenueByCategory[cat];
      if (revenue > 0) {
        console.log(`   ${cat}: R$ ${revenue.toFixed(2)} (${sales} vendas)`);
      }
    });

    // 6. CALCULAR MÉTRICAS DERIVADAS (usar receita líquida)
    const total_revenue = net_revenue;
    const operating_cost = ads_cost + team_cost + office_cost;
    const real_cost = operating_cost;
    const operating_profit = total_revenue - operating_cost;
    
    const roi = real_cost > 0 ? ((operating_profit / real_cost) * 100) : 0;
    const roas = ads_cost > 0 ? (total_revenue / ads_cost) : 0;
    const cir = total_revenue > 0 ? ((ads_cost / total_revenue) * 100) : 0;

    // Ultrametas
    const ultrameta_clint = total_revenue * 0.3;
    const ultrameta_liquido = ultrameta_clint - (operating_cost * 0.15);

    // 7. PREPARAR DADOS PARA UPSERT
    const metricsData: any = {
      start_date: week_start,
      end_date: week_end,
      week_label: `${week_start} - ${week_end}`,
      ads_cost,
      team_cost,
      office_cost,
      total_cost: operating_cost,
      operating_cost,
      real_cost,
      clint_revenue: net_revenue, // Receita líquida
      total_revenue: net_revenue,
      operating_profit,
      roi,
      roas,
      cir,
      ultrameta_clint,
      ultrameta_liquido,
      updated_at: new Date().toISOString(),
    };

    // Adicionar receitas por categoria
    REVENUE_CATEGORIES.forEach(cat => {
      const { revenue, sales } = revenueByCategory[cat];
      metricsData[`${cat}_revenue`] = revenue;
      metricsData[`${cat}_sales`] = sales;
    });

    // 8. UPSERT EM WEEKLY_METRICS
    const { data, error } = await supabase
      .from('weekly_metrics')
      .upsert(metricsData, {
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

    console.log('✅ Métricas calculadas com sucesso!');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Métricas calculadas com sucesso',
        data,
        summary: {
          gross_revenue,
          refunds,
          net_revenue,
          operating_profit,
          roi: `${roi.toFixed(2)}%`,
          roas: roas.toFixed(2),
        }
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