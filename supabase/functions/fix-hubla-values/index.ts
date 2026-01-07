import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Produtos que ENTRAM no Incorporador 50k
const INCORPORADOR_50K_CATEGORIES = ['incorporador', 'contrato-anticrise'];

// Mapeamento de produtos por código
const PRODUCT_CODE_MAPPING: Record<string, string> = {
  'A001': 'incorporador',
  'A002': 'incorporador',
  'A003': 'incorporador',
  'A004': 'incorporador',
  'A005': 'incorporador',
  'A008': 'incorporador',
  'A009': 'incorporador',
  'A000': 'incorporador',
  'A006': 'renovacao',
  'A010': 'a010',
};

// Mapeamento por nome de produto (para CSV imports sem código)
const PRODUCT_NAME_PATTERNS: Array<{ pattern: RegExp; category: string }> = [
  // A006 - Renovação (deve vir antes do incorporador para ter prioridade)
  { pattern: /A006|RENOVA[ÇC][ÃA]O\s*PARCEIRO/i, category: 'renovacao' },
  
  // Incorporador products
  { pattern: /A000\s*-?\s*CONTRATO|^CONTRATO$/i, category: 'incorporador' },
  { pattern: /A001|MCF\s*INCORPORADOR/i, category: 'incorporador' },
  { pattern: /A002|A003|A004|A005|A008|A009/i, category: 'incorporador' },
  { pattern: /CONTRATO\s*-?\s*ANTICRISE|ANTICRISE/i, category: 'contrato-anticrise' },
  { pattern: /CONTRATO\s*CREDENCIAMENTO/i, category: 'incorporador' },
  
  // A010
  { pattern: /A010|A010\s*-?\s*INCORPORADOR/i, category: 'a010' },
  
  // Imersão Sócios (excluído do incorporador)
  { pattern: /IMERS[ÃA]O\s*S[ÓO]CIOS/i, category: 'imersao_socios' },
  
  // Order Bumps
  { pattern: /CONSTRUIR\s*PARA\s*ALUGAR|VIVER\s*DE\s*ALUGUEL|COMO\s*VIVER\s*DE\s*ALUGUEL/i, category: 'ob_construir_alugar' },
  { pattern: /ACESSO\s*VITAL[ÍI]CIO|OB\s*-?\s*VITAL[ÍI]CIO/i, category: 'ob_vitalicio' },
  { pattern: /IMERS[ÃA]O\s*PRESENCIAL/i, category: 'ob_evento' },
  
  // Outros produtos
  { pattern: /EFEITO\s*ALAVANCA/i, category: 'efeito_alavanca' },
  { pattern: /CLUBE\s*ARREMATE/i, category: 'clube_arremate' },
];

function mapProductCategory(productName: string, productCode?: string): string {
  const name = productName?.toUpperCase() || '';
  const code = productCode?.toUpperCase()?.trim() || '';
  
  // Tentar match por código primeiro (se existir e for válido)
  if (code && PRODUCT_CODE_MAPPING[code]) {
    return PRODUCT_CODE_MAPPING[code];
  }
  
  // Tentar match por padrões de nome
  for (const { pattern, category } of PRODUCT_NAME_PATTERNS) {
    if (pattern.test(name)) {
      return category;
    }
  }
  
  return 'outros';
}

// Função para parsear valores monetários em formato brasileiro
function parseBRCurrency(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  
  // Remove "R$", espaços e converte formato brasileiro (1.234,56) para número
  const cleaned = value
    .toString()
    .replace(/R\$\s*/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')  // Remove separador de milhar
    .replace(',', '.');   // Converte separador decimal
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

// Extrai valores do raw_data (suporta formato CSV e Webhook)
function extractValues(rawData: any): { grossValue: number; netValue: number; installmentFeeCents: number; subtotalCents: number } {
  if (!rawData) {
    return { grossValue: 0, netValue: 0, installmentFeeCents: 0, subtotalCents: 0 };
  }

  // Detectar formato CSV (campos em português)
  if (rawData['Valor Líquido'] !== undefined || rawData['Valor do produto'] !== undefined) {
    const grossValue = parseBRCurrency(rawData['Valor do produto']) || 
                       parseBRCurrency(rawData['Valor total']) || 0;
    const netValue = parseBRCurrency(rawData['Valor Líquido']) || 0;
    const installmentFee = parseBRCurrency(rawData['Valor do juros de parcelamento']) || 0;
    
    return {
      grossValue: Math.round(grossValue * 100) / 100,
      netValue: Math.round((netValue > 0 ? netValue : grossValue * 0.9417) * 100) / 100,
      installmentFeeCents: Math.round(installmentFee * 100),
      subtotalCents: Math.round(grossValue * 100),
    };
  }

  // Formato Webhook (campos em inglês)
  const invoice = rawData?.event?.invoice || rawData?.invoice || {};
  const amount = invoice?.amount || {};
  const receivers = invoice?.receivers || [];
  
  const subtotalCents = Math.round(amount.subtotalCents || amount.totalCents || 0);
  const installmentFeeCents = Math.round(amount.installmentFeeCents || 0);
  
  const sellerReceiver = receivers.find((r: any) => r.role === 'seller');
  const sellerTotalCents = Math.round(sellerReceiver?.totalCents || 0);

  const grossValue = Math.round(subtotalCents) / 100;
  let netValue = sellerTotalCents > 0 
    ? Math.round(sellerTotalCents - installmentFeeCents) / 100 
    : Math.round(grossValue * 0.9417 * 100) / 100;

  if (netValue <= 0) {
    netValue = Math.round(grossValue * 0.9417 * 100) / 100;
  }

  return { grossValue, netValue, installmentFeeCents: Math.round(installmentFeeCents), subtotalCents: Math.round(subtotalCents) };
}

// Extrai informações de parcelas
function extractInstallmentInfo(rawData: any): { installmentNumber: number; totalInstallments: number } {
  if (!rawData) {
    return { installmentNumber: 1, totalInstallments: 1 };
  }

  // Formato CSV
  if (rawData['Número da parcela'] !== undefined) {
    return {
      installmentNumber: parseInt(rawData['Número da parcela']) || 1,
      totalInstallments: parseInt(rawData['Total de parcelas']) || 1,
    };
  }

  // Formato Webhook
  const invoice = rawData?.event?.invoice || rawData?.invoice || {};
  const smartInstallment = invoice?.smartInstallment || {};
  
  return {
    installmentNumber: smartInstallment.installment || 1,
    totalInstallments: smartInstallment.installments || 1,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { date_start, date_end, dry_run = false, batch_size = 1000 } = await req.json().catch(() => ({}));

    console.log(`🔄 Iniciando reprocessamento de transações Hubla V2...`);
    console.log(`📅 Período: ${date_start || 'início'} até ${date_end || 'fim'}`);
    console.log(`🧪 Dry run: ${dry_run}`);
    console.log(`📦 Batch size: ${batch_size}`);

    const results = {
      total: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      categories_updated: {} as Record<string, number>,
      details: [] as any[],
    };

    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      // Buscar transações em batches com paginação
      let query = supabase
        .from('hubla_transactions')
        .select('*')
        .order('sale_date', { ascending: false })
        .range(offset, offset + batch_size - 1);

      if (date_start) {
        query = query.gte('sale_date', date_start);
      }
      if (date_end) {
        query = query.lte('sale_date', date_end);
      }

      const { data: transactions, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      if (!transactions || transactions.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`📊 Processando batch ${offset / batch_size + 1}: ${transactions.length} transações (offset: ${offset})`);

      for (const tx of transactions) {
        try {
          results.total++;

          const rawData = tx.raw_data;
          const { grossValue, netValue, installmentFeeCents, subtotalCents } = extractValues(rawData);
          const { installmentNumber, totalInstallments } = extractInstallmentInfo(rawData);
          const isOffer = tx.hubla_id?.includes('-offer-') || false;

          // Recategorizar produto baseado no nome (mais confiável que código para imports CSV)
          const newCategory = mapProductCategory(tx.product_name, tx.product_code);

          // Determinar se precisa atualizar
          const needsUpdate = 
            tx.net_value === 0 || 
            tx.net_value === null ||
            tx.product_category !== newCategory ||
            tx.product_category === 'outros' ||
            tx.product_category === null;

          if (!needsUpdate) {
            results.skipped++;
            continue;
          }

          const updateData: any = {
            product_category: newCategory,
          };

          // Só atualizar valores se tivermos dados válidos
          if (grossValue > 0) {
            updateData.product_price = grossValue;
            updateData.subtotal_cents = subtotalCents;
          }

          if (netValue > 0) {
            updateData.net_value = netValue;
          } else if (tx.product_price > 0) {
            // Fallback: calcular net_value baseado no price existente
            updateData.net_value = tx.product_price * 0.9417;
          }

          updateData.installment_fee_cents = installmentFeeCents;
          updateData.installment_number = installmentNumber;
          updateData.total_installments = totalInstallments;
          updateData.is_offer = isOffer;

          // Track category changes
          if (tx.product_category !== newCategory) {
            const key = `${tx.product_category || 'null'} -> ${newCategory}`;
            results.categories_updated[key] = (results.categories_updated[key] || 0) + 1;
          }

          // Salvar detalhes (limitar a 100 para não sobrecarregar resposta)
          if (results.details.length < 100) {
            results.details.push({
              hubla_id: tx.hubla_id,
              product: tx.product_name?.substring(0, 50),
              old_net: tx.net_value,
              new_net: updateData.net_value,
              old_category: tx.product_category,
              new_category: newCategory,
            });
          }

          if (!dry_run) {
            const { error: updateError } = await supabase
              .from('hubla_transactions')
              .update(updateData)
              .eq('id', tx.id);

            if (updateError) {
              console.error(`❌ Erro ao atualizar ${tx.hubla_id}:`, updateError.message);
              results.errors++;
              continue;
            }
          }

          results.updated++;
          
        } catch (err: any) {
          console.error(`❌ Erro processando transação ${tx.hubla_id}:`, err.message);
          results.errors++;
        }
      }

      // Verificar se há mais dados
      if (transactions.length < batch_size) {
        hasMore = false;
      } else {
        offset += batch_size;
      }

      // Log progresso
      console.log(`✅ Progresso: ${results.total} processadas, ${results.updated} atualizadas, ${results.skipped} ignoradas, ${results.errors} erros`);
    }

    console.log(`\n🎉 Reprocessamento concluído!`);
    console.log(`   - Total: ${results.total}`);
    console.log(`   - Atualizados: ${results.updated}`);
    console.log(`   - Ignorados (já corretos): ${results.skipped}`);
    console.log(`   - Erros: ${results.errors}`);
    console.log(`   - Categorias alteradas:`, results.categories_updated);

    return new Response(
      JSON.stringify({
        success: true,
        dry_run,
        results: {
          total: results.total,
          updated: results.updated,
          skipped: results.skipped,
          errors: results.errors,
          categories_updated: results.categories_updated,
          sample_details: results.details.slice(0, 20),
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro fatal:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
