import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth } from "date-fns";

interface DirectorKPI {
  value: number;
  change: number;
  isPositive: boolean;
}

interface DirectorKPIs {
  faturamentoTotal: DirectorKPI;
  gastosAds: DirectorKPI;
  cpl: DirectorKPI;
  custoTotal: DirectorKPI;
  lucro: DirectorKPI;
  roi: DirectorKPI;
  roas: DirectorKPI;
  vendasA010: number;
  faturamentoIncorporador: number;
  // Campos Ultrameta para tempo real
  ultrametaClint: number;
  faturamentoClint: number;
  ultrametaLiquido: number;
  faturamentoLiquido: number;
}

// ===== LISTA EXATA de produtos para Faturamento Clint (Bruto e Líquido) =====
// Conforme planilha fornecida pelo usuário - SEM regex/startsWith
// NOTA: "Contrato" puro NÃO está incluído (não está na lista do usuário)
const PRODUTOS_FATURAMENTO_CLINT = [
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
  "A006 - Renovação Parceiro MCF",
  "A007 - Imersão SÓCIOS MCF",
  "A008 - The CLUB",
  "A008 - The CLUB - CONSULTORIA CLUB",
  "A009 - MCF INCORPORADOR COMPLETO + THE CLUB",
  // REMOVIDO: "A009 - Renovação Parceiro MCF" - Não faz parte do Faturamento Clint
  "ASAAS",
  "COBRANÇAS ASAAS",
  "CONTRATO ANTICRISE",
  "Contrato - Anticrise",
  "Contrato - Sócio MCF",
  "Contrato",  // ADICIONADO: Fallback para transações Make sem prefixo A000
  "Jantar Networking",
  "R001 - Incorporador Completo 50K",
  "R004 - Incorporador 50k Básico",
  "R005 - Anticrise Completo",
  "R006 - Anticrise Básico",
  "R009 - Renovação Parceiro MCF",
  "R21- MCF Incorporador P2 (Assinatura)",
  "Sócio Jantar",
];

// Função helper para verificar se produto está na lista de Faturamento Clint
// Verifica por nome, prefixo de código OU por categoria (para produtos Make)
const isProductInFaturamentoClint = (productName: string, productCategory?: string | null): boolean => {
  const normalized = productName.trim().toUpperCase();
  
  // EXCLUSÃO: Clube do Arremate NÃO faz parte do Faturamento Clint
  if (normalized.includes("CLUBE DO ARREMATE") || normalized.includes("CLUBE ARREMATE")) {
    return false;
  }
  
  // 1. Verificar por categoria (produtos Make e Hubla)
  const validCategories = ['incorporador', 'parceria', 'contrato', 'contrato-anticrise', 'imersao_socios'];
  if (productCategory && validCategories.includes(productCategory)) {
    return true;
  }
  
  // 2. Verificar por prefixo de código (A000, A001, A002, A003, A004, A005, A009)
  const validPrefixes = ['A000', 'A001', 'A002', 'A003', 'A004', 'A005', 'A009'];
  if (validPrefixes.some(prefix => normalized.startsWith(prefix))) {
    return true;
  }
  
  // 3. Verificar por nome parcial da lista original (includes bidirecional)
  if (PRODUTOS_FATURAMENTO_CLINT.some(p => 
    normalized.includes(p.toUpperCase()) || p.toUpperCase().includes(normalized)
  )) {
    return true;
  }
  
  return false;
};

// Produtos do Incorporador 50k (para cálculos antigos - mantido para compatibilidade)
const INCORPORADOR_PRODUCTS = ["A000", "A001", "A002", "A003", "A004", "A005", "A008", "A009"];
const EXCLUDED_PRODUCT_NAMES = [
  "A006",
  "A010",
  "IMERSÃO SÓCIOS",
  "IMERSAO SOCIOS",
  "EFEITO ALAVANCA",
  "CLUBE DO ARREMATE",
  "CLUBE ARREMATE",
  "SÓCIO MCF",
  "SOCIO MCF",
];

// Categorias e produtos excluídos do Faturamento Total (conforme planilha)
// CORREÇÃO: Adicionar "contrato" como categoria excluída (duplicata com A000 - Contrato)
const EXCLUDED_CATEGORIES_FATURAMENTO = ["clube_arremate", "efeito_alavanca", "renovacao", "imersao", "contrato"];
const EXCLUDED_PRODUCTS_FATURAMENTO = [
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

// ===== TAXAS FIXAS POR PRODUTO (conforme planilha do usuário) =====
// Estas taxas são aplicadas ao valor BRUTO para obter o valor faturado
const TAXA_OB_VITALICIO = 0.8356;    // 83.56% (taxa fixa Hubla: 16.44%)
const TAXA_OB_CONSTRUIR = 0.8980;    // 89.80% (taxa fixa Hubla: 10.20%)
const PRECO_OB_VITALICIO = 57;       // R$ 57 preço padrão OB Vitalício
const PRECO_OB_CONSTRUIR = 97;       // R$ 97 preço padrão OB Construir

// Importar constantes compartilhadas
import { PRECO_REFERENCIA, normalizeProductForDedup, getPrecoReferencia } from '@/lib/precosReferencia';

// Helper para formatar data no fuso horário de Brasília (UTC-3)
const formatDateForBrazil = (date: Date, isEndOfDay: boolean = false): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  if (isEndOfDay) {
    return `${year}-${month}-${day}T23:59:59-03:00`;
  }
  return `${year}-${month}-${day}T00:00:00-03:00`;
};

// ===== DEDUPLICAÇÃO INTELIGENTE HUBLA + MAKE =====
// Detecta quando Make recebeu apenas taxa em vez de valor real e usa Hubla nesses casos
type HublaTransaction = {
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
  a010: 35,           // A010 mínimo ~R$ 41, taxa ~R$ 5-10
  contrato: 100,      // Contratos mínimo ~R$ 367, taxa ~R$ 30-45
  incorporador: 100,  // Incorporador mínimo ~R$ 300
  ob_vitalicio: 35,   // OB Vitalício mínimo ~R$ 47
  ob_construir: 70,   // OB Construir mínimo ~R$ 87
};

// Normaliza tipo de produto para chave de deduplicação
const getNormalizedProductType = (tx: HublaTransaction): string => {
  const category = tx.product_category || "unknown";
  const productName = (tx.product_name || "").toUpperCase();
  
  if (category === "a010" || productName.includes("A010")) {
    return "a010";
  }
  
  // CORREÇÃO: Cada produto Incorporador tem tipo único para evitar falsa deduplicação
  // quando mesmo cliente compra produtos diferentes no mesmo dia
  if (productName.includes("A009")) return "a009_incorporador_club";
  if (productName.includes("A005")) return "a005_p2";
  if (productName.includes("A004")) return "a004_basico";
  if (productName.includes("A003")) return "a003_anticrise";
  if (productName.includes("A002")) return "a002_basico";
  if (productName.includes("A001")) return "a001_incorporador";
  if (productName.includes("A000") || productName.includes("CONTRATO")) return "a000_contrato";
  if (productName.includes("R00")) return "r00_renovacao";
  
  // OBs mantém mesmo comportamento
  if (productName.includes("VITAL")) return "ob_vitalicio";
  if (productName.includes("CONSTRUIR")) return "ob_construir";
  
  if (category === "incorporador" || category === "contrato") {
    return category;
  }
  
  return category;
};

// CHAVE SIMPLES: email + data + tipo (SEM valor)
// Make e Hubla têm valores diferentes para mesma transação, então valor não pode estar na chave
const getSaleKey = (tx: HublaTransaction): string => {
  const email = (tx.customer_email || "").toLowerCase().trim();
  const date = tx.sale_date.split("T")[0];
  const tipoNormalizado = getNormalizedProductType(tx);
  return `${email}|${date}|${tipoNormalizado}`;
};

// Deduplicação por email+data+tipo, priorizando MAIOR VALOR válido
const deduplicateTransactions = (transactions: HublaTransaction[]): HublaTransaction[] => {
  const groups = new Map<string, HublaTransaction[]>();
  
  transactions.forEach((tx) => {
    const key = getSaleKey(tx);
    const existing = groups.get(key) || [];
    existing.push(tx);
    groups.set(key, existing);
  });
  
  let duplicatesRemoved = 0;
  
  // Para cada grupo, escolher a transação com MAIOR VALOR
  const result = Array.from(groups.entries()).map(([key, txs]) => {
    if (txs.length > 1) duplicatesRemoved += txs.length - 1;
    
    // Se só 1 transação, usar ela
    if (txs.length === 1) return txs[0];
    
    const tipoNormalizado = key.split('|')[2];
    const minValue = VALOR_MINIMO_POR_CATEGORIA[tipoNormalizado] || 30;
    
    const makeTx = txs.find(t => t.source === 'make');
    const hublaTx = txs.find(t => t.source === 'hubla' || !t.source);
    const kiwifyTx = txs.find(t => t.source === 'kiwify');
    
    // Se Make e Hubla existem, escolher o de MAIOR VALOR válido
    if (makeTx && hublaTx) {
      const makeValue = makeTx.net_value || 0;
      const hublaValue = hublaTx.net_value || 0;
      
      // Se Make tem taxa (valor baixo) e Hubla tem valor real → usar Hubla
      if (makeValue < minValue && hublaValue >= minValue) {
        return hublaTx;
      }
      
      // Se ambos têm valores válidos → usar o MAIOR
      return makeValue >= hublaValue ? makeTx : hublaTx;
    }
    
    // Se só Make existe → usar Make
    if (makeTx) return makeTx;
    
    // Se só Hubla existe → usar Hubla
    if (hublaTx) return hublaTx;
    
    // Se só Kiwify existe → usar Kiwify
    if (kiwifyTx) return kiwifyTx;
    
    // Fallback - usar o de maior valor
    return txs.reduce((best, tx) => 
      (tx.net_value || 0) > (best.net_value || 0) ? tx : best
    , txs[0]);
  });
  
  console.log(`🔧 Deduplicação: ${transactions.length} → ${result.length} (${duplicatesRemoved} duplicatas removidas)`);
  
  return result;
};

export function useDirectorKPIs(startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ["director-kpis", startDate?.toISOString(), endDate?.toISOString()],
    staleTime: 0,
    gcTime: 0,
    queryFn: async (): Promise<DirectorKPIs> => {
      // Formatar datas com fuso horário de Brasília (America/Sao_Paulo)
      const startStr = startDate ? formatDateForBrazil(startDate, false) : formatDateForBrazil(new Date(), false);
      const endStr = endDate ? formatDateForBrazil(endDate, true) : formatDateForBrazil(new Date(), true);
      const start = startDate ? format(startDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
      const end = endDate ? format(endDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");

      // Buscar transações de TODAS AS FONTES (Hubla + Kiwify + Make) no período
      // CORREÇÃO: Incluir todas as fontes para deduplicação correta por email+data
      // NOVO: Filtrar apenas transações marcadas para contar no dashboard (count_in_dashboard = true ou null)
      const { data: hublaDataRaw } = await supabase
        .from("hubla_transactions")
        .select(
          "hubla_id, product_name, product_category, net_value, sale_date, installment_number, total_installments, customer_name, customer_email, raw_data, product_price, event_type, source, count_in_dashboard",
        )
        .eq("sale_status", "completed")
        .or("event_type.eq.invoice.payment_succeeded,event_type.eq.purchase_approved,source.eq.kiwify,source.eq.make,source.eq.hubla_make_sync,source.eq.manual,source.is.null")
        .not("customer_email", "is", null)
        .neq("customer_email", "")
        .not("customer_name", "is", null)
        .neq("customer_name", "")
        .gt("net_value", 0)
        .or("count_in_dashboard.is.null,count_in_dashboard.eq.true")
        .gte("sale_date", startStr)
        .lte("sale_date", endStr);

      // Query secundária: buscar A010 Order Bumps com net_value=0 (excluídos pela query principal)
      // NOVO: Também respeitar count_in_dashboard
      const { data: a010OfferData } = await supabase
        .from("hubla_transactions")
        .select(
          "hubla_id, product_name, product_category, net_value, sale_date, installment_number, total_installments, customer_name, customer_email, raw_data, product_price, event_type, source, count_in_dashboard",
        )
        .eq("sale_status", "completed")
        .eq("product_category", "a010")
        .ilike("hubla_id", "%-offer-%")
        .eq("net_value", 0)
        .not("customer_email", "is", null)
        .neq("customer_email", "")
        .not("customer_name", "is", null)
        .neq("customer_name", "")
        .or("count_in_dashboard.is.null,count_in_dashboard.eq.true")
        .gte("sale_date", startStr)
        .lte("sale_date", endStr);

      console.log("📊 A010 Order Bumps com net_value=0:", a010OfferData?.length || 0);

      // CORREÇÃO: Excluir MCF FUNDAMENTOS ANTES da deduplicação
      // MCF Fundamentos é automação Make com product_category='a010', não é venda real
      const filteredHublaData = (hublaDataRaw || []).filter((tx) => {
        const productName = (tx.product_name || "").toUpperCase().trim();
        // Excluir APENAS "MCF FUNDAMENTOS" puro (automação fake)
        // MANTER "A010 - MCF FUNDAMENTOS" pois é venda real do Make
        if (productName === "MCF FUNDAMENTOS") return false;
        return true;
      });

      // Combinar dados: principal (sem MCF Fundamentos) + A010 Order Bumps sem valor
      const allHublaData = [...filteredHublaData, ...(a010OfferData || [])];

      // Aplicar deduplicação inteligente: Make > Hubla/Kiwify (Make tem taxa real)
      const hublaData = deduplicateTransactions(allHublaData as HublaTransaction[]);
      
      console.log("📊 Deduplicação:", {
        rawCount: hublaDataRaw?.length || 0,
        deduplicatedCount: hublaData.length,
        sources: {
          hubla: hublaData.filter(tx => tx.source !== 'make' && tx.source !== 'kiwify').length,
          kiwify: hublaData.filter(tx => tx.source === 'kiwify').length,
          make: hublaData.filter(tx => tx.source === 'make').length,
        }
      });

      // ===== FATURAMENTO INCORPORADOR (Líquido) - APENAS HUBLA =====
      // REGRA: Incorporador 50k usa apenas source='hubla'
      // CORREÇÃO: Usar dados RAW (não deduplicados por email+data) para não perder parcelas
      // Deduplicar APENAS por hubla_id para capturar todas transações únicas
      const seenIncorporadorIds = new Set<string>();
      const faturamentoIncorporador = (allHublaData || [])
        .filter((tx) => {
          // FILTRO DE FONTE: Hubla, Kiwify ou Manual (Asaas)
          const source = tx.source || 'hubla';
          if (source !== 'hubla' && source !== 'kiwify' && source !== 'manual') return false;
          
          const productName = (tx.product_name || "").toUpperCase();
          const isIncorporador = INCORPORADOR_PRODUCTS.some((code) => productName.startsWith(code));
          const isExcluded = EXCLUDED_PRODUCT_NAMES.some((name) => productName.includes(name.toUpperCase()));
          if (seenIncorporadorIds.has(tx.hubla_id)) return false;
          if (isIncorporador && !isExcluded) {
            seenIncorporadorIds.add(tx.hubla_id);
            return true;
          }
          return false;
        })
        .reduce((sum, tx) => sum + (tx.net_value || 0), 0);

      // ===== OB ACESSO VITALÍCIO (MAKE - SOMA TOTAL SEM DEDUPLICAÇÃO) =====
      // CORREÇÃO: Somar TODAS as transações, não deduplicar por email
      const obVitalicioFaturado = (allHublaData || [])
        .filter((tx) => {
          if (tx.source !== "make") return false;
          const productName = (tx.product_name || "").toUpperCase();
          return productName.includes("VITAL") || tx.product_category === 'ob_vitalicio';
        })
        .reduce((sum, tx) => sum + (tx.net_value || 0), 0);
      
      console.log("🎁 OB Vitalício (Make - soma total):", { faturado: obVitalicioFaturado });

      // ===== OB CONSTRUIR PARA ALUGAR (HUBLA - product_category = ob_construir_alugar) =====
      // CORREÇÃO: Usar dados da Hubla com categoria específica, não Make
      // EXCLUIR "Viver de Aluguel" (produto separado)
      const obConstruirFaturado = (allHublaData || [])
        .filter((tx) => {
          const source = tx.source || 'hubla';
          if (source !== 'hubla') return false;
          const productName = (tx.product_name || "").toUpperCase();
          return tx.product_category === 'ob_construir_alugar' && !productName.includes("VIVER");
        })
        .reduce((sum, tx) => sum + (tx.net_value || 0), 0);
      
      console.log("🏠 OB Construir para Alugar (Hubla):", { faturado: obConstruirFaturado });
      
      // ===== OB EVENTO / IMERSÃO PRESENCIAL (MAKE - SOMA TOTAL SEM DEDUPLICAÇÃO) =====
      // CORREÇÃO: Somar TODAS as transações, não deduplicar por email
      const obEventoFaturado = (allHublaData || [])
        .filter((tx) => {
          if (tx.source !== "make") return false;
          const productName = (tx.product_name || "").toUpperCase();
          return productName.includes("IMERSÃO") || productName.includes("IMERSAO") || productName.includes("PRESENCIAL");
        })
        .reduce((sum, tx) => sum + (tx.net_value || 0), 0);
      
      console.log("🎪 OB Evento (Make - soma total):", { faturado: obEventoFaturado });

      // ===== CÓDIGO LEGADO REMOVIDO =====
      // A lógica de deduplicação complexa Hubla vs Make foi simplificada
      // Agora usa fonte única por tipo de produto:
      // - OBs (Vitalício, Construir, Evento) e A010: Make (count_in_dashboard=true)
      // - Incorporador 50k: Hubla

      // ===== VENDAS A010 (MAKE + HUBLA_MAKE_SYNC) =====
      // Make e hubla_make_sync são fontes válidas para contagem de A010
      // Deduplicar por EMAIL ÚNICO
      const vendasA010Calc = (() => {
        const seenA010Emails = new Set<string>();
        
        // CORREÇÃO: Incluir source='make' E source='hubla_make_sync'
        ((allHublaData as HublaTransaction[]) || []).forEach((tx) => {
          // Apenas transações do Make OU hubla_make_sync
          if (tx.source !== 'make' && tx.source !== 'hubla_make_sync') return;
          
          const productName = (tx.product_name || "").toUpperCase().trim();
          
          // Excluir APENAS "MCF FUNDAMENTOS" puro (automação fake)
          // MANTER "A010 - MCF FUNDAMENTOS" pois é venda real do Make
          if (productName === "MCF FUNDAMENTOS") return;
          
          const isA010 = productName.includes("A010") || tx.product_category === 'a010';
          
          if (isA010) {
            const email = (tx.customer_email || "").toLowerCase().trim();
            if (!email) return;
            
            seenA010Emails.add(email);
          }
        });

        console.log("🔍 Vendas A010 (Make + hubla_make_sync, emails únicos):", seenA010Emails.size);
        return seenA010Emails.size;
      })();

      const vendasA010 = vendasA010Calc;

      // ===== FATURAMENTO A010 (MAKE + HUBLA_MAKE_SYNC - SOMA TOTAL SEM DEDUPLICAÇÃO) =====
      // CORREÇÃO: Usar allHublaData para somar TODAS as transações de ambas fontes
      const a010Faturado = (allHublaData || [])
        .filter((tx) => {
          if (tx.source !== 'make' && tx.source !== 'hubla_make_sync') return false;
          const productName = (tx.product_name || "").toUpperCase();
          return productName.includes("A010") || tx.product_category === 'a010';
        })
        .reduce((sum, tx) => sum + (tx.net_value || 0), 0);
      
      console.log("💸 A010 (Make + hubla_make_sync):", { vendas: vendasA010, faturado: a010Faturado });

      // ===== FATURAMENTO TOTAL (FÓRMULA FIXA DA PLANILHA) =====
      // Faturamento Total = Incorporador50k (Hubla) + A010 (Make) + OB Construir (Make) + OB Vitalício (Make)
      // NOTA: OB Evento NÃO entra na fórmula conforme planilha
      const faturamentoTotalFinal = faturamentoIncorporador + a010Faturado + obConstruirFaturado + obVitalicioFaturado;

      console.log("💰 Faturamento Total Debug:", {
        incorporador: faturamentoIncorporador,
        a010: a010Faturado,
        obVitalicio: obVitalicioFaturado,
        obConstruir: obConstruirFaturado,
        obEvento: obEventoFaturado,
        total: faturamentoTotalFinal,
      });

      // ===== GASTOS ADS =====
      const { data: adsData } = await supabase
        .from("daily_costs")
        .select("amount")
        .eq("cost_type", "ads")
        .gte("date", start)
        .lte("date", end);

      const gastosAds = adsData?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;

      // DEBUG: Log período e contagens
      console.log("📊 Director KPIs Debug:", {
        periodo: `${start} - ${end}`,
        totalTransacoes: hublaData?.length,
        faturamentoTotal: faturamentoTotalFinal,
        vendasA010,
        gastosAds,
      });

      // ===== CUSTOS OPERACIONAIS (equipe + escritório) =====
      const monthDate = format(startOfMonth(startDate || new Date()), "yyyy-MM-dd");
      const { data: operationalData } = await supabase
        .from("operational_costs")
        .select("amount, cost_type")
        .eq("month", monthDate);

      const custoEquipe =
        operationalData?.filter((c) => c.cost_type === "team").reduce((sum, c) => sum + (c.amount || 0), 0) || 0;
      const custoEscritorio =
        operationalData?.filter((c) => c.cost_type === "office").reduce((sum, c) => sum + (c.amount || 0), 0) || 0;

      // Custo operacional semanal = (Equipe + Escritório) / 4 (FÓRMULA FIXA DA PLANILHA)
      const custoOperacionalSemanal = (custoEquipe + custoEscritorio) / 4;
      // ===== CÁLCULOS FINAIS =====
      // CPL = Ads / Vendas A010
      const cpl = vendasA010 > 0 ? gastosAds / vendasA010 : 0;

      // Custo Total = Ads + Custo Operacional Semanal
      const custoTotal = gastosAds + custoOperacionalSemanal;

      // Lucro = Faturamento Total - Custo Total
      const lucro = faturamentoTotalFinal - custoTotal;

      // ===== FATURAMENTO CLINT (Bruto - usando product_price real) =====
      // CORREÇÃO: Deduplicar por timestamp_preciso + email + product_price
      // Isso permite múltiplas compras do mesmo cliente no mesmo dia (timestamps diferentes)
      // mas agrupa Hubla+Make da mesma transação real (mesmo timestamp e valor)
      
      // 1. Identificar quais hubla_ids são PARENTS que têm offers
      // CORREÇÃO: Usar allHublaData (dados brutos) em vez de hublaData (já deduplicado)
      const parentIdsWithOffers = new Set<string>();
      ((allHublaData as HublaTransaction[]) || []).forEach((tx) => {
        if (tx.hubla_id?.includes('-offer-')) {
          const parentId = tx.hubla_id.split('-offer-')[0];
          parentIdsWithOffers.add(parentId);
        }
      });
      
      console.log("🔍 Parents com offers:", parentIdsWithOffers.size);
      
      // 2. DEDUPLICAÇÃO POR HUBLA_ID: cada transação Hubla é única
      // Make só entra se não existir Hubla com email+date+price similar
      const seenHublaIds = new Set<string>();
      const deduplicatedClintTransactions: HublaTransaction[] = [];
      
      // Função de filtro comum
      const isValidClintTransaction = (tx: HublaTransaction): boolean => {
        if (tx.hubla_id?.startsWith("newsale-")) return false;
        if (tx.hubla_id?.includes('-offer-')) return false;
        if (!tx.customer_email) return false;
        if (!tx.net_value || tx.net_value <= 0) return false;
        if (parentIdsWithOffers.has(tx.hubla_id)) return false;
        
        const productName = tx.product_name || "";
        if (!isProductInFaturamentoClint(productName, tx.product_category)) return false;
        
        const productNameUpper = productName.toUpperCase();
        if (productNameUpper.includes("RENOVAÇÃO") || productNameUpper.includes("RENOVACAO")) return false;
        
        return true;
      };
      
      // PASSO 1: Processar TODAS as transações Hubla (cada hubla_id é único)
      // CORREÇÃO: Usar allHublaData para evitar perda de transações pela deduplicação global
      ((allHublaData as HublaTransaction[]) || []).forEach((tx) => {
        const source = tx.source || "hubla";
        if (source !== "hubla" && source !== null) return;
        
        if (!isValidClintTransaction(tx)) return;
        
        // Deduplicar por hubla_id (cada transação é única)
        if (seenHublaIds.has(tx.hubla_id)) return;
        seenHublaIds.add(tx.hubla_id);
        
        deduplicatedClintTransactions.push(tx);
      });
      
      console.log("🔵 Hubla Clint (por hubla_id):", seenHublaIds.size, "transações");
      
      // PASSO 2: Processar Make - adicionar APENAS se não existe Hubla similar (email+date+price)
      const seenMakeKeys = new Set<string>();
      let makeAdded = 0;
      
      ((allHublaData as HublaTransaction[]) || []).forEach((tx) => {
        if (tx.source !== "make") return;
        if (!isValidClintTransaction(tx)) return;
        
        const email = (tx.customer_email || "").toLowerCase().trim();
        const date = tx.sale_date.split('T')[0];
        const price = Math.round(tx.product_price || 0);
        const makeKey = `${email}|${date}|${price}`;
        
        // Evitar duplicatas Make
        if (seenMakeKeys.has(makeKey)) return;
        
        // CORREÇÃO FINAL: Se Make tem mesmo email + data + preço similar de um Hubla,
        // é duplicata INDEPENDENTE da categoria (Parceria = A009 do mesmo cliente)
        const hasHublaMatch = deduplicatedClintTransactions.some(htx => {
          const hEmail = (htx.customer_email || "").toLowerCase().trim();
          const hDate = htx.sale_date.split('T')[0];
          const hPrice = Math.round(htx.product_price || 0);
          
          // Duplicata: mesmo email + data + preço similar (independente de categoria)
          return hEmail === email && hDate === date && Math.abs(hPrice - price) < 100;
        });
        
        if (!hasHublaMatch) {
          seenMakeKeys.add(makeKey);
          deduplicatedClintTransactions.push(tx);
          makeAdded++;
        }
      });
      
      console.log("🟢 Make Clint (complementar):", makeAdded, "transações exclusivas");
      console.log("📊 Total Clint deduplicado:", deduplicatedClintTransactions.length);
      
      console.log("📊 Transações Clint deduplicadas:", deduplicatedClintTransactions.length);
      
      // 3. Calcular Faturamento Clint Bruto
      // NOVA LÓGICA: Deduplicar por email+produto normalizado e usar PREÇOS DE REFERÊNCIA
      // (ignora juros do cartão parcelado - A005/P2 usa valor do banco pois é variável)
      
      // Agrupar por email + produto normalizado, mantendo apenas 1 por grupo
      const groupedByEmailProduct = new Map<string, HublaTransaction>();
      
      deduplicatedClintTransactions
        .filter((tx) => {
          const installmentNum = tx.installment_number || 1;
          return installmentNum === 1; // Apenas primeira parcela
        })
        .forEach((tx) => {
          const email = (tx.customer_email || "").toLowerCase().trim();
          const productNormalized = normalizeProductForDedup(tx.product_name || "");
          const key = `${email}|${productNormalized}`;
          
          const existing = groupedByEmailProduct.get(key);
          // Se já existe, manter o de maior product_price (caso haja duplicata)
          if (!existing || (tx.product_price || 0) > (existing.product_price || 0)) {
            groupedByEmailProduct.set(key, tx);
          }
        });
      
      console.log("🔑 Grupos email+produto únicos:", groupedByEmailProduct.size);
      
      // Calcular Faturamento Clint usando product_price REAL (não preços de referência)
      const faturamentoClintDebug: { email: string; product: string; productPrice: number; source: string }[] = [];
      const faturamentoClint = Array.from(groupedByEmailProduct.values()).reduce((sum, tx) => {
        const productPrice = tx.product_price || 0;
        
        faturamentoClintDebug.push({
          email: (tx.customer_email || "").substring(0, 20),
          product: tx.product_name || "",
          productPrice: productPrice,
          source: tx.source || "hubla"
        });
        
        return sum + productPrice;
      }, 0);
      
      // DEBUG: Log Faturamento Clint
      console.log("💰 Faturamento Clint Bruto (product_price real):", {
        totalGrupos: groupedByEmailProduct.size,
        brutoTotal: faturamentoClint,
        samples: faturamentoClintDebug.slice(0, 10)
      });

      // ===== FATURAMENTO LÍQUIDO =====
      // Todas as parcelas contam (não só primeira), soma de net_value
      const faturamentoLiquidoDebug: { product: string; net: number; source: string }[] = [];
      const faturamentoLiquido = deduplicatedClintTransactions
        .reduce((sum, tx) => {
          faturamentoLiquidoDebug.push({ 
            product: tx.product_name || "", 
            net: tx.net_value || 0,
            source: tx.source || "hubla"
          });
          return sum + (tx.net_value || 0);
        }, 0);
      
      // DEBUG: Log Faturamento Líquido
      console.log("💵 Faturamento Líquido Debug:", deduplicatedClintTransactions.length, "transações, Total:", faturamentoLiquido);

      // Valores finais (sem override, cálculo real)
      const faturamentoClintFinal = faturamentoClint;
      const faturamentoLiquidoFinal = faturamentoLiquido;

      // ROI = Incorporador50k / (Incorporador50k - Lucro) × 100 (FÓRMULA FIXA DA PLANILHA)
      const denominadorROI = faturamentoIncorporador - lucro;
      const roi = denominadorROI > 0 ? (faturamentoIncorporador / denominadorROI) * 100 : 0;

      // ROAS = Faturamento Total / Gastos Ads
      const roas = gastosAds > 0 ? faturamentoTotalFinal / gastosAds : 0;

      // ===== PERÍODO ANTERIOR PARA COMPARAÇÃO =====
      const daysDiff =
        startDate && endDate ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1 : 7;

      const prevEnd = new Date(startDate || new Date());
      prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - daysDiff + 1);

      const prevStartStr = format(prevStart, "yyyy-MM-dd");
      const prevEndStr = format(prevEnd, "yyyy-MM-dd");

      // Buscar dados anteriores para comparação - TODAS AS FONTES (Hubla + Kiwify + Make)
      const prevStartBR = formatDateForBrazil(prevStart, false);
      const prevEndBR = formatDateForBrazil(prevEnd, true);
      const { data: prevHublaRaw } = await supabase
        .from("hubla_transactions")
        .select(
          "hubla_id, product_name, product_category, net_value, installment_number, total_installments, customer_name, customer_email, raw_data, sale_date, product_price, event_type, source",
        )
        .eq("sale_status", "completed")
        .or("event_type.eq.invoice.payment_succeeded,source.eq.kiwify,source.eq.make")
        .not("customer_email", "is", null)
        .neq("customer_email", "")
        .not("customer_name", "is", null)
        .neq("customer_name", "")
        .gt("net_value", 0)
        .gte("sale_date", prevStartBR)
        .lte("sale_date", prevEndBR);
      
      // Aplicar mesma deduplicação para período anterior
      const prevHubla = deduplicateTransactions((prevHublaRaw || []) as HublaTransaction[]);

      // Calcular métricas anteriores
      const prevSeenIncIds = new Set<string>();
      const prevFatIncorporador = (prevHubla || [])
        .filter((tx) => {
          const productName = (tx.product_name || "").toUpperCase();
          const isIncorporador = INCORPORADOR_PRODUCTS.some((code) => productName.startsWith(code));
          const isExcluded = EXCLUDED_PRODUCT_NAMES.some((name) => productName.includes(name.toUpperCase()));
          if (prevSeenIncIds.has(tx.hubla_id)) return false;
          if (isIncorporador && !isExcluded) {
            prevSeenIncIds.add(tx.hubla_id);
            return true;
          }
          return false;
        })
        .reduce((sum, tx) => sum + (tx.net_value || 0), 0);

      // OB Vitalício anterior
      const prevSeenObVitalicioEmails = new Set<string>();
      const prevObVitalicio = (prevHubla || [])
        .filter((tx) => {
          const name = (tx.product_name || "").toUpperCase();
          const isOB = name.includes("VITALIC") || tx.product_category === "ob_vitalicio";
          const email = (tx.customer_email || "").toLowerCase().trim();
          if (!email || prevSeenObVitalicioEmails.has(email)) return false;
          if (isOB) {
            prevSeenObVitalicioEmails.add(email);
            return true;
          }
          return false;
        })
        .reduce((sum, tx) => sum + (tx.net_value || 0), 0);

      // OB Construir anterior
      const prevSeenObConstruirEmails = new Set<string>();
      const prevObConstruir = (prevHubla || [])
        .filter((tx) => {
          const name = (tx.product_name || "").toUpperCase();
          const isOB = (name.includes("CONSTRUIR") || tx.product_category === "ob_construir") && !name.includes("VIVER");
          const email = (tx.customer_email || "").toLowerCase().trim();
          if (!email || prevSeenObConstruirEmails.has(email)) return false;
          if (isOB) {
            prevSeenObConstruirEmails.add(email);
            return true;
          }
          return false;
        })
        .reduce((sum, tx) => sum + (tx.net_value || 0), 0);

      // A010 Faturado anterior
      const prevSeenA010FatIds = new Set<string>();
      const prevFatA010 = (prevHubla || [])
        .filter((tx) => {
          const productName = (tx.product_name || "").toUpperCase();
          const isA010 = tx.product_category === "a010" || productName.includes("A010");
          if (tx.hubla_id?.includes('-offer-')) return false;
          if (prevSeenA010FatIds.has(tx.hubla_id)) return false;
          if (isA010) {
            prevSeenA010FatIds.add(tx.hubla_id);
            return true;
          }
          return false;
        })
        .reduce((sum, tx) => sum + (tx.net_value || 0), 0);

      // Faturamento Total anterior = Incorporador + A010 + OBs (FÓRMULA FIXA DA PLANILHA)
      const prevFaturamentoTotal = prevFatIncorporador + prevFatA010 + prevObConstruir + prevObVitalicio;

      // Vendas A010 período anterior - contar por emails únicos (mesmo que período atual)
      const prevA010Emails = new Set<string>();
      (prevHubla || []).forEach((tx) => {
        const productName = (tx.product_name || "").toUpperCase();
        const isA010 = tx.product_category === "a010" || productName.includes("A010");
        if (tx.hubla_id?.startsWith("newsale-")) return;
        if (isA010) {
          const email = (tx.customer_email || "").toLowerCase().trim();
          if (email) prevA010Emails.add(email);
        }
      });
      const prevVendasA010 = prevA010Emails.size;

      const { data: prevAds } = await supabase
        .from("daily_costs")
        .select("amount")
        .eq("cost_type", "ads")
        .gte("date", prevStartStr)
        .lte("date", prevEndStr);

      const prevGastosAds = prevAds?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;
      const prevCustoTotal = prevGastosAds + custoOperacionalSemanal;
      const prevCpl = prevVendasA010 > 0 ? prevGastosAds / prevVendasA010 : 0;
      const prevLucro = prevFaturamentoTotal - prevCustoTotal;
      // Faturamento Clint anterior (bruto) - APENAS A000/A003 com pagamento único
      const prevSeenClintBrutoIds = new Set<string>();
      const prevFaturamentoClint = (prevHubla || [])
        .filter((tx) => {
          if (tx.hubla_id?.startsWith("newsale-")) return false;
          if (prevSeenClintBrutoIds.has(tx.hubla_id)) return false;

          const productName = (tx.product_name || "").toUpperCase();
          const isA000ouA003 = productName.startsWith("A000") || productName.startsWith("A003");
          const installmentNum = tx.installment_number || 1;
          const totalInstallments = tx.total_installments || 1;
          const isPagamentoUnico = installmentNum === 1 && totalInstallments === 1;

          if (isA000ouA003 && isPagamentoUnico) {
            prevSeenClintBrutoIds.add(tx.hubla_id);
            return true;
          }
          return false;
        })
        .reduce((sum, tx) => sum + (tx.product_price || 0), 0);

      // Faturamento Líquido anterior - APENAS A000-A009 (excluindo A010 e A006)
      const prevSeenLiquidoIds = new Set<string>();
      const prevFaturamentoLiquido = (prevHubla || [])
        .filter((tx) => {
          if (tx.hubla_id?.startsWith("newsale-")) return false;
          if (prevSeenLiquidoIds.has(tx.hubla_id)) return false;

          const productName = (tx.product_name || "").toUpperCase();
          const isIncorporadorA00x = /^A00[0-9]/.test(productName);
          const isExcluded = productName.includes("A010") || productName.includes("A006");

          if (isIncorporadorA00x && !isExcluded) {
            prevSeenLiquidoIds.add(tx.hubla_id);
            return true;
          }
          return false;
        })
        .reduce((sum, tx) => sum + (tx.net_value || 0), 0);

      // ROI anterior = Incorporador50k / (Incorporador50k - Lucro) × 100 (FÓRMULA FIXA DA PLANILHA)
      const prevDenominadorROI = prevFatIncorporador - prevLucro;
      const prevRoi = prevDenominadorROI > 0 ? (prevFatIncorporador / prevDenominadorROI) * 100 : 0;

      // ROAS anterior = Faturamento Total / Gastos Ads
      const prevRoas = prevGastosAds > 0 ? prevFaturamentoTotal / prevGastosAds : 0;

      // Calcular variações
      const calcChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
      };

      // ===== ULTRAMETA (baseado em vendas A010) =====
      const ultrametaClint = vendasA010 * 1680;
      const ultrametaLiquido = vendasA010 * 1400;

      return {
        faturamentoTotal: {
          value: faturamentoTotalFinal,
          change: calcChange(faturamentoTotalFinal, prevFaturamentoTotal),
          isPositive: faturamentoTotalFinal >= prevFaturamentoTotal,
        },
        gastosAds: {
          value: gastosAds,
          change: calcChange(gastosAds, prevGastosAds),
          isPositive: gastosAds <= prevGastosAds,
        },
        cpl: {
          value: cpl,
          change: calcChange(cpl, prevCpl),
          isPositive: cpl <= prevCpl,
        },
        custoTotal: {
          value: custoTotal,
          change: calcChange(custoTotal, prevCustoTotal),
          isPositive: custoTotal <= prevCustoTotal,
        },
        lucro: {
          value: lucro,
          change: calcChange(lucro, prevLucro),
          isPositive: lucro >= prevLucro,
        },
        roi: {
          value: roi,
          change: calcChange(roi, prevRoi),
          isPositive: roi >= prevRoi,
        },
        roas: {
          value: roas,
          change: calcChange(roas, prevRoas),
          isPositive: roas <= prevRoas,
        },
        vendasA010,
        faturamentoIncorporador,
        // Novos campos Ultrameta (com override para semana específica)
        ultrametaClint,
        faturamentoClint: faturamentoClintFinal,
        ultrametaLiquido,
        faturamentoLiquido: faturamentoLiquidoFinal,
      };
    },
    refetchInterval: 30000,
  });
}
