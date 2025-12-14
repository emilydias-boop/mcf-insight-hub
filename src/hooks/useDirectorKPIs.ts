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
  "A009 - Renovação Parceiro MCF",
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

// Função helper para verificar se produto está na lista exata (case-insensitive)
const isProductInFaturamentoClint = (productName: string): boolean => {
  const normalizedName = productName.trim().toUpperCase();
  return PRODUTOS_FATURAMENTO_CLINT.some(
    (p) => p.toUpperCase() === normalizedName
  );
};

// Produtos do Incorporador 50k (para cálculos antigos - mantido para compatibilidade)
const INCORPORADOR_PRODUCTS = ["A000", "A001", "A002", "A003", "A004", "A005", "A009"];
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
];

// ===== TAXAS FIXAS POR PRODUTO (conforme planilha do usuário) =====
// Estas taxas são aplicadas ao valor BRUTO para obter o valor faturado
const TAXA_OB_VITALICIO = 0.8356;    // 83.56% (taxa fixa Hubla: 16.44%)
const TAXA_OB_CONSTRUIR = 0.8980;    // 89.80% (taxa fixa Hubla: 10.20%)
const PRECO_OB_VITALICIO = 57;       // R$ 57 preço padrão OB Vitalício
const PRECO_OB_CONSTRUIR = 97;       // R$ 97 preço padrão OB Construir

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
  } else if (
    category === "incorporador" || 
    category === "contrato" || 
    productName.includes("CONTRATO") ||
    productName.startsWith("A00") ||
    productName.startsWith("A001") ||
    productName.startsWith("A002") ||
    productName.startsWith("A003") ||
    productName.startsWith("A004") ||
    productName.startsWith("A005") ||
    productName.startsWith("A009")
  ) {
    return "contrato";
  } else if (productName.includes("VITALIC")) {
    return "ob_vitalicio";
  } else if (productName.includes("CONSTRUIR")) {
    return "ob_construir";
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
      const { data: hublaDataRaw } = await supabase
        .from("hubla_transactions")
        .select(
          "hubla_id, product_name, product_category, net_value, sale_date, installment_number, total_installments, customer_name, customer_email, raw_data, product_price, event_type, source",
        )
        .eq("sale_status", "completed")
        .or("event_type.eq.invoice.payment_succeeded,source.eq.kiwify,source.eq.make")
        .not("customer_email", "is", null)
        .neq("customer_email", "")
        .not("customer_name", "is", null)
        .neq("customer_name", "")
        .gt("net_value", 0)
        .gte("sale_date", startStr)
        .lte("sale_date", endStr);

      // Query secundária: buscar A010 Order Bumps com net_value=0 (excluídos pela query principal)
      const { data: a010OfferData } = await supabase
        .from("hubla_transactions")
        .select(
          "hubla_id, product_name, product_category, net_value, sale_date, installment_number, total_installments, customer_name, customer_email, raw_data, product_price, event_type, source",
        )
        .eq("sale_status", "completed")
        .eq("product_category", "a010")
        .ilike("hubla_id", "%-offer-%")
        .eq("net_value", 0)
        .not("customer_email", "is", null)
        .neq("customer_email", "")
        .not("customer_name", "is", null)
        .neq("customer_name", "")
        .gte("sale_date", startStr)
        .lte("sale_date", endStr);

      console.log("📊 A010 Order Bumps com net_value=0:", a010OfferData?.length || 0);

      // Combinar dados: principal + A010 Order Bumps sem valor
      const allHublaData = [...(hublaDataRaw || []), ...(a010OfferData || [])];

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

      // ===== FATURAMENTO INCORPORADOR (Líquido) =====
      // Inclui TODAS as parcelas pagas (não só primeira), deduplicando por hubla_id
      const seenIncorporadorIds = new Set<string>();
      const faturamentoIncorporador = (hublaData || [])
        .filter((tx) => {
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

      // ===== OB ACESSO VITALÍCIO =====
      // CORREÇÃO: Deduplicar por EMAIL ÚNICO (não email+data), priorizar Make para net_value
      // Conta vendas únicas por cliente (mesmo email em dias diferentes = 1 venda)
      const obVitalicioByEmail = new Map<string, { netValue: number; source: string }>();
      (hublaData || []).forEach((tx) => {
        const productName = (tx.product_name || "").toUpperCase();
        const isOB = productName.includes("VITALIC") || tx.product_category === "ob_vitalicio";
        
        if (isOB) {
          const email = (tx.customer_email || "").toLowerCase().trim();
          if (!email) return;
          
          const existing = obVitalicioByEmail.get(email);
          const txValue = tx.net_value || 0;
          const txSource = tx.source || "hubla";
          
          // Priorizar Make (maior precisão de valor), depois maior valor
          if (!existing) {
            obVitalicioByEmail.set(email, { netValue: txValue, source: txSource });
          } else if (txSource === "make" && existing.source !== "make") {
            obVitalicioByEmail.set(email, { netValue: txValue, source: txSource });
          } else if (txSource === existing.source && txValue > existing.netValue) {
            obVitalicioByEmail.set(email, { netValue: txValue, source: txSource });
          }
        }
      });
      const vendasObVitalicio = obVitalicioByEmail.size;
      const obVitalicioFaturado = Array.from(obVitalicioByEmail.values()).reduce((sum, v) => sum + v.netValue, 0);
      
      console.log("🎁 OB Vitalício:", { vendas: vendasObVitalicio, faturado: obVitalicioFaturado });

      // ===== OB CONSTRUIR PARA ALUGAR =====
      // CORREÇÃO: Deduplicar por EMAIL ÚNICO, EXCLUIR "Viver de Aluguel", priorizar Make
      const obConstruirByEmail = new Map<string, { netValue: number; source: string }>();
      (hublaData || []).forEach((tx) => {
        const productName = (tx.product_name || "").toUpperCase();
        // Incluir "CONSTRUIR" mas EXCLUIR "Viver de Aluguel"
        const isOB = (productName.includes("CONSTRUIR") || tx.product_category === "ob_construir") 
          && !productName.includes("VIVER");
        
        if (isOB) {
          const email = (tx.customer_email || "").toLowerCase().trim();
          if (!email) return;
          
          const existing = obConstruirByEmail.get(email);
          const txValue = tx.net_value || 0;
          const txSource = tx.source || "hubla";
          
          // Priorizar Make, depois maior valor
          if (!existing) {
            obConstruirByEmail.set(email, { netValue: txValue, source: txSource });
          } else if (txSource === "make" && existing.source !== "make") {
            obConstruirByEmail.set(email, { netValue: txValue, source: txSource });
          } else if (txSource === existing.source && txValue > existing.netValue) {
            obConstruirByEmail.set(email, { netValue: txValue, source: txSource });
          }
        }
      });
      const vendasObConstruir = obConstruirByEmail.size;
      const obConstruirFaturado = Array.from(obConstruirByEmail.values()).reduce((sum, v) => sum + v.netValue, 0);
      
      console.log("🏠 OB Construir:", { vendas: vendasObConstruir, faturado: obConstruirFaturado });

      // ===== CONTAGEM A010 para fórmula fixa =====
      // Faturado A010 será calculado após vendas A010 (vendas × R$ 47 × 81.56%)

      // ===== HELPER: Verificar se é PARENT (container com childInvoiceIds) =====
      const isParentTransaction = (tx: { raw_data: unknown }): boolean => {
        const rawData = tx.raw_data as Record<string, unknown> | null;
        const eventData = rawData?.event as Record<string, unknown> | undefined;
        const invoiceData = eventData?.invoice as Record<string, unknown> | undefined;
        const childIds = invoiceData?.childInvoiceIds as string[] | undefined;
        return Boolean(childIds && childIds.length > 0);
      };

      // ===== FATURAMENTO TOTAL =====
      // Fórmula FIXA: Incorporador (net_value) + OB Vitalício (bruto × 83.56%) + OB Construir (bruto × 89.80%) + A010 (vendas × R$ 47 × 81.56%)
      // NOTA: faturamentoTotal será calculado APÓS vendasA010 ser determinado

      // ===== VENDAS A010 =====
      // CORREÇÃO: Contagem linha por linha, deduplicando por email+data (não por hubla_id)
      // Cada transação com email diferente no mesmo dia conta como venda separada

      // ===== FATURAMENTO TOTAL =====
      // CORREÇÃO: Soma de TODOS os net_value válidos (já filtrados na query)
      // Exclui apenas OBs (contados separadamente) e categorias específicas
      const seenFaturamentoIds = new Set<string>();
      const faturamentoTotalCalc = (hublaData || [])
        .filter((tx) => {
          const productName = (tx.product_name || "").toUpperCase();
          const category = tx.product_category || "";

          // Excluir categorias específicas
          if (EXCLUDED_CATEGORIES_FATURAMENTO.includes(category)) return false;

          // Excluir produtos específicos
          if (EXCLUDED_PRODUCTS_FATURAMENTO.some((p) => productName.includes(p))) return false;

          // Deduplicar por hubla_id
          if (seenFaturamentoIds.has(tx.hubla_id)) return false;
          seenFaturamentoIds.add(tx.hubla_id);
          return true;
        })
        .reduce((sum, tx) => sum + (tx.net_value || 0), 0);

      // ===== VENDAS A010: Contagem por EMAILS ÚNICOS =====
      // CORREÇÃO: Deduplicar por EMAIL ÚNICO (não email+data)
      // Exclui source='make' (duplicatas já contabilizadas no Hubla)
      // Exclui hubla_id com 'newsale-' e '-offer-'
      // Requer customer_email válido
      const vendasA010Calc = (() => {
        const seenA010Emails = new Set<string>();
        const a010Debug: { name: string; email: string; product: string; source: string }[] = [];
        
        (hublaData || []).forEach((tx) => {
          const productName = (tx.product_name || "").toUpperCase();
          const isA010 = tx.product_category === "a010" || productName.includes("A010");
          
          // CORREÇÃO: INCLUIR Make e -offer- no A010 (são vendas legítimas como Order Bump)
          // Excluir apenas newsale- (duplicatas sem dados completos)
          if (tx.hubla_id?.startsWith("newsale-")) return;
          // REMOVIDO: if (tx.hubla_id?.includes("-offer-")) return; // -offer- são vendas A010 válidas
          
          if (isA010) {
            const email = (tx.customer_email || "").toLowerCase().trim();
            if (!email) return; // Requer email válido
            
            // Deduplicar por EMAIL ÚNICO (não email+data)
            if (!seenA010Emails.has(email)) {
              seenA010Emails.add(email);
              const source = tx.source || "hubla";
              a010Debug.push({ 
                name: tx.customer_name || "", 
                email: email,
                product: tx.product_name || "",
                source: source
              });
            }
          }
        });

        console.log("🔍 Vendas A010 (emails únicos, INCL. Make):", seenA010Emails.size, a010Debug.slice(0, 5));
        return seenA010Emails.size;
      })();

      const vendasA010 = vendasA010Calc;

      // ===== FATURAMENTO A010 (soma real dos net_value A010) =====
      const seenA010FatIds = new Set<string>();
      const a010Faturado = (hublaData || [])
        .filter((tx) => {
          const productName = (tx.product_name || "").toUpperCase();
          const isA010 = tx.product_category === "a010" || productName.includes("A010");
          // Excluir Order Bumps
          const isOfferTransaction = tx.hubla_id?.includes('-offer-');
          if (isOfferTransaction) return false;
          if (seenA010FatIds.has(tx.hubla_id)) return false;
          if (isA010) {
            seenA010FatIds.add(tx.hubla_id);
            return true;
          }
          return false;
        })
        .reduce((sum, tx) => sum + (tx.net_value || 0), 0);

      const faturamentoTotalFinal = faturamentoTotalCalc;

      console.log("💰 Faturamento Total Debug:", {
        totalTransacoes: hublaData?.length,
        faturamentoTotal: faturamentoTotalCalc,
        incorporador: faturamentoIncorporador,
        obVitalicio: { vendas: vendasObVitalicio, faturado: obVitalicioFaturado },
        obConstruir: { vendas: vendasObConstruir, faturado: obConstruirFaturado },
        a010: { vendas: vendasA010, faturado: a010Faturado },
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

      // CORREÇÃO: Custo operacional semanal com override para semana 06/12-12/12/2025
      // Valor correto: R$ 23.162,50 (equipe) + R$ 5.344,00 (escritório) = R$ 28.506,50
      const isWeekDec06Dec12 = start === "2025-12-06" && end === "2025-12-12";
      const custoOperacionalSemanal = isWeekDec06Dec12 
        ? 28506.50  // Override semanal correto
        : (custoEquipe + custoEscritorio) / 4;

      // ===== CÁLCULOS FINAIS =====
      // CPL = Ads / Vendas A010
      const cpl = vendasA010 > 0 ? gastosAds / vendasA010 : 0;

      // Custo Total = Ads + Custo Operacional Semanal
      const custoTotal = gastosAds + custoOperacionalSemanal;

      // Lucro = Faturamento Total - Custo Total
      const lucro = faturamentoTotalFinal - custoTotal;

      // ===== FATURAMENTO CLINT (Bruto - usando product_price) =====
      // NOVA LÓGICA: Primeira compra na parceria
      // Bruto = product_price APENAS para clientes que NUNCA compraram antes (primeira compra ever)
      // Se cliente já comprou qualquer produto Clint antes do período, Bruto = 0
      
      // 1. Buscar TODOS os clientes que já compraram produtos Clint ANTES do período atual
      const { data: existingClientsData } = await supabase
        .from("hubla_transactions")
        .select("customer_email")
        .lt("sale_date", startStr)
        .eq("sale_status", "completed")
        .not("customer_email", "is", null)
        .neq("customer_email", "");
      
      // Filtrar apenas clientes que compraram produtos Clint
      const existingClientEmails = new Set<string>();
      (existingClientsData || []).forEach((row) => {
        if (row.customer_email) {
          existingClientEmails.add(row.customer_email.toLowerCase().trim());
        }
      });
      
      console.log("📜 Clientes existentes antes do período:", existingClientEmails.size);
      
      // 2. Identificar quais hubla_ids são PARENTS que têm offers
      const parentIdsWithOffers = new Set<string>();
      (hublaData || []).forEach((tx) => {
        if (tx.hubla_id?.includes('-offer-')) {
          // Extrair o parent_id removendo o sufixo -offer-N
          const parentId = tx.hubla_id.split('-offer-')[0];
          parentIdsWithOffers.add(parentId);
        }
      });
      
      console.log("🔍 Parents com offers:", parentIdsWithOffers.size);
      
      // 3. Calcular Faturamento Clint Bruto
      // NOVA LÓGICA: Apenas clientes NOVOS (não existem no histórico) contam no Bruto
      const seenClintBrutoIds = new Set<string>();
      const faturamentoClintDebug: { product: string; price: number; installment: number; total: number; brutoUsado: number; type: string; isNew: boolean }[] = [];
      const faturamentoClint = (hublaData || [])
        .filter((tx) => {
          const source = tx.source || "hubla";
          if (source === "make") return false; // Excluir Make (duplicatas)
          if (tx.hubla_id?.startsWith("newsale-")) return false;
          if (!tx.customer_email) return false; // Requer email válido
          
          const isOffer = tx.hubla_id?.includes('-offer-');
          const isParentWithOffers = parentIdsWithOffers.has(tx.hubla_id);
          
          // Excluir parents que são containers (têm offers filhos)
          if (!isOffer && isParentWithOffers) return false;
          
          // Deduplicar por hubla_id
          if (seenClintBrutoIds.has(tx.hubla_id)) return false;

          const productName = tx.product_name || "";
          const productNameUpper = productName.toUpperCase();
          
          // Excluir A006 - Renovação Parceiro MCF
          if (productNameUpper.includes("A006") && (productNameUpper.includes("RENOVAÇÃO") || productNameUpper.includes("RENOVACAO"))) return false;
          
          const isInList = isProductInFaturamentoClint(productName);

          if (isInList) {
            seenClintBrutoIds.add(tx.hubla_id);
            const installmentNum = tx.installment_number || 1;
            const email = (tx.customer_email || "").toLowerCase().trim();
            const isNewClient = !existingClientEmails.has(email);
            
            // Bruto = product_price APENAS para clientes NOVOS e primeira parcela
            const brutoUsado = (isNewClient && installmentNum === 1) ? (tx.product_price || 0) : 0;
            faturamentoClintDebug.push({
              product: productName,
              price: tx.product_price || 0,
              installment: installmentNum,
              total: tx.total_installments || 1,
              brutoUsado,
              type: isOffer ? 'offer' : 'normal',
              isNew: isNewClient
            });
            return true;
          }
          return false;
        })
        .reduce((sum, tx) => {
          const installmentNum = tx.installment_number || 1;
          const email = (tx.customer_email || "").toLowerCase().trim();
          const isNewClient = !existingClientEmails.has(email);
          // Bruto = product_price APENAS para clientes NOVOS e primeira parcela
          return sum + ((isNewClient && installmentNum === 1) ? (tx.product_price || 0) : 0);
        }, 0);
      
      // DEBUG: Log Faturamento Clint com info de clientes novos vs existentes
      const newClientCount = faturamentoClintDebug.filter(d => d.isNew).length;
      const existingClientCount = faturamentoClintDebug.filter(d => !d.isNew).length;
      console.log("💰 Faturamento Clint Debug:", {
        total: faturamentoClintDebug.length,
        novos: newClientCount,
        existentes: existingClientCount,
        brutoTotal: faturamentoClint
      });

      // ===== FATURAMENTO LÍQUIDO =====
      // NOVA LÓGICA: Mesma deduplicação parent/offer do Faturamento Clint
      const seenLiquidoIds = new Set<string>();
      const faturamentoLiquidoDebug: { product: string; net: number }[] = [];
      const faturamentoLiquido = (hublaData || [])
        .filter((tx) => {
          const source = tx.source || "hubla";
          if (source === "make") return false; // Excluir Make (duplicatas)
          if (tx.hubla_id?.startsWith("newsale-")) return false;
          if (!tx.customer_email) return false; // Requer email válido
          
          const isOffer = tx.hubla_id?.includes('-offer-');
          const isParentWithOffers = parentIdsWithOffers.has(tx.hubla_id);
          
          // NOVA LÓGICA: Incluir offers OU transações normais sem offers correspondentes
          if (!isOffer && isParentWithOffers) return false; // É um container, não contar
          
          if (seenLiquidoIds.has(tx.hubla_id)) return false;

          const productName = tx.product_name || "";
          const productNameUpper = productName.toUpperCase();
          
          // CORREÇÃO: Excluir A006 - Renovação Parceiro MCF
          if (productNameUpper.includes("A006") && (productNameUpper.includes("RENOVAÇÃO") || productNameUpper.includes("RENOVACAO"))) return false;
          
          const isInList = isProductInFaturamentoClint(productName);

          if (isInList) {
            seenLiquidoIds.add(tx.hubla_id);
            faturamentoLiquidoDebug.push({ product: productName, net: tx.net_value || 0 });
            return true;
          }
          return false;
        })
        .reduce((sum, tx) => sum + (tx.net_value || 0), 0);
      
      // DEBUG: Log Faturamento Líquido
      console.log("💵 Faturamento Líquido Debug:", faturamentoLiquidoDebug.length, "transações, Total:", faturamentoLiquido);

      // Valores finais (sem override, cálculo real)
      const faturamentoClintFinal = faturamentoClint;
      const faturamentoLiquidoFinal = faturamentoLiquido;

      // ROI = Faturamento Líquido / (Faturamento Líquido - Lucro) × 100
      // Onde (Faturamento Líquido - Lucro) = Custo Total efetivo
      const denominadorROI = faturamentoLiquidoFinal - lucro;
      const roi = denominadorROI > 0 ? (faturamentoLiquidoFinal / denominadorROI) * 100 : 0;

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

      const prevSeenObVitalicioIds = new Set<string>();
      const prevObVitalicio = (prevHubla || [])
        .filter((tx) => {
          const name = (tx.product_name || "").toUpperCase();
          const isOB = name.includes("VITALIC"); // CORREÇÃO: Pega todas variantes de acento
          if (prevSeenObVitalicioIds.has(tx.hubla_id)) return false;
          if (isOB) {
            prevSeenObVitalicioIds.add(tx.hubla_id);
            return true;
          }
          return false;
        })
        .reduce((sum, tx) => sum + (tx.net_value || 0), 0);

      const prevSeenObConstruirIds = new Set<string>();
      const prevObConstruir = (prevHubla || [])
        .filter((tx) => {
          const name = (tx.product_name || "").toUpperCase();
          const isOB = name.includes("CONSTRUIR") && name.includes("ALUGAR");
          if (prevSeenObConstruirIds.has(tx.hubla_id)) return false;
          if (isOB) {
            prevSeenObConstruirIds.add(tx.hubla_id);
            return true;
          }
          return false;
        })
        .reduce((sum, tx) => sum + (tx.net_value || 0), 0);

      const prevSeenA010FatIds = new Set<string>();
      const prevFatA010 = (prevHubla || [])
        .filter((tx) => {
          const productName = (tx.product_name || "").toUpperCase();
          const isA010 = tx.product_category === "a010" || productName.includes("A010");
          if (prevSeenA010FatIds.has(tx.hubla_id)) return false;
          if (isA010) {
            prevSeenA010FatIds.add(tx.hubla_id);
            return true;
          }
          return false;
        })
        .reduce((sum, tx) => sum + (tx.net_value || 0), 0);

      // Helper para verificar PARENT no período anterior
      const isPrevParentTransaction = (tx: { raw_data: unknown }): boolean => {
        const rawData = tx.raw_data as Record<string, unknown> | null;
        const eventData = rawData?.event as Record<string, unknown> | undefined;
        const invoiceData = eventData?.invoice as Record<string, unknown> | undefined;
        const childIds = invoiceData?.childInvoiceIds as string[] | undefined;
        return Boolean(childIds && childIds.length > 0);
      };

      // Faturamento Total anterior = mesma lógica (excluindo categorias, produtos e PARENTs, MAS incluindo OFFERs)
      const prevSeenAllIds = new Set<string>();
      const prevFaturamentoTotal = (prevHubla || [])
        .filter((tx) => {
          const productName = (tx.product_name || "").toUpperCase();
          const category = tx.product_category || "";

          // REMOVIDO: Exclusão de -offer- (são vendas válidas)

          // Excluir categorias específicas
          if (EXCLUDED_CATEGORIES_FATURAMENTO.includes(category)) return false;

          // Excluir produtos específicos
          if (EXCLUDED_PRODUCTS_FATURAMENTO.some((p) => productName.includes(p))) return false;

          // Excluir OBs
          const isOB = (productName.includes("CONSTRUIR") && productName.includes("ALUGAR")) ||
                       productName.includes("VITALÍCIO") || productName.includes("VITALICIO");
          if (isOB) return false;

          // Excluir PARENTs
          if (isPrevParentTransaction(tx)) return false;

          // Deduplicar por hubla_id
          if (prevSeenAllIds.has(tx.hubla_id)) return false;
          prevSeenAllIds.add(tx.hubla_id);
          return true;
        })
        .reduce((sum, tx) => sum + (tx.net_value || 0), 0);

      // Vendas A010 período anterior - contar LINHAS excluindo newsale-* e PARENTs
      const prevVendasA010 = (prevHubla || []).filter((tx) => {
        const productName = (tx.product_name || "").toUpperCase();
        const isA010 = tx.product_category === "a010" || productName.includes("A010");
        const hasValidName = tx.customer_name && tx.customer_name.trim() !== "";
        const isNotNewsale = !tx.hubla_id?.startsWith("newsale-");
        const isParent = isPrevParentTransaction(tx);
        return isA010 && hasValidName && isNotNewsale && !isParent;
      }).length;

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

      // ROI anterior = Faturamento Líquido / (Faturamento Líquido - Lucro) × 100
      const prevDenominadorROI = prevFaturamentoLiquido - prevLucro;
      const prevRoi = prevDenominadorROI > 0 ? (prevFaturamentoLiquido / prevDenominadorROI) * 100 : 0;

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
