import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Hubla platform fee (5.83%)
const HUBLA_PLATFORM_FEE = 0.0583;
const HUBLA_NET_MULTIPLIER = 1 - HUBLA_PLATFORM_FEE; // 0.9417

// Produtos que ENTRAM no Incorporador 50k (apenas códigos A00x específicos)
const INCORPORADOR_50K_PRODUCTS = ['A000', 'A001', 'A002', 'A003', 'A004', 'A005', 'A006', 'A008', 'A009'];

// Mapeamento de preços fixos (BRUTO) para Incorporador 50k
const INCORPORADOR_PRODUCT_PRICES: Record<string, number> = {
  'A001': 14500,  // MCF INCORPORADOR COMPLETO
  'A002': 14000,  // MCF INCORPORADOR BÁSICO
  'A003': 7503,   // MCF Plano Anticrise Completo
  'A004': 5503,   // MCF Plano Anticrise Básico
  'A006': 2997,   // Renovação Parceiro MCF
  'A009': 19500,  // MCF INCORPORADOR COMPLETO + THE CLUB
  'SÓCIO JANTAR': 297,
  'SOCIO JANTAR': 297,
  'CONTRATO - ANTICRISE': 249,
  'CONTRATO-ANTICRISE': 249,
  // A000 (Contrato), A005 (P2), A008 (The Club) = preço variável, usar product_price
};

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

// Extrair smartInstallment do raw_data
function getSmartInstallment(transaction: any): { installment: number | null; installments: number | null } {
  const rawData = transaction.raw_data;
  const invoice = rawData?.event?.invoice || rawData?.invoice;
  const smartInstallment = invoice?.smartInstallment;
  
  if (!smartInstallment) {
    return { installment: null, installments: null };
  }
  
  return {
    installment: smartInstallment.installment || null,
    installments: smartInstallment.installments || null,
  };
}

// Limite para identificar recorrência baseado no valor líquido do seller
const RECO_VALUE_THRESHOLD = 20; // R$ 20 - valores abaixo são recorrências

// Extrair valor líquido do seller dos receivers (movido para cima)
function extractSellerNetValue(transaction: any): number | null {
  const rawData = transaction.raw_data;
  const invoice = rawData?.event?.invoice || rawData?.invoice;
  const receivers = invoice?.receivers || [];
  const sellerReceiver = receivers.find((r: any) => r.role === 'seller');
  if (sellerReceiver?.totalCents) {
    return sellerReceiver.totalCents / 100;
  }
  return null;
}

// Verificar se é primeira parcela (não é recorrência)
function isFirstInstallment(transaction: any): boolean {
  const { installment } = getSmartInstallment(transaction);
  
  // Se tem smartInstallment e não é parcela 1 = recorrência
  if (installment !== null && installment > 1) {
    return false;
  }
  
  // Fallback: verificar pelo valor líquido do seller (RECO tem valor baixo < R$20)
  const sellerNetValue = extractSellerNetValue(transaction);
  if (sellerNetValue !== null && sellerNetValue < RECO_VALUE_THRESHOLD) {
    return false; // Valor muito baixo = recorrência
  }
  
  return true; // É venda nova
}

// Verificar se a transação é um "container" (tem childInvoiceIds = compra principal com OBs)
function isContainerTransaction(transaction: any): boolean {
  const rawData = transaction.raw_data;
  const invoice = rawData?.event?.invoice || rawData?.invoice;
  const childInvoiceIds = invoice?.childInvoiceIds || [];
  
  // É container se NÃO é offer E tem childInvoiceIds
  const hublaId = transaction.hubla_id || '';
  const isOffer = hublaId.includes('-offer-');
  
  return !isOffer && Array.isArray(childInvoiceIds) && childInvoiceIds.length > 0;
}

// Verificar se é uma transação de Order Bump (offer)
function isOfferTransaction(transaction: any): boolean {
  const hublaId = transaction.hubla_id || '';
  return hublaId.includes('-offer-');
}

function parseValorLiquido(transaction: any): number {
  // Primeiro, tentar extrair valor líquido do seller dos receivers
  const sellerNetValue = extractSellerNetValue(transaction);
  if (sellerNetValue !== null && sellerNetValue > 0) {
    return sellerNetValue;
  }
  
  // Fallback: Usar Valor Líquido do Hubla se disponível no raw_data (formato antigo)
  const valorLiquidoStr = transaction.raw_data?.['Valor Líquido'];
  if (valorLiquidoStr) {
    const cleaned = String(valorLiquidoStr).replace(/[^\d.,-]/g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  }
  
  // Último fallback: calcular baseado no product_price
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

    // 2. CUSTOS OPERACIONAIS - apenas ads_cost (simplificado)
    const team_cost = 0;
    const office_cost = 0;

    // 3. BUSCAR TRANSAÇÕES HUBLA DA SEMANA (VENDAS CONFIRMADAS - ambos event_type)
    const { data: completedTransactions } = await supabase
      .from('hubla_transactions')
      .select('*')
      .gte('sale_date', `${week_start}T00:00:00Z`)
      .lt('sale_date', `${week_end}T23:59:59Z`)
      .in('event_type', ['invoice.payment_succeeded', 'NewSale'])
      .eq('sale_status', 'completed');

    // 4. BUSCAR REEMBOLSOS DA SEMANA (APENAS PARA INFORMAÇÃO)
    const { data: refundedTransactions } = await supabase
      .from('hubla_transactions')
      .select('*')
      .gte('sale_date', `${week_start}T00:00:00Z`)
      .lt('sale_date', `${week_end}T23:59:59Z`)
      .eq('event_type', 'invoice.refunded');

    console.log(`📊 Vendas Hubla: ${completedTransactions?.length || 0} | Reembolsos: ${refundedTransactions?.length || 0}`);

    // 5. CONTAR VENDAS A010 (APENAS PRIMEIRA PARCELA - excluir offers e containers)
    // IMPORTANTE: Excluir transações que são:
    //   - "-offer-" (são OBs, não A010 principal)
    //   - "containers" (transações com childInvoiceIds que só agrupam offers)
    // NOTA: newsale-* são válidas e devem ser contadas
    const a010AllTransactions = completedTransactions?.filter(t => {
      const productName = (t.product_name || '').toUpperCase();
      const isA010 = t.product_category === 'a010' || productName.includes('A010');
      
      // Excluir offers (são OBs vendidos junto com A010)
      if (isOfferTransaction(t)) return false;
      
      // Excluir containers (transações pai que agrupam offers)
      if (isContainerTransaction(t)) return false;
      
      return isA010;
    }) || [];
    
    // Filtrar apenas primeira parcela (não recorrência)
    const a010NewSales = a010AllTransactions.filter(t => isFirstInstallment(t));
    const a010Recurrences = a010AllTransactions.filter(t => !isFirstInstallment(t));
    
    // Contar também containers e offers excluídos para log
    const a010Containers = completedTransactions?.filter(t => {
      const productName = (t.product_name || '').toUpperCase();
      const isA010 = t.product_category === 'a010' || productName.includes('A010');
      return isA010 && isContainerTransaction(t);
    }) || [];
    const a010Offers = completedTransactions?.filter(t => {
      const productName = (t.product_name || '').toUpperCase();
      const isA010 = t.product_category === 'a010' || productName.includes('A010');
      return isA010 && isOfferTransaction(t);
    }) || [];
    
    const vendas_a010 = a010NewSales.length;
    const faturado_a010 = a010NewSales.reduce((sum, t) => sum + parseValorLiquido(t), 0);
    const a010_reco_revenue = a010Recurrences.reduce((sum, t) => sum + parseValorLiquido(t), 0);
    
    console.log(`📈 Vendas A010: ${vendas_a010} novas vendas`);
    console.log(`   ├─ Recorrências excluídas: ${a010Recurrences.length}`);
    console.log(`   ├─ Containers excluídos: ${a010Containers.length}`);
    console.log(`   └─ Offers excluídos: ${a010Offers.length}`);
    console.log(`📈 Faturado A010: R$ ${faturado_a010.toFixed(2)} (RECO: R$ ${a010_reco_revenue.toFixed(2)})`);

    // 6. FILTRAR TRANSAÇÕES DO INCORPORADOR 50K (apenas produtos A000-A009, APENAS PRIMEIRA PARCELA)
    const incorporadorTransactions = completedTransactions?.filter(t => {
      const productName = (t.product_name || '').toUpperCase();
      // Verificar se começa com algum dos códigos válidos
      const isIncorporador = INCORPORADOR_50K_PRODUCTS.some(code => productName.startsWith(code));
      // Apenas primeira parcela
      return isIncorporador && isFirstInstallment(t);
    }) || [];
    
    // Também contar recorrências do Incorporador para log
    const incorporadorRecurrences = completedTransactions?.filter(t => {
      const productName = (t.product_name || '').toUpperCase();
      const isIncorporador = INCORPORADOR_50K_PRODUCTS.some(code => productName.startsWith(code));
      return isIncorporador && !isFirstInstallment(t);
    }) || [];

    console.log(`💼 Incorporador 50k: ${incorporadorTransactions.length} vendas novas (${incorporadorRecurrences.length} recorrências excluídas)`);

    // 7. CALCULAR MÉTRICAS INCORPORADOR 50K
    // Faturamento Clint (BRUTO) - usar preço fixo do mapeamento quando disponível
    const faturamento_clint = incorporadorTransactions.reduce((sum, t) => {
      const productName = (t.product_name || '').toUpperCase();
      
      // Tentar encontrar preço fixo no mapeamento
      let fixedPrice = 0;
      for (const [key, price] of Object.entries(INCORPORADOR_PRODUCT_PRICES)) {
        if (productName.includes(key.toUpperCase())) {
          fixedPrice = price;
          break;
        }
      }
      
      // Se encontrou preço fixo, usar; senão usar product_price (caso do A000, A005/P2, A008)
      const grossValue = fixedPrice > 0 ? fixedPrice : (t.product_price || 0);
      return sum + grossValue;
    }, 0);

    // Incorporador 50k (LÍQUIDO) - soma do valor líquido das parcelas (apenas vendas novas)
    const incorporador_50k = incorporadorTransactions.reduce(
      (sum, t) => sum + parseValorLiquido(t), 0);
    
    // Também somar recorrências do Incorporador para revenue total (mas não contam como vendas novas)
    const incorporador_reco_revenue = incorporadorRecurrences.reduce(
      (sum, t) => sum + parseValorLiquido(t), 0);

    console.log(`💼 Faturamento Clint (bruto): R$ ${faturamento_clint.toFixed(2)}`);
    console.log(`💰 Incorporador 50k (líquido novas vendas): R$ ${incorporador_50k.toFixed(2)}`);
    console.log(`💰 Incorporador 50k (líquido recorrências): R$ ${incorporador_reco_revenue.toFixed(2)}`);

    // 8. CALCULAR ORDER BUMPS (APENAS transações -offer- = OBs reais)
    // IMPORTANTE: OBs são SEMPRE transações com "-offer-" no hubla_id
    // Transações sem "-offer-" são vendas diretas do produto, NÃO order bumps
    
    const ob_construir_alugar_transactions = completedTransactions?.filter(t => {
      // DEVE ser uma transação -offer- para ser OB
      if (!isOfferTransaction(t)) return false;
      
      const category = t.product_category?.toLowerCase() || '';
      const productName = (t.product_name || '').toUpperCase();
      return category === 'ob_construir_alugar' || 
             productName.includes('CONSTRUIR PARA ALUGAR') ||
             productName.includes('VIVER DE ALUGUEL');
    }) || [];
    
    const ob_vitalicio_transactions = completedTransactions?.filter(t => {
      // DEVE ser uma transação -offer- para ser OB
      if (!isOfferTransaction(t)) return false;
      
      const category = t.product_category?.toLowerCase() || '';
      const productName = (t.product_name || '').toUpperCase();
      return category === 'ob_vitalicio' || 
             productName.includes('ACESSO VITALIC');
    }) || [];
    
    const ob_evento_transactions = completedTransactions?.filter(t => {
      // DEVE ser uma transação -offer- para ser OB
      if (!isOfferTransaction(t)) return false;
      
      const productName = (t.product_name || '').toUpperCase();
      // Normalizar removendo acentos para evitar problemas com IMERSÃO vs IMERSAO
      const normalizedName = productName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const price = t.product_price || 0;
      return normalizedName.includes('IMERSAO PRESENCIAL') && price <= 300;
    }) || [];
    
    const ob_construir_vender_transactions = completedTransactions?.filter(t => {
      // DEVE ser uma transação -offer- para ser OB
      if (!isOfferTransaction(t)) return false;
      return t.product_category === 'ob_construir_vender';
    }) || [];

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

    console.log(`📦 OB Construir Alugar: ${ob_construir_alugar_sales} vendas (offers), R$ ${ob_construir_alugar.toFixed(2)}`);
    console.log(`📦 OB Vitalício: ${ob_vitalicio_sales} vendas (offers), R$ ${ob_vitalicio.toFixed(2)}`);
    console.log(`📦 OB Evento: ${ob_evento_sales} vendas (offers), R$ ${ob_evento.toFixed(2)}`);
    console.log(`📦 OB Construir Vender: ${ob_construir_vender_sales} vendas (offers), R$ ${ob_construir_vender.toFixed(2)}`);

    // 9. CALCULAR RECEITAS POR CATEGORIA (TODAS AS 19)
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

    // 10. CALCULAR ULTRAMETAS (baseado em vendas A010 NOVAS, excluindo RECOs)
    const ultrameta_clint = vendas_a010 * 1680;
    const ultrameta_liquido = vendas_a010 * 1400;

    console.log(`🎯 Ultrameta Clint: R$ ${ultrameta_clint.toFixed(2)} (${vendas_a010} vendas × R$ 1.680)`);
    console.log(`🎯 Ultrameta Líquido: R$ ${ultrameta_liquido.toFixed(2)} (${vendas_a010} vendas × R$ 1.400)`);

    // 11. CALCULAR FATURAMENTO TOTAL (TODOS os valores líquidos da Hubla)
    const faturamento_total = completedTransactions?.reduce(
      (sum, t) => sum + parseValorLiquido(t), 0
    ) || 0;

    console.log(`💵 Faturamento Total: R$ ${faturamento_total.toFixed(2)}`);

    // 12. CALCULAR FATURADO CONTRATO (apenas A000-Contrato e Anticrise)
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

    // 13. CALCULAR CUSTO REAL (incluir todos OBs)
    const custo_real = ads_cost - (faturado_a010 + ob_construir_alugar + ob_vitalicio + ob_evento + ob_construir_vender);

    console.log(`💸 Custo Real: R$ ${custo_real.toFixed(2)}`);

    // 14. CALCULAR MÉTRICAS DERIVADAS (fórmulas corrigidas)
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

    // 15. PREPARAR DADOS PARA UPSERT
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
      clint_revenue: faturamento_clint, // Receita BRUTA Incorporador 50k (preço cheio)
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
    
    // IMPORTANTE: Sobrescrever a010_sales e a010_revenue com valores corrigidos
    // (excluindo containers e offers, apenas vendas diretas)
    metricsData.a010_sales = vendas_a010;
    metricsData.a010_revenue = faturado_a010;
    
    // IMPORTANTE: Sobrescrever OB values com os calculados corretamente
    // (apenas transações -offer-)
    metricsData.ob_construir_alugar_revenue = ob_construir_alugar;
    metricsData.ob_construir_alugar_sales = ob_construir_alugar_sales;
    metricsData.ob_vitalicio_revenue = ob_vitalicio;
    metricsData.ob_vitalicio_sales = ob_vitalicio_sales;

    // 16. UPSERT EM WEEKLY_METRICS
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
          a010_recorrencias_excluidas: a010Recurrences.length,
          faturado_a010,
          a010_reco_revenue,
          faturamento_clint,
          incorporador_50k,
          incorporador_recorrencias_excluidas: incorporadorRecurrences.length,
          incorporador_reco_revenue,
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
          ultrameta_clint,
          ultrameta_liquido,
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
