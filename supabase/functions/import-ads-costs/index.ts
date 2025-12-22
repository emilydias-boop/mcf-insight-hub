import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AdCostInput {
  date: string; // DD/MM/YYYY
  amount: string; // R$ X.XXX,XX
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
    const { costs } = await req.json() as { costs: AdCostInput[] };
    
    console.log(`📊 Importando ${costs.length} registros de custos de ads`);

    const parsedCosts = costs.map(cost => {
      // Parse date DD/MM/YYYY → YYYY-MM-DD
      const [day, month, year] = cost.date.split('/');
      const parsedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      
      // Parse amount R$ X.XXX,XX → number
      let parsedAmount = 0;
      if (cost.amount && cost.amount.trim() !== '') {
        parsedAmount = parseFloat(
          cost.amount
            .replace('R$', '')
            .replace(/\s/g, '')
            .replace(/\./g, '')
            .replace(',', '.')
            .trim()
        ) || 0;
      }

      // Validação: valores diários acima de R$ 50k são suspeitos
      if (parsedAmount > 50000) {
        console.warn(`⚠️ VALOR ALTO DETECTADO para ${parsedDate}: R$ ${parsedAmount.toFixed(2)} - Verificar se está correto!`);
      }

      return {
        date: parsedDate,
        cost_type: 'ads',
        source: 'facebook',
        amount: parsedAmount,
        updated_at: new Date().toISOString(),
      };
    });

    // Batch upsert em grupos de 100 para evitar timeout
    const batchSize = 100;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < parsedCosts.length; i += batchSize) {
      const batch = parsedCosts.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('daily_costs')
        .upsert(batch, {
          onConflict: 'date,cost_type,source'
        });

      if (error) {
        console.error(`❌ Erro no batch ${i / batchSize + 1}:`, error);
        errorCount += batch.length;
      } else {
        successCount += batch.length;
        console.log(`✅ Batch ${i / batchSize + 1} importado: ${batch.length} registros`);
      }
    }

    console.log(`✅ Importação completa: ${successCount} sucesso, ${errorCount} erros`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Custos de ads importados com sucesso',
        results: {
          total: costs.length,
          success: successCount,
          errors: errorCount,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro na importação:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
