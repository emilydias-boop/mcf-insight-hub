import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Hubla platform fee (5.83%)
const HUBLA_PLATFORM_FEE = 0.0583;
const HUBLA_NET_MULTIPLIER = 1 - HUBLA_PLATFORM_FEE; // 0.9417

// Produtos que ENTRAM no Incorporador 50k (apenas códigos A00x específicos)
const INCORPORADOR_50K_PRODUCTS = ['A000', 'A001', 'A002', 'A003', 'A004', 'A008', 'A009'];

// Não precisa mais de lista de exclusões, pois estamos usando apenas códigos específicos

// Mapeamento completo de 19 categorias
const REVENUE_CATEGORIES = [
  'a010', 'captacao', 'contrato', 'parceria', 'p2', 'renovacao', 
  'formacao', 'projetos', 'efeito_alavanca', 'mentoria_caixa', 
  'mentoria_grupo_caixa', 'socios', 'ob_construir_alugar', 
  'ob_vitalicio', 'ob_evento', 'clube_arremate', 'imersao', 
  'imersao_socios', 'outros'
] as const;

// Mapeamento de categoria → nome da coluna (quando diferente)
const COLUMN_NAME_MAP: Record<string, string> = {
  'contrato': 'contract',  // tabela usa contract_revenue, não contrato_revenue
};

function parseValorLiquido(transaction: any): number {
  // Usar Valor Líquido do Hubla se disponível, senão calcular
  const valorLiquidoStr = transaction.raw_data?.['Valor Líquido'];
  if (valorLiquidoStr) {
    const cleaned = String(valorLiquidoStr).replace(/[^\d.,-]/g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  }
  return (transaction.product_price || 0) * HUBLA_NET_MULTIPLIER;
}

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

    // 3. BUSCAR TRANSAÇÕES HUBLA (para contar A010 depois)
    // Vendas A010 serão contadas a partir das transações Hubla

    // 4. BUSCAR TRANSAÇÕES HUBLA DA SEMANA (VENDAS CONFIRMADAS - ambos event_type)
    const { data: completedTransactions } = await supabase
      .from('hubla_transactions')
      .select('*')
      .gte('sale_date', `${week_start}T00:00:00Z`)
      .lt('sale_date', `${week_end}T23:59:59Z`)
      .in('event_type', ['invoice.payment_succeeded', 'NewSale'])
      .eq('sale_status', 'completed');

    // 5. BUSCAR REEMBOLSOS DA SEMANA (APENAS PARA INFORMAÇÃO)
    const { data: refundedTransactions } = await supabase
      .from('hubla_transactions')
      .select('*')
      .gte('sale_date', `${week_start}T00:00:00Z`)
      .lt('sale_date', `${week_end}T23:59:59Z`)
      .eq('event_type', 'invoice.refunded');

    console.log(`📊 Vendas Hubla: ${completedTransactions?.length || 0} | Reembolsos: ${refundedTransactions?.length || 0}`);

    // 6. CONTAR VENDAS A010 (faturas únicas da Hubla, não parcelas)
    const a010Transactions = completedTransactions?.filter(t => {
      const productName = (t.product_name || '').toUpperCase();
      return t.product_category === 'a010' || productName.includes('A010');
    }) || [];
    
    const vendas_a010 = a010Transactions.length;
    const faturado_a010 = a010Transactions.reduce((sum, t) => sum + parseValorLiquido(t), 0);
    
    console.log(`📈 Vendas A010: ${vendas_a010} vendas, R$ ${faturado_a010.toFixed(2)}`);

    // 7. FILTRAR TRANSAÇÕES DO INCORPORADOR 50K (apenas produtos A000-A004, A008, A009)
    const incorporadorTransactions = completedTransactions?.filter(t => {
      const productName = (t.product_name || '').toUpperCase();
      // Verificar se começa com algum dos códigos válidos
      return INCORPORADOR_50K_PRODUCTS.some(code => productName.startsWith(code));
    });

    // 8. CALCULAR MÉTRICAS INCORPORADOR 50K
    const faturamento_clint = incorporadorTransactions?.reduce(
      (sum, t) => sum + (t.product_price || 0), 0) || 0;

    const incorporador_50k = incorporadorTransactions?.reduce(
      (sum, t) => sum + parseValorLiquido(t), 0) || 0;

    console.log(`💼 Faturamento Clint (bruto): R$ ${faturamento_clint.toFixed(2)}`);
    console.log(`💰 Incorporador 50k (líquido): R$ ${incorporador_50k.toFixed(2)}`);

    // 9. CALCULAR ORDER BUMPS (incluir os que estão em 'outros')
    const ob_construir_alugar_transactions = completedTransactions?.filter(t => {
      const category = t.product_category?.toLowerCase() || '';
      const productName = (t.product_name || '').toUpperCase();
      return category === 'ob_construir_alugar' || 
             productName.includes('CONSTRUIR PARA ALUGAR') ||
             productName.includes('VIVER DE ALUGUEL');
    }) || [];
    
    const ob_vitalicio_transactions = completedTransactions?.filter(t => {
      const category = t.product_category?.toLowerCase() || '';
      const productName = (t.product_name || '').toUpperCase();
      return category === 'ob_vitalicio' || 
             productName.includes('ACESSO VITALIC');
    }) || [];
    
    const ob_evento_transactions = completedTransactions?.filter(t => {
      const productName = (t.product_name || '').toUpperCase();
      // Normalizar removendo acentos para evitar problemas com IMERSÃO vs IMERSAO
      const normalizedName = productName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const price = t.product_price || 0;
      return normalizedName.includes('IMERSAO PRESENCIAL') && price <= 300;
    }) || [];
    
    const ob_construir_vender_transactions = completedTransactions?.filter(t => 
      t.product_category === 'ob_construir_vender'
    ) || [];

    const ob_construir_alugar = ob_construir_alugar_transactions.reduce(
      (sum, t) => sum + parseValorLiquido(t), 0
    );
    
    const ob_vitalicio = ob_vitalicio_transactions.reduce(
      (sum, t) => sum + parseValorLiquido(t), 0
    );
    
    const ob_evento = ob_evento_transactions.reduce(
      (sum, t) => sum + parseValorLiquido(t), 0
    );
    
    const ob_construir_vender = ob_construir_vender_transactions.reduce(
      (sum, t) => sum + parseValorLiquido(t), 0
    );

    const ob_construir_alugar_sales = ob_construir_alugar_transactions.length;
    const ob_vitalicio_sales = ob_vitalicio_transactions.length;
    const ob_evento_sales = ob_evento_transactions.length;
    const ob_construir_vender_sales = ob_construir_vender_transactions.length;

    console.log(`📦 OB Construir Alugar: ${ob_construir_alugar_sales} vendas, R$ ${ob_construir_alugar.toFixed(2)}`);
    console.log(`📦 OB Vitalício: ${ob_vitalicio_sales} vendas, R$ ${ob_vitalicio.toFixed(2)}`);
    console.log(`📦 OB Evento: ${ob_evento_sales} vendas, R$ ${ob_evento.toFixed(2)}`);
    console.log(`📦 OB Construir Vender: ${ob_construir_vender_sales} vendas, R$ ${ob_construir_vender.toFixed(2)}`);

    // 10. CALCULAR RECEITAS POR CATEGORIA (TODAS AS 19)
    const revenueByCategory: Record<string, { revenue: number; sales: number }> = {};
    
    // Inicializar todas as categorias
    REVENUE_CATEGORIES.forEach(cat => {
      revenueByCategory[cat] = { revenue: 0, sales: 0 };
    });

    // Somar vendas completadas usando Valor Líquido real do Hubla
    completedTransactions?.forEach(t => {
      const category = t.product_category?.toLowerCase() || 'outros';
      const netValue = parseValorLiquido(t);
      
      if (revenueByCategory[category]) {
        revenueByCategory[category].revenue += netValue;
        revenueByCategory[category].sales += 1;
      }
    });

    // Log por categoria
    REVENUE_CATEGORIES.forEach(cat => {
      const { revenue, sales } = revenueByCategory[cat];
      if (revenue > 0) {
        console.log(`   ${cat}: R$ ${revenue.toFixed(2)} (${sales} vendas)`);
      }
    });

    // 11. CALCULAR ULTRAMETAS (baseado em vendas A010)
    const ultrameta_clint = vendas_a010 * 1680;
    const ultrameta_liquido = vendas_a010 * 1400;

    console.log(`🎯 Ultrameta Clint: R$ ${ultrameta_clint.toFixed(2)}`);
    console.log(`🎯 Ultrameta Líquido: R$ ${ultrameta_liquido.toFixed(2)}`);

    // 12. CALCULAR FATURAMENTO TOTAL (TODOS os valores líquidos da Hubla)
    const faturamento_total = completedTransactions?.reduce(
      (sum, t) => sum + parseValorLiquido(t), 0
    ) || 0;

    console.log(`💵 Faturamento Total: R$ ${faturamento_total.toFixed(2)}`);

    // 13. CALCULAR FATURADO CONTRATO (apenas A000-Contrato e Anticrise)
    // Incluir de TODAS as categorias (contrato, incorporador, etc)
    const contractTransactions = completedTransactions?.filter(t => {
      const productName = (t.product_name || '').toUpperCase();
      const isA000Contrato = productName.includes('A000') && productName.includes('CONTRATO');
      const isAnticrise = productName.includes('ANTICRISE');
      return isA000Contrato || isAnticrise;
    }) || [];
    
    const contract_revenue = contractTransactions.reduce(
      (sum, t) => sum + parseValorLiquido(t), 0
    );
    const contract_sales = contractTransactions.length;
    
    console.log(`📋 Faturado Contrato: ${contract_sales} vendas, R$ ${contract_revenue.toFixed(2)}`);

    // 14. CALCULAR CUSTO REAL (incluir todos OBs)
    const custo_real = ads_cost - (faturado_a010 + ob_construir_alugar + ob_vitalicio + ob_evento + ob_construir_vender);

    console.log(`💸 Custo Real: R$ ${custo_real.toFixed(2)}`);

    // 15. CALCULAR MÉTRICAS DERIVADAS (fórmulas corrigidas)
    const operating_cost = ads_cost + team_cost + office_cost;
    const lucro_operacional = faturamento_total - operating_cost;
    
    const roi = incorporador_50k > 0 ? (incorporador_50k / (incorporador_50k - lucro_operacional)) * 100 : 0;
    const cir = incorporador_50k > 0 ? (custo_real / incorporador_50k) * 100 : 0;
    const roas = ads_cost > 0 ? (faturamento_total / ads_cost) : 0;
    const cpl = vendas_a010 > 0 ? (ads_cost / vendas_a010) : 0;
    const cplr = vendas_a010 > 0 ? (custo_real / vendas_a010) : 0;

    console.log(`📊 ROI: ${roi.toFixed(2)}%`);
    console.log(`📊 CIR: ${cir.toFixed(2)}%`);
    console.log(`📊 ROAS: ${roas.toFixed(2)}`);
    console.log(`📊 CPL: R$ ${cpl.toFixed(2)}`);
    console.log(`📊 CPLR: R$ ${cplr.toFixed(2)}`);

    // Calcular gross revenue e platform fees para informação
    const gross_revenue = completedTransactions?.reduce((sum, t) => sum + (t.product_price || 0), 0) || 0;
    const net_revenue = completedTransactions?.reduce((sum, t) => sum + parseValorLiquido(t), 0) || 0;
    const platform_fees = gross_revenue - net_revenue;
    const refunds_amount = refundedTransactions?.reduce((sum, t) => sum + (t.product_price || 0), 0) || 0;

    // 16. PREPARAR DADOS PARA UPSERT
    const metricsData: any = {
      start_date: week_start,
      end_date: week_end,
      week_label: `${week_start} - ${week_end}`,
      
      // Custos
      ads_cost,
      team_cost,
      office_cost,
      total_cost: operating_cost,
      operating_cost,
      real_cost: custo_real,
      
      // Novas métricas
      faturamento_clint,
      incorporador_50k,
      faturamento_total,
      a010_sales: vendas_a010,
      a010_revenue: faturado_a010,
      custo_real,
      cpl,
      cplr,
      
      // Order Bumps separados
      ob_construir_alugar_revenue: ob_construir_alugar,
      ob_construir_alugar_sales: ob_construir_alugar_sales,
      ob_vitalicio_revenue: ob_vitalicio,
      ob_vitalicio_sales: ob_vitalicio_sales,
      ob_evento_revenue: ob_evento,
      ob_evento_sales: ob_evento_sales,
      ob_construir_revenue: ob_construir_vender,
      ob_construir_sales: ob_construir_vender_sales,
      
      // Contratos
      contract_revenue,
      contract_sales,
      
      // Métricas antigas (manter compatibilidade)
      clint_revenue: incorporador_50k, // Receita líquida Incorporador 50k
      total_revenue: faturamento_total,
      operating_profit: lucro_operacional,
      roi,
      roas,
      cir,
      ultrameta_clint,
      ultrameta_liquido,
      
      updated_at: new Date().toISOString(),
    };

    // Adicionar receitas por categoria (19 categorias)
    REVENUE_CATEGORIES.forEach(cat => {
      const { revenue, sales } = revenueByCategory[cat];
      const columnName = COLUMN_NAME_MAP[cat] || cat;
      metricsData[`${columnName}_revenue`] = revenue;
      metricsData[`${columnName}_sales`] = sales;
    });

    // IMPORTANTE: Sobrescrever contract_revenue com o valor calculado manualmente
    // (não usar o da categoria 'contrato' que vem de product_category)
    metricsData.contract_revenue = contract_revenue;
    metricsData.contract_sales = contract_sales;

    // 17. UPSERT EM WEEKLY_METRICS
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
          vendas_a010,
          faturado_a010,
          faturamento_clint,
          incorporador_50k,
          ob_construir_alugar,
          ob_construir_alugar_sales,
          ob_vitalicio,
          ob_vitalicio_sales,
          ob_evento,
          ob_evento_sales,
          ob_construir_vender,
          ob_construir_vender_sales,
          contract_revenue,
          contract_sales,
          faturamento_total,
          custo_real,
          gross_revenue,
          platform_fees,
          net_revenue,
          refunds_amount,
          lucro_operacional,
          roi: `${roi.toFixed(2)}%`,
          roas: roas.toFixed(2),
          cir: `${cir.toFixed(2)}%`,
          cpl: `R$ ${cpl.toFixed(2)}`,
          cplr: `R$ ${cplr.toFixed(2)}`,
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
