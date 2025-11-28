import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const payload = await req.json();
    console.log('📊 Recebendo custo de ads:', payload);

    const { date, amount, source = 'facebook', campaign_name } = payload;

    if (!date || amount === undefined) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: date, amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse amount se vier como string brasileira
    let parsedAmount = typeof amount === 'string' 
      ? parseFloat(amount.replace(/[^\d,]/g, '').replace(',', '.'))
      : amount;

    // Upsert no banco
    const { data, error } = await supabase
      .from('daily_costs')
      .upsert({
        date,
        cost_type: 'ads',
        source,
        amount: parsedAmount,
        campaign_name,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'date,cost_type,source'
      })
      .select();

    if (error) {
      console.error('❌ Erro ao inserir custo:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Custo registrado:', data);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Custo de ads registrado com sucesso',
        data 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro no webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
