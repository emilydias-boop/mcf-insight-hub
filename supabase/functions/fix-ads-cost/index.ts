import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const payload = await req.json();
    const { date, correct_amount } = payload;

    if (!date || correct_amount === undefined) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: date, correct_amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔧 Corrigindo custo Ads de ${date} para R$ ${correct_amount}`);

    // Buscar valor atual
    const { data: current } = await supabase
      .from('daily_costs')
      .select('*')
      .eq('date', date)
      .eq('cost_type', 'ads')
      .single();

    console.log(`📊 Valor atual: R$ ${current?.amount || 'N/A'}`);

    // Atualizar valor
    const { data, error } = await supabase
      .from('daily_costs')
      .update({ amount: correct_amount, updated_at: new Date().toISOString() })
      .eq('date', date)
      .eq('cost_type', 'ads')
      .select();

    if (error) {
      console.error('❌ Erro ao atualizar:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Corrigido: R$ ${current?.amount} → R$ ${correct_amount}`);

    // Recalcular métricas da semana automaticamente
    const dateObj = new Date(date + 'T12:00:00Z');
    const dayOfWeek = dateObj.getUTCDay();
    // Encontrar sábado anterior (início da semana)
    const daysToSaturday = (dayOfWeek + 1) % 7;
    const weekStart = new Date(dateObj);
    weekStart.setUTCDate(dateObj.getUTCDate() - daysToSaturday);
    // Encontrar sexta seguinte (fim da semana)
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    console.log(`🔄 Recalculando métricas da semana ${weekStartStr} a ${weekEndStr}...`);

    // Chamar calculate-weekly-metrics
    const calcResponse = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/calculate-weekly-metrics`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ week_start: weekStartStr, week_end: weekEndStr }),
      }
    );

    const calcResult = await calcResponse.json();
    console.log(`✅ Métricas recalculadas:`, calcResult);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Custo Ads de ${date} corrigido de R$ ${current?.amount} para R$ ${correct_amount}`,
        old_value: current?.amount,
        new_value: correct_amount,
        data,
        metrics_recalculated: {
          week_start: weekStartStr,
          week_end: weekEndStr,
          result: calcResult
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
