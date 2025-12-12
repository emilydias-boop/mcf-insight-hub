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

// Produtos do Incorporador 50k (validados contra planilha)
// Inclui A002, A004, A005 conforme planilha do usuário
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
const EXCLUDED_CATEGORIES_FATURAMENTO = ["clube_arremate", "efeito_alavanca", "renovacao", "imersao"];
const EXCLUDED_PRODUCTS_FATURAMENTO = [
  "SÓCIO MCF",
  "SOCIO MCF",
  "ALMOÇO NETWORKING",
  "ALMOCO NETWORKING",
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

// NOVA CHAVE: email + data + tipo + valor arredondado
// Isso permite múltiplas compras do mesmo cliente no mesmo dia (valores diferentes)
// Mas agrupa a MESMA transação entre Hubla e Make (valores similares)
const getSaleKey = (tx: HublaTransaction): string => {
  const email = (tx.customer_email || "").toLowerCase().trim();
  const date = tx.sale_date.split("T")[0];
  const tipoNormalizado = getNormalizedProductType(tx);
  // Arredondar valor para 1 casa decimal (tolera centavos de diferença entre fontes)
  const valorArredondado = Math.round((tx.net_value || 0) * 10);
  return `${email}|${date}|${tipoNormalizado}|${valorArredondado}`;
};

// Deduplicação INTELIGENTE por TRANSAÇÃO (email+data+tipo+valor)
// Permite múltiplas compras do mesmo cliente, mas remove duplicatas entre Hubla e Make
const deduplicateTransactions = (transactions: HublaTransaction[]): HublaTransaction[] => {
  // Agrupar por chave (email+data+tipo+valor)
  const groups = new Map<string, HublaTransaction[]>();
  
  transactions.forEach((tx) => {
    const key = getSaleKey(tx);
    const existing = groups.get(key) || [];
    existing.push(tx);
    groups.set(key, existing);
  });
  
  let taxaFixedCount = 0;
  let duplicatesRemoved = 0;
  
  // Para cada grupo, escolher a melhor transação
  const result = Array.from(groups.entries()).map(([key, txs]) => {
    if (txs.length > 1) duplicatesRemoved++;
    
    const tipoNormalizado = key.split('|')[2];
    const minValue = VALOR_MINIMO_POR_CATEGORIA[tipoNormalizado] || 30;
    
    const makeTx = txs.find(t => t.source === 'make');
    const hublaTx = txs.find(t => t.source === 'hubla' || !t.source);
    const kiwifyTx = txs.find(t => t.source === 'kiwify');
    
    // REGRA 1: Se Make existe E tem valor válido (>= mínimo) → usar Make
    if (makeTx && (makeTx.net_value || 0) >= minValue) {
      return makeTx;
    }
    
    // REGRA 2: Se Make tem valor baixo (taxa) E Hubla existe com valor válido → usar Hubla
    if (makeTx && (makeTx.net_value || 0) < minValue && hublaTx && (hublaTx.net_value || 0) >= minValue) {
      taxaFixedCount++;
      return hublaTx;
    }
    
    // REGRA 3: Se só Make existe (mesmo com valor baixo) → usar Make
    if (makeTx && !hublaTx && !kiwifyTx) {
      return makeTx;
    }
    
    // REGRA 4: Se Hubla existe → usar Hubla
    if (hublaTx) {
      return hublaTx;
    }
    
    // REGRA 5: Se Kiwify existe → usar Kiwify
    if (kiwifyTx) {
      return kiwifyTx;
    }
    
    // REGRA 6: Fallback - usar o de maior valor
    return txs.reduce((best, tx) => 
      (tx.net_value || 0) > (best.net_value || 0) ? tx : best
    , txs[0]);
  });
  
  console.log(`🔧 Deduplicação: ${transactions.length} → ${result.length} (${duplicatesRemoved} duplicatas removidas, ${taxaFixedCount} taxas corrigidas)`);
  
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

      // Buscar transações Hubla + Kiwify + Make no período (com fuso horário BR)
      // CORREÇÃO: Adicionar filtros para excluir registros inválidos na query
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

      // Aplicar deduplicação inteligente: Make > Hubla/Kiwify (Make tem taxa real)
      const hublaData = deduplicateTransactions((hublaDataRaw || []) as HublaTransaction[]);
      
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

      // ===== OB ACESSO VITALÍCIO (FÓRMULA FIXA: quantidade × preço) =====
      // Fórmula: COUNT(-offer- transactions) × R$ 57
      const seenObVitalicioIds = new Set<string>();
      (hublaData || []).forEach((tx) => {
        const productName = (tx.product_name || "").toUpperCase();
        const isOB = productName.includes("VITALIC");
        const isOfferTransaction = tx.hubla_id?.includes('-offer-');
        
        if (isOB && isOfferTransaction && !seenObVitalicioIds.has(tx.hubla_id)) {
          seenObVitalicioIds.add(tx.hubla_id);
        }
      });
      const vendasObVitalicio = seenObVitalicioIds.size;
      const obVitalicioFaturado = vendasObVitalicio * PRECO_OB_VITALICIO;

      // ===== OB CONSTRUIR PARA ALUGAR (FÓRMULA FIXA: quantidade × preço) =====
      // Fórmula: COUNT(-offer- transactions) × R$ 97
      const seenObConstruirIds = new Set<string>();
      (hublaData || []).forEach((tx) => {
        const productName = (tx.product_name || "").toUpperCase();
        const isOB = productName.includes("CONSTRUIR") && productName.includes("ALUGAR");
        const isOfferTransaction = tx.hubla_id?.includes('-offer-');
        
        if (isOB && isOfferTransaction && !seenObConstruirIds.has(tx.hubla_id)) {
          seenObConstruirIds.add(tx.hubla_id);
        }
      });
      const vendasObConstruir = seenObConstruirIds.size;
      const obConstruirFaturado = vendasObConstruir * PRECO_OB_CONSTRUIR;

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

      // Cálculo automático de Vendas A010 (DEDUPLICADO por email+data)
      const vendasA010Calc = (() => {
        const seenA010Keys = new Set<string>();
        const a010Debug: { name: string; email: string; date: string; product: string }[] = [];
        
        (hublaData || []).forEach((tx) => {
          const productName = (tx.product_name || "").toUpperCase();
          const isA010 = tx.product_category === "a010" || productName.includes("A010");
          
          // Excluir Order Bumps (são OBs vendidos junto com A010, não A010 em si)
          const isOfferTransaction = tx.hubla_id?.includes('-offer-');
          if (isOfferTransaction) return;
          
          if (isA010) {
            // Chave: email normalizado + data
            const email = (tx.customer_email || "").toLowerCase().trim();
            const date = tx.sale_date.split("T")[0];
            const key = `${email}|${date}`;
            
            if (!seenA010Keys.has(key)) {
              seenA010Keys.add(key);
              a010Debug.push({ 
                name: tx.customer_name || "", 
                email: email,
                date: date,
                product: tx.product_name || ""
              });
            }
          }
        });

        console.log("🔍 Vendas A010 (deduplicado por email+data):", seenA010Keys.size, a010Debug.slice(0, 5));
        return seenA010Keys.size;
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
      // CORREÇÃO: Bruto só conta PRIMEIRA PARCELA (installment_number = 1 ou null)
      // Recorrências (installment_number > 1) tem Bruto = 0 conforme planilha
      const seenClintBrutoIds = new Set<string>();
      const faturamentoClintDebug: { product: string; price: number; installment: number; total: number; brutoUsado: number }[] = [];
      const faturamentoClint = (hublaData || [])
        .filter((tx) => {
          // Excluir newsale-* (duplicatas webhook)
          if (tx.hubla_id?.startsWith("newsale-")) return false;
          // Deduplicar por hubla_id
          if (seenClintBrutoIds.has(tx.hubla_id)) return false;

          const productName = (tx.product_name || "").toUpperCase();
          
          // REGRA: Produtos Incorporador (A000-A009)
          const isIncorporador = INCORPORADOR_PRODUCTS.some((code) => productName.startsWith(code));
          const isExcluded = EXCLUDED_PRODUCT_NAMES.some((name) => productName.includes(name.toUpperCase()));

          if (isIncorporador && !isExcluded) {
            seenClintBrutoIds.add(tx.hubla_id);
            const installmentNum = tx.installment_number || 1;
            // REGRA: Bruto = product_price APENAS se primeira parcela, senão = 0
            const brutoUsado = installmentNum === 1 ? (tx.product_price || 0) : 0;
            faturamentoClintDebug.push({
              product: tx.product_name || "",
              price: tx.product_price || 0,
              installment: installmentNum,
              total: tx.total_installments || 1,
              brutoUsado
            });
            return true;
          }
          return false;
        })
        .reduce((sum, tx) => {
          const installmentNum = tx.installment_number || 1;
          // Bruto = product_price APENAS se primeira parcela
          return sum + (installmentNum === 1 ? (tx.product_price || 0) : 0);
        }, 0);
      
      // DEBUG: Log Faturamento Clint
      console.log("💰 Faturamento Clint Debug:", faturamentoClintDebug.length, "transações, Total:", faturamentoClint, faturamentoClintDebug);

      // ===== FATURAMENTO LÍQUIDO =====
      // CORREÇÃO: APENAS produtos A000-A009 (excluindo OBs e A010)
      const seenLiquidoIds = new Set<string>();
      const faturamentoLiquidoDebug: { product: string; net: number }[] = [];
      const faturamentoLiquido = (hublaData || [])
        .filter((tx) => {
          if (tx.hubla_id?.startsWith("newsale-")) return false;
          if (seenLiquidoIds.has(tx.hubla_id)) return false;

          const productName = (tx.product_name || "").toUpperCase();
          
          // REGRA CORRIGIDA: Apenas produtos A000-A009 (regex)
          const isIncorporadorA00x = /^A00[0-9]/.test(productName);
          
          // Excluir A010 e A006 (renovações)
          const isExcluded = productName.includes("A010") || productName.includes("A006");

          if (isIncorporadorA00x && !isExcluded) {
            seenLiquidoIds.add(tx.hubla_id);
            faturamentoLiquidoDebug.push({ product: tx.product_name || "", net: tx.net_value || 0 });
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

      // Buscar dados anteriores para comparação - mesmo filtro (Hubla + Kiwify + Make) com fuso BR
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
