import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Converte valores BR (R$ 1.234,56) para número
function parseBRNumber(value: string | number): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  const cleaned = String(value)
    .replace(/R\$\s?/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();
  
  return parseFloat(cleaned) || 0;
}

// Converte percentual BR (12,5%) para número
function parseBRPercent(value: string | number): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  const cleaned = String(value)
    .replace(/%/g, '')
    .replace(',', '.')
    .trim();
  
  return parseFloat(cleaned) || 0;
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
    const { metrics } = await req.json();

    if (!Array.isArray(metrics) || metrics.length === 0) {
      throw new Error('Dados inválidos: esperado array de métricas');
    }

    console.log(`📊 Importando ${metrics.length} semanas de métricas...`);

    let imported = 0;
    let updated = 0;
    let errors = 0;

    for (const metric of metrics) {
      try {
        const record = {
          start_date: metric.start_date,
          end_date: metric.end_date,
          week_label: metric.week_label,
          
          // Custos
          ads_cost: parseBRNumber(metric.ads_cost),
          team_cost: parseBRNumber(metric.team_cost),
          office_cost: parseBRNumber(metric.office_cost),
          total_cost: parseBRNumber(metric.total_cost),
          
          // Vendas A010
          a010_revenue: parseBRNumber(metric.a010_revenue),
          a010_sales: parseInt(metric.a010_sales) || 0,
          sdr_ia_ig: parseInt(metric.sdr_ia_ig) || 0,
          
          // Order Bumps
          ob_construir_revenue: parseBRNumber(metric.ob_construir_revenue),
          ob_construir_sales: parseInt(metric.ob_construir_sales) || 0,
          ob_vitalicio_revenue: parseBRNumber(metric.ob_vitalicio_revenue),
          ob_vitalicio_sales: parseInt(metric.ob_vitalicio_sales) || 0,
          ob_evento_revenue: parseBRNumber(metric.ob_evento_revenue),
          ob_evento_sales: parseInt(metric.ob_evento_sales) || 0,
          
          // Contratos
          contract_revenue: parseBRNumber(metric.contract_revenue),
          contract_sales: parseInt(metric.contract_sales) || 0,
          
          // Clint
          ultrameta_clint: parseBRNumber(metric.ultrameta_clint),
          clint_revenue: parseBRNumber(metric.clint_revenue),
          incorporador_50k: parseBRNumber(metric.incorporador_50k),
          
          // Métricas
          roi: parseBRPercent(metric.roi),
          roas: parseBRPercent(metric.roas),
          cpl: parseBRNumber(metric.cpl),
          cplr: parseBRNumber(metric.cplr),
          
          // Funil
          stage_01_target: parseInt(metric.stage_01_target) || 0,
          stage_01_actual: parseInt(metric.stage_01_actual) || 0,
          stage_01_rate: parseBRPercent(metric.stage_01_rate),
          
          stage_02_target: parseInt(metric.stage_02_target) || 0,
          stage_02_actual: parseInt(metric.stage_02_actual) || 0,
          stage_02_rate: parseBRPercent(metric.stage_02_rate),
          
          stage_03_target: parseInt(metric.stage_03_target) || 0,
          stage_03_actual: parseInt(metric.stage_03_actual) || 0,
          stage_03_rate: parseBRPercent(metric.stage_03_rate),
          
          stage_04_target: parseInt(metric.stage_04_target) || 0,
          stage_04_actual: parseInt(metric.stage_04_actual) || 0,
          stage_04_rate: parseBRPercent(metric.stage_04_rate),
          
          stage_05_target: parseInt(metric.stage_05_target) || 0,
          stage_05_actual: parseInt(metric.stage_05_actual) || 0,
          stage_05_rate: parseBRPercent(metric.stage_05_rate),
          
          stage_06_target: parseInt(metric.stage_06_target) || 0,
          stage_06_actual: parseInt(metric.stage_06_actual) || 0,
          stage_06_rate: parseBRPercent(metric.stage_06_rate),
          
          stage_07_target: parseInt(metric.stage_07_target) || 0,
          stage_07_actual: parseInt(metric.stage_07_actual) || 0,
          stage_07_rate: parseBRPercent(metric.stage_07_rate),
          
          stage_08_target: parseInt(metric.stage_08_target) || 0,
          stage_08_actual: parseInt(metric.stage_08_actual) || 0,
          stage_08_rate: parseBRPercent(metric.stage_08_rate),
        };

        // Upsert (inserir ou atualizar)
        const { error } = await supabase
          .from('weekly_metrics')
          .upsert(record, {
            onConflict: 'start_date,end_date',
          });

        if (error) throw error;

        imported++;
      } catch (error: any) {
        console.error(`❌ Erro ao importar métrica:`, error.message);
        errors++;
      }
    }

    console.log(`✅ Importação concluída: ${imported} importadas, ${errors} erros`);

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        updated,
        errors,
        total: metrics.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('❌ Erro na importação:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
