import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting metrics recalculation...');

    // Buscar todos os registros de weekly_metrics
    const { data: metrics, error: fetchError } = await supabase
      .from('weekly_metrics')
      .select('*')
      .order('start_date', { ascending: true });

    if (fetchError) throw fetchError;

    console.log(`Found ${metrics?.length || 0} metrics to recalculate`);

    let updated = 0;
    let errors = 0;

    // Processar cada registro
    for (const metric of metrics || []) {
      try {
        // Calcular week_label correto
        const startDate = new Date(metric.start_date);
        const endDate = new Date(metric.end_date);
        
        const formatDate = (date: Date) => {
          const day = String(date.getDate()).padStart(2, '0');
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const year = date.getFullYear();
          return `${day}/${month}/${year}`;
        };

        const week_label = `${formatDate(startDate)} - ${formatDate(endDate)}`;

        // Calcular CPL
        const cpl = metric.a010_sales > 0 
          ? metric.ads_cost / metric.a010_sales 
          : null;

        // Calcular CPLR (usando real_cost que já é calculado automaticamente)
        const cplr = metric.a010_sales > 0 && metric.real_cost
          ? metric.real_cost / metric.a010_sales
          : null;

        // Calcular ROAS (usando total_revenue que já é calculado automaticamente)
        const roas = metric.ads_cost > 0 && metric.total_revenue
          ? metric.total_revenue / metric.ads_cost
          : null;

        // Calcular ROI
        const roi = metric.clint_revenue && metric.operating_profit
          ? (metric.clint_revenue / (metric.clint_revenue - metric.operating_profit)) * 100
          : null;

        // Calcular CIR
        const cir = metric.contract_revenue > 0 && metric.real_cost
          ? (metric.real_cost / metric.contract_revenue) * 100
          : null;

        // Calcular Ultrameta Clint
        const ultrameta_clint = metric.a010_sales && metric.operating_cost
          ? (metric.a010_sales * metric.operating_cost) + ((metric.sdr_ia_ig || 0) * metric.operating_cost / 2)
          : null;

        // Calcular Ultrameta Líquido
        const ultrameta_liquido = metric.a010_sales && metric.total_revenue
          ? (metric.total_revenue * metric.a010_sales) + ((metric.sdr_ia_ig || 0) * metric.total_revenue / 2)
          : null;

        // Atualizar o registro com novos cálculos
        const { error: updateError } = await supabase
          .from('weekly_metrics')
          .update({
            week_label,
            cpl,
            cplr,
            roas,
            roi,
            cir,
            ultrameta_clint,
            ultrameta_liquido,
            updated_at: new Date().toISOString(),
          })
          .eq('id', metric.id);

        if (updateError) {
          console.error(`Error updating metric ${metric.id}:`, updateError);
          errors++;
        } else {
          updated++;
          console.log(`Updated metric for week ${week_label}`);
        }
      } catch (error) {
        console.error(`Error processing metric ${metric.id}:`, error);
        errors++;
      }
    }

    console.log(`Recalculation complete. Updated: ${updated}, Errors: ${errors}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Recalculated ${updated} metrics`,
        updated,
        errors,
        total: metrics?.length || 0,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in recalculate-metrics:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
