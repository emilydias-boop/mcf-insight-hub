import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Hubla platform fee (5.83%)
const HUBLA_PLATFORM_FEE = 0.0583;
const HUBLA_NET_MULTIPLIER = 1 - HUBLA_PLATFORM_FEE; // 0.9417

// LISTA COMPLETA de produtos Incorporador 50k / Faturamento Clint
const INCORPORADOR_PRODUCT_PATTERNS = [
  '000 - PRÉ RESERVA', '000 - CONTRATO', '001- PRÉ-RESERVA', '003 - IMERSÃO SÓCIOS', '016-ANÁLISE',
  'A000 - CONTRATO', 'A000 - PRÉ-RESERVA', 'A001 - MCF', 'A001', 'A002 - MCF', 'A002',
  'A003 - MCF', 'A003', 'A004 - MCF', 'A004', 'A005 - ANTICRISE', 'A005 - MCF', 'A005',
  'A006 - ANTICRISE', 'A006', 'A007 - IMERSÃO', 'A007', 'A008 - THE CLUB', 'A008',
  'A009 - MCF', 'A009 - RENOVAÇÃO', 'A009', 'ASAAS', 'COBRANÇAS ASAAS',
  'CONTRATO ANTICRISE', 'CONTRATO - ANTICRISE', 'JANTAR NETWORKING',
  'R001 - INCORPORADOR', 'R001', 'R004 - INCORPORADOR', 'R004', 'R005 - ANTICRISE', 'R005',
  'R006 - ANTICRISE', 'R006', 'R009 - RENOVAÇÃO', 'R009', 'R21- MCF', 'R21',
  'SÓCIO JANTAR', 'SOCIO JANTAR',
];

// Produtos EXPLICITAMENTE EXCLUÍDOS
const EXCLUDED_PRODUCT_NAMES = [
  'A010', 'A011', 'A012', 'EFEITO ALAVANCA', 'CLUBE DO ARREMATE', 'CLUBE ARREMATE',
  'CONSTRUIR PARA ALUGAR', 'ACESSO VITALÍCIO', 'ACESSO VITALICIO', 'IMERSÃO PRESENCIAL',
];

// Mapeamento de 19 categorias
const REVENUE_CATEGORIES = [
  'a010', 'captacao', 'contrato', 'parceria', 'p2', 'renovacao', 
  'formacao', 'projetos', 'efeito_alavanca', 'mentoria_caixa', 
  'mentoria_grupo_caixa', 'socios', 'ob_construir_alugar', 
  'ob_vitalicio', 'ob_evento', 'clube_arremate', 'imersao', 
  'imersao_socios', 'outros'
] as const;

const COLUMN_NAME_MAP: Record<string, string> = {
  'contrato': 'contract',
};

// ============================================================================
// NOVA FUNÇÃO: Normalizar nome do produto para deduplicação
// ============================================================================
function normalizeProductName(productName: string): string {
  const name = (productName || '').toUpperCase().trim();
  
  // Normalizar produtos A00X
  if (name.includes('A009') || name.includes('INCORPORADOR') && name.includes('CLUB')) return 'A009_INCORPORADOR_CLUB';
  if (name.includes('A008') || name.includes('THE CLUB')) return 'A008_CLUB';
  if (name.includes('A007') || name.includes('IMERSAO') && !name.includes('PRESENCIAL')) return 'A007_IMERSAO';
  if (name.includes('A006')) return 'A006';
  if (name.includes('A005') || name.includes('ANTICRISE')) return 'A005_ANTICRISE';
  if (name.includes('A004')) return 'A004_BASICO';
  if (name.includes('A003')) return 'A003';
  if (name.includes('A002')) return 'A002_BASICO';
  if (name.includes('A001')) return 'A001_INCORPORADOR';
  if (name.includes('A000') || name.includes('CONTRATO') || name.includes('PRE-RESERVA') || name.includes('PRÉ-RESERVA')) return 'A000_CONTRATO';
  
  // Normalizar renovações
  if (name.includes('R009') || name.includes('R21') || name.includes('RENOVACAO') || name.includes('RENOVAÇÃO')) return 'RENOVACAO';
  if (name.includes('R001') || name.includes('R004') || name.includes('R005') || name.includes('R006')) return 'RENOVACAO';
  
  // Outros
  if (name.includes('ASAAS')) return 'ASAAS';
  if (name.includes('JANTAR')) return 'JANTAR';
  if (name.includes('SOCIOS') || name.includes('SÓCIOS')) return 'SOCIOS';
  
  return name.substring(0, 30);
}

// ============================================================================
// PREÇOS DE REFERÊNCIA (mesmos valores do frontend)
// A005/P2 NÃO tem valor fixo - usa product_price do banco
// ============================================================================
const PRECO_REFERENCIA: Record<string, number> = {
  'A009_INCORPORADOR_CLUB': 19500,
  'A008_CLUB': 5000,
  'A001_INCORPORADOR': 14500,
  'A002_BASICO': 7500,
  'A003': 7503,
  'A004_BASICO': 5503,
  'A000_CONTRATO': 497,
  // A005/P2 não entra - usa valor do banco
};

// Normaliza nome do produto para chave de deduplicação (email+produto)
function normalizeProductForDedup(productName: string): string {
  const upper = productName.toUpperCase();
  if (upper.includes('A009')) return 'A009_INCORPORADOR_CLUB';
  if (upper.includes('A008')) return 'A008_CLUB';
  if (upper.includes('A005') || upper.includes('P2')) return 'A005';
  if (upper.includes('A004')) return 'A004_BASICO';
  if (upper.includes('A003')) return 'A003';
  if (upper.includes('A002')) return 'A002_BASICO';
  if (upper.includes('A001')) return 'A001_INCORPORADOR';
  if (upper.includes('A000') || upper.includes('CONTRATO')) {
    if (upper.includes('ANTICRISE')) return 'CONTRATO_ANTICRISE';
    return 'A000_CONTRATO';
  }
  return upper.substring(0, 20);
}

// Obtém preço de referência ou usa valor do banco
function getPrecoReferencia(productName: string, productPriceFromDB: number): number {
  const normalizado = normalizeProductForDedup(productName);
  if (PRECO_REFERENCIA[normalizado]) {
    return PRECO_REFERENCIA[normalizado];
  }
  return productPriceFromDB;
}

// Converter data UTC para data no fuso BR (America/Sao_Paulo)
function toSaoPauloDateString(utcDateStr: string): string {
  const date = new Date(utcDateStr);
  const spTime = new Date(date.getTime() - (3 * 60 * 60 * 1000));
  const year = spTime.getUTCFullYear();
  const month = String(spTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(spTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

const RECO_VALUE_THRESHOLD = 20;

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

function isOfferTransaction(transaction: any): boolean {
  const hublaId = transaction.hubla_id || '';
  return hublaId.includes('-offer-');
}

function isIncorporadorProduct(productName: string): boolean {
  const upperName = productName.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  if (EXCLUDED_PRODUCT_NAMES.some(excl => upperName.includes(excl.toUpperCase()))) {
    return false;
  }
  
  return INCORPORADOR_PRODUCT_PATTERNS.some(pattern => {
    const upperPattern = pattern.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return upperName.includes(upperPattern) || upperName.startsWith(upperPattern.split(' ')[0]);
  });
}

function parseValorLiquido(transaction: any): number {
  const sellerNetValue = extractSellerNetValue(transaction);
  if (sellerNetValue !== null && sellerNetValue > 0) {
    return sellerNetValue;
  }
  
  if (transaction.net_value && transaction.net_value > 0) {
    return transaction.net_value;
  }
  
  const valorLiquidoStr = transaction.raw_data?.['Valor Líquido'];
  if (valorLiquidoStr) {
    const cleaned = String(valorLiquidoStr).replace(/[^\d.,-]/g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  }
  
  return (transaction.product_price || 0) * HUBLA_NET_MULTIPLIER;
}

function parseValorBruto(transaction: any): number {
  if (transaction.product_price && transaction.product_price > 0) {
    return transaction.product_price;
  }
  
  const rawData = transaction.raw_data;
  
  if (rawData?.['Valor do produto']) {
    const valorStr = String(rawData['Valor do produto']);
    return parseFloat(valorStr.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
  }
  
  return 0;
}

function isClintProduct(productName: string): boolean {
  const upperName = productName.toUpperCase();
  
  if (/^A00[0-9]/.test(upperName)) return true;
  if (upperName.startsWith('CONTRATO') || upperName.includes('CONTRATO')) return true;
  
  return false;
}

// ============================================================================
// NOVA FUNÇÃO: Deduplicar transações por email + produto normalizado
// Retorna: { forBruto: transações para faturamento bruto, forLiquido: todas }
// ============================================================================
function deduplicateTransactions(transactions: any[]): { forBruto: any[], forLiquido: any[] } {
  const groupedByEmailProduct = new Map<string, any[]>();
  
  // Agrupar por email + produto normalizado
  for (const tx of transactions) {
    const email = (tx.customer_email || '').toLowerCase().trim();
    if (!email) continue;
    
    const normalizedProduct = normalizeProductName(tx.product_name || '');
    const key = `${email}|${normalizedProduct}`;
    
    if (!groupedByEmailProduct.has(key)) {
      groupedByEmailProduct.set(key, []);
    }
    groupedByEmailProduct.get(key)!.push(tx);
  }
  
  // Para faturamento bruto: pegar transação com maior product_price de cada grupo
  const forBruto: any[] = [];
  for (const [key, txs] of groupedByEmailProduct.entries()) {
    // Ordenar por product_price descendente e pegar o primeiro
    const sorted = txs.sort((a, b) => (b.product_price || 0) - (a.product_price || 0));
    forBruto.push(sorted[0]);
  }
  
  // Para faturamento líquido: todas as transações (sem deduplicação)
  const forLiquido = transactions.filter(tx => {
    const email = (tx.customer_email || '').toLowerCase().trim();
    return email !== '';
  });
  
  console.log(`📊 Deduplicação: ${transactions.length} transações → ${forBruto.length} grupos únicos (email+produto)`);
  
  return { forBruto, forLiquido };
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

    // Buscar custos operacionais mensais
    const weekStartDate = new Date(week_start);
    const monthStart = `${weekStartDate.getFullYear()}-${String(weekStartDate.getMonth() + 1).padStart(2, '0')}-01`;
    
    const { data: operationalCosts } = await supabase
      .from('operational_costs')
      .select('*')
      .eq('month', monthStart);
    
    const team_cost_monthly = operationalCosts?.find(c => c.cost_type === 'team')?.amount || 0;
    const office_cost_monthly = operationalCosts?.find(c => c.cost_type === 'office')?.amount || 0;
    
    const team_cost = team_cost_monthly / 4;
    const office_cost = office_cost_monthly / 4;
    
    console.log(`💼 Custos Operacionais Semanais: Equipe R$ ${team_cost.toFixed(2)} + Escritório R$ ${office_cost.toFixed(2)}`);

    // 2. BUSCAR TRANSAÇÕES HUBLA DA SEMANA
    const startDateUTC = new Date(`${week_start}T00:00:00Z`);
    startDateUTC.setHours(startDateUTC.getHours() - 6);
    
    const endDateUTC = new Date(`${week_end}T23:59:59Z`);
    endDateUTC.setHours(endDateUTC.getHours() + 6);
    
    console.log(`🔍 Buscando transações de ${startDateUTC.toISOString()} até ${endDateUTC.toISOString()}`);
    
    const { data: allTransactions, error: txError } = await supabase
      .from('hubla_transactions')
      .select('*')
      .gte('sale_date', startDateUTC.toISOString())
      .lte('sale_date', endDateUTC.toISOString());

    if (txError) {
      console.error('❌ Erro ao buscar transações:', txError);
    }

    console.log(`📦 Total transações brutas: ${allTransactions?.length || 0}`);

    // Filtrar por data BR
    const allWeekTransactions = (allTransactions || []).filter(t => {
      const saleDateBR = toSaoPauloDateString(t.sale_date);
      return saleDateBR >= week_start && saleDateBR <= week_end;
    });

    console.log(`📦 Após filtro data BR: ${allWeekTransactions.length} transações`);
    
    const completedTransactions = allWeekTransactions.filter(t => t.sale_status === 'completed');
    const refundedTransactions = allWeekTransactions.filter(t => 
      t.sale_status === 'refunded' || t.event_type === 'invoice.refunded'
    );

    console.log(`📊 Vendas Hubla: ${completedTransactions?.length || 0} completed | ${refundedTransactions?.length || 0} refunds`);

    // 3. CONTAR VENDAS A010
    const { data: a010MakeFromDB } = await supabase
      .from('hubla_transactions')
      .select('*')
      .in('source', ['make', 'hubla_make_sync'])
      .eq('product_category', 'a010')
      .gte('sale_date', startDateUTC.toISOString())
      .lte('sale_date', endDateUTC.toISOString());
    
    const a010MakeTransactions = (a010MakeFromDB || []).filter(t => {
      const saleDateBR = toSaoPauloDateString(t.sale_date);
      return saleDateBR >= week_start && saleDateBR <= week_end && t.customer_email;
    });
    
    const { data: a010HublaFromDB } = await supabase
      .from('hubla_transactions')
      .select('*')
      .eq('source', 'hubla')
      .eq('product_category', 'a010')
      .eq('sale_status', 'completed')
      .gte('sale_date', startDateUTC.toISOString())
      .lte('sale_date', endDateUTC.toISOString());
    
    const hublaValuesByEmailDate = new Map<string, number>();
    (a010HublaFromDB || []).forEach(t => {
      const saleDateBR = toSaoPauloDateString(t.sale_date);
      if (saleDateBR < week_start || saleDateBR > week_end) return;
      const email = (t.customer_email || '').toLowerCase().trim();
      if (!email) return;
      
      const key = `${email}_${saleDateBR}`;
      const currentValue = hublaValuesByEmailDate.get(key) || 0;
      const newValue = parseValorLiquido(t);
      if (newValue > currentValue) {
        hublaValuesByEmailDate.set(key, newValue);
      }
    });
    
    console.log(`🔍 A010 Make+HublaMakeSync: ${a010MakeTransactions.length} | Hubla values map: ${hublaValuesByEmailDate.size}`);
    
    // Deduplicar A010 por email
    const a010ByEmail = new Map<string, typeof a010MakeTransactions[0]>();
    for (const tx of a010MakeTransactions) {
      const email = (tx.customer_email || '').toLowerCase().trim();
      if (!email) continue;
      
      const existing = a010ByEmail.get(email);
      if (!existing || 
          (tx.sale_status === 'completed' && existing.sale_status !== 'completed') ||
          (tx.sale_status === existing.sale_status && new Date(tx.sale_date) > new Date(existing.sale_date))) {
        a010ByEmail.set(email, tx);
      }
    }
    const a010Transactions = Array.from(a010ByEmail.values());
    
    const vendas_a010 = a010Transactions.length;
    
    const a010CompletedTransactions = a010Transactions.filter(t => t.sale_status === 'completed');
    let faturado_a010 = 0;
    
    for (const tx of a010CompletedTransactions) {
      const saleDateBR = toSaoPauloDateString(tx.sale_date);
      const email = (tx.customer_email || '').toLowerCase().trim();
      const key = `${email}_${saleDateBR}`;
      
      const hublaValue = hublaValuesByEmailDate.get(key);
      const makeValue = parseValorLiquido(tx);
      
      faturado_a010 += hublaValue && hublaValue > 0 ? hublaValue : makeValue;
    }
    
    console.log(`📈 Vendas A010: ${vendas_a010} (deduplicado por email)`);
    console.log(`📈 Faturado A010: R$ ${faturado_a010.toFixed(2)}`);

    // 4. FATURAMENTO CLINT - NOVA LÓGICA COM DEDUPLICAÇÃO POR EMAIL + PRODUTO
    
    // 4.1 Buscar transações MAKE (contrato + parceria)
    const { data: makeClintFromDB } = await supabase
      .from('hubla_transactions')
      .select('*')
      .eq('source', 'make')
      .in('product_category', ['contrato', 'parceria'])
      .eq('sale_status', 'completed')
      .gte('sale_date', startDateUTC.toISOString())
      .lte('sale_date', endDateUTC.toISOString());
    
    const makeClintTransactions = (makeClintFromDB || []).filter(t => {
      const saleDateBR = toSaoPauloDateString(t.sale_date);
      return saleDateBR >= week_start && saleDateBR <= week_end;
    });
    
    console.log(`📦 Make Clint (contrato+parceria): ${makeClintTransactions.length} transações`);
    
    // 4.2 Buscar transações HUBLA (incorporador)
    const { data: hublaIncFromDB } = await supabase
      .from('hubla_transactions')
      .select('*')
      .eq('source', 'hubla')
      .eq('product_category', 'incorporador')
      .eq('sale_status', 'completed')
      .gte('sale_date', startDateUTC.toISOString())
      .lte('sale_date', endDateUTC.toISOString());
    
    const hublaIncTransactions = (hublaIncFromDB || []).filter(t => {
      const saleDateBR = toSaoPauloDateString(t.sale_date);
      return saleDateBR >= week_start && saleDateBR <= week_end;
    });
    
    console.log(`📦 Hubla Incorporador: ${hublaIncTransactions.length} transações`);
    
    // 4.3 Combinar Make + Hubla (sem duplicatas por email)
    const makeEmailsSet = new Set<string>();
    makeClintTransactions.forEach(t => {
      const email = (t.customer_email || '').toLowerCase().trim();
      if (email) makeEmailsSet.add(email);
    });
    
    const hublaFallbackTransactions = hublaIncTransactions.filter(t => {
      const email = (t.customer_email || '').toLowerCase().trim();
      return !makeEmailsSet.has(email);
    });
    
    console.log(`📦 Hubla Fallback (não duplicados): ${hublaFallbackTransactions.length} transações`);
    
    // 4.4 APLICAR NOVA DEDUPLICAÇÃO (email + produto normalizado)
    const allClintTransactions = [...makeClintTransactions, ...hublaFallbackTransactions];
    const { forBruto: clintForBruto, forLiquido: clintForLiquido } = deduplicateTransactions(allClintTransactions);
    
    // FATURAMENTO CLINT BRUTO: usar preços de referência (mesma lógica do frontend)
    const faturamento_clint = clintForBruto.reduce((sum, t) => {
      const productName = t.product_name || '';
      const productPrice = t.product_price || 0;
      const precoFinal = getPrecoReferencia(productName, productPrice);
      return sum + precoFinal;
    }, 0);
    
    // FATURAMENTO CLINT LÍQUIDO: soma de TODOS os net_value (sem deduplicação)
    const faturamento_clint_liquido = clintForLiquido.reduce((sum, t) => sum + parseValorLiquido(t), 0);
    
    console.log(`💼 Faturamento Clint (bruto): R$ ${faturamento_clint.toFixed(2)} (${clintForBruto.length} grupos únicos)`);
    console.log(`💼 Faturamento Clint (líquido): R$ ${faturamento_clint_liquido.toFixed(2)} (${clintForLiquido.length} transações)`);
    
    const vendas_clint = clintForBruto.length;
    console.log(`💼 Vendas Clint: ${vendas_clint}`);
    
    // 4.5 INCORPORADOR 50K (manter compatibilidade)
    const incorporadorTransactions = completedTransactions.filter(t => {
      const hublaId = t.hubla_id || '';
      const productName = t.product_name || '';
      
      if (hublaId.includes('-offer-')) return false;
      
      return isIncorporadorProduct(productName);
    });
    
    // IMPORTANTE: Deduplicar por email - cada pessoa conta apenas 1x
    // Pegar a transação com MAIOR net_value para cada email
    const incByEmail = new Map<string, any>();
    for (const tx of incorporadorTransactions) {
      const email = (tx.customer_email || '').toLowerCase().trim();
      if (!email) continue;
      
      const existing = incByEmail.get(email);
      const currentNetValue = parseValorLiquido(tx);
      const existingNetValue = existing ? parseValorLiquido(existing) : 0;
      
      if (!existing || currentNetValue > existingNetValue) {
        incByEmail.set(email, tx);
      }
    }
    const dedupedIncorporador = Array.from(incByEmail.values());
    
    // INCORPORADOR 50K (LÍQUIDO) - soma dos net_value DEDUPLICADOS por email
    const incorporador_50k = dedupedIncorporador.reduce((sum, t) => sum + parseValorLiquido(t), 0);

    console.log(`💰 Incorporador 50k (líquido): R$ ${incorporador_50k.toFixed(2)} (${dedupedIncorporador.length} pessoas únicas de ${incorporadorTransactions.length} transações)`);

    // 5. CALCULAR ORDER BUMPS
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

    // 8. CALCULAR FATURAMENTO TOTAL
    const faturamento_total = incorporador_50k + ob_vitalicio + ob_construir_alugar + ob_evento + faturado_a010;

    console.log(`💵 Faturamento Total: R$ ${faturamento_total.toFixed(2)} (Inc50k: ${incorporador_50k.toFixed(2)} + OBs: ${(ob_vitalicio + ob_construir_alugar + ob_evento).toFixed(2)} + A010: ${faturado_a010.toFixed(2)})`);

    // 9. CALCULAR FATURADO CONTRATO
    // REGRA: Apenas produtos 'Contrato' ou 'A000 - Contrato' com preço 397/497, net_value > 0
    const contractTransactionsRaw = completedTransactions.filter(t => {
      const productName = (t.product_name || '').toUpperCase().trim();
      const netValue = t.net_value || 0;
      const productPrice = t.product_price || 0;
      
      // Apenas 'CONTRATO' ou 'A000 - CONTRATO' (não Anticrise, não Sócio MCF)
      const isContrato = productName === 'CONTRATO' || productName === 'A000 - CONTRATO';
      
      // Filtrar apenas transações com net_value real e preço de contrato (397 ou 497)
      const hasRealValue = netValue > 0;
      const hasValidPrice = productPrice >= 350 && productPrice <= 550;
      
      return isContrato && hasRealValue && hasValidPrice;
    });
    
    // Deduplicar por email - cada pessoa conta apenas 1x (maior net_value)
    const contractByEmail = new Map<string, any>();
    for (const tx of contractTransactionsRaw) {
      const email = (tx.customer_email || '').toLowerCase().trim();
      if (!email) continue;
      
      const existing = contractByEmail.get(email);
      const currentNetValue = tx.net_value || 0;
      const existingNetValue = existing?.net_value || 0;
      
      if (!existing || currentNetValue > existingNetValue) {
        contractByEmail.set(email, tx);
      }
    }
    const dedupedContract = Array.from(contractByEmail.values());
    
    const contract_revenue = dedupedContract.reduce((sum, t) => sum + (t.net_value || 0), 0);
    const contract_sales = dedupedContract.length;
    
    console.log(`📋 Faturado Contrato: ${contract_sales} vendas únicas, R$ ${contract_revenue.toFixed(2)} (de ${contractTransactionsRaw.length} transações)`);

    // 10. CALCULAR CUSTO REAL
    const custo_real = ads_cost - (faturado_a010 + ob_construir_alugar + ob_vitalicio + ob_evento + ob_construir_vender);

    // 11. CALCULAR MÉTRICAS DERIVADAS
    const operating_cost = ads_cost + team_cost + office_cost;
    const lucro_operacional = faturamento_total - operating_cost;
    
    const roi = operating_cost > 0 ? (incorporador_50k / operating_cost) * 100 : 0;
    const roas = ads_cost > 0 ? (faturamento_total / ads_cost) : 0;
    const cir = incorporador_50k > 0 ? (custo_real / incorporador_50k) * 100 : 0;
    const cpl = vendas_a010 > 0 ? (ads_cost / vendas_a010) : 0;
    const cplr = vendas_a010 > 0 ? (custo_real / vendas_a010) : 0;

    console.log(`📊 Custo Total: R$ ${operating_cost.toFixed(2)}`);
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
      // faturamento_clint_liquido - coluna não existe no banco
      // vendas_clint - coluna não existe no banco
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
      // clint_revenue_liquido - coluna não existe no banco
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
          faturamento_clint_liquido,
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
