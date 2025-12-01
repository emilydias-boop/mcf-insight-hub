import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função auxiliar para normalizar nomes (remover acentos, trim, uppercase)
function normalizeName(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove acentos
}

// Valores conhecidos dos Order Bumps - Mapeamento expandido
const OB_VALUES: Record<string, { gross: number, net: number, category: string }> = {
  // Order Bumps padrão - Construir
  'CONSTRUIR PARA ALUGAR': { gross: 97, net: 88.15, category: 'ob_construir_alugar' },
  'VIVER DE ALUGUEL': { gross: 97, net: 88.15, category: 'ob_construir_alugar' },
  'VIVENDO DE ALUGUEL': { gross: 97, net: 88.15, category: 'ob_construir_alugar' },
  'CONSTRUIR PARA VENDER': { gross: 47, net: 42.70, category: 'ob_construir_vender' },
  
  // Order Bumps - Vitalício (todas as variações)
  'ACESSO VITALIC': { gross: 57, net: 51.82, category: 'ob_vitalicio' },
  'ACESSO VITALICIO': { gross: 57, net: 51.82, category: 'ob_vitalicio' },
  'VITALICIO': { gross: 57, net: 51.82, category: 'ob_vitalicio' },
  
  // A010 produtos - todos mapeados como categoria a010
  'A010': { gross: 47, net: 42.70, category: 'a010' },
  'A010 - CONSULTORIA': { gross: 47, net: 42.70, category: 'a010' },
  'A010 - CONSTRUA PARA VENDER': { gross: 47, net: 42.70, category: 'a010' },
  'CONSTRUA PARA VENDER': { gross: 47, net: 42.70, category: 'a010' },
  
  // A011 produtos - Captação/Clube do Arremate
  'A011': { gross: 97, net: 88.15, category: 'clube_arremate' },
  'A011 - CAPTACAO': { gross: 97, net: 88.15, category: 'clube_arremate' },
  'CAPTACAO': { gross: 97, net: 88.15, category: 'clube_arremate' },
  
  // A012 produtos
  'A012': { gross: 297, net: 269.88, category: 'a012' },
  
  // Imersões
  'IMERSAO PRESENCIAL': { gross: 97, net: 88.15, category: 'imersao' },
  'IMERSAO': { gross: 97, net: 88.15, category: 'imersao' },
  'IMERSAO SOCIOS': { gross: 197, net: 179.10, category: 'imersao_socios' },
  
  // Produtos Incorporador (A001-A009, Contrato)
  'A001': { gross: 997, net: 906.17, category: 'incorporador' },
  'A001 - MCF INCORPORADOR': { gross: 997, net: 906.17, category: 'incorporador' },
  'A002': { gross: 997, net: 906.17, category: 'incorporador' },
  'A003': { gross: 997, net: 906.17, category: 'incorporador' },
  'A004': { gross: 1497, net: 1359.73, category: 'incorporador' },
  'A005': { gross: 1997, net: 1813.29, category: 'incorporador' },
  'A006': { gross: 1497, net: 1359.73, category: 'incorporador' },
  'A007': { gross: 197, net: 179.10, category: 'imersao_socios' },
  'A007 - IMERSAO SOCIOS': { gross: 197, net: 179.10, category: 'imersao_socios' },
  'A008': { gross: 997, net: 906.17, category: 'incorporador' },
  'A009': { gross: 1497, net: 1359.73, category: 'incorporador' },
  'A009 - MCF INCORPORADOR': { gross: 1497, net: 1359.73, category: 'incorporador' },
  'CONTRATO': { gross: 997, net: 906.17, category: 'incorporador' },
  'CONTRATO - ANTICRISE': { gross: 997, net: 906.17, category: 'incorporador' },
  
  // Sócio MCF
  'SOCIO MCF': { gross: 197, net: 179.10, category: 'socios' },
  
  // Efeito Alavanca / Clube Arremate
  'EFEITO ALAVANCA': { gross: 297, net: 269.88, category: 'efeito_alavanca' },
  'CONTRATO - EFEITO ALAVANCA': { gross: 297, net: 269.88, category: 'efeito_alavanca' },
  'CONTRATO - CLUBE DO ARREMATE': { gross: 297, net: 269.88, category: 'clube_arremate' },
  'CLUBE DO ARREMATE': { gross: 297, net: 269.88, category: 'clube_arremate' },
  
  // Ingressos de eventos
  'INGRESSO': { gross: 97, net: 88.15, category: 'outros' },
  'EVENTO': { gross: 97, net: 88.15, category: 'outros' },
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

    // 1. Buscar TODAS as transações com paginação
    let allTransactions: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    console.log('📥 Carregando transações em lotes...');
    
    while (hasMore) {
      const { data: batch, error: batchError } = await supabase
        .from('hubla_transactions')
        .select('*')
        .eq('event_type', 'invoice.payment_succeeded')
        .not('hubla_id', 'ilike', '%-offer-%')
        .range(from, from + pageSize - 1);
      
      if (batchError) {
        console.error('❌ Erro ao buscar lote de transações:', batchError);
        throw batchError;
      }
      
      if (batch && batch.length > 0) {
        allTransactions = [...allTransactions, ...batch];
        from += pageSize;
        hasMore = batch.length === pageSize;
        console.log(`   ✓ ${allTransactions.length} transações carregadas...`);
      } else {
        hasMore = false;
      }
    }

    const transactions = allTransactions;
    console.log(`📊 ${transactions.length} transações totais carregadas`);

    // 2. Filtrar apenas as que têm Order Bumps
    const transactionsWithOB = transactions.filter(t => {
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
          const normalizedName = normalizeName(obName);
          let obData = null;
          
          // Identificar OB pelo nome (matching por substring/keyword)
          for (const [key, values] of Object.entries(OB_VALUES)) {
            const normalizedKey = normalizeName(key);
            if (normalizedName.includes(normalizedKey) || normalizedKey.includes(normalizedName)) {
              obData = values;
              console.log(`   🔍 Match encontrado: "${obName}" -> "${key}" (${values.category})`);
              break;
            }
          }
          
          // Fallback para OBs não reconhecidos
          if (!obData) {
            obData = { gross: 97, net: 88.15, category: 'outros' };
            console.log(`   ⚠️ OB sem categoria específica: "${obName}" -> outros`);
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
    
    // Buscar data mais antiga
    const { data: minDateData } = await supabase
      .from('hubla_transactions')
      .select('sale_date')
      .order('sale_date', { ascending: true })
      .limit(1)
      .single();

    // Buscar data mais recente  
    const { data: maxDateData } = await supabase
      .from('hubla_transactions')
      .select('sale_date')
      .order('sale_date', { ascending: false })
      .limit(1)
      .single();
    
    if (minDateData && maxDateData) {
      const startDate = new Date(minDateData.sale_date).toISOString().split('T')[0];
      const endDate = new Date(maxDateData.sale_date).toISOString().split('T')[0];
      
      console.log(`📅 Range de recálculo: ${startDate} até ${endDate}`);
      
      await supabase.functions.invoke('recalculate-metrics', {
        body: {
          start_date: startDate,
          end_date: endDate,
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
