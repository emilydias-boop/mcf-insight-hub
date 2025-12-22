import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";

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

    return new Response(
      JSON.stringify({
        success: true,
        message: `Custo Ads de ${date} corrigido de R$ ${current?.amount} para R$ ${correct_amount}`,
        old_value: current?.amount,
        new_value: correct_amount,
        data
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
