import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { days_back = 7 } = await req.json().catch(() => ({}));

    console.log(`[detect-duplicate-activities] Starting detection for last ${days_back} days`);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days_back);

    // Buscar activities dos últimos N dias que não foram analisadas ainda
    const { data: activities, error: fetchError } = await supabase
      .from('deal_activities')
      .select('id, deal_id, activity_type, to_stage, from_stage, created_at, metadata')
      .eq('activity_type', 'stage_change')
      .gte('created_at', startDate.toISOString())
      .order('deal_id')
      .order('created_at');

    if (fetchError) {
      throw new Error(`Erro ao buscar activities: ${fetchError.message}`);
    }

    console.log(`[detect-duplicate-activities] Found ${activities?.length || 0} activities to analyze`);

    if (!activities || activities.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No activities to analyze',
        stats: { analyzed: 0, duplicates_found: 0, duplicates_marked: 0 }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Agrupar por deal_id para análise
    const byDeal: Record<string, typeof activities> = {};
    for (const act of activities) {
      if (!byDeal[act.deal_id]) byDeal[act.deal_id] = [];
      byDeal[act.deal_id].push(act);
    }

    const duplicatesToInsert: any[] = [];
    const idsToMarkDuplicate: string[] = [];

    // Detectar duplicatas por deal
    for (const dealId in byDeal) {
      const dealActivities = byDeal[dealId];
      
      for (let i = 1; i < dealActivities.length; i++) {
        const current = dealActivities[i];
        const previous = dealActivities[i - 1];

        // Verificar se já está marcado como duplicata
        const currentMeta = current.metadata as Record<string, any> || {};
        if (currentMeta.is_duplicate) continue;

        // Verificar se é duplicata (mesmo to_stage, from_stage, dentro de 60 segundos)
        if (
          current.to_stage === previous.to_stage &&
          current.from_stage === previous.from_stage
        ) {
          const currentTime = new Date(current.created_at).getTime();
          const previousTime = new Date(previous.created_at).getTime();
          const gapSeconds = (currentTime - previousTime) / 1000;

          if (gapSeconds <= 60) {
            // É uma duplicata!
            idsToMarkDuplicate.push(current.id);

            // Verificar se já existe na tabela de duplicatas
            const { data: existing } = await supabase
              .from('deal_activities_duplicates')
              .select('id')
              .eq('duplicate_activity_id', current.id)
              .maybeSingle();

            if (!existing) {
              duplicatesToInsert.push({
                deal_id: dealId,
                original_activity_id: previous.id,
                duplicate_activity_id: current.id,
                from_stage: current.from_stage,
                to_stage: current.to_stage,
                gap_seconds: gapSeconds,
                status: 'pending'
              });
            }
          }
        }
      }
    }

    console.log(`[detect-duplicate-activities] Found ${idsToMarkDuplicate.length} duplicates to mark`);

    // Inserir novos registros na tabela de duplicatas
    let insertedCount = 0;
    if (duplicatesToInsert.length > 0) {
      // Inserir em batches de 100
      for (let i = 0; i < duplicatesToInsert.length; i += 100) {
        const batch = duplicatesToInsert.slice(i, i + 100);
        const { error: insertError } = await supabase
          .from('deal_activities_duplicates')
          .insert(batch);
        
        if (insertError) {
          console.error(`[detect-duplicate-activities] Insert error:`, insertError);
        } else {
          insertedCount += batch.length;
        }
      }
    }

    // Marcar activities com is_duplicate = true no metadata
    let markedCount = 0;
    if (idsToMarkDuplicate.length > 0) {
      for (let i = 0; i < idsToMarkDuplicate.length; i += 50) {
        const batch = idsToMarkDuplicate.slice(i, i + 50);
        
        for (const id of batch) {
          const { error: updateError } = await supabase
            .from('deal_activities')
            .update({ 
              metadata: supabase.rpc('jsonb_set_nested', {
                target: {},
                path: ['is_duplicate'],
                value: true
              })
            })
            .eq('id', id);

          // Fallback: update simples
          if (updateError) {
            // Get current metadata and merge
            const { data: current } = await supabase
              .from('deal_activities')
              .select('metadata')
              .eq('id', id)
              .single();

            const newMetadata = { ...(current?.metadata || {}), is_duplicate: true };
            
            await supabase
              .from('deal_activities')
              .update({ metadata: newMetadata })
              .eq('id', id);
          }
          markedCount++;
        }
      }
    }

    console.log(`[detect-duplicate-activities] Completed: inserted=${insertedCount}, marked=${markedCount}`);

    return new Response(JSON.stringify({
      success: true,
      stats: {
        analyzed: activities.length,
        duplicates_found: idsToMarkDuplicate.length,
        duplicates_inserted: insertedCount,
        duplicates_marked: markedCount
      },
      executed_at: new Date().toISOString()
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[detect-duplicate-activities] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
