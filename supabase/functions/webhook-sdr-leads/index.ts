import { createClient } from "npm:@supabase/supabase-js@2";

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
    console.log('📊 Recebendo dados SDR/Leads:', payload);

    const { week_start, week_end, sdr_ia_ig } = payload;

    if (!week_start || !week_end || sdr_ia_ig === undefined) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: week_start, week_end, sdr_ia_ig' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atualizar weekly_metrics com dados de SDR
    const { data: existingWeek } = await supabase
      .from('weekly_metrics')
      .select('id')
      .eq('start_date', week_start)
      .eq('end_date', week_end)
      .single();

    if (existingWeek) {
      const { error } = await supabase
        .from('weekly_metrics')
        .update({
          sdr_ia_ig,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingWeek.id);

      if (error) {
        console.error('❌ Erro ao atualizar SDR:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Criar nova semana se não existe
      const { error } = await supabase
        .from('weekly_metrics')
        .insert({
          start_date: week_start,
          end_date: week_end,
          week_label: `${week_start} - ${week_end}`,
          sdr_ia_ig,
        });

      if (error) {
        console.error('❌ Erro ao criar semana:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('✅ SDR/Leads registrado');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'SDR/Leads registrado com sucesso' 
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
