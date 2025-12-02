import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Produtos que ENTRAM no Incorporador 50k (A006 EXCLUÍDO - é renovação)
const INCORPORADOR_50K_CATEGORIES = ['incorporador', 'contrato-anticrise'];

// A006 é renovação, NÃO incorporador
const PRODUCT_MAPPING: Record<string, string> = {
  'A001': 'incorporador',
  'A002': 'incorporador',
  'A003': 'incorporador',
  'A004': 'incorporador',
  'A005': 'incorporador',
  'A008': 'incorporador',
  'A009': 'incorporador',
  'A000': 'incorporador',
  'CONTRATO': 'incorporador',
  'CONTRATO - ANTICRISE': 'contrato-anticrise',
  'ANTICRISE': 'contrato-anticrise',
  'A006': 'renovacao',
  'RENOVAÇÃO PARCEIRO': 'renovacao',
  'A010': 'a010',
  'A010 - INCORPORADOR': 'a010',
  'CONSTRUIR PARA ALUGAR': 'ob_construir_alugar',
  'VIVER DE ALUGUEL': 'ob_construir_alugar',
  'COMO VIVER DE ALUGUEL': 'ob_construir_alugar',
  'ACESSO VITALÍCIO': 'ob_vitalicio',
  'OB - VITALÍCIO': 'ob_vitalicio',
  'IMERSÃO PRESENCIAL': 'ob_evento',
  'IMERSÃO SÓCIOS': 'imersao_socios',
  'IMERSÃO SÓCIOS MCF': 'imersao_socios',
  'EFEITO ALAVANCA': 'efeito_alavanca',
  'CLUBE ARREMATE': 'clube_arremate',
};

function mapProductCategory(productName: string, productCode?: string): string {
  const name = productName?.toUpperCase() || '';
  const code = productCode?.toUpperCase() || '';
  
  // Verificar produtos específicos que devem ser excluídos do incorporador
  if (name.includes('IMERSÃO SÓCIOS') || name.includes('IMERSAO SOCIOS')) {
    return 'imersao_socios';
  }
  
  // A006 é renovação
  if (code === 'A006' || name.includes('RENOVAÇÃO PARCEIRO')) {
    return 'renovacao';
  }
  
  // Tentar match por código primeiro
  if (code && PRODUCT_MAPPING[code]) {
    return PRODUCT_MAPPING[code];
  }
  
  // Tentar match por nome
  if (PRODUCT_MAPPING[name]) {
    return PRODUCT_MAPPING[name];
  }
  
  // Match parcial
  for (const [key, category] of Object.entries(PRODUCT_MAPPING)) {
    if (name.includes(key) || (code && code.includes(key))) {
      return category;
    }
  }
  
  return 'outros';
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
    const { date_start, date_end, dry_run = false } = await req.json().catch(() => ({}));

    console.log(`🔄 Iniciando reprocessamento de transações Hubla...`);
    console.log(`📅 Período: ${date_start || 'início'} até ${date_end || 'fim'}`);
    console.log(`🧪 Dry run: ${dry_run}`);

    // Buscar todas as transações com raw_data
    let query = supabase
      .from('hubla_transactions')
      .select('*')
      .not('raw_data', 'is', null)
      .order('sale_date', { ascending: false });

    if (date_start) {
      query = query.gte('sale_date', date_start);
    }
    if (date_end) {
      query = query.lte('sale_date', date_end);
    }

    const { data: transactions, error: fetchError } = await query;

    if (fetchError) throw fetchError;

    console.log(`📊 Encontradas ${transactions?.length || 0} transações para processar`);

    const results = {
      total: transactions?.length || 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      details: [] as any[],
    };

    for (const tx of transactions || []) {
      try {
        const rawData = tx.raw_data as any;
        const invoice = rawData?.event?.invoice || rawData?.invoice || {};
        const amount = invoice?.amount || {};
        const receivers = invoice?.receivers || [];
        const smartInstallment = invoice?.smartInstallment || {};

        // Extrair valores corretos
        const subtotalCents = amount.subtotalCents || amount.totalCents || 0;
        const installmentFeeCents = amount.installmentFeeCents || 0;
        
        const sellerReceiver = receivers.find((r: any) => r.role === 'seller');
        const sellerTotalCents = sellerReceiver?.totalCents || 0;

        // Calcular valores
        const grossValue = subtotalCents / 100;
        let netValue = sellerTotalCents > 0 
          ? (sellerTotalCents - installmentFeeCents) / 100 
          : grossValue * 0.9417;

        // Se o net_value for negativo ou zero, usar fallback
        if (netValue <= 0) {
          netValue = grossValue * 0.9417;
        }

        const installmentNumber = smartInstallment.installment || 1;
        const totalInstallments = smartInstallment.installments || 1;
        const isOffer = tx.hubla_id?.includes('-offer-') || false;

        // Recategorizar produto
        const newCategory = mapProductCategory(tx.product_name, tx.product_code);

        const updateData = {
          product_price: grossValue > 0 ? grossValue : tx.product_price,
          net_value: netValue,
          subtotal_cents: subtotalCents,
          installment_fee_cents: installmentFeeCents,
          installment_number: installmentNumber,
          total_installments: totalInstallments,
          is_offer: isOffer,
          product_category: newCategory,
        };

        const changed = 
          tx.net_value !== updateData.net_value ||
          tx.product_category !== updateData.product_category ||
          tx.subtotal_cents !== updateData.subtotal_cents;

        if (!changed) {
          results.skipped++;
          continue;
        }

        results.details.push({
          hubla_id: tx.hubla_id,
          customer: tx.customer_name,
          product: tx.product_name,
          old_price: tx.product_price,
          new_price: updateData.product_price,
          old_net: tx.net_value,
          new_net: updateData.net_value,
          old_category: tx.product_category,
          new_category: updateData.product_category,
          installment: `${installmentNumber}/${totalInstallments}`,
        });

        if (!dry_run) {
          const { error: updateError } = await supabase
            .from('hubla_transactions')
            .update(updateData)
            .eq('id', tx.id);

          if (updateError) {
            console.error(`❌ Erro ao atualizar ${tx.hubla_id}:`, updateError);
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

    console.log(`✅ Reprocessamento concluído:`);
    console.log(`   - Total: ${results.total}`);
    console.log(`   - Atualizados: ${results.updated}`);
    console.log(`   - Ignorados (sem alteração): ${results.skipped}`);
    console.log(`   - Erros: ${results.errors}`);

    return new Response(
      JSON.stringify({
        success: true,
        dry_run,
        results,
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
