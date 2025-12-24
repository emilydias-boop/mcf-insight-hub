// ===== FUNÇÕES COMPARTILHADAS DE CÁLCULO DE MÉTRICAS =====
// Usado por useDirectorKPIs.ts e useEvolutionData.ts para consistência

// ===== LISTA COMPLETA DE PRODUTOS INCORPORADOR 50K (38 produtos) =====
// Conforme planilha fornecida pelo usuário
export const PRODUTOS_INCORPORADOR_50K = [
  "000 - Pré Reserva Minha Casa Financiada",
  "000 - Contrato",
  "001- Pré-Reserva Anticrise",
  "003 - Imersão SÓCIOS MCF",
  "016-Análise e defesa de proposta de crédito",
  "A000 - Contrato",
  "A000 - Pré-Reserva Plano Anticrise",
  "A001 - MCF INCORPORADOR COMPLETO",
  "A002 - MCF INCORPORADOR BÁSICO",
  "A003 - MCF Incorporador - P2",
  "A003 - MCF Plano Anticrise Completo",
  "A004 - MCF INCORPORADOR BÁSICO",
  "A004 - MCF Plano Anticrise Básico",
  "A005 - Anticrise Completo",
  "A005 - MCF P2",
  "A005 - MCF P2 - ASAAS",
  "A006 - Anticrise Básico",
  // EXCLUÍDO: "A006 - Renovação Parceiro MCF" - Não faz parte
  "A007 - Imersão SÓCIOS MCF",
  "A008 - The CLUB",
  "A008 - The CLUB - CONSULTORIA CLUB",
  "A009 - MCF INCORPORADOR COMPLETO + THE CLUB",
  // EXCLUÍDO: "A009 - Renovação Parceiro MCF" - Não faz parte
  "ASAAS",
  "COBRANÇAS ASAAS",
  "CONTRATO ANTICRISE",
  "Contrato - Anticrise",
  "Contrato - Sócio MCF",
  "Contrato",
  "Jantar Networking",
  "R001 - Incorporador Completo 50K",
  "R004 - Incorporador 50k Básico",
  "R005 - Anticrise Completo",
  "R006 - Anticrise Básico",
  "R009 - Renovação Parceiro MCF",
  "R21- MCF Incorporador P2 (Assinatura)",
  "Sócio Jantar",
];

// Tipo para transação Hubla
export type HublaTransactionBase = {
  hubla_id: string;
  product_name: string | null;
  product_category: string | null;
  net_value: number | null;
  sale_date: string;
  installment_number: number | null;
  total_installments: number | null;
  customer_name: string | null;
  customer_email: string | null;
  raw_data: unknown;
  product_price: number | null;
  event_type: string;
  source: string | null;
};

// Valores mínimos esperados por categoria (se abaixo, provavelmente é taxa)
const VALOR_MINIMO_POR_CATEGORIA: Record<string, number> = {
  a010: 35,
  contrato: 100,
  incorporador: 100,
  ob_vitalicio: 35,
  ob_construir: 70,
};

// Normaliza tipo de produto para chave de deduplicação
const getNormalizedProductType = (tx: HublaTransactionBase): string => {
  const category = tx.product_category || "unknown";
  const productName = (tx.product_name || "").toUpperCase();
  
  if (category === "a010" || productName.includes("A010")) {
    return "a010";
  }
  
  if (productName.includes("A009")) return "a009_incorporador_club";
  if (productName.includes("A008")) return "a008_club";
  if (productName.includes("A007")) return "a007_imersao";
  if (productName.includes("A005")) return "a005_p2";
  if (productName.includes("A004")) return "a004_basico";
  if (productName.includes("A003")) return "a003_anticrise";
  if (productName.includes("A002")) return "a002_basico";
  if (productName.includes("A001")) return "a001_incorporador";
  if (productName.includes("A000") || productName.includes("CONTRATO")) return "a000_contrato";
  if (productName.includes("R00")) return "r00_renovacao";
  
  if (productName.includes("VITALIC")) return "ob_vitalicio";
  if (productName.includes("CONSTRUIR")) return "ob_construir";
  
  if (category === "incorporador" || category === "contrato") {
    return category;
  }
  
  return category;
};

// NOVA CHAVE: email + produto normalizado (sem data)
// Isso agrupa transações do mesmo cliente para o mesmo produto
const getSaleKey = (tx: HublaTransactionBase): string => {
  const email = (tx.customer_email || "").toLowerCase().trim();
  const tipoNormalizado = getNormalizedProductType(tx);
  return `${email}|${tipoNormalizado}`;
};

// Interface para resultado de deduplicação com bruto e líquido separados
export interface DeduplicatedResult<T> {
  // Transações para cálculo de BRUTO (maior product_price por grupo)
  forBruto: T[];
  // Todas as transações para cálculo de LÍQUIDO (soma de net_value)
  forLiquido: T[];
}

// NOVA FUNÇÃO: Deduplicação inteligente para bruto vs líquido
// Bruto: manter apenas a transação com maior product_price por email+produto
// Líquido: manter TODAS as transações (cada pagamento conta)
export const deduplicateTransactionsV2 = <T extends HublaTransactionBase>(
  transactions: T[]
): DeduplicatedResult<T> => {
  const groups = new Map<string, T[]>();
  
  transactions.forEach((tx) => {
    const key = getSaleKey(tx);
    const existing = groups.get(key) || [];
    existing.push(tx);
    groups.set(key, existing);
  });
  
  // Para BRUTO: pegar transação com maior product_price de cada grupo
  const forBruto = Array.from(groups.values()).map((txs) => {
    if (txs.length === 1) return txs[0];
    
    // Ordenar por product_price decrescente, pegar o maior
    return txs.reduce((best, tx) => {
      const bestPrice = best.product_price || 0;
      const currentPrice = tx.product_price || 0;
      return currentPrice > bestPrice ? tx : best;
    }, txs[0]);
  });
  
  // Para LÍQUIDO: todas as transações (cada net_value conta)
  return {
    forBruto,
    forLiquido: transactions,
  };
};

// Função legada mantida para compatibilidade (usa lógica antiga)
export const deduplicateTransactions = <T extends HublaTransactionBase>(transactions: T[]): T[] => {
  const result = deduplicateTransactionsV2(transactions);
  return result.forBruto;
};

// Helper para verificar se produto está na lista de Incorporador 50k
export const isProductInIncorporador50k = (productName: string): boolean => {
  const normalizedName = productName.trim().toUpperCase();
  return PRODUTOS_INCORPORADOR_50K.some(
    (p) => p.toUpperCase() === normalizedName
  );
};

// ===== CÁLCULO INCORPORADOR 50K (LÍQUIDO) =====
// Soma de net_value dos produtos da lista, deduplicando por hubla_id
export const calcularIncorporador50k = (transactions: HublaTransactionBase[]): number => {
  const seenIds = new Set<string>();
  
  return transactions
    .filter((tx) => {
      if (tx.hubla_id?.startsWith("newsale-")) return false;
      if (tx.hubla_id?.includes("-offer-")) return false;
      if (seenIds.has(tx.hubla_id)) return false;
      
      const productName = tx.product_name || "";
      if (!isProductInIncorporador50k(productName)) return false;
      
      // Excluir renovações
      const upperName = productName.toUpperCase();
      if (upperName.includes("RENOVAÇÃO") || upperName.includes("RENOVACAO")) return false;
      
      seenIds.add(tx.hubla_id);
      return true;
    })
    .reduce((sum, tx) => sum + (tx.net_value || 0), 0);
};

// ===== CÁLCULO A010 FATURADO (LÍQUIDO) =====
// Soma de net_value de produtos A010, excluindo Order Bumps
export const calcularA010Faturado = (transactions: HublaTransactionBase[]): number => {
  const seenIds = new Set<string>();
  
  return transactions
    .filter((tx) => {
      const productName = (tx.product_name || "").toUpperCase();
      const isA010 = tx.product_category === "a010" || productName.includes("A010");
      if (!isA010) return false;
      
      // Excluir Order Bumps
      if (tx.hubla_id?.includes('-offer-')) return false;
      if (seenIds.has(tx.hubla_id)) return false;
      
      seenIds.add(tx.hubla_id);
      return true;
    })
    .reduce((sum, tx) => sum + (tx.net_value || 0), 0);
};

// ===== CÁLCULO OBs (LÍQUIDO) =====
export const calcularOBs = (transactions: HublaTransactionBase[]): {
  obConstruir: number;
  obVitalicio: number;
  obEvento: number;
} => {
  const obConstruirByEmail = new Map<string, number>();
  const obVitalicioByEmail = new Map<string, number>();
  const obEventoByEmail = new Map<string, number>();
  
  transactions.forEach((tx) => {
    const productName = (tx.product_name || "").toUpperCase();
    const email = (tx.customer_email || "").toLowerCase().trim();
    if (!email) return;
    
    const netValue = tx.net_value || 0;
    
    // OB Vitalício
    if (productName.includes("VITALIC") || tx.product_category === "ob_vitalicio") {
      const existing = obVitalicioByEmail.get(email) || 0;
      if (netValue > existing) obVitalicioByEmail.set(email, netValue);
    }
    // OB Construir (excluir Viver de Aluguel)
    else if ((productName.includes("CONSTRUIR") || tx.product_category === "ob_construir") && !productName.includes("VIVER")) {
      const existing = obConstruirByEmail.get(email) || 0;
      if (netValue > existing) obConstruirByEmail.set(email, netValue);
    }
    // OB Evento (Imersão Presencial)
    else if (productName.includes("IMERSÃO") || productName.includes("IMERSAO") || tx.product_category === "ob_evento") {
      const existing = obEventoByEmail.get(email) || 0;
      if (netValue > existing) obEventoByEmail.set(email, netValue);
    }
  });
  
  return {
    obConstruir: Array.from(obConstruirByEmail.values()).reduce((sum, v) => sum + v, 0),
    obVitalicio: Array.from(obVitalicioByEmail.values()).reduce((sum, v) => sum + v, 0),
    obEvento: Array.from(obEventoByEmail.values()).reduce((sum, v) => sum + v, 0),
  };
};

// ===== CONTA VENDAS A010 (EMAILS ÚNICOS) =====
export const contarVendasA010 = (transactions: HublaTransactionBase[]): number => {
  const seenEmails = new Set<string>();
  
  transactions.forEach((tx) => {
    const productName = (tx.product_name || "").toUpperCase();
    const isA010 = tx.product_category === "a010" || productName.includes("A010");
    
    if (tx.hubla_id?.startsWith("newsale-")) return;
    
    if (isA010) {
      const email = (tx.customer_email || "").toLowerCase().trim();
      if (email) {
        seenEmails.add(email);
      }
    }
  });
  
  return seenEmails.size;
};

// ===== FUNÇÃO MASTER: CALCULAR TODAS AS MÉTRICAS DA SEMANA =====
// Usa as fórmulas EXATAS da planilha do usuário
export interface MetricasSemana {
  // Componentes
  incorporador50k: number;
  a010Faturado: number;
  obConstruir: number;
  obVitalicio: number;
  obEvento: number;
  vendasA010: number;
  
  // Calculados
  faturamentoTotal: number;
  custoTotal: number;
  lucro: number;
  roi: number;
  roas: number;
  cpl: number;
  
  // Ultrametas
  ultrametaClint: number;
  ultrametaLiquido: number;
}

export const calcularMetricasSemana = (
  transactions: HublaTransactionBase[],
  gastosAds: number,
  custoEquipeMensal: number,
  custoEscritorioMensal: number
): MetricasSemana => {
  // 1. Calcular componentes
  const incorporador50k = calcularIncorporador50k(transactions);
  const a010Faturado = calcularA010Faturado(transactions);
  const obs = calcularOBs(transactions);
  const vendasA010 = contarVendasA010(transactions);
  
  // 2. Custo Operacional Semanal = (Equipe + Escritório) / 4
  const custoOperacionalSemanal = (custoEquipeMensal + custoEscritorioMensal) / 4;
  
  // 3. Custo Total = Ads + Operacional Semanal
  const custoTotal = gastosAds + custoOperacionalSemanal;
  
  // 4. Faturamento Total = Inc50k + A010 + OBs (FÓRMULA FIXA DA PLANILHA)
  const faturamentoTotal = incorporador50k + a010Faturado + obs.obConstruir + obs.obVitalicio + obs.obEvento;
  
  // 5. Lucro = Faturamento Total - Custo Total
  const lucro = faturamentoTotal - custoTotal;
  
  // 6. ROI = Incorporador50k / (Incorporador50k - Lucro) × 100 (FÓRMULA FIXA DA PLANILHA)
  const denominadorROI = incorporador50k - lucro;
  const roi = denominadorROI > 0 ? (incorporador50k / denominadorROI) * 100 : 0;
  
  // 7. ROAS = Faturamento Total / Gastos Ads
  const roas = gastosAds > 0 ? faturamentoTotal / gastosAds : 0;
  
  // 8. CPL = Gastos Ads / Vendas A010
  const cpl = vendasA010 > 0 ? gastosAds / vendasA010 : 0;
  
  // 9. Ultrametas
  const ultrametaClint = vendasA010 * 1680;
  const ultrametaLiquido = vendasA010 * 1400;
  
  return {
    incorporador50k,
    a010Faturado,
    obConstruir: obs.obConstruir,
    obVitalicio: obs.obVitalicio,
    obEvento: obs.obEvento,
    vendasA010,
    faturamentoTotal,
    custoTotal,
    lucro,
    roi,
    roas,
    cpl,
    ultrametaClint,
    ultrametaLiquido,
  };
};

// Formata data para query no fuso de Brasília
export const formatDateForBrazil = (date: Date, isEndOfDay: boolean = false): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  if (isEndOfDay) {
    return `${year}-${month}-${day}T23:59:59-03:00`;
  }
  return `${year}-${month}-${day}T00:00:00-03:00`;
};
