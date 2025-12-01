import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Valores conhecidos dos Order Bumps
const OB_VALUES: Record<string, { gross: number, net: number, category: string }> = {
  'CONSTRUIR PARA ALUGAR': { gross: 97, net: 88.15, category: 'ob_construir_alugar' },
  'VIVER DE ALUGUEL': { gross: 97, net: 88.15, category: 'ob_construir_alugar' },
  'ACESSO VITALIC': { gross: 57, net: 51.82, category: 'ob_vitalicio' },
  'ACESSO VITALÍCIO': { gross: 57, net: 51.82, category: 'ob_vitalicio' },
  'VITALÍCIO': { gross: 57, net: 51.82, category: 'ob_vitalicio' },
  'CONSTRUIR PARA VENDER': { gross: 47, net: 42.70, category: 'ob_construir_vender' },
  // Novos produtos identificados nos dados reais
  'A010': { gross: 47, net: 42.70, category: 'a010' },
  'A010 - CONSULTORIA': { gross: 47, net: 42.70, category: 'a010' },
  'A011': { gross: 97, net: 88.15, category: 'clube_arremate' },
  'A011 - CAPTAÇÃO': { gross: 97, net: 88.15, category: 'clube_arremate' },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log('🔧 Iniciando correção de Order Bumps históricos...');

    // 1. Buscar todas as transações invoice.payment_succeeded (sem filtrar por raw_data na query)
    const { data: transactions, error: fetchError } = await supabase
      .from('hubla_transactions')
      .select('*')
      .eq('event_type', 'invoice.payment_succeeded')
      .not('product_name', 'like', '%-offer-%');

    if (fetchError) {
      console.error('❌ Erro ao buscar transações:', fetchError);
      throw fetchError;
    }

    console.log(`📊 ${transactions?.length || 0} transações encontradas`);

    // Filtrar apenas as que têm Order Bumps
    const transactionsWithOB = (transactions || []).filter(t => {
      try {
        const rawData = typeof t.raw_data === 'string' ? JSON.parse(t.raw_data) : t.raw_data;
        const obField = rawData?.['Nome do produto de orderbump'];
        return obField && obField !== '';
      } catch {
        return false;
      }
    });

    console.log(`📦 ${transactionsWithOB.length} transações com Order Bumps identificadas`);

    let correctedCount = 0;
    let createdObCount = 0;
    let skippedCount = 0;

    // Processar em batches de 100 para evitar timeout
    const BATCH_SIZE = 100;
    const totalBatches = Math.ceil(transactionsWithOB.length / BATCH_SIZE);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, transactionsWithOB.length);
      const batch = transactionsWithOB.slice(start, end);
      
      console.log(`\n📦 Processando batch ${batchIndex + 1}/${totalBatches} (${start + 1}-${end} de ${transactionsWithOB.length})`);

      for (const transaction of batch) {
      try {
        // Garantir que raw_data seja um objeto válido
        let rawData: any = {};
        try {
          if (typeof transaction.raw_data === 'string') {
            rawData = JSON.parse(transaction.raw_data);
          } else if (transaction.raw_data && typeof transaction.raw_data === 'object') {
            rawData = transaction.raw_data;
          }
        } catch (parseError) {
          console.error(`⚠️ raw_data inválido para ${transaction.hubla_id}:`, parseError);
          skippedCount++;
          continue;
        }
        
        const orderbumpNamesStr = rawData['Nome do produto de orderbump'] || '';
        
        if (!orderbumpNamesStr) {
          skippedCount++;
          continue;
        }

        const orderbumps = orderbumpNamesStr.split(',').map((s: string) => s.trim()).filter(Boolean);
        
        if (orderbumps.length === 0) {
          skippedCount++;
          continue;
        }

        console.log(`\n📦 Processando: ${transaction.hubla_id}`);
        console.log(`   OBs: ${orderbumps.join(', ')}`);

        // Verificar se já existem transações de offer
        const { data: existingOffers } = await supabase
          .from('hubla_transactions')
          .select('hubla_id')
          .like('hubla_id', `${transaction.hubla_id}-offer-%`);

        if (existingOffers && existingOffers.length > 0) {
          console.log(`   ⏭️ Já possui ${existingOffers.length} offers criados`);
          skippedCount++;
          continue;
        }

        // Criar transações para cada Order Bump
        const obTransactions: any[] = [];
        let totalObPrice = 0;

        orderbumps.forEach((obName: string, index: number) => {
          const obNameUpper = obName.toUpperCase();
          let obData = null;
          
          // Identificar OB pelo nome
          for (const [key, values] of Object.entries(OB_VALUES)) {
            if (obNameUpper.includes(key)) {
              obData = values;
              break;
            }
          }
          
          if (!obData) {
            console.log(`   ⚠️ OB desconhecido: ${obName}`);
            return;
          }

          totalObPrice += obData.gross;
          
          // Criar raw_data minimalista para evitar problemas de serialização
          const safeRawData = {
            source: 'csv_import',
            order_bump_name: obName,
            order_bump_index: index + 1,
            corrected_by_fix_script: true,
            original_transaction_id: String(transaction.hubla_id)
          };
          
          obTransactions.push({
            hubla_id: `${transaction.hubla_id}-offer-${index + 1}`,
            product_name: obName,
            product_code: null,
            product_category: obData.category,
            product_price: obData.gross,
            product_type: 'offer',
            customer_name: transaction.customer_name || null,
            customer_email: transaction.customer_email || null,
            customer_phone: transaction.customer_phone || null,
            utm_source: transaction.utm_source || null,
            utm_medium: transaction.utm_medium || null,
            utm_campaign: transaction.utm_campaign || null,
            payment_method: transaction.payment_method || null,
            sale_date: transaction.sale_date,
            sale_status: transaction.sale_status || 'completed',
            event_type: transaction.event_type || 'csv_import',
            raw_data: safeRawData,
          });

          console.log(`   ✅ Criando OB ${index + 1}: ${obName} - ${obData.category} - R$ ${obData.gross}`);
        });

        // Inserir as transações dos OBs
        if (obTransactions.length > 0) {
          console.log(`   📤 Inserindo ${obTransactions.length} Order Bumps...`);
          
          const { error: insertError } = await supabase
            .from('hubla_transactions')
            .insert(obTransactions);

          if (insertError) {
            console.error(`   ❌ Erro ao inserir OBs:`, insertError);
            console.error(`   📋 Transação problemática:`, transaction.hubla_id);
            console.error(`   📋 Dados tentados:`, JSON.stringify(obTransactions[0], null, 2));
            continue;
          }

          createdObCount += obTransactions.length;
          console.log(`   ✅ ${obTransactions.length} OBs inseridos com sucesso`);
        }

        // Atualizar transação principal (se for A010, ajustar para R$47)
        if (transaction.product_category === 'a010') {
          const newMainPrice = 47;
          console.log(`   🔄 Ajustando produto principal de R$ ${transaction.product_price} para R$ ${newMainPrice}`);
          
          // Criar raw_data minimalista
          const safeMainRawData = {
            source: 'csv_import',
            corrected_by_fix_script: true,
            original_price: Number(transaction.product_price)
          };
          
          const { error: updateError } = await supabase
            .from('hubla_transactions')
            .update({
              product_price: newMainPrice,
              raw_data: safeMainRawData,
            })
            .eq('hubla_id', transaction.hubla_id);
          
          if (updateError) {
            console.error(`   ❌ Erro ao atualizar transação principal:`, updateError);
            console.error(`   📋 Transação: ${transaction.hubla_id}`);
          } else {
            console.log(`   ✅ Transação principal atualizada`);
          }
        }

        correctedCount++;
        console.log(`   ✅ Correção concluída`);

        } catch (error) {
          console.error(`❌ Erro ao processar transação ${transaction.hubla_id}:`, error);
          skippedCount++;
        }
      }
      
      console.log(`✅ Batch ${batchIndex + 1}/${totalBatches} concluído`);
    }

    console.log('\n📊 Resumo da Correção:');
    console.log(`   ✅ ${correctedCount} transações corrigidas`);
    console.log(`   📦 ${createdObCount} Order Bumps criados`);
    console.log(`   ⏭️ ${skippedCount} transações ignoradas`);

    // Recalcular métricas após correção
    console.log('\n🔄 Recalculando métricas...');
    const { data: dates } = await supabase
      .from('hubla_transactions')
      .select('sale_date')
      .order('sale_date', { ascending: true });
    
    if (dates && dates.length > 0) {
      const minDate = new Date(dates[0].sale_date);
      const maxDate = new Date(dates[dates.length - 1].sale_date);
      
      await supabase.functions.invoke('recalculate-metrics', {
        body: {
          start_date: minDate.toISOString().split('T')[0],
          end_date: maxDate.toISOString().split('T')[0],
        },
      });
      
      console.log('✅ Recálculo de métricas iniciado');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Correção de Order Bumps concluída',
        summary: {
          correctedTransactions: correctedCount,
          createdOrderBumps: createdObCount,
          skippedTransactions: skippedCount,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro na correção:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
