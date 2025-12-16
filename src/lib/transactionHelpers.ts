// ===== FUNÇÕES COMPARTILHADAS DE DEDUPLICAÇÃO DE TRANSAÇÕES =====
// Usado por useDirectorKPIs.ts e useEvolutionData.ts para consistência

// Categorias excluídas do Faturamento Total
export const EXCLUDED_CATEGORIES_FATURAMENTO = ["clube_arremate", "efeito_alavanca", "renovacao", "imersao", "contrato"];

// Produtos excluídos do Faturamento Total
export const EXCLUDED_PRODUCTS_FATURAMENTO = [
  "SÓCIO MCF",
  "SOCIO MCF",
  "SÓCIO",
  "SOCIO",
  "PARCERIA",
  "ALMOÇO NETWORKING",
  "ALMOCO NETWORKING",
  "ALMOÇO",
  "ALMOCO",
  "MENTORIA INDIVIDUAL",
  "CLUBE DO ARREMATE",
  "CONTRATO - CLUBE DO ARREMATE",
  "RENOVAÇÃO PARCEIRO",
  "RENOVACAO PARCEIRO",
  "AVALIAÇÃO DE IMÓVEIS",
  "AVALIACAO DE IMOVEIS",
];

// Valores mínimos esperados por categoria (se abaixo, provavelmente é taxa)
export const VALOR_MINIMO_POR_CATEGORIA: Record<string, number> = {
  a010: 35,
  contrato: 100,
  incorporador: 100,
  ob_vitalicio: 35,
  ob_construir: 70,
};

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

// Normaliza tipo de produto para chave de deduplicação
export const getNormalizedProductType = (tx: HublaTransactionBase): string => {
  const category = tx.product_category || "unknown";
  const productName = (tx.product_name || "").toUpperCase();
  
  if (category === "a010" || productName.includes("A010")) {
    return "a010";
  }
  
  if (productName.includes("A009")) return "a009_incorporador_club";
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

// Chave de deduplicação: email + data + tipo normalizado
export const getSaleKey = (tx: HublaTransactionBase): string => {
  const email = (tx.customer_email || "").toLowerCase().trim();
  const date = tx.sale_date.split("T")[0];
  const tipoNormalizado = getNormalizedProductType(tx);
  return `${email}|${date}|${tipoNormalizado}`;
};

// Deduplicação por email+data+tipo, priorizando maior valor válido
export const deduplicateTransactions = <T extends HublaTransactionBase>(transactions: T[]): T[] => {
  const groups = new Map<string, T[]>();
  
  transactions.forEach((tx) => {
    const key = getSaleKey(tx);
    const existing = groups.get(key) || [];
    existing.push(tx);
    groups.set(key, existing);
  });
  
  return Array.from(groups.entries()).map(([key, txs]) => {
    if (txs.length === 1) return txs[0];
    
    const tipoNormalizado = key.split('|')[2];
    const minValue = VALOR_MINIMO_POR_CATEGORIA[tipoNormalizado] || 30;
    
    const makeTx = txs.find(t => t.source === 'make');
    const hublaTx = txs.find(t => t.source === 'hubla' || !t.source);
    const kiwifyTx = txs.find(t => t.source === 'kiwify');
    
    if (makeTx && hublaTx) {
      const makeValue = makeTx.net_value || 0;
      const hublaValue = hublaTx.net_value || 0;
      
      if (makeValue < minValue && hublaValue >= minValue) {
        return hublaTx;
      }
      
      return makeValue >= hublaValue ? makeTx : hublaTx;
    }
    
    if (makeTx) return makeTx;
    if (hublaTx) return hublaTx;
    if (kiwifyTx) return kiwifyTx;
    
    return txs.reduce((best, tx) => 
      (tx.net_value || 0) > (best.net_value || 0) ? tx : best
    , txs[0]);
  });
};

// Calcula Faturamento Total a partir de transações deduplicadas
export const calcularFaturamentoTotal = (transactions: HublaTransactionBase[]): number => {
  const seenIds = new Set<string>();
  const matchMap = new Map<string, { netValue: number; source: string }>();
  
  transactions.forEach((tx) => {
    const productName = (tx.product_name || "").toUpperCase();
    const category = tx.product_category || "";
    const hublaId = tx.hubla_id || "";

    if (hublaId.startsWith("newsale-")) return;
    if (hublaId.includes("-offer-")) return;
    if (EXCLUDED_CATEGORIES_FATURAMENTO.includes(category)) return;
    if (EXCLUDED_PRODUCTS_FATURAMENTO.some((p) => productName.includes(p))) return;
    if (seenIds.has(hublaId)) return;
    seenIds.add(hublaId);

    const source = tx.source || "hubla";
    const netValue = tx.net_value || 0;
    const email = (tx.customer_email || "").toLowerCase().trim();
    const timestamp = tx.sale_date?.substring(0, 19) || "";
    const price = (tx.product_price || 0).toFixed(2);
    const matchKey = `${email}|${timestamp}|${price}`;

    if (matchMap.has(matchKey)) {
      const existing = matchMap.get(matchKey)!;
      if (source === "make" && existing.source === "hubla") {
        matchMap.set(matchKey, { netValue, source });
      }
    } else {
      matchMap.set(matchKey, { netValue, source });
    }
  });
  
  return Array.from(matchMap.values()).reduce((sum, entry) => sum + entry.netValue, 0);
};

// Conta vendas A010 por emails únicos
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
