import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Hubla platform fee (5.83%)
const HUBLA_PLATFORM_FEE = 0.0583;
const HUBLA_NET_MULTIPLIER = 1 - HUBLA_PLATFORM_FEE; // 0.9417

// Produtos que ENTRAM no Incorporador 50k (CORRIGIDO - validado contra planilha)
// A005 (P2), A002, A004, A006, A008 EXCLUÍDOS
const INCORPORADOR_50K_PRODUCTS = ['A000', 'A001', 'A003', 'A009'];

// Mapeamento de preços fixos (BRUTO) para Incorporador 50k
const INCORPORADOR_PRODUCT_PRICES: Record<string, number> = {
  'A001': 14500,  // MCF INCORPORADOR COMPLETO
  'A003': 7503,   // MCF Plano Anticrise Completo
  'A009': 19500,  // MCF INCORPORADOR COMPLETO + THE CLUB
  'SÓCIO JANTAR': 297,
  'SOCIO JANTAR': 297,
  'CONTRATO - ANTICRISE': 249,
  'CONTRATO-ANTICRISE': 249,
  // A000 (Contrato) = preço variável, usar product_price
};

// Produtos EXCLUÍDOS do Incorporador
const EXCLUDED_PRODUCT_NAMES = [
  'A005', 'A006', 'A010', 'A002', 'A004', 'A008',
  'IMERSÃO SÓCIOS', 'IMERSAO SOCIOS',
  'EFEITO ALAVANCA', 'CLUBE DO ARREMATE', 'CLUBE ARREMATE'
];

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
  'contrato': 'contract',
};

// Converter data UTC para data no fuso BR (America/Sao_Paulo)
function toSaoPauloDateString(utcDateStr: string): string {
  const date = new Date(utcDateStr);
  // São Paulo é UTC-3 (sem horário de verão atualmente)
  const offset = -3 * 60; // offset em minutos
  const localDate = new Date(date.getTime() + offset * 60 * 1000);
  return localDate.toISOString().split('T')[0];
}

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
const RECO_VALUE_THRESHOLD = 20;

// Extrair valor líquido do seller dos receivers
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
  
  if (installment !== null && installment > 1) {
    return false;
  }
  
  const sellerNetValue = extractSellerNetValue(transaction);
  if (sellerNetValue !== null && sellerNetValue < RECO_VALUE_THRESHOLD) {
    return false;
  }
  
  return true;
}

// Verificar se é uma transação de Order Bump (offer)
function isOfferTransaction(transaction: any): boolean {
  const hublaId = transaction.hubla_id || '';
  return hublaId.includes('-offer-');
}

function parseValorLiquido(transaction: any): number {
  const sellerNetValue = extractSellerNetValue(transaction);
  if (sellerNetValue !== null && sellerNetValue > 0) {
    return sellerNetValue;
  }
  
  const valorLiquidoStr = transaction.raw_data?.['Valor Líquido'];
  if (valorLiquidoStr) {
    const cleaned = String(valorLiquidoStr).replace(/[^\d.,-]/g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  }
  
  return (transaction.product_price || 0) * HUBLA_NET_MULTIPLIER;
}

// Extrair valor bruto do produto
function parseValorBruto(transaction: any): number {
  const rawData = transaction.raw_data;
  
  // Tentar "Valor do produto" do CSV
  if (rawData?.['Valor do produto']) {
    const valorStr = String(rawData['Valor do produto']);
    return parseFloat(valorStr.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
  }
  
  // Tentar subtotalCents do webhook
  if (rawData?.event?.invoice?.amount?.subtotalCents) {
    return rawData.event.invoice.amount.subtotalCents / 100;
  }
  
  // Fallback: usar product_price
  return transaction.product_price || 0;
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
    console.log(`💰 Custo de Ads: R$ ${ads_cost.toFixed(2)} (${dailyCosts?.length || 0} dias)`);

    // CORREÇÃO: Buscar custos operacionais mensais do mês correspondente
    const weekStartDate = new Date(week_start);
    const monthStart = `${weekStartDate.getFullYear()}-${String(weekStartDate.getMonth() + 1).padStart(2, '0')}-01`;
    
    const { data: operationalCosts } = await supabase
      .from('operational_costs')
      .select('*')
      .eq('month', monthStart);
    
    const team_cost_monthly = operationalCosts?.find(c => c.cost_type === 'team')?.amount || 0;
    const office_cost_monthly = operationalCosts?.find(c => c.cost_type === 'office')?.amount || 0;
    
    // Dividir por 4 para obter custo semanal
    const team_cost = team_cost_monthly / 4;
    const office_cost = office_cost_monthly / 4;
    
    console.log(`💼 Custos Operacionais Mensais: Equipe R$ ${team_cost_monthly.toFixed(2)} + Escritório R$ ${office_cost_monthly.toFixed(2)}`);
    console.log(`💼 Custos Operacionais Semanais: Equipe R$ ${team_cost.toFixed(2)} + Escritório R$ ${office_cost.toFixed(2)}`);

    // 2. BUSCAR TRANSAÇÕES HUBLA DA SEMANA
    // CORREÇÃO: Buscar com margem para timezone e filtrar por data BR depois
    const startDateUTC = new Date(`${week_start}T00:00:00Z`);
    startDateUTC.setHours(startDateUTC.getHours() - 6); // Margem de segurança
    
    const endDateUTC = new Date(`${week_end}T23:59:59Z`);
    endDateUTC.setHours(endDateUTC.getHours() + 6); // Margem de segurança
    
    const { data: allTransactions } = await supabase
      .from('hubla_transactions')
      .select('*')
      .gte('sale_date', startDateUTC.toISOString())
      .lte('sale_date', endDateUTC.toISOString());

    // Filtrar por data BR (America/Sao_Paulo)
    const completedTransactions = (allTransactions || []).filter(t => {
      if (t.sale_status !== 'completed') return false;
      const saleDateBR = toSaoPauloDateString(t.sale_date);
      return saleDateBR >= week_start && saleDateBR <= week_end;
    });

    const refundedTransactions = (allTransactions || []).filter(t => {
      if (t.sale_status === 'refunded' || t.event_type === 'invoice.refunded') {
        const saleDateBR = toSaoPauloDateString(t.sale_date);
        return saleDateBR >= week_start && saleDateBR <= week_end;
      }
      return false;
    });

    console.log(`📊 Vendas Hubla: ${completedTransactions?.length || 0} | Reembolsos: ${refundedTransactions?.length || 0}`);

    // 3. CONTAR VENDAS A010 - CORREÇÃO FINAL:
    // - Contar TODAS as transações A010 (sem deduplicar por email)
    // - Incluir transações com sale_status 'completed' E 'refunded'
    // - Cada linha/transação = 1 venda (conforme planilha do usuário)
    const allA010Transactions = (allTransactions || []).filter(t => {
      const saleDateBR = toSaoPauloDateString(t.sale_date);
      if (saleDateBR < week_start || saleDateBR > week_end) return false;
      
      // Incluir completed E refunded
      if (t.sale_status !== 'completed' && t.sale_status !== 'refunded') return false;
      
      const productName = (t.product_name || '').toUpperCase();
      const isA010 = t.product_category === 'a010' || productName.includes('A010');
      
      if (!isA010) return false;
      
      // Requer customer_name ou customer_email válido
      const hasCustomer = (t.customer_name || '').trim() || (t.customer_email || '').trim();
      if (!hasCustomer) return false;
      
      return true;
    });
    
    const vendas_a010 = allA010Transactions.length;
    
    // Faturado A010: soma do valor líquido de TODAS transações A010 completed (não refunded)
    const a010CompletedTransactions = allA010Transactions.filter(t => t.sale_status === 'completed');
    const faturado_a010 = a010CompletedTransactions.reduce((sum, t) => sum + parseValorLiquido(t), 0);
    
    console.log(`📈 Vendas A010: ${vendas_a010} transações (incluindo refunds)`);
    console.log(`📈 Faturado A010: R$ ${faturado_a010.toFixed(2)} (${a010CompletedTransactions.length} completed)`);

    // 4. FILTRAR TRANSAÇÕES DO INCORPORADOR 50K - CORREÇÃO FINAL
    // Apenas produtos: A000, A001, A003, A009
    // Exclui: A002, A004, A005, A006, A008, newsale- sem dados, -offer-
    const seenIncorporadorBrutoIds = new Set<string>();
    const incorporadorBrutoTransactions = completedTransactions.filter(t => {
      const hublaId = t.hubla_id || '';
      const productName = (t.product_name || '').toUpperCase();
      
      // Excluir -offer- (são Order Bumps)
      if (hublaId.includes('-offer-')) return false;
      
      // Excluir newsale- sem customer_email ou customer_name
      if (hublaId.startsWith('newsale-') && (!t.customer_email || !t.customer_name)) return false;
      
      // Verificar se é produto Incorporador válido
      const isIncorporador = INCORPORADOR_50K_PRODUCTS.some(code => productName.startsWith(code));
      const isExcluded = EXCLUDED_PRODUCT_NAMES.some(name => productName.includes(name.toUpperCase()));
      
      if (!isIncorporador || isExcluded) return false;
      
      // Apenas primeira parcela para BRUTO
      const isFirst = isFirstInstallment(t);
      if (!isFirst) return false;
      
      // Deduplicar por hubla_id
      if (seenIncorporadorBrutoIds.has(hublaId)) return false;
      seenIncorporadorBrutoIds.add(hublaId);
      
      return true;
    });

    // FATURAMENTO CLINT (BRUTO) - usar Valor do produto
    const faturamento_clint = incorporadorBrutoTransactions.reduce((sum, t) => {
      return sum + parseValorBruto(t);
    }, 0);

    console.log(`💼 Faturamento Clint (bruto): R$ ${faturamento_clint.toFixed(2)} (${incorporadorBrutoTransactions.length} vendas)`);

    // INCORPORADOR 50K (LÍQUIDO) - CORREÇÃO FINAL
    // Incluir todas parcelas pagas, mas excluir transações inválidas
    const seenIncorporadorLiqIds = new Set<string>();
    const incorporador50kTransactions = completedTransactions.filter(t => {
      const hublaId = t.hubla_id || '';
      const productName = (t.product_name || '').toUpperCase();
      
      // Excluir -offer- (são Order Bumps)
      if (hublaId.includes('-offer-')) return false;
      
      // Excluir newsale- sem customer_email ou customer_name
      if (hublaId.startsWith('newsale-') && (!t.customer_email || !t.customer_name)) return false;
      
      // Excluir transações com net_value = 0 ou NULL
      const netValue = parseValorLiquido(t);
      if (!netValue || netValue <= 0) return false;
      
      // Verificar se é produto Incorporador válido
      const isIncorporador = INCORPORADOR_50K_PRODUCTS.some(code => productName.startsWith(code));
      const isExcluded = EXCLUDED_PRODUCT_NAMES.some(name => productName.includes(name.toUpperCase()));
      
      if (!isIncorporador || isExcluded) return false;
      
      // Deduplicar por hubla_id
      if (seenIncorporadorLiqIds.has(hublaId)) return false;
      seenIncorporadorLiqIds.add(hublaId);
      
      return true;
    });
    
    const incorporador_50k = incorporador50kTransactions.reduce((sum, t) => sum + parseValorLiquido(t), 0);

    console.log(`💰 Incorporador 50k (líquido): R$ ${incorporador_50k.toFixed(2)} (${incorporador50kTransactions.length} transações)`);

    // 5. CALCULAR ORDER BUMPS (APENAS transações -offer-)
    const ob_construir_alugar_transactions = completedTransactions.filter(t => {
      if (!isOfferTransaction(t)) return false;
      const category = t.product_category?.toLowerCase() || '';
      const productName = (t.product_name || '').toUpperCase();
      return category === 'ob_construir_alugar' || 
             productName.includes('CONSTRUIR PARA ALUGAR') ||
             productName.includes('VIVER DE ALUGUEL');
    });
    
    const ob_vitalicio_transactions = completedTransactions.filter(t => {
      if (!isOfferTransaction(t)) return false;
      const category = t.product_category?.toLowerCase() || '';
      const productName = (t.product_name || '').toUpperCase();
      return category === 'ob_vitalicio' || productName.includes('ACESSO VITALIC');
    });
    
    const ob_evento_transactions = completedTransactions.filter(t => {
      if (!isOfferTransaction(t)) return false;
      const productName = (t.product_name || '').toUpperCase();
      const normalizedName = productName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const price = t.product_price || 0;
      return normalizedName.includes('IMERSAO PRESENCIAL') && price <= 300;
    });
    
    const ob_construir_vender_transactions = completedTransactions.filter(t => {
      if (!isOfferTransaction(t)) return false;
      return t.product_category === 'ob_construir_vender';
    });

    const ob_construir_alugar = ob_construir_alugar_transactions.reduce((sum, t) => sum + parseValorLiquido(t), 0);
    const ob_vitalicio = ob_vitalicio_transactions.reduce((sum, t) => sum + parseValorLiquido(t), 0);
    const ob_evento = ob_evento_transactions.reduce((sum, t) => sum + parseValorLiquido(t), 0);
    const ob_construir_vender = ob_construir_vender_transactions.reduce((sum, t) => sum + parseValorLiquido(t), 0);

    const ob_construir_alugar_sales = ob_construir_alugar_transactions.length;
    const ob_vitalicio_sales = ob_vitalicio_transactions.length;
    const ob_evento_sales = ob_evento_transactions.length;
    const ob_construir_vender_sales = ob_construir_vender_transactions.length;

    console.log(`📦 OB Construir Alugar: ${ob_construir_alugar_sales} vendas, R$ ${ob_construir_alugar.toFixed(2)}`);
    console.log(`📦 OB Vitalício: ${ob_vitalicio_sales} vendas, R$ ${ob_vitalicio.toFixed(2)}`);
    console.log(`📦 OB Evento: ${ob_evento_sales} vendas, R$ ${ob_evento.toFixed(2)}`);

    // 6. CALCULAR RECEITAS POR CATEGORIA
    const revenueByCategory: Record<string, { revenue: number; sales: number }> = {};
    
    REVENUE_CATEGORIES.forEach(cat => {
      revenueByCategory[cat] = { revenue: 0, sales: 0 };
    });

    completedTransactions?.forEach(t => {
      const category = t.product_category?.toLowerCase() || 'outros';
      const netValue = parseValorLiquido(t);
      
      if (revenueByCategory[category]) {
        revenueByCategory[category].revenue += netValue;
        revenueByCategory[category].sales += 1;
      }
    });

    // 7. CALCULAR ULTRAMETAS
    const ultrameta_clint = vendas_a010 * 1680;
    const ultrameta_liquido = vendas_a010 * 1400;

    console.log(`🎯 Ultrameta Clint: R$ ${ultrameta_clint.toFixed(2)} (${vendas_a010} vendas × R$ 1.680)`);
    console.log(`🎯 Ultrameta Líquido: R$ ${ultrameta_liquido.toFixed(2)} (${vendas_a010} vendas × R$ 1.400)`);

    // 8. CALCULAR FATURAMENTO TOTAL - CORREÇÃO:
    // Faturamento Total = Incorporador 50k + OB Acesso Vitalício + OB Construir Para Alugar + Faturado A010
    const faturamento_total = incorporador_50k + ob_vitalicio + ob_construir_alugar + faturado_a010;

    console.log(`💵 Faturamento Total: R$ ${faturamento_total.toFixed(2)} (Inc50k: ${incorporador_50k.toFixed(2)} + OBVit: ${ob_vitalicio.toFixed(2)} + OBAlug: ${ob_construir_alugar.toFixed(2)} + A010: ${faturado_a010.toFixed(2)})`);

    // 9. CALCULAR FATURADO CONTRATO
    const contractTransactions = completedTransactions.filter(t => {
      const productName = (t.product_name || '').toUpperCase();
      const isA000Contrato = productName.includes('A000') && productName.includes('CONTRATO');
      const isAnticrise = productName.includes('ANTICRISE');
      return isA000Contrato || isAnticrise;
    });
    
    const contract_revenue = contractTransactions.reduce((sum, t) => sum + parseValorLiquido(t), 0);
    const contract_sales = contractTransactions.length;
    
    console.log(`📋 Faturado Contrato: ${contract_sales} vendas, R$ ${contract_revenue.toFixed(2)}`);

    // 10. CALCULAR CUSTO REAL
    const custo_real = ads_cost - (faturado_a010 + ob_construir_alugar + ob_vitalicio + ob_evento + ob_construir_vender);

    // 11. CALCULAR MÉTRICAS DERIVADAS - CORREÇÃO FINAL:
    // Custo Total = Gastos Ads + (Team + Office) / 4
    const operating_cost = ads_cost + team_cost + office_cost;
    const lucro_operacional = faturamento_total - operating_cost;
    
    // ROI = Faturamento Incorporador / Custo Total * 100
    const roi = operating_cost > 0 ? (incorporador_50k / operating_cost) * 100 : 0;
    
    // ROAS = Faturamento Total / Gastos Ads (se Ads > 0)
    const roas = ads_cost > 0 ? (faturamento_total / ads_cost) : 0;
    
    // CIR = Custo Real / Incorporador 50k * 100
    const cir = incorporador_50k > 0 ? (custo_real / incorporador_50k) * 100 : 0;
    
    // CPL = Gastos Ads / Vendas A010
    const cpl = vendas_a010 > 0 ? (ads_cost / vendas_a010) : 0;
    
    // CPLR = Custo Real / Vendas A010
    const cplr = vendas_a010 > 0 ? (custo_real / vendas_a010) : 0;

    console.log(`📊 Custo Total: R$ ${operating_cost.toFixed(2)} (Ads: ${ads_cost.toFixed(2)} + Op: ${(team_cost + office_cost).toFixed(2)})`);
    console.log(`📊 CPL: R$ ${cpl.toFixed(2)}`);
    console.log(`📊 ROI: ${roi.toFixed(2)}%`);
    console.log(`📊 ROAS: ${roas.toFixed(2)}`);
    console.log(`📊 Lucro: R$ ${lucro_operacional.toFixed(2)}`);

    // 12. PREPARAR DADOS PARA UPSERT
    const gross_revenue = completedTransactions.reduce((sum, t) => sum + (t.product_price || 0), 0);
    const net_revenue = faturamento_total;
    const platform_fees = gross_revenue - net_revenue;
    const refunds_amount = refundedTransactions.reduce((sum, t) => sum + (t.product_price || 0), 0);

    const metricsData: any = {
      start_date: week_start,
      end_date: week_end,
      week_label: `${week_start} - ${week_end}`,
      
      ads_cost,
      team_cost,
      office_cost,
      total_cost: operating_cost,
      operating_cost,
      real_cost: custo_real,
      
      faturamento_clint,
      incorporador_50k,
      faturamento_total,
      a010_sales: vendas_a010,
      a010_revenue: faturado_a010,
      custo_real,
      cpl,
      cplr,
      
      ob_construir_alugar_revenue: ob_construir_alugar,
      ob_construir_alugar_sales,
      ob_vitalicio_revenue: ob_vitalicio,
      ob_vitalicio_sales,
      ob_evento_revenue: ob_evento,
      ob_evento_sales,
      ob_construir_revenue: ob_construir_vender,
      ob_construir_sales: ob_construir_vender_sales,
      
      contract_revenue,
      contract_sales,
      
      clint_revenue: faturamento_clint,
      total_revenue: faturamento_total,
      operating_profit: lucro_operacional,
      roi,
      roas,
      cir,
      ultrameta_clint,
      ultrameta_liquido,
      
      updated_at: new Date().toISOString(),
    };

    REVENUE_CATEGORIES.forEach(cat => {
      const { revenue, sales } = revenueByCategory[cat];
      const columnName = COLUMN_NAME_MAP[cat] || cat;
      metricsData[`${columnName}_revenue`] = revenue;
      metricsData[`${columnName}_sales`] = sales;
    });

    metricsData.contract_revenue = contract_revenue;
    metricsData.contract_sales = contract_sales;
    metricsData.a010_sales = vendas_a010;
    metricsData.a010_revenue = faturado_a010;
    metricsData.ob_construir_alugar_revenue = ob_construir_alugar;
    metricsData.ob_construir_alugar_sales = ob_construir_alugar_sales;
    metricsData.ob_vitalicio_revenue = ob_vitalicio;
    metricsData.ob_vitalicio_sales = ob_vitalicio_sales;

    // 13. UPSERT EM WEEKLY_METRICS
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
          cpl: `R$ ${cpl.toFixed(2)}`,
          cplr: `R$ ${cplr.toFixed(2)}`,
          roi: `${roi.toFixed(2)}%`,
          roas: roas.toFixed(2),
          operating_cost: `R$ ${operating_cost.toFixed(2)}`,
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
