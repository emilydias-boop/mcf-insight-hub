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
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // 1. Buscar origens distintas de deals sem stage_id
    const { data: origins, error: originsError } = await supabase
      .from('crm_deals')
      .select('origin_id')
      .is('stage_id', null)
      .not('origin_id', 'is', null);

    if (originsError) throw originsError;

    const uniqueOriginIds = [...new Set((origins || []).map((d: any) => d.origin_id))];
    console.log(`📊 Origens com deals sem estágio: ${uniqueOriginIds.length}`);

    const report: Record<string, { fixed: number; default_stage: string }> = {};
    let totalFixed = 0;

    for (const originId of uniqueOriginIds) {
      // 2. Buscar primeiro estágio ativo da origem
      const { data: defaultStage } = await supabase
        .from('crm_stages')
        .select('id, stage_name')
        .eq('origin_id', originId)
        .eq('is_active', true)
        .order('stage_order', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!defaultStage) {
        console.log(`⚠️ Sem estágio ativo para origin_id: ${originId}`);
        continue;
      }

      // 3. Atualizar deals em batch
      const { data: updated, error: updateError } = await supabase
        .from('crm_deals')
        .update({ stage_id: defaultStage.id })
        .is('stage_id', null)
        .eq('origin_id', originId)
        .select('id');

      if (updateError) {
        console.error(`❌ Erro ao atualizar origin ${originId}:`, updateError);
        continue;
      }

      const count = updated?.length || 0;
      totalFixed += count;
      report[originId] = { fixed: count, default_stage: defaultStage.stage_name };
      console.log(`✅ Origin ${originId}: ${count} deals → "${defaultStage.stage_name}"`);
    }

    const summary = {
      success: true,
      total_fixed: totalFixed,
      origins_processed: uniqueOriginIds.length,
      report,
      timestamp: new Date().toISOString(),
    };

    console.log('📋 Resumo:', JSON.stringify(summary, null, 2));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
